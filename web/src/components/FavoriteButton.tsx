import { useEffect, useRef } from 'react';
import { Heart } from '@phosphor-icons/react';
import { useFavorite } from '../hooks/useFavorite';
import type { MediaItem } from '../types';

export function FavoriteButton({ item, iconOnly = false, short = false }: {
  item: MediaItem; iconOnly?: boolean; short?: boolean;
}) {
  const { favorite, pending, error, toggle } = useFavorite(item);
  const iconRef = useRef<HTMLSpanElement>(null);
  const clickEffect = useRef<Animation | null>(null);
  useEffect(() => () => { clickEffect.current?.cancel(); }, [item.id]);
  const label = favorite ? 'Remove from favorites' : 'Add to favorites';
  return <>
    <button type="button" className={`favorite-button${favorite ? ' saved liked' : ''}${short ? ' short-favorite' : ''}`}
      aria-label={label} title={label} aria-pressed={favorite} aria-busy={pending} disabled={pending}
      onClick={event => {
        if (pending) return;
        const icon = iconRef.current;
        const style = icon ? getComputedStyle(icon) : null;
        const transform = style?.transform || 'none';
        const opacity = style?.opacity || '1';
        const easing = style?.getPropertyValue('--ease-out').trim() || 'cubic-bezier(0.23, 1, 0.32, 1)';
        clickEffect.current?.cancel();
        if (event.detail > 0 && icon?.animate && style) {
          const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          const frames = reduced
            ? [{ opacity }, { opacity: 0.6, offset: 0.4 }, { opacity: 1 }]
            : [{ transform }, { transform: favorite ? 'scale(0.9)' : 'scale(1.18)', offset: 0.4 }, { transform: 'scale(1)' }];
          try {
            clickEffect.current = icon.animate(frames, { duration: 160, easing });
          } catch {
            // Visual feedback must never prevent saving.
            clickEffect.current = null;
          }
        }
        void toggle();
      }}>
      <span ref={iconRef} className="favorite-icon" aria-hidden="true"><Heart weight={favorite ? 'fill' : 'regular'} /></span>
      {!iconOnly && <span>{favorite ? 'Saved' : 'Favorites'}</span>}
    </button>
    {error && <span className="favorite-error" role="alert">{error}</span>}
  </>;
}
