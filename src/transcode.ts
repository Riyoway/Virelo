import { mkdirSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import { hasFfmpeg, type PlaybackQuality } from './ffmpeg.js';

export interface TranscodeState {
  status: 'idle'|'starting'|'running'|'ready'|'error';
  error?: string;
  playlist: string;
}

export interface TranscodeOptions {
  audioStream?: number;
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
}

export interface AdaptiveTranscodeOptions {
  audioStream?: number;
  hasAudio: boolean;
  sourceWidth: number;
  sourceHeight: number;
  qualities: PlaybackQuality[];
}

const jobs = new Map<string, { child: ChildProcess; state: TranscodeState }>();
const audioJobs = new Map<string, { child: ChildProcess; state: AudioTranscodeState }>();
const adaptiveJobs = new Map<string, { child: ChildProcess; state: AdaptiveTranscodeState }>();

export function hlsDir(dataDir:string,id:number){return join(dataDir,'cache','hls',String(id));}
function variantName(audioStream?:number){return Number.isInteger(audioStream) ? `audio-${audioStream}` : 'default';}
function jobKey(id:number,audioStream?:number){return `${id}:${variantName(audioStream)}`;}
export function hlsVariantDir(dataDir:string,id:number,audioStream?:number){return join(hlsDir(dataDir,id),variantName(audioStream));}
export function hlsPlaylist(dataDir:string,id:number,audioStream?:number){return join(hlsVariantDir(dataDir,id,audioStream),'index.m3u8');}
function playlistUrl(id:number,audioStream?:number){return `/hls/${id}/${variantName(audioStream)}/index.m3u8`;}
function audioDir(dataDir:string,id:number){return join(dataDir,'cache','audio',String(id));}
function audioVariantDir(dataDir:string,id:number,audioStream:number){return join(audioDir(dataDir,id),`stream-${audioStream}`);}
function audioPlaylist(dataDir:string,id:number,audioStream:number){return join(audioVariantDir(dataDir,id,audioStream),'index.m3u8');}
function audioUrl(id:number,audioStream:number){return `/audio/${id}/stream-${audioStream}/index.m3u8`;}
function adaptiveName(audioStream?:number){return Number.isInteger(audioStream)?`adaptive-audio-${audioStream}`:'adaptive-default';}
function adaptiveKey(id:number,audioStream?:number){return `${id}:${adaptiveName(audioStream)}`;}
function adaptiveDir(dataDir:string,id:number,audioStream?:number){return join(hlsDir(dataDir,id),adaptiveName(audioStream));}
function adaptivePlaylist(dataDir:string,id:number,audioStream?:number){return join(adaptiveDir(dataDir,id,audioStream),'master.m3u8');}
function adaptiveUrl(id:number,audioStream?:number){return `/hls/${id}/${adaptiveName(audioStream)}/master.m3u8`;}
function adaptiveVariants(id:number,audioStream:number|undefined,qualities:PlaybackQuality[]){
  return qualities.map((quality)=>({...quality,url:`/hls/${id}/${adaptiveName(audioStream)}/${quality.height}/index.m3u8`}));
}

export function adaptiveTranscodeStatus(dataDir:string,id:number,audioStream:number|undefined,qualities:PlaybackQuality[]):AdaptiveTranscodeState {
  const running=adaptiveJobs.get(adaptiveKey(id,audioStream))?.state;
  const variants=adaptiveVariants(id,audioStream,qualities);
  if(existsSync(adaptivePlaylist(dataDir,id,audioStream))&&variants.every((variant)=>existsSync(join(adaptiveDir(dataDir,id,audioStream),String(variant.height),'segment-00000.ts')))){
    return {status:'ready',playlist:adaptiveUrl(id,audioStream),variants};
  }
  return running||{status:'idle',playlist:adaptiveUrl(id,audioStream),variants};
}

export async function startAdaptiveTranscode(dataDir:string,id:number,source:string,options:AdaptiveTranscodeOptions):Promise<AdaptiveTranscodeState>{
  const audioStream=Number.isInteger(options.audioStream)?options.audioStream:undefined;
  const qualities=options.qualities;
  const existing=adaptiveTranscodeStatus(dataDir,id,audioStream,qualities);
  if(existing.status==='ready'||existing.status==='running'||existing.status==='starting')return existing;
  const variants=adaptiveVariants(id,audioStream,qualities);
  if(!qualities.length)return {status:'error',error:'Video resolution could not be detected.',playlist:adaptiveUrl(id,audioStream),variants};
  if(!(await hasFfmpeg()))return {status:'error',error:'FFmpeg is not installed or not available in PATH.',playlist:adaptiveUrl(id,audioStream),variants};
  const dir=adaptiveDir(dataDir,id,audioStream);
  rmSync(dir,{recursive:true,force:true});
  mkdirSync(dir,{recursive:true});
  for(const quality of qualities)mkdirSync(join(dir,String(quality.height)),{recursive:true});
  const state:AdaptiveTranscodeState={status:'starting',playlist:adaptiveUrl(id,audioStream),variants};
  const audioMap=audioStream===undefined?'0:a:0?':`0:${audioStream}`;
  const args=['-hide_banner','-loglevel','warning','-i',source];
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
    '-force_key_frames','expr:gte(t,n_forced*4)','-sc_threshold','0',
    '-f','hls','-hls_time','4','-hls_playlist_type','event','-hls_flags','independent_segments+temp_file',
    '-master_pl_name','master.m3u8',
    '-var_stream_map',qualities.map((quality,index)=>options.hasAudio?`v:${index},a:${index},name:${quality.height}`:`v:${index},name:${quality.height}`).join(' '),
    '-hls_segment_filename',join(dir,'%v','segment-%05d.ts').replaceAll('\\','/'),join(dir,'%v','index.m3u8').replaceAll('\\','/')
  );
  let child:ChildProcess;
  try{child=spawn(process.env.FFMPEG_PATH||'ffmpeg',args,{windowsHide:true});}
  catch(error){state.status='error';state.error=error instanceof Error?error.message:'FFmpeg could not start.';return state;}
  const key=adaptiveKey(id,audioStream);
  adaptiveJobs.set(key,{child,state});
  state.status='running';
  child.stderr?.on('data',(chunk)=>{const text=String(chunk).trim();if(text)state.error=text.slice(-500);});
  child.once('error',(error)=>{state.status='error';state.error=error.message;rmSync(dir,{recursive:true,force:true});adaptiveJobs.delete(key);});
  child.once('exit',(code)=>{
    if(code===0&&existsSync(adaptivePlaylist(dataDir,id,audioStream))){state.status='ready';state.error=undefined;}
    else{state.status='error';if(!state.error)state.error=`FFmpeg exited with code ${code}`;rmSync(dir,{recursive:true,force:true});}
    adaptiveJobs.delete(key);
  });
  return state;
}

