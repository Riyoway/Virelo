import { Link, useNavigate } from '@tanstack/react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Play } from '@phosphor-icons/react';
import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react';
import { api, artwork } from '../api';
import type { MediaItem } from '../types';
import { PreviewPlayer } from './PreviewPlayer';
import { MediaContextMenu } from './MediaContextMenu';

const HOVER_CAPABLE = typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

export function MediaCard({item, compact=false, short=false, playDirect=false, preview=false, onHoverChange}:{item:MediaItem;compact?:boolean;short?:boolean;playDirect?:boolean;preview?:boolean;onHoverChange?:(hovered:boolean)=>void}) {
  const navigate = useNavigate();
  const client = useQueryClient();
  const [menuPosition, setMenuPosition] = useState<{x:number;y:number}|null>(null);
  const [favorite, setFavorite] = useState(Boolean(item.liked));
  const longPressTimer = useRef<number | null>(null);
  const longPressTriggered = useRef(false);
  const favoriteMutation = useMutation({
    mutationFn: (liked:boolean) => api.setLike(item.id, liked),
    onSuccess: (result) => {
      setFavorite(result.liked);
      void client.invalidateQueries({queryKey:['home']});
      void client.invalidateQueries({queryKey:['favorites']});
      void client.invalidateQueries({queryKey:['media']});
      void client.invalidateQueries({queryKey:['shorts']});
    },
    onError: () => setFavorite((current) => !current)
  });
  useEffect(() => setFavorite(Boolean(item.liked)), [item.liked]);
  useEffect(() => () => {
    if (longPressTimer.current !== null) window.clearTimeout(longPressTimer.current);
  }, []);
  const progressDuration = item.progress_duration || item.duration || 0;
  const progress = progressDuration > 0 ? Math.min(100, ((item.progress_position || 0) / progressDuration) * 100) : 0;
  const isPortrait = Boolean(item.width && item.height && item.height > item.width);
  const destination = short ? '/shorts' : playDirect ? '/watch/$mediaId' : '/title/$mediaId';
  const progressLabel = playDirect && (item.progress_position || 0) > 10 ? `Resume ${formatTime(item.progress_position || 0)}` : null;
  const previewStart = (item.progress_position || 0) > 5 ? item.progress_position! : 0;
  const openMenu = (x:number, y:number) => setMenuPosition({x, y});
  const clearLongPress = () => {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };
  const handlePointerDown = (event:PointerEvent<HTMLAnchorElement>) => {
    if (event.pointerType !== 'touch') return;
    clearLongPress();
    longPressTriggered.current = false;
    longPressTimer.current = window.setTimeout(() => {
      longPressTriggered.current = true;
      openMenu(event.clientX, event.clientY);
    }, 520);
  };
  const handleClick = (event:MouseEvent<HTMLAnchorElement>) => {
    if (!longPressTriggered.current) return;
    event.preventDefault();
    event.stopPropagation();
    longPressTriggered.current = false;
  };
  const goToPlayback = () => {
    if (short) void navigate({to:'/shorts'});
    else void navigate({to:'/watch/$mediaId',params:{mediaId:String(item.id)}});
  };
  const goToDetails = () => void navigate({to:'/title/$mediaId',params:{mediaId:String(item.id)}});
  return (
    <Link to={destination} params={short ? undefined : {mediaId:String(item.id)}} aria-label={progressLabel ? `${progressLabel}: ${item.title}` : undefined} className={`media-card ${compact?'compact':''} ${playDirect?'resume-card ':''}${short?`shorts-card ${isPortrait?'art-portrait':'art-landscape'}`:''}${preview?' previewing':''}`} preload="intent"
      onMouseEnter={HOVER_CAPABLE && onHoverChange ? ()=>onHoverChange(true) : undefined}
      onMouseLeave={HOVER_CAPABLE && onHoverChange ? ()=>onHoverChange(false) : undefined}
      onContextMenu={(event) => { event.preventDefault(); openMenu(event.clientX, event.clientY); }}
      onPointerDown={handlePointerDown}
      onPointerMove={clearLongPress}
      onPointerUp={clearLongPress}
      onPointerCancel={clearLongPress}
      onClick={handleClick}>
      <div className="media-card-art">
        <img src={artwork(item, item.external_id ? 'backdrop' : 'thumbnail')} alt="" loading="lazy" decoding="async" onError={(e)=>{const image=e.currentTarget;if(item.external_id && !image.dataset.fallback){image.dataset.fallback='1';image.src=artwork(item,'poster');return;}if(image.dataset.fallback==='1'){image.dataset.fallback='2';image.src=artwork(item,'thumbnail');return;}image.style.display='none';}}/>
        <div className="media-card-fallback"><Play weight="fill"/></div>
        <div className="media-card-play"><span><Play weight="fill"/></span></div>
        {preview && <PreviewPlayer item={item} start={previewStart} />}
        {progress > 0 && <div className="card-progress"><i style={{width:`${progress}%`}}/></div>}
      </div>
      <div className="media-card-copy">
        <strong title={item.title}>{item.title}</strong>
        <span>{progressLabel || item.year || (item.kind === 'series' && item.season ? `S${item.season} · E${item.episode}` : item.container?.toUpperCase() || 'Video')}</span>
      </div>
      {menuPosition && <MediaContextMenu
        item={{...item, liked: favorite ? 1 : 0}}
        position={menuPosition}
        favorite={favorite}
        onFavorite={() => { const next = !favorite; setFavorite(next); favoriteMutation.mutate(next); }}
        onPlay={goToPlayback}
        onDetails={goToDetails}
        onClose={() => setMenuPosition(null)}
      />}
    </Link>
  );
}

function formatTime(value:number) {
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
