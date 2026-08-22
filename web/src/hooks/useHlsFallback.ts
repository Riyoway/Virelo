import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { api } from '../api';
import type { MediaItem } from '../types';

type FallbackState = 'idle' | 'starting' | 'active' | 'error';
type HlsInstance = InstanceType<(typeof import('hls.js/light'))['default']>;

export function useHlsFallback(item: MediaItem, videoRef: RefObject<HTMLVideoElement | null>) {
  const hlsRef = useRef<HlsInstance|null>(null);
  const fallbackTimer = useRef<number|null>(null);
  const restoreToken = useRef(0);
  const restoreCleanupRef = useRef<(()=>void)|null>(null);
  const stateRef = useRef<FallbackState>('idle');
  const variantRef = useRef<number|null>(null);
  const [fallback, setFallbackState] = useState<FallbackState>('idle');
  const [activeAudioStream, setActiveAudioStream] = useState<number|null>(null);
  const [error, setError] = useState('');

  const setState = useCallback((value: FallbackState) => {
    stateRef.current = value;
    setFallbackState(value);
  }, []);

  const stopCurrent = useCallback(() => {
    restoreToken.current++;
    restoreCleanupRef.current?.();
    restoreCleanupRef.current=null;
    hlsRef.current?.destroy();
    hlsRef.current = null;
    if (fallbackTimer.current !== null) window.clearInterval(fallbackTimer.current);
    fallbackTimer.current = null;
  }, []);

  useEffect(() => stopCurrent, [stopCurrent]);

  useEffect(() => {
    stopCurrent();
    variantRef.current = null;
    setActiveAudioStream(null);
    setState('idle');
    setError('');
  }, [item.id, setState, stopCurrent]);

  const attachHls = useCallback(async (url: string, audioStream: number|null, resumeAt: number, shouldPlay: boolean) => {
    const video = videoRef.current;
    if (!video) return;
    stopCurrent();
    const attachToken=restoreToken.current;
    let restored=false;
    let cleanupRestore=()=>{};
    const restorePlayback = () => {
      if (restored||attachToken!==restoreToken.current||video.readyState<HTMLMediaElement.HAVE_METADATA)return;
      const maxTime=Number.isFinite(video.duration)&&video.duration>0?video.duration:resumeAt;
      const position=Math.min(Math.max(resumeAt,0),Math.max(0,maxTime-0.05));
      try{video.currentTime=position;}catch{/* the media element is not seekable yet */}
      restored=true;
      cleanupRestore();
      setActiveAudioStream(audioStream);
      setState('active');
      if (shouldPlay) void video.play().catch(() => {});
    };
    cleanupRestore=()=>{
      video.removeEventListener('loadedmetadata',restorePlayback);
      video.removeEventListener('durationchange',restorePlayback);
      video.removeEventListener('canplay',restorePlayback);
      if(restoreCleanupRef.current===cleanupRestore)restoreCleanupRef.current=null;
    };
    restoreCleanupRef.current=cleanupRestore;
    video.addEventListener('loadedmetadata',restorePlayback);
    video.addEventListener('durationchange',restorePlayback);
    video.addEventListener('canplay',restorePlayback);
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url;
      video.load();
      return;
    }
    try {
      const { default: Hls } = await import('hls.js/light');
      if (!Hls.isSupported()) throw new Error('This browser cannot play HLS.');
      const hls = new Hls({ enableWorker: true, lowLatencyMode: false, maxBufferLength: 40 });
      hlsRef.current = hls;
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, restorePlayback);
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return;
        setError('Compatible playback failed.');
        setState('error');
      });
    } catch (reason) {
      cleanupRestore();
      setError(reason instanceof Error ? reason.message : 'This browser cannot play HLS.');
      setState('error');
    }
  }, [setState, stopCurrent, videoRef]);

  const startFallback = useCallback(async (audioStream?: number, resumeAt?: number, shouldPlay?: boolean) => {
    const requestedStream = audioStream ?? null;
    if (stateRef.current === 'starting' && variantRef.current === requestedStream) return;
    if (stateRef.current === 'active' && variantRef.current === requestedStream) return;
    const video = videoRef.current;
    const position = resumeAt ?? video?.currentTime ?? 0;
    const resumePlayback = shouldPlay ?? Boolean(video && !video.paused);
    stopCurrent();
    variantRef.current = requestedStream;
    setState('starting');
    setError('');
    try {
      const start = await api.startTranscode(item.id, audioStream);
      if (start.status === 'error') throw new Error(start.error || 'Compatible playback is unavailable.');
      if (start.status === 'ready') {
        await attachHls(start.playlist, requestedStream, position, resumePlayback);
        return;
      }
      let attempts = 0;
      fallbackTimer.current = window.setInterval(async () => {
        attempts++;
        try {
          const status = await api.transcodeStatus(item.id, audioStream);
          if (status.status === 'ready') {
            if (fallbackTimer.current !== null) window.clearInterval(fallbackTimer.current);
            fallbackTimer.current = null;
            await attachHls(status.playlist, requestedStream, position, resumePlayback);
          } else if (status.status === 'error' || attempts > 300) {
            if (fallbackTimer.current !== null) window.clearInterval(fallbackTimer.current);
            fallbackTimer.current = null;
            setState('error');
            setError(status.error || 'Compatible playback did not become ready.');
          }
        } catch {
          if (attempts <= 300) return;
          if (fallbackTimer.current !== null) window.clearInterval(fallbackTimer.current);
          fallbackTimer.current = null;
          setState('error');
          setError('Compatible playback status could not be reached.');
        }
      }, 1000);
    } catch (reason) {
      setState('error');
      setError(reason instanceof Error ? reason.message : 'Compatible playback failed.');
    }
  }, [attachHls, item.id, setState, stopCurrent, videoRef]);

  return { fallback, error, startFallback, activeAudioStream };
}