export function transcodeStatus(dataDir:string,id:number,audioStream?:number):TranscodeState {
  if (existsSync(hlsPlaylist(dataDir,id,audioStream))) return {status:'ready',playlist:playlistUrl(id,audioStream)};
  return jobs.get(jobKey(id,audioStream))?.state || {status:'idle',playlist:playlistUrl(id,audioStream)};
}

export async function startHlsTranscode(dataDir:string,id:number,source:string,options:TranscodeOptions={}):Promise<TranscodeState> {
  const audioStream = Number.isInteger(options.audioStream) ? options.audioStream : undefined;
  const existing = transcodeStatus(dataDir,id,audioStream);
  if (existing.status === 'ready' || existing.status === 'running' || existing.status === 'starting') return existing;
  if (!(await hasFfmpeg())) return {status:'error',error:'FFmpeg is not installed or not available in PATH.',playlist:playlistUrl(id,audioStream)};
  const dir = hlsVariantDir(dataDir,id,audioStream);
  rmSync(dir,{recursive:true,force:true});
  mkdirSync(dir,{recursive:true});
  const playlist = hlsPlaylist(dataDir,id,audioStream);
  const state:TranscodeState = {status:'starting',playlist:playlistUrl(id,audioStream)};
  let child: ChildProcess;
  try {
    const audioMap = audioStream === undefined ? '0:a:0?' : `0:${audioStream}`;
    child = spawn(process.env.FFMPEG_PATH || 'ffmpeg',[
      '-hide_banner','-loglevel','warning','-i',source,
      '-map','0:v:0','-map',audioMap,
      '-c:v','libx264','-preset','veryfast','-crf','21','-pix_fmt','yuv420p',
      '-c:a','aac','-b:a','192k','-ac','2',
      '-force_key_frames','expr:gte(t,n_forced*4)',
      '-f','hls','-hls_time','4','-hls_playlist_type','vod','-hls_flags','independent_segments',
      '-hls_segment_filename',join(dir,'segment-%05d.ts'),playlist
    ],{windowsHide:true});
  } catch (error) {
    state.status='error';
    state.error=error instanceof Error ? error.message : 'FFmpeg could not start.';
    return state;
  }
  const key = jobKey(id,audioStream);
  jobs.set(key,{child,state});
  state.status='running';
  child.stderr?.on('data',(chunk)=>{
    const text=String(chunk).trim();
    if(text) state.error=text.slice(-500);
  });
  child.once('error',(error)=>{state.status='error';state.error=error.message;jobs.delete(key);});
  child.once('exit',(code)=>{
    state.status=code===0 && existsSync(playlist)?'ready':'error';
    if(code!==0 && !state.error) state.error=`FFmpeg exited with code ${code}`;
    jobs.delete(key);
  });
  return state;
}

export function audioTranscodeStatus(dataDir:string,id:number,audioStream:number):AudioTranscodeState {
  if (existsSync(audioPlaylist(dataDir,id,audioStream))) return {status:'ready',url:audioUrl(id,audioStream)};
  return audioJobs.get(`${id}:${audioStream}`)?.state || {status:'idle',url:audioUrl(id,audioStream)};
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
