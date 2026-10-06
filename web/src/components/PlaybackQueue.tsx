import { useEffect, useRef } from 'react';
import { CaretLeft, CaretRight, Play, Queue as QueueIcon } from '@phosphor-icons/react';
import { artwork } from '../api';
import type { MediaItem } from '../types';

interface PlaybackQueueProps {
  items: MediaItem[];
  activeIndex: number;
  canGoPrevious: boolean;
  canGoNext: boolean;
  onSelect: (index: number) => void;
  onPrevious: () => void;
  onNext: () => void;
}

export function PlaybackQueue({items,activeIndex,canGoPrevious,canGoNext,onSelect,onPrevious,onNext}:PlaybackQueueProps) {
  const activeItem = useRef<HTMLButtonElement | null>(null);
  const queueList = useRef<HTMLOListElement | null>(null);

  useEffect(()=>{
    const list=queueList.current;
    const item=activeItem.current;
    if(!list||!item)return;
    const tile=item.parentElement as HTMLElement|null;
    if(!tile)return;
    const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const left=tile.offsetLeft-Math.max(0,(list.clientWidth-tile.clientWidth)/2);
    list.scrollTo({left:Math.max(0,left),behavior:reduceMotion?'auto':'smooth'});
  },[activeIndex]);

  return <section className="playback-queue" aria-labelledby="playback-queue-title">
    <header className="playback-queue-head">
      <div className="playback-queue-title">
        <QueueIcon/>
        <div><h2 id="playback-queue-title">Queue</h2><span>{activeIndex+1} of {items.length}</span></div>
      </div>
      <div className="playback-queue-nav">
        <button type="button" onClick={onPrevious} disabled={!canGoPrevious} aria-label="Previous video in queue"><CaretLeft/></button>
        <button type="button" onClick={onNext} disabled={!canGoNext} aria-label="Next video in queue"><CaretRight/></button>
      </div>
    </header>
    <ol className="playback-queue-list" ref={queueList}>
      {items.map((item,index)=>{
        const active=index===activeIndex;
        return <li key={item.id}>
          <button ref={active?(element)=>{activeItem.current=element;}:undefined} type="button" className={`playback-queue-item${active?' active':''}`} onClick={()=>onSelect(index)} aria-current={active?'true':undefined}>
            <span className="playback-queue-art">
              <span className="playback-queue-fallback"><Play weight="fill"/></span>
              <img src={artwork(item,item.backdrop_path?'backdrop':item.poster_path?'poster':'thumbnail')} alt="" loading="lazy" decoding="async" onError={(event)=>{event.currentTarget.style.display='none';}}/>
            </span>
            <span className="playback-queue-copy">
              <small>{active?'Now playing':`Item ${index+1}`}</small>
              <strong title={item.title}>{item.title}</strong>
              <span>{queueMeta(item)}</span>
            </span>
          </button>
        </li>;
      })}
    </ol>
  </section>;
}

function queueMeta(item:MediaItem) {
  const episode=item.kind==='series'&&item.season!=null&&item.episode!=null
    ? `S${String(item.season).padStart(2,'0')} · E${String(item.episode).padStart(2,'0')}`
    : item.container?.toUpperCase()||'Video';
  if(!item.duration||!Number.isFinite(item.duration)) return episode;
  const total=Math.round(item.duration);
  const hours=Math.floor(total/3600);
  const minutes=Math.floor(total%3600/60);
  const seconds=total%60;
  const duration=hours?`${hours}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`:`${minutes}:${String(seconds).padStart(2,'0')}`;
  return `${episode} · ${duration}`;
}
