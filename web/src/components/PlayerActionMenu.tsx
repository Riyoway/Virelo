import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check } from '@phosphor-icons/react';
import { useContextMenuPlacement } from '../hooks/useContextMenuPlacement';
import type { ContextMenuPosition } from '../utils/context-menu';

export interface PlayerAction { label:string; icon?:ReactNode; checked?:boolean; disabled?:boolean; action:()=>void; }

export function PlayerActionMenu({position,label,actions,returnFocus,onClose}:{
  position:ContextMenuPosition; label:string; actions:PlayerAction[]; returnFocus:HTMLElement|null; onClose:()=>void;
}) {
  const ref=useRef<HTMLDivElement>(null);
  const close=useRef(onClose);close.current=onClose;
  const placement=useContextMenuPlacement(ref,position,returnFocus);
  useLayoutEffect(()=>{
    const menu=ref.current;if(!menu)return;
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
  return createPortal(<div ref={ref} className="player-action-menu context-popover" data-side={placement.side} data-animate={placement.animate} role="menu" aria-label={label} style={placement.style}
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
    <div className="context-popover-content player-action-menu-content">
    {actions.map(option=><button key={option.label} type="button" role={option.checked===undefined?'menuitem':'menuitemradio'} aria-checked={option.checked} disabled={option.disabled}
      onClick={()=>{dismiss();option.action();}}>{option.icon}<span>{option.label}</span>{option.checked&&<Check weight="bold"/>}</button>)}
    </div>
  </div>,document.fullscreenElement||document.body);
}
