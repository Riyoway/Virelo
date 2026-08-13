import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { constants } from 'node:fs';

async function canRun(command: string): Promise<boolean> {
  return await new Promise((resolve) => {
    let child;
    try {
      child = spawn(command, ['-version'], { stdio: 'ignore', windowsHide: true });
    } catch {
      resolve(false);
      return;
    }
    child.once('error', () => resolve(false));
    child.once('exit', (code) => resolve(code === 0));
  });
}

let ffmpegAvailable: boolean | undefined;
let ffprobeAvailable: boolean | undefined;

export async function hasFfmpeg() {
  return ffmpegAvailable ??= await canRun(process.env.FFMPEG_PATH || 'ffmpeg');
}

export async function hasFfprobe() {
  return ffprobeAvailable ??= await canRun(process.env.FFPROBE_PATH || 'ffprobe');
}

export async function probeMedia(path: string): Promise<{
  duration: number | null;
  width: number | null;
  height: number | null;
  videoCodec: string | null;
  audioCodec: string | null;
  container: string | null;
} | null> {
  if (!(await hasFfprobe())) return null;
  return await new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let child;
    try {
      child = spawn(process.env.FFPROBE_PATH || 'ffprobe', ['-v','quiet','-print_format','json','-show_format','-show_streams',path], { windowsHide: true });
    } catch {
      resolve(null);
      return;
    }
    child.stdout.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    child.once('error', () => resolve(null));
    child.once('exit', (code) => {
      if (code !== 0) return resolve(null);
      try {
        const data = JSON.parse(Buffer.concat(chunks).toString('utf8')) as any;
        const video = Array.isArray(data.streams) ? data.streams.find((s: any) => s.codec_type === 'video') : null;
        const audio = Array.isArray(data.streams) ? data.streams.find((s: any) => s.codec_type === 'audio') : null;
        resolve({
          duration: Number.isFinite(Number(data.format?.duration)) ? Number(data.format.duration) : null,
          width: Number.isFinite(Number(video?.width)) ? Number(video.width) : null,
          height: Number.isFinite(Number(video?.height)) ? Number(video.height) : null,
          videoCodec: video?.codec_name ?? null,
          audioCodec: audio?.codec_name ?? null,
          container: data.format?.format_name?.split(',')[0] ?? null
        });
      } catch { resolve(null); }
    });
  });
}

export async function makeThumbnail(source: string, target: string, duration?: number | null): Promise<boolean> {
  try { await access(target, constants.F_OK); return true; } catch { /* generate */ }
  if (!(await hasFfmpeg())) return false;
  const seek = duration && duration > 0 ? Math.min(Math.max(duration * 0.12, 0.1), 60) : 3;
  return await new Promise((resolve) => {
    let child;
    try {
      child = spawn(process.env.FFMPEG_PATH || 'ffmpeg', [
        '-hide_banner','-loglevel','error','-ss',String(seek),'-i',source,'-frames:v','1','-vf','scale=min(960\\,iw):-2','-q:v','3','-y',target
      ], { stdio: 'ignore', windowsHide: true });
    } catch {
      resolve(false);
      return;
    }
    child.once('error', () => resolve(false));
    child.once('exit', (code) => resolve(code === 0));
  });
}
