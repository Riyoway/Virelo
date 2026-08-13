import { mkdirSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import { hasFfmpeg } from './ffmpeg.js';

export interface TranscodeState {
  status: 'idle'|'starting'|'running'|'ready'|'error';
  error?: string;
  playlist: string;
}

const jobs = new Map<number, { child: ChildProcess; state: TranscodeState }>();

export function hlsDir(dataDir:string,id:number){return join(dataDir,'cache','hls',String(id));}
export function hlsPlaylist(dataDir:string,id:number){return join(hlsDir(dataDir,id),'index.m3u8');}

export function transcodeStatus(dataDir:string,id:number):TranscodeState {
  if (existsSync(hlsPlaylist(dataDir,id))) return {status:'ready',playlist:`/hls/${id}/index.m3u8`};
  return jobs.get(id)?.state || {status:'idle',playlist:`/hls/${id}/index.m3u8`};
}

export async function startHlsTranscode(dataDir:string,id:number,source:string):Promise<TranscodeState> {
  const existing = transcodeStatus(dataDir,id);
  if (existing.status === 'ready' || existing.status === 'running' || existing.status === 'starting') return existing;
  if (!(await hasFfmpeg())) return {status:'error',error:'FFmpeg is not installed or not available in PATH.',playlist:`/hls/${id}/index.m3u8`};
  const dir = hlsDir(dataDir,id);
  rmSync(dir,{recursive:true,force:true});
  mkdirSync(dir,{recursive:true});
  const playlist = hlsPlaylist(dataDir,id);
  const state:TranscodeState = {status:'starting',playlist:`/hls/${id}/index.m3u8`};
  let child: ChildProcess;
  try {
    child = spawn(process.env.FFMPEG_PATH || 'ffmpeg',[
      '-hide_banner','-loglevel','warning','-i',source,
      '-map','0:v:0','-map','0:a:0?',
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
  jobs.set(id,{child,state});
  state.status='running';
  child.stderr?.on('data',(chunk)=>{
    const text=String(chunk).trim();
    if(text) state.error=text.slice(-500);
  });
  child.once('error',(error)=>{state.status='error';state.error=error.message;jobs.delete(id);});
  child.once('exit',(code)=>{
    state.status=code===0 && existsSync(playlist)?'ready':'error';
    if(code!==0 && !state.error) state.error=`FFmpeg exited with code ${code}`;
    jobs.delete(id);
  });
  return state;
}

export function stopAllTranscodes(){for(const {child} of jobs.values()) child.kill('SIGTERM');jobs.clear();}
