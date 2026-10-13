import type { HomeData, MediaItem } from '../types';

// Patch existing items only: Shorts order, pagination offsets and playback data stay intact.
export function patchFavoriteData(data: unknown, id: number, liked: boolean): unknown {
  if (Array.isArray(data)) return data.map(value => patchFavoriteData(value, id, liked));
  if (!data || typeof data !== 'object') return data;
  const record = data as Record<string, unknown>;
  if (record.id === id && typeof record.title === 'string') return { ...record, liked: Number(liked) };
  return Object.fromEntries(Object.entries(record).map(([key, value]) =>
    [key, Array.isArray(value) ? patchFavoriteData(value, id, liked) : value]));
}

export function updateHomeFavorites(home: HomeData, item: MediaItem, liked: boolean): HomeData {
  const favorites = home.favorites.filter(value => value.id !== item.id);
  if (liked) favorites.unshift({ ...item, liked: 1 });
  return { ...home, favorites: favorites.slice(0, 24) };
}

export const FAVORITES_PAGE_SIZE = 100;
export function nextFavoritesPage(pages: MediaItem[][]): number | undefined {
  return pages.at(-1)?.length === FAVORITES_PAGE_SIZE
    ? pages.reduce((count, page) => count + page.length, 0) : undefined;
}
