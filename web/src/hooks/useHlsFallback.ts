import { useEffect, useRef, useState, type RefObject } from 'react';
import { api } from '../api';
import type { MediaItem } from '../types';

type FallbackState = 'idle' | 'starting' | 'active' | 'error';
type HlsInstance = InstanceType<(typeof import('hls.js/light'))['default']>;

export function useHlsFallback(item: MediaItem, videoRef: RefObject<HTMLVideoElement | null>) {
  const hlsRef = useRef<HlsInstance|null>(null);
  const fallbackTimer = useRef<number|null>(null);
  const stateRef = useRef<FallbackState>('idle');
  const [fallback, setFallbackState] = useState<FallbackState>('idle');
  const [error, setError] = useState('');

  const setState = (value: FallbackState) => {
    stateRef.current = value;
    setFallbackState(value);
  };

  useEffect(() => () => {
    hlsRef.current?.destroy();
    if (fallbackTimer.current !== null) window.clearInterval(fallbackTimer.current);
  }, []);

  async function attachHls(url: string) {
    const video = videoRef.current;
    if (!video) return;
    hlsRef.current?.destroy();
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url;
      setState('active');
      void video.play().catch(() => {});
      return;
    }
    try {
      const { default: Hls } = await import('hls.js/light');
      if (!Hls.isSupported()) {
        setError('This browser cannot play HLS.');
        setState('error');
        return;
      }
      const hls = new Hls({ enableWorker: true, lowLatencyMode: false, maxBufferLength: 40 });
      hlsRef.current = hls;
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => { setState('active'); void video.play().catch(() => {}); });
      hls.on(Hls.Events.ERROR, (_event, data) => { if (data.fatal) { setError('HLS playback failed.'); setState('error'); } });
    } catch {
      setError('This browser cannot play HLS.');
      setState('error');
    }
  }

  async function startFallback() {
    if (stateRef.current === 'starting' || stateRef.current === 'active') return;
    setState('starting');
    setError('');
    try {
      const start = await api.startTranscode(item.id);
      if (start.status === 'error') throw new Error(start.error || 'Transcode unavailable');
      if (start.status === 'ready') { void attachHls(start.playlist); return; }
      let attempts = 0;
      if (fallbackTimer.current !== null) window.clearInterval(fallbackTimer.current);
      fallbackTimer.current = window.setInterval(async () => {
        attempts++;
        try {
          const status = await api.transcodeStatus(item.id);
          if (status.status === 'ready') {
            if (fallbackTimer.current !== null) window.clearInterval(fallbackTimer.current);
            fallbackTimer.current = null;
            void attachHls(status.playlist);
          } else if (status.status === 'error' || attempts > 120) {
            if (fallbackTimer.current !== null) window.clearInterval(fallbackTimer.current);
            fallbackTimer.current = null;
            setState('error');
            setError(status.error || 'Transcode did not finish.');
          }
        } catch {
          if (attempts > 120) {
            if (fallbackTimer.current !== null) window.clearInterval(fallbackTimer.current);
            fallbackTimer.current = null;
            setState('error');
            setError('Transcode status could not be reached.');
          }
        }
      }, 1000);
    } catch (e) {
      setState('error');
      setError(e instanceof Error ? e.message : 'Transcode failed');
    }
  }

  return { fallback, error, startFallback };
}
