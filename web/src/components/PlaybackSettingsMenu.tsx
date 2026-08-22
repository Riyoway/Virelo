import { useEffect, useRef, useState } from 'react';
import { Check, MonitorPlay, SlidersHorizontal, SpeakerHigh, Subtitles } from '@phosphor-icons/react';
import type { PlaybackQuality, PlaybackTrack } from '../types';

interface PlaybackSettingsMenuProps {
  audioTracks: PlaybackTrack[];
  subtitleTracks: PlaybackTrack[];
  selectedAudio: number|null;
  selectedSubtitle: number|null;
  busy?: boolean;
  qualityOptions: PlaybackQuality[];
  selectedQuality: number|null;
  activeQuality: number|null;
  onSelectAudio: (stream: number) => void;
  onSelectSubtitle: (stream: number|null) => void;
  onSelectQuality: (height: number|null) => void;
}

export function PlaybackSettingsMenu({
  audioTracks,
  subtitleTracks,
  selectedAudio,
  selectedSubtitle,
  busy=false,
  qualityOptions,
  selectedQuality,
  activeQuality,
  onSelectAudio,
  onSelectSubtitle,
  onSelectQuality
}: PlaybackSettingsMenuProps) {
  const [open,setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const hasOptions = qualityOptions.length > 0 || audioTracks.length > 1 || subtitleTracks.length > 0;

  useEffect(()=>{
    if(!open)return;
    const close=(event:PointerEvent)=>{if(!rootRef.current?.contains(event.target as Node))setOpen(false);};
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')setOpen(false);};
    document.addEventListener('pointerdown',close);
    document.addEventListener('keydown',escape);
    return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',escape);};
  },[open]);

  if(!hasOptions)return null;

  return <div className="playback-settings" ref={rootRef}>
    <button
      type="button"
      className={open?'active':''}
      aria-label="Playback settings"
      aria-haspopup="menu"
      aria-expanded={open}
      onClick={()=>setOpen((value)=>!value)}
    >
      <SlidersHorizontal/>
    </button>
    {open&&<div className="playback-settings-menu" role="menu" aria-label="Playback settings" onClick={(event)=>event.stopPropagation()}>
      {qualityOptions.length>0&&<section>
        <h3><MonitorPlay/>Quality</h3>
        <div className="playback-track-list">
          <button type="button" role="menuitemradio" aria-checked={selectedQuality===null} className={selectedQuality===null?'selected':''} disabled={busy} onClick={()=>{onSelectQuality(null);setOpen(false);}}>
            <span><strong>Auto</strong><small>{activeQuality?`Playing at ${qualityLabel(activeQuality)}`:'Adjusts to your network'}</small></span>
            {selectedQuality===null&&<Check weight="bold"/>}
          </button>
          {qualityOptions.map((quality)=><button type="button" role="menuitemradio" aria-checked={selectedQuality===quality.height} className={selectedQuality===quality.height?'selected':''} disabled={busy} key={quality.height} onClick={()=>{onSelectQuality(quality.height);setOpen(false);}}>
            <span><strong>{quality.label}</strong><small>{quality===qualityOptions[0]?'Highest available':formatBitrate(quality.bitrate)}</small></span>
            {selectedQuality===quality.height&&<Check weight="bold"/>}
          </button>)}
        </div>
      </section>}
      {audioTracks.length>1&&<section>
        <h3><SpeakerHigh/>Audio</h3>
        <div className="playback-track-list">
          {audioTracks.map((track)=><button
            type="button"
            role="menuitemradio"
            aria-checked={selectedAudio===track.index}
            className={selectedAudio===track.index?'selected':''}
            disabled={busy||!track.supported}
            key={track.index}
            onClick={()=>{onSelectAudio(track.index);setOpen(false);}}
          >
            <span><strong>{trackLabel(track,'Audio',track.typeIndex+1)}</strong><small>{track.supported?trackMeta(track):`${track.codec.toUpperCase()} · Unavailable`}</small></span>
            {selectedAudio===track.index&&<Check weight="bold"/>}
          </button>)}
        </div>
      </section>}
      {subtitleTracks.length>0&&<section>
        <h3><Subtitles/>Subtitles</h3>
        <div className="playback-track-list">
          <button
            type="button"
            role="menuitemradio"
            aria-checked={selectedSubtitle===null}
            className={selectedSubtitle===null?'selected':''}
            disabled={busy}
            onClick={()=>{onSelectSubtitle(null);setOpen(false);}}
          >
            <span><strong>Off</strong></span>
            {selectedSubtitle===null&&<Check weight="bold"/>}
          </button>
          {subtitleTracks.map((track)=><button
            type="button"
            role="menuitemradio"
            aria-checked={selectedSubtitle===track.index}
            className={selectedSubtitle===track.index?'selected':''}
            disabled={busy||!track.supported}
            key={track.index}
            onClick={()=>{onSelectSubtitle(track.index);setOpen(false);}}
          >
            <span><strong>{trackLabel(track,'Subtitle',track.typeIndex+1)}</strong><small>{track.supported?track.codec.toUpperCase():'Image subtitles are not supported'}</small></span>
            {selectedSubtitle===track.index&&<Check weight="bold"/>}
          </button>)}
        </div>
      </section>}
    </div>}
  </div>;
}

function qualityLabel(height:number){return height>=2160?'4K':`${height}p`;}
function formatBitrate(bitrate:number){return `${(bitrate/1_000_000).toFixed(bitrate>=1_000_000?1:2)} Mbps`;}

function trackLabel(track:PlaybackTrack,fallback:string,number:number){
  if(track.title)return track.title;
  if(track.language)return languageName(track.language);
  return `${fallback} ${number}`;
}
function trackMeta(track:PlaybackTrack){
  return [track.language?.toUpperCase(),track.codec.toUpperCase(),track.channelLayout||channelLabel(track.channels)].filter(Boolean).join(' · ');
}
function channelLabel(channels:number|null){
  if(channels===1)return 'Mono';
  if(channels===2)return 'Stereo';
  return channels?`${channels} channels`:'';
}
function languageName(code:string){
  try{return new Intl.DisplayNames(undefined,{type:'language'}).of(code)||code.toUpperCase();}
  catch{return code.toUpperCase();}
}
