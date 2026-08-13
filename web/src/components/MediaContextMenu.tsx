import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check, Heart, Info, Play } from '@phosphor-icons/react';
import type { MediaItem } from '../types';

type MenuPosition = { x: number; y: number };

export function MediaContextMenu({
  item,
  position,
  favorite,
  onFavorite,
  onPlay,
  onDetails,
  onClose
}: {
  item: MediaItem;
  position: MenuPosition;
  favorite: boolean;
  onFavorite: () => void;
  onPlay: () => void;
  onDetails: () => void;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const firstItemRef = useRef<HTMLButtonElement>(null);
  const [offset, setOffset] = useState(position);

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const rect = menu.getBoundingClientRect();
    const margin = 12;
    setOffset({
      x: Math.max(margin, Math.min(position.x, window.innerWidth - rect.width - margin)),
      y: Math.max(margin, Math.min(position.y, window.innerHeight - rect.height - margin))
    });
  }, [position]);

  useEffect(() => {
    firstItemRef.current?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    const onViewportChange = () => onClose();
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', onViewportChange, true);
    window.addEventListener('resize', onViewportChange);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', onViewportChange, true);
      window.removeEventListener('resize', onViewportChange);
    };
  }, [onClose]);

  const choose = (action: () => void) => {
    onClose();
    action();
  };

  return createPortal(
    <div
      ref={menuRef}
      className="media-context-menu"
      role="menu"
      aria-label={`${item.title} actions`}
      style={{ left: offset.x, top: offset.y }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="media-context-menu-title" title={item.title}>
        <span>{item.title}</span>
      </div>
      <div className="media-context-menu-divider" />
      <MenuItem ref={firstItemRef} icon={<Heart weight={favorite ? 'fill' : 'regular'} />} onClick={() => choose(onFavorite)}>
        {favorite ? 'Remove from favorites' : 'Add to favorites'}
        {favorite && <Check className="media-context-menu-check" weight="bold" />}
      </MenuItem>
      <MenuItem icon={<Play weight="fill" />} onClick={() => choose(onPlay)}>
        {item.progress_position && item.progress_position > 10 && !item.progress_completed ? 'Resume playback' : 'Play now'}
      </MenuItem>
      <MenuItem icon={<Info />} onClick={() => choose(onDetails)}>Open details</MenuItem>
    </div>,
    document.body
  );
}

function MenuItem({ children, icon, onClick, ref }: { children: ReactNode; icon: ReactNode; onClick: () => void; ref?: React.Ref<HTMLButtonElement> }) {
  return <button ref={ref} className="media-context-menu-item" role="menuitem" onClick={onClick}>
    <span className="media-context-menu-icon">{icon}</span>
    <span>{children}</span>
  </button>;
}
