import { CaretLeft, CaretRight } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import type { MediaItem } from '../types';
import { MediaCard } from './MediaCard';
import { useRowWheel } from '../hooks/useRowWheel';

export function MediaRow({title,items,playDirect=false}:{title:string;items:MediaItem[];playDirect?:boolean}) {
  const ref = useRef<HTMLDivElement>(null);
  const hoverTimer = useRef<number | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);
  useRowWheel(ref);

  useEffect(() => {
    const row = ref.current;
    if (!row || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) setActiveId(null);
    });
    observer.observe(row);
    return () => observer.disconnect();
  }, []);

  useEffect(() => () => { if (hoverTimer.current) clearTimeout(hoverTimer.current); }, []);

  if (!items.length) return null;
  const scroll = (dir:number) => ref.current?.scrollBy({ left: dir * Math.min(ref.current.clientWidth * .86, 1000), behavior:'smooth' });
  const handleHover = (id:number) => (hovered:boolean) => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    if (hovered) hoverTimer.current = window.setTimeout(() => setActiveId(id), 160);
    else setActiveId((current) => (current === id ? null : current));
  };
  return (
    <section className="media-section">
      <div className="section-heading"><h2>{title}</h2><div className="row-controls"><button onClick={()=>scroll(-1)} aria-label="Scroll left"><CaretLeft/></button><button onClick={()=>scroll(1)} aria-label="Scroll right"><CaretRight/></button></div></div>
      <div className="media-row" ref={ref}>{items.map(item=><MediaCard key={item.id} item={item} playDirect={playDirect} preview={activeId===item.id} onHoverChange={handleHover(item.id)}/>)}</div>
    </section>
  );
}