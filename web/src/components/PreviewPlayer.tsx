import { useEffect, useRef, useState } from 'react';
import { Pause, Play, SpeakerHigh, SpeakerSlash } from '@phosphor-icons/react';
import type { MediaItem } from '../types';

const PREVIEW_WINDOW = 15;

export function PreviewPlayer({ item, start }: { item: MediaItem; start: number }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const startAt = () => {
      try { video.currentTime = start; } catch { /* ignore */ }
      video.play().catch(() => { /* autoplay blocked; user can start via button */ });
    };
    if (video.readyState >= 1) startAt();
    else video.addEventListener('loadedmetadata', startAt, { once: true });
    return () => { video.pause(); };
  }, [start]);

  if (failed) return null;

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    const cut = start + PREVIEW_WINDOW;
    if (cut <= video.duration - 0.5 && video.currentTime >= cut) {
      video.currentTime = start;
    }
    setProgress(Math.min(1, Math.max(0, (video.currentTime - start) / PREVIEW_WINDOW)));
  };

  const stopClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const toggleMute = (event: React.MouseEvent) => {
    stopClick(event);
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  };

  const togglePlay = (event: React.MouseEvent) => {
    stopClick(event);
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => { });
    else video.pause();
  };

  const restart = () => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = start;
    video.play().catch(() => { });
  };

  return (
    <div className="preview-player">
      <video
        ref={videoRef}
        src={`/api/media/${item.id}/stream`}
        muted
        playsInline
        preload="auto"
        onTimeUpdate={handleTimeUpdate}
        onEnded={restart}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onError={() => setFailed(true)}
      />
      <div className="preview-controls">
        <button type="button" aria-label={playing ? 'Pause preview' : 'Play preview'} onClick={togglePlay}>{playing ? <Pause weight="fill" /> : <Play weight="fill" />}</button>
        <button type="button" aria-label={muted ? 'Unmute' : 'Mute'} onClick={toggleMute}>{muted ? <SpeakerSlash weight="fill" /> : <SpeakerHigh weight="fill" />}</button>
      </div>
      <div className="preview-progress"><i style={{ width: `${progress * 100}%` }} /></div>
    </div>
  );
}