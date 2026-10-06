import { useRef, useState } from 'react';
import { Repeat, RepeatOnce } from '@phosphor-icons/react';
import { PlayerActionMenu } from './PlayerActionMenu';
import { repeatLabels, type RepeatMode } from '../utils/playback-repeat';

export function RepeatControl({mode,hasQueue,onChange}:{mode:RepeatMode;hasQueue:boolean;onChange:(mode:RepeatMode)=>void}) {
  const button=useRef<HTMLButtonElement>(null);
  const [position,setPosition]=useState<{x:number;y:number}|null>(null);
  const open=()=>{const bounds=button.current?.getBoundingClientRect();if(bounds)setPosition({x:bounds.left,y:bounds.top-(hasQueue?144:96)-8});};
  return <div className="repeat-control">
    <button ref={button} type="button" className={mode==='off'?'':'active'} aria-label="Repeat" title={repeatLabels[mode]} aria-haspopup="menu" aria-expanded={Boolean(position)}
      onClick={()=>position?setPosition(null):open()} onKeyDown={event=>{if(event.key==='ArrowDown'){event.preventDefault();event.stopPropagation();open();}}}>
      {mode==='one'?<RepeatOnce weight="bold"/>:<Repeat weight={mode==='queue'?'bold':'regular'}/>}
      <span className="sr-only">{repeatLabels[mode]}</span>
    </button>
    {position&&<PlayerActionMenu label="Repeat" position={position} returnFocus={button.current} onClose={()=>setPosition(null)}
      actions={(hasQueue?['off','one','queue']:['off','one']).map(value=>({label:repeatLabels[value as RepeatMode],checked:mode===value,action:()=>onChange(value as RepeatMode)}))}/>}
  </div>;
}
