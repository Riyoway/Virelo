import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check } from '@phosphor-icons/react';

export interface PlayerAction { label:string; icon?:ReactNode; checked?:boolean; disabled?:boolean; action:()=>void; }

export function PlayerActionMenu({position,label,actions,returnFocus,onClose}:{
  position:{x:number;y:number}; label:string; actions:PlayerAction[]; returnFocus:HTMLElement|null; onClose:()=>void;
}) {
  const ref=useRef<HTMLDivElement>(null);
  const close=useRef(onClose);close.current=onClose;
  const [offset,setOffset]=useState(position);
  useLayoutEffect(()=>{
    const menu=ref.current;if(!menu)return;
    const bounds=menu.getBoundingClientRect();
    setOffset({x:Math.max(8,Math.min(position.x,innerWidth-bounds.width-8)),y:Math.max(8,Math.min(position.y,innerHeight-bounds.height-8))});
    menu.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({preventScroll:true});
  },[position]);
  useEffect(()=>{
    const outside=(event:PointerEvent)=>{if(!ref.current?.contains(event.target as Node))close.current();};
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();returnFocus?.focus({preventScroll:true});close.current();}};
    const viewport=(event:Event)=>{if(!(event.target instanceof Node && ref.current?.contains(event.target)))close.current();};
    document.addEventListener('pointerdown',outside);
    document.addEventListener('keydown',escape);
    window.addEventListener('resize',viewport);window.addEventListener('scroll',viewport,true);
    return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);window.removeEventListener('resize',viewport);window.removeEventListener('scroll',viewport,true);};
  },[returnFocus]);
  const dismiss=()=>{returnFocus?.focus({preventScroll:true});onClose();};
  return createPortal(<div ref={ref} className="player-action-menu" role="menu" aria-label={label} style={{left:offset.x,top:offset.y}}
    onClick={event=>event.stopPropagation()} onDoubleClick={event=>event.stopPropagation()}
    onPointerDown={event=>event.stopPropagation()} onContextMenu={event=>{event.preventDefault();event.stopPropagation();}}
    onKeyDown={event=>{
      event.stopPropagation();
      const buttons=Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')??[]);
      const index=buttons.indexOf(document.activeElement as HTMLButtonElement);
      if(event.key==='Escape'||event.key==='Tab'){if(event.key==='Escape')event.preventDefault();dismiss();return;}
      if(!buttons.length)return;
      const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:event.key==='ArrowDown'?(index+1)%buttons.length:event.key==='ArrowUp'?(index-1+buttons.length)%buttons.length:null;
      if(next!==null){event.preventDefault();buttons[next].focus();}
    }}>
    {actions.map(option=><button key={option.label} type="button" role={option.checked===undefined?'menuitem':'menuitemradio'} aria-checked={option.checked} disabled={option.disabled}
      onClick={()=>{dismiss();option.action();}}>{option.icon}<span>{option.label}</span>{option.checked&&<Check weight="bold"/>}</button>)}
  </div>,document.fullscreenElement||document.body);
}
