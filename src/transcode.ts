import { mkdirSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import { hasFfmpeg, type PlaybackQuality } from './ffmpeg.js';
import { seekWindowStart } from './hls-seek.js';

export interface TranscodeState {
  status: 'idle'|'starting'|'running'|'ready'|'error';
  error?: string;
  playlist: string;
  bufferedUntil?: number;
  complete?: boolean;
  startTime?: number;
}

export interface TranscodeOptions {
  audioStream?: number;
  copyVideo?: boolean;
  startTime?: number;
}

export interface AudioTranscodeState {
  status: 'idle'|'starting'|'running'|'ready'|'error';
  error?: string;
  url: string;
}

export interface AdaptiveTranscodeState {
  status: 'idle'|'starting'|'running'|'ready'|'error';
  error?: string;
  playlist: string;
  variants: Array<PlaybackQuality & { url: string }>;
  bufferedUntil?: number;
  complete?: boolean;
  startTime?: number;
}

export interface AdaptiveTranscodeOptions {
  audioStream?: number;
  hasAudio: boolean;
  sourceWidth: number;
  sourceHeight: number;
  qualities: PlaybackQuality[];
  startTime?: number;
}

const jobs = new Map<string, { child: ChildProcess; state: TranscodeState }>();
const audioJobs = new Map<string, { child: ChildProcess; state: AudioTranscodeState }>();
const adaptiveJobs = new Map<string, { child: ChildProcess; state: AdaptiveTranscodeState }>();

export function hlsDir(dataDir:string,id:number){return join(dataDir,'cache','hls',String(id));}
function variantName(audioStream?:number){return Number.isInteger(audioStream) ? `audio-${audioStream}` : 'default';}
function windowDir(dataDir:string,id:number,startTime=0){return startTime>0?join(hlsDir(dataDir,id),'seek',String(startTime)):hlsDir(dataDir,id);}
function windowUrl(id:number,startTime=0){return startTime>0?`/hls/${id}/seek/${startTime}`:`/hls/${id}`;}
function jobKey(id:number,audioStream?:number,startTime=0){return `${id}:${variantName(audioStream)}:${startTime}`;}
export function hlsVariantDir(dataDir:string,id:number,audioStream?:number,startTime=0){return join(windowDir(dataDir,id,startTime),variantName(audioStream));}
export function hlsPlaylist(dataDir:string,id:number,audioStream?:number,startTime=0){return join(hlsVariantDir(dataDir,id,audioStream,startTime),'index.m3u8');}
function playlistUrl(id:number,audioStream?:number,startTime=0){return `${windowUrl(id,startTime)}/${variantName(audioStream)}/index.m3u8`;}
function audioDir(dataDir:string,id:number){return join(dataDir,'cache','audio',String(id));}
function audioVariantDir(dataDir:string,id:number,audioStream:number){return join(audioDir(dataDir,id),`stream-${audioStream}`);}
function audioPlaylist(dataDir:string,id:number,audioStream:number){return join(audioVariantDir(dataDir,id,audioStream),'index.m3u8');}
function audioUrl(id:number,audioStream:number){return `/audio/${id}/stream-${audioStream}/index.m3u8`;}
function adaptiveName(audioStream?:number){return Number.isInteger(audioStream)?`adaptive-audio-${audioStream}`:'adaptive-default';}
function adaptiveKey(id:number,audioStream?:number,startTime=0){return `${id}:${adaptiveName(audioStream)}:${startTime}`;}
function adaptiveDir(dataDir:string,id:number,audioStream?:number,startTime=0){return join(windowDir(dataDir,id,startTime),adaptiveName(audioStream));}
function adaptivePlaylist(dataDir:string,id:number,audioStream?:number,startTime=0){return join(adaptiveDir(dataDir,id,audioStream,startTime),'master.m3u8');}
function adaptiveUrl(id:number,audioStream?:number,startTime=0){return `${windowUrl(id,startTime)}/${adaptiveName(audioStream)}/master.m3u8`;}
function adaptiveVariants(id:number,audioStream:number|undefined,qualities:PlaybackQuality[],startTime=0){
  return qualities.map((quality)=>({...quality,url:`${windowUrl(id,startTime)}/${adaptiveName(audioStream)}/${quality.height}/index.m3u8`}));
}

// FFmpeg publishes playlists atomically. Only advertise media whose segment files
// are already present; a playlist alone does not mean playback is possible.
function playlistProgress(playlist:string){
  try{
    const content=readFileSync(playlist,'utf8');
    const lines=content.split(/\r?\n/);
    let duration=0;
    let segmentDuration=0;
    let segments=0;
    for(const line of lines){
      if(line.startsWith('#EXTINF:'))segmentDuration=Number.parseFloat(line.slice(8));
      else if(line&& !line.startsWith('#')){
        if(!Number.isFinite(segmentDuration)||segmentDuration<=0||!existsSync(join(dirname(playlist),line)))return null;
        duration+=segmentDuration;segments++;segmentDuration=0;
      }
    }
    return segments?{duration,segments,complete:content.includes('#EXT-X-ENDLIST')}:null;
  }catch{return null;}
}

export function adaptiveTranscodeStatus(dataDir:string,id:number,audioStream:number|undefined,qualities:PlaybackQuality[],startTime=0):AdaptiveTranscodeState {
  startTime=seekWindowStart(startTime);
  const running=adaptiveJobs.get(adaptiveKey(id,audioStream,startTime))?.state;
  const variants=adaptiveVariants(id,audioStream,qualities,startTime);
  if(running?.status==='error')return running;
  const progress=qualities.map((quality)=>playlistProgress(join(adaptiveDir(dataDir,id,audioStream,startTime),String(quality.height),'index.m3u8')));
  if(progress.length&&progress.every((entry)=>entry!==null)&&existsSync(adaptivePlaylist(dataDir,id,audioStream,startTime))){
    const bufferedUntil=startTime+Math.min(...progress.map((entry)=>entry!.duration));
    const complete=progress.every((entry)=>entry!.complete);
    if(complete||running)return {status:'ready',playlist:adaptiveUrl(id,audioStream,startTime),variants,bufferedUntil,complete,startTime};
  }
  return running||{status:'idle',playlist:adaptiveUrl(id,audioStream,startTime),variants,startTime};
}

export async function startAdaptiveTranscode(dataDir:string,id:number,source:string,options:AdaptiveTranscodeOptions):Promise<AdaptiveTranscodeState>{
  const audioStream=Number.isInteger(options.audioStream)?options.audioStream:undefined;
  const qualities=options.qualities;
  const startTime=seekWindowStart(options.startTime);
  const full=adaptiveTranscodeStatus(dataDir,id,audioStream,qualities);
  if(full.status==='ready'&&(full.complete||(full.bufferedUntil??0)>=startTime+6))return full;
  const existing=adaptiveTranscodeStatus(dataDir,id,audioStream,qualities,startTime);
  if(existing.status==='ready'||existing.status==='running'||existing.status==='starting')return existing;
  const variants=adaptiveVariants(id,audioStream,qualities,startTime);
  if(!qualities.length)return {status:'error',error:'Video resolution could not be detected.',playlist:adaptiveUrl(id,audioStream),variants};
  if(!(await hasFfmpeg()))return {status:'error',error:'FFmpeg is not installed or not available in PATH.',playlist:adaptiveUrl(id,audioStream),variants};
  const dir=adaptiveDir(dataDir,id,audioStream,startTime);
  rmSync(dir,{recursive:true,force:true});
  mkdirSync(dir,{recursive:true});
  for(const quality of qualities)mkdirSync(join(dir,String(quality.height)),{recursive:true});
  const state:AdaptiveTranscodeState={status:'starting',playlist:adaptiveUrl(id,audioStream,startTime),variants,startTime};
  const audioMap=audioStream===undefined?'0:a:0?':`0:${audioStream}`;
  const args=['-hide_banner','-loglevel','warning',...(startTime>0?['-ss',String(startTime)]:[]),'-i',source];
  for(let index=0;index<qualities.length;index++){
    args.push('-map','0:v:0');
    if(options.hasAudio)args.push('-map',audioMap);
  }
  const landscape=options.sourceWidth>=options.sourceHeight;
  for(let index=0;index<qualities.length;index++){
    const quality=qualities[index];
    const maxRate=Math.round(quality.bitrate*1.08);
    const buffer=Math.round(quality.bitrate*2);
    args.push(
      `-c:v:${index}`,'libx264',`-preset:v:${index}`,'veryfast',`-pix_fmt:v:${index}`,'yuv420p',
      `-b:v:${index}`,String(quality.bitrate),`-maxrate:v:${index}`,String(maxRate),`-bufsize:v:${index}`,String(buffer),
      `-filter:v:${index}`,landscape?`scale=-2:${quality.height}`:`scale=${quality.height}:-2`
    );
    if(options.hasAudio)args.push(`-c:a:${index}`,'aac',`-b:a:${index}`,index===0?'160k':'128k',`-ac:a:${index}`,'2');
  }
  args.push(
    '-force_key_frames','expr:gte(t,n_forced*2)','-sc_threshold','0',
    '-f','hls','-hls_time','2','-hls_playlist_type','event','-hls_flags','independent_segments+temp_file',
    '-master_pl_name','master.m3u8',
    '-var_stream_map',qualities.map((quality,index)=>options.hasAudio?`v:${index},a:${index},name:${quality.height}`:`v:${index},name:${quality.height}`).join(' '),
    '-hls_segment_filename',join(dir,'%v','segment-%05d.ts').replaceAll('\\','/'),join(dir,'%v','index.m3u8').replaceAll('\\','/')
  );
  let child:ChildProcess;
  try{child=spawn(process.env.FFMPEG_PATH||'ffmpeg',args,{windowsHide:true});}
  catch(error){state.status='error';state.error=error instanceof Error?error.message:'FFmpeg could not start.';return state;}
  const key=adaptiveKey(id,audioStream,startTime);
  adaptiveJobs.set(key,{child,state});
  state.status='running';
  child.stderr?.on('data',(chunk)=>{const text=String(chunk).trim();if(text)state.error=text.slice(-500);});
  child.once('error',(error)=>{state.status='error';state.error=error.message;rmSync(dir,{recursive:true,force:true});});
  child.once('exit',(code)=>{
    if(code===0&&existsSync(adaptivePlaylist(dataDir,id,audioStream,startTime))){state.status='ready';state.error=undefined;}
    else{state.status='error';if(!state.error)state.error=`FFmpeg exited with code ${code}`;rmSync(dir,{recursive:true,force:true});}
    if(state.status==='ready')adaptiveJobs.delete(key);
  });
  return state;
}

export function transcodeStatus(dataDir:string,id:number,audioStream?:number,startTime=0):TranscodeState {
  startTime=seekWindowStart(startTime);
  const running=jobs.get(jobKey(id,audioStream,startTime))?.state;
  if(running?.status==='error')return running;
  const progress=playlistProgress(hlsPlaylist(dataDir,id,audioStream,startTime));
  if(progress&&(progress.complete||(running&&progress.segments>=2)))return {status:'ready',playlist:playlistUrl(id,audioStream,startTime),bufferedUntil:startTime+progress.duration,complete:progress.complete,startTime};
  return running || {status:'idle',playlist:playlistUrl(id,audioStream,startTime),startTime};
}

export async function startHlsTranscode(dataDir:string,id:number,source:string,options:TranscodeOptions={}):Promise<TranscodeState> {
  const audioStream = Number.isInteger(options.audioStream) ? options.audioStream : undefined;
  const startTime=seekWindowStart(options.startTime);
  const full=transcodeStatus(dataDir,id,audioStream);
  if(full.status==='ready'&&(full.complete||(full.bufferedUntil??0)>=startTime+6))return full;
  const existing = transcodeStatus(dataDir,id,audioStream,startTime);
  if (existing.status === 'ready' || existing.status === 'running' || existing.status === 'starting') return existing;
  if (!(await hasFfmpeg())) return {status:'error',error:'FFmpeg is not installed or not available in PATH.',playlist:playlistUrl(id,audioStream)};
  const dir = hlsVariantDir(dataDir,id,audioStream,startTime);
  rmSync(dir,{recursive:true,force:true});
  mkdirSync(dir,{recursive:true});
  const playlist = hlsPlaylist(dataDir,id,audioStream,startTime);
  const state:TranscodeState = {status:'starting',playlist:playlistUrl(id,audioStream,startTime),startTime};
  let child: ChildProcess;
  try {
    const audioMap = audioStream === undefined ? '0:a:0?' : `0:${audioStream}`;
    child = spawn(process.env.FFMPEG_PATH || 'ffmpeg',[
      '-hide_banner','-loglevel','warning',...(startTime>0?['-ss',String(startTime)]:[]),'-i',source,
      '-map','0:v:0','-map',audioMap,
      // Stream-copy input seeking preserves preroll before the requested time.
      // Decode a new window so its first frame/audio/subtitles share one origin.
      ...(options.copyVideo&&startTime===0?['-c:v','copy']:['-c:v','libx264','-preset','veryfast','-crf','21','-pix_fmt','yuv420p','-force_key_frames','expr:gte(t,n_forced*2)']),
      '-c:a','aac','-b:a','192k','-ac','2',
      '-f','hls','-hls_time','2','-hls_playlist_type','event','-hls_flags','independent_segments+temp_file',
      '-hls_segment_filename',join(dir,'segment-%05d.ts'),playlist
    ],{windowsHide:true});
  } catch (error) {
    state.status='error';
    state.error=error instanceof Error ? error.message : 'FFmpeg could not start.';
    return state;
  }
  const key = jobKey(id,audioStream,startTime);
  jobs.set(key,{child,state});
  state.status='running';
  child.stderr?.on('data',(chunk)=>{
    const text=String(chunk).trim();
    if(text) state.error=text.slice(-500);
  });
  child.once('error',(error)=>{state.status='error';state.error=error.message;});
  child.once('exit',(code)=>{
    state.status=code===0 && existsSync(playlist)?'ready':'error';
    if(code!==0 && !state.error) state.error=`FFmpeg exited with code ${code}`;
    if(state.status==='ready')jobs.delete(key);
  });
  return state;
}

export function audioTranscodeStatus(dataDir:string,id:number,audioStream:number):AudioTranscodeState {
  const job=audioJobs.get(`${id}:${audioStream}`);
  if(job)return job.state;
  if (existsSync(audioPlaylist(dataDir,id,audioStream))) return {status:'ready',url:audioUrl(id,audioStream)};
  return {status:'idle',url:audioUrl(id,audioStream)};
}

export async function startAudioTranscode(dataDir:string,id:number,source:string,audioStream:number):Promise<AudioTranscodeState> {
  const existing=audioTranscodeStatus(dataDir,id,audioStream);
  if(existing.status==='ready'||existing.status==='running'||existing.status==='starting')return existing;
  if(!(await hasFfmpeg()))return {status:'error',error:'FFmpeg is not installed or not available in PATH.',url:audioUrl(id,audioStream)};
  const dir=audioVariantDir(dataDir,id,audioStream);
  const playlist=audioPlaylist(dataDir,id,audioStream);
  rmSync(dir,{recursive:true,force:true});
  mkdirSync(dir,{recursive:true});
  const state:AudioTranscodeState={status:'starting',url:audioUrl(id,audioStream)};
  let child:ChildProcess;
  try{
    child=spawn(process.env.FFMPEG_PATH||'ffmpeg',[
      '-hide_banner','-loglevel','warning','-i',source,
      '-map',`0:${audioStream}`,'-vn',
      '-c:a','aac','-b:a','192k','-ac','2',
      '-f','hls','-hls_time','4','-hls_playlist_type','event',
      '-hls_segment_filename',join(dir,'segment-%05d.ts'),playlist
    ],{windowsHide:true});
  }catch(error){
    state.status='error';
    state.error=error instanceof Error?error.message:'FFmpeg could not start.';
    return state;
  }
  const key=`${id}:${audioStream}`;
  audioJobs.set(key,{child,state});
  state.status='running';
  child.stderr?.on('data',(chunk)=>{const text=String(chunk).trim();if(text)state.error=text.slice(-500);});
  child.once('error',(error)=>{state.status='error';state.error=error.message;rmSync(dir,{recursive:true,force:true});audioJobs.delete(key);});
  child.once('exit',(code)=>{
    if(code===0&&existsSync(playlist)){
      state.status='ready';
      state.error=undefined;
    }else{
      state.status='error';
      if(!state.error)state.error=`FFmpeg exited with code ${code}`;
      rmSync(dir,{recursive:true,force:true});
    }
    audioJobs.delete(key);
  });
  return state;
}

export async function extractSubtitleVtt(dataDir:string,id:number,source:string,subtitleStream:number) {
  const subtitleDir = join(hlsDir(dataDir,id),'subtitles');
  const target = join(subtitleDir,`${subtitleStream}.vtt`);
  if (existsSync(target)) return { path: target, url: `/hls/${id}/subtitles/${subtitleStream}.vtt` };
  if (!(await hasFfmpeg())) throw new Error('FFmpeg is not installed or not available in PATH.');
  mkdirSync(subtitleDir,{recursive:true});
  const result = await new Promise<{ok:boolean;error:string}>((resolve) => {
    let stderr='';
    let child: ChildProcess;
    try {
      child=spawn(process.env.FFMPEG_PATH || 'ffmpeg',[
        '-hide_banner','-loglevel','warning','-i',source,
        '-map',`0:${subtitleStream}`,'-c:s','webvtt','-f','webvtt','-y',target
      ],{windowsHide:true});
    } catch (error) {
      resolve({ok:false,error:error instanceof Error?error.message:'FFmpeg could not start.'});
      return;
    }
    child.stderr?.on('data',(chunk)=>{stderr=(stderr+String(chunk)).slice(-1000);});
    child.once('error',(error)=>resolve({ok:false,error:error.message}));
    child.once('exit',(code)=>resolve({ok:code===0&&existsSync(target),error:stderr.trim()||`FFmpeg exited with code ${code}`}));
  });
  if (!result.ok) {
    rmSync(target,{force:true});
    throw new Error(result.error || 'Subtitle conversion failed.');
  }
  return { path: target, url: `/hls/${id}/subtitles/${subtitleStream}.vtt` };
}

export function stopAllTranscodes(){for(const {child} of [...jobs.values(),...audioJobs.values(),...adaptiveJobs.values()]) child.kill('SIGTERM');jobs.clear();audioJobs.clear();adaptiveJobs.clear();}
