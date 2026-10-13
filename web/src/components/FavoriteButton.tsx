import { Heart } from '@phosphor-icons/react';
import { useFavorite } from '../hooks/useFavorite';
import type { MediaItem } from '../types';

export function FavoriteButton({ item, iconOnly = false, short = false }: {
  item: MediaItem; iconOnly?: boolean; short?: boolean;
}) {
  const { favorite, pending, error, toggle } = useFavorite(item);
  const label = favorite ? 'Remove from favorites' : 'Add to favorites';
  return <>
    <button type="button" className={`favorite-button${favorite ? ' saved liked' : ''}${short ? ' short-favorite' : ''}`}
      aria-label={label} title={label} aria-pressed={favorite} aria-busy={pending} disabled={pending}
      onClick={() => void toggle()}>
      <Heart weight={favorite ? 'fill' : 'regular'} />
      {!iconOnly && <span>{favorite ? 'Saved' : 'Favorites'}</span>}
    </button>
    {error && <span className="favorite-error" role="alert">{error}</span>}
  </>;
}
