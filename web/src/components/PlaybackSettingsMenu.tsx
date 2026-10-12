import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Check, MonitorPlay, SpeakerHigh, Subtitles, Waveform } from '@phosphor-icons/react';
import type { PlaybackQuality, PlaybackTrack } from '../types';
import type { QualityPreference } from '../utils/playback-quality';

type Setting = 'quality'|'audio'|'subtitles';

interface PlaybackSettingsMenuProps {
  audioTracks: PlaybackTrack[];
  subtitleTracks: PlaybackTrack[];
  selectedAudio: number|null;
  selectedSubtitle: number|null;
  busy?: boolean;
  qualityOptions: PlaybackQuality[];
  selectedQuality: number|null;
  qualityPreference: QualityPreference;
  activeQuality?: number|null;
  allowAutoQuality?: boolean;
  onSelectAudio: (stream: number) => void;
  onSelectSubtitle: (stream: number|null) => void;
  onSelectQuality: (preference: QualityPreference) => void;
}

export function PlaybackSettingsMenu({
  audioTracks, subtitleTracks, selectedAudio, selectedSubtitle, busy=false,
  qualityOptions, selectedQuality, qualityPreference, activeQuality=null, allowAutoQuality=false,
  onSelectAudio, onSelectSubtitle, onSelectQuality
}: PlaybackSettingsMenuProps) {
  const [open,setOpen] = useState<Setting|null>(null);
  const [animateOpen,setAnimateOpen] = useState(false);
  const [placement,setPlacement] = useState({left:0,top:0,width:280,maxHeight:320,anchor:140,side:'above'});
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const focusRequest = useRef<'first'|'last'|'selected'>('selected');
  const menuId = useId();

  function trigger(setting:Setting){
    return rootRef.current?.querySelector<HTMLButtonElement>(`[data-setting="${setting}"]`);
  }
  function closeMenu(returnFocus=false){
    if(returnFocus&&open)trigger(open)?.focus();
    setOpen(null);
  }
  function focusOption(which:'first'|'last'|'selected'){
    const options=Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')||[]);
    const option=which==='last'?options.at(-1):which==='selected'?options.find(button=>button.getAttribute('aria-checked')==='true')||options[0]:options[0];
    (option||menuRef.current)?.focus();
  }

  useEffect(()=>{
    if(!open)return;
    const close=(event:PointerEvent)=>{
      const target=event.target as Node;
      if(!rootRef.current?.contains(target)&&!menuRef.current?.contains(target))setOpen(null);
    };
    document.addEventListener('pointerdown',close);
    return()=>document.removeEventListener('pointerdown',close);
  },[open]);

  useLayoutEffect(()=>{
    if(!open)return;
    const controls=rootRef.current?.closest<HTMLElement>('.player-controls');
    const player=rootRef.current?.closest<HTMLElement>('.player');
    if(!controls||!player)return;
    const position=()=>{
      const bounds=controls.getBoundingClientRect(), button=trigger(open)?.getBoundingClientRect();
      if(!button)return;
      const width=Math.min(280,bounds.width-16,window.innerWidth-16);
      const above=Math.max(0,button.top-22), below=Math.max(0,window.innerHeight-button.bottom-22);
      const desiredHeight=Math.min(320,(menuRef.current?.querySelector('.playback-track-list')?.scrollHeight||0)
        +(menuRef.current?.querySelector('h3')?.offsetHeight||36)+16);
      const placeAbove=above>=desiredHeight||above>=below;
      const maxHeight=Math.min(320,placeAbove?above:below);
      const height=Math.min(desiredHeight,maxHeight);
      const left=Math.max(8,Math.min(button.left+button.width/2+28-width,window.innerWidth-width-8));
      const next={width,maxHeight,left,
        anchor:Math.max(24,Math.min(button.left+button.width/2-left,width-24)),
        side:placeAbove?'above':'below',
        top:placeAbove?Math.max(8,button.top-height-14):button.bottom+14};
      setPlacement(previous=>previous.left===next.left&&previous.top===next.top
        &&previous.width===next.width&&previous.maxHeight===next.maxHeight
        &&previous.anchor===next.anchor&&previous.side===next.side?previous:next);
    };
    position();
    focusOption(focusRequest.current);
    const resize=new ResizeObserver(position);
    resize.observe(player);resize.observe(controls);
    window.addEventListener('resize',position);
    window.addEventListener('scroll',position,true);
    document.addEventListener('fullscreenchange',position);
    return()=>{
      resize.disconnect();
      window.removeEventListener('resize',position);
      window.removeEventListener('scroll',position,true);
      document.removeEventListener('fullscreenchange',position);
    };
  },[open]);

  function toggleMenu(setting:Setting,pointer:boolean){
    focusRequest.current='selected';
    setAnimateOpen(pointer);
    setOpen(value=>value===setting?null:setting);
  }
  function select(action:()=>void){
    closeMenu(true);
    action();
  }
  function settingButton(setting:Setting,label:string,icon:React.ReactNode,detail?:string){
    return <button type="button" data-setting={setting} className={open===setting?'active':''}
      aria-label={label} title={detail?`${label}: ${detail}`:label} aria-haspopup="menu"
      aria-expanded={open===setting} aria-controls={open===setting?menuId:undefined}
      onClick={event=>toggleMenu(setting,event.detail>0)}
      onKeyDown={event=>{
        if(event.key==='ArrowDown'||event.key==='ArrowUp'){
          event.preventDefault();event.stopPropagation();
          setAnimateOpen(false);
          focusRequest.current=event.key==='ArrowUp'?'last':'first';
          if(open===setting)focusOption(focusRequest.current);else setOpen(setting);
        }
      }}>
      {icon}
    </button>;
  }

  const label=open==='quality'?'Quality':open==='audio'?'Audio':'Subtitles';
  const displayedQuality=qualityPreference==='source'?'Original':qualityPreference==='auto'&&allowAutoQuality?'Auto':qualityLabel(selectedQuality??activeQuality??qualityOptions[0]?.height);
  const selectedAudioTrack=audioTracks.find(track=>track.index===selectedAudio);
  const selectedSubtitleTrack=subtitleTracks.find(track=>track.index===selectedSubtitle);

  return <div className="playback-settings" ref={rootRef} onDoubleClick={event=>event.stopPropagation()}
    onKeyDown={event=>{
      if(open&&event.key==='Escape'){event.preventDefault();event.stopPropagation();closeMenu(true);}
    }}>
    {qualityOptions.length>0&&settingButton('quality','Quality',<><MonitorPlay/><span className="playback-quality-label">{displayedQuality}</span></>,displayedQuality)}
    {audioTracks.length>1&&settingButton('audio','Audio',<Waveform/>,selectedAudioTrack?trackLabel(selectedAudioTrack,'Audio',selectedAudioTrack.typeIndex+1):undefined)}
    {subtitleTracks.length>0&&settingButton('subtitles','Subtitles',<Subtitles weight={selectedSubtitle===null?'regular':'fill'}/>,selectedSubtitleTrack?trackLabel(selectedSubtitleTrack,'Subtitle',selectedSubtitleTrack.typeIndex+1):'Off')}
    {open&&createPortal(<div key={open} ref={menuRef} id={menuId} className="playback-settings-menu" role="menu" aria-label={label} tabIndex={-1}
      data-side={placement.side} data-animate={animateOpen}
      style={{left:placement.left,top:placement.top,width:placement.width,maxHeight:placement.maxHeight,
        '--popover-anchor-x':`${placement.anchor}px`} as CSSProperties}
      onClick={event=>event.stopPropagation()} onContextMenu={event=>event.preventDefault()}
      onKeyDown={event=>{
        if(event.key==='Tab'){closeMenu(true);return;}
        if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
        event.preventDefault();event.stopPropagation();
        const options=Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')||[]);
        if(!options.length)return;
        const current=options.indexOf(document.activeElement as HTMLButtonElement);
        const next=event.key==='Home'?0:event.key==='End'?options.length-1:
          (current+(event.key==='ArrowDown'?1:-1)+options.length)%options.length;
        options[next].focus();
      }}>
      <h3>{open==='quality'?<MonitorPlay/>:open==='audio'?<SpeakerHigh/>:<Subtitles/>}{label}</h3>
      <div className="playback-track-list">
        {open==='quality'&&<button type="button" role="menuitemradio" tabIndex={-1}
          aria-checked={qualityPreference==='source'} className={qualityPreference==='source'?'selected':''}
          disabled={busy} onClick={()=>select(()=>onSelectQuality('source'))}>
          <span><strong>Original Quality</strong><small>Uses each video's original resolution</small></span>
          {qualityPreference==='source'&&<Check weight="bold"/>}
        </button>}
        {open==='quality'&&allowAutoQuality&&<button type="button" role="menuitemradio" tabIndex={-1}
          aria-checked={qualityPreference==='auto'} className={qualityPreference==='auto'?'selected':''}
          disabled={busy} onClick={()=>select(()=>onSelectQuality('auto'))}>
          <span><strong>Auto</strong><small>{activeQuality?`Playing at ${qualityLabel(activeQuality)}`:'Adjusts to your network'}</small></span>
          {qualityPreference==='auto'&&<Check weight="bold"/>}
        </button>}
        {open==='quality'&&qualityOptions.map((quality,index)=><button type="button" role="menuitemradio" tabIndex={-1}
          aria-checked={typeof qualityPreference==='number'&&selectedQuality===quality.height} className={typeof qualityPreference==='number'&&selectedQuality===quality.height?'selected':''}
          disabled={busy} key={quality.height} onClick={()=>select(()=>onSelectQuality(quality.height))}>
          <span><strong>{quality.label}</strong><small>{index===0?'Highest available':formatBitrate(quality.bitrate)}</small></span>
          {typeof qualityPreference==='number'&&selectedQuality===quality.height&&<Check weight="bold"/>}
        </button>)}
        {open==='audio'&&audioTracks.map(track=><button type="button" role="menuitemradio" tabIndex={-1}
          aria-checked={selectedAudio===track.index} className={selectedAudio===track.index?'selected':''}
          disabled={busy||!track.supported} key={track.index} onClick={()=>select(()=>onSelectAudio(track.index))}>
          <span><strong>{trackLabel(track,'Audio',track.typeIndex+1)}</strong><small>{track.supported?trackMeta(track):`${track.codec.toUpperCase()} · Unavailable`}</small></span>
          {selectedAudio===track.index&&<Check weight="bold"/>}
        </button>)}
        {open==='subtitles'&&<>
          <button type="button" role="menuitemradio" tabIndex={-1} aria-checked={selectedSubtitle===null}
            className={selectedSubtitle===null?'selected':''} disabled={busy} onClick={()=>select(()=>onSelectSubtitle(null))}>
            <span><strong>Off</strong></span>{selectedSubtitle===null&&<Check weight="bold"/>}
          </button>
          {subtitleTracks.map(track=><button type="button" role="menuitemradio" tabIndex={-1}
            aria-checked={selectedSubtitle===track.index} className={selectedSubtitle===track.index?'selected':''}
            disabled={busy||!track.supported} key={track.index} onClick={()=>select(()=>onSelectSubtitle(track.index))}>
            <span><strong>{trackLabel(track,'Subtitle',track.typeIndex+1)}</strong><small>{track.supported?track.codec.toUpperCase():'Image subtitles are not supported'}</small></span>
            {selectedSubtitle===track.index&&<Check weight="bold"/>}
          </button>)}
        </>}
      </div>
    </div>,document.fullscreenElement||document.body)}
  </div>;
}

function qualityLabel(height:number|undefined){return !height?'Quality':height>=2160?'4K':`${height}p`;}
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
