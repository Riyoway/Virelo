import { useEffect, useRef, useState } from 'react';
import { ArrowsOut, FastForward, Pause, PictureInPicture, Play, Rewind, SkipBack, SkipForward, SpeakerHigh, SpeakerSlash, SpinnerGap } from '@phosphor-icons/react';
import { api } from '../api';
import { useHlsFallback } from '../hooks/useHlsFallback';
import type { MediaItem } from '../types';

export function Player({item,queue,queueIndex,onEnded,onNext,onPrev,autoPlay}:{item:MediaItem;queue?:MediaItem[];queueIndex?:number;onEnded?:()=>void;onNext?:()=>void;onPrev?:()=>void;autoPlay?:boolean}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastProgress = useRef(0);
  const { fallback, error, startFallback } = useHlsFallback(item, videoRef);
  const [playing,setPlaying] = useState(false);
  const [current,setCurrent] = useState(0);
  const [duration,setDuration] = useState(item.duration || 0);
  const [volume,setVolume] = useState(1);
  const [muted,setMuted] = useState(false);
  const [pip,setPip] = useState(false);
  const [pipSupported,setPipSupported] = useState(false);

  useEffect(()=>{
    const video=videoRef.current;
    setPipSupported(Boolean(video && document.pictureInPictureEnabled && typeof video.requestPictureInPicture==='function'));
    if (!video) return;
    const handleEnterPip=()=>setPip(true);
    const handleLeavePip=()=>setPip(false);
    video.addEventListener('enterpictureinpicture',handleEnterPip);
    video.addEventListener('leavepictureinpicture',handleLeavePip);
    return ()=>{
      video.removeEventListener('enterpictureinpicture',handleEnterPip);
      video.removeEventListener('leavepictureinpicture',handleLeavePip);
    };
  },[]);

  function toggle(){const v=videoRef.current;if(!v)return; if(v.paused)void v.play(); else v.pause();}
  function seek(value:number){const v=videoRef.current;if(!v)return;v.currentTime=value;setCurrent(value);}
  function seekBy(seconds:number){const v=videoRef.current;if(!v)return;seek(Math.max(0,Math.min(v.duration || duration,current + seconds)));}
  function toggleMute(){const v=videoRef.current;if(!v)return;v.muted=!v.muted;setMuted(v.muted);}
  function setVol(value:number){const v=videoRef.current;if(!v)return;v.volume=value;v.muted=false;setMuted(false);setVolume(value);}
  async function fullscreen(){const el=containerRef.current;if(!el)return;if(document.fullscreenElement)await document.exitFullscreen();else await el.requestFullscreen();}
  async function togglePip(){const v=videoRef.current;if(!v||!pipSupported)return;if(document.pictureInPictureElement)await document.exitPictureInPicture();else await v.requestPictureInPicture().catch(()=>{});}

  return <div className="player" ref={containerRef} onDoubleClick={()=>void fullscreen()}>
    <video
      ref={videoRef}
      src={`/api/media/${item.id}/stream`}
      playsInline
      preload={autoPlay?'auto':'metadata'}
      autoPlay={autoPlay}
      onClick={toggle}
      onPlay={()=>setPlaying(true)}
      onPause={(e)=>{setPlaying(false);const v=e.currentTarget;void api.progress(item.id,v.currentTime,v.duration||duration);}}
      onLoadedMetadata={(e)=>{
        const v=e.currentTarget;setDuration(v.duration||item.duration||0);
        const resume=item.progress_position||0;
        if(resume>5 && (!v.duration || resume < v.duration*.92)) v.currentTime=resume;
      }}
      onTimeUpdate={(e)=>{
        const v=e.currentTarget;setCurrent(v.currentTime);
        if(Math.abs(v.currentTime-lastProgress.current)>5){lastProgress.current=v.currentTime;void api.progress(item.id,v.currentTime,v.duration||duration);}
      }}
      onEnded={(e)=>{void api.progress(item.id,e.currentTarget.duration,e.currentTarget.duration);onEnded?.();}}
      onError={()=>{if(fallback==='idle')void startFallback();}}
    />
    {fallback==='starting' && <div className="player-status"><SpinnerGap className="spin"/><strong>Preparing video…</strong><span>This may take a moment.</span></div>}
    {fallback==='error' && <div className="player-status error"><strong>Playback unavailable</strong><span>{error}</span></div>}
    <div className="player-gradient"/>
    <div className="player-controls">
      <input className="player-seek" aria-label="Seek" type="range" min="0" max={Math.max(duration,1)} step="0.1" value={Math.min(current,Math.max(duration,1))} onChange={(e)=>seek(Number(e.target.value))}/>
      <div className="player-toolbar">
        {onPrev && <button onClick={onPrev} aria-label="Previous"><SkipBack weight="fill"/></button>}
        <button className="skip-button" onClick={()=>seekBy(-10)} aria-label="Rewind 10 seconds"><Rewind weight="bold"/></button>
        <button onClick={toggle} aria-label={playing?'Pause':'Play'}>{playing?<Pause weight="fill"/>:<Play weight="fill"/>}</button>
        <button className="skip-button" onClick={()=>seekBy(10)} aria-label="Fast-forward 10 seconds"><FastForward weight="bold"/></button>
        {onNext && <button onClick={onNext} aria-label="Next"><SkipForward weight="fill"/></button>}
        <button onClick={toggleMute} aria-label={muted?'Unmute':'Mute'}>{muted?<SpeakerSlash weight="fill"/>:<SpeakerHigh weight="fill"/>}</button>
        <input className="volume-slider" aria-label="Volume" type="range" min="0" max="1" step="0.05" value={muted?0:volume} onChange={(e)=>setVol(Number(e.target.value))}/>
        <span className="player-time">{time(current)} / {time(duration)}</span>
        {queue && queueIndex!==undefined && <span className="player-queue">{queueIndex+1} / {queue.length}</span>}
        {pipSupported && <button onClick={()=>void togglePip()} aria-label={pip?'Exit Picture in Picture':'Picture in Picture'} className={pip?'active':''}>{pip?<PictureInPicture weight="fill"/>:<PictureInPicture/>}</button>}
        <button onClick={()=>void fullscreen()} aria-label="Fullscreen"><ArrowsOut/></button>
      </div>
    </div>
  </div>;
}
function time(value:number){if(!Number.isFinite(value))return '0:00';const h=Math.floor(value/3600);const m=Math.floor(value%3600/60);const s=Math.floor(value%60);return h?`${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`:`${m}:${String(s).padStart(2,'0')}`;}
