import { createWriteStream, existsSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { join } from 'node:path';
import type { VireloDB } from './db.js';

const TMDB_API = 'https://api.themoviedb.org/3';
const TMDB_IMAGE = 'https://image.tmdb.org/t/p';
const REQUEST_TIMEOUT = 15000;

async function fetchJson(url: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT) });
  if (!response.ok) throw new Error(`Metadata request failed: ${response.status}`);
  return response.json() as Promise<any>;
}

async function download(url: string, target: string) {
  if (existsSync(target)) return;
  const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(REQUEST_TIMEOUT) });
  if (!response.ok || !response.body) throw new Error(`Artwork download failed: ${response.status}`);
  await pipeline(Readable.fromWeb(response.body as any), createWriteStream(target));
}

export async function refreshTmdbMetadata(db: VireloDB, dataDir: string, mediaId: number) {
  const settings = db.getSettings();
  if (!settings.externalMetadataEnabled) throw new Error('External metadata is disabled. Enable it explicitly in Settings first.');
  if (!settings.tmdbApiKey) throw new Error('TMDB API key is not configured.');
  const media = db.getMedia(mediaId);
  if (!media) throw new Error('Media not found.');

  const type = media.kind === 'series' ? 'tv' : 'movie';
  const query = media.kind === 'series' && media.series_title ? media.series_title : media.title;
  const params = new URLSearchParams({ api_key: settings.tmdbApiKey, query, language: settings.metadataLanguage, include_adult: 'false' });
  if (media.year) params.set(type === 'movie' ? 'year' : 'first_air_date_year', String(media.year));
  const searchJson = await fetchJson(`${TMDB_API}/search/${type}?${params.toString()}`);
  const match = searchJson.results?.[0];
  if (!match) throw new Error('No TMDB match found.');

  const details = await fetchJson(`${TMDB_API}/${type}/${match.id}?api_key=${encodeURIComponent(settings.tmdbApiKey)}&language=${encodeURIComponent(settings.metadataLanguage)}`);
  let content = details;
  let externalId = `tmdb:${type}:${details.id}`;

  // A parsed SxxExx item is matched to its show first, then to the exact episode.
  if (type === 'tv' && media.season != null && media.episode != null) {
    try {
      content = await fetchJson(`${TMDB_API}/tv/${details.id}/season/${media.season}/episode/${media.episode}?api_key=${encodeURIComponent(settings.tmdbApiKey)}&language=${encodeURIComponent(settings.metadataLanguage)}`);
      externalId = `tmdb:tv:${details.id}:s${media.season}:e${media.episode}`;
    } catch {
      content = details;
    }
  }

  let posterPath: string | null = media.poster_path;
  let backdropPath: string | null = media.backdrop_path;
  if (settings.externalImagesEnabled) {
    const posterRemote = details.poster_path;
    const backdropRemote = content.still_path || details.backdrop_path;
    if (posterRemote) {
      const target = join(dataDir, 'artwork', `tmdb-${type}-${details.id}-poster.jpg`);
      try { await download(`${TMDB_IMAGE}/w780${posterRemote}`, target); posterPath = target; } catch { /* text metadata is still useful */ }
    }
    if (backdropRemote) {
      const target = join(dataDir, 'artwork', `${media.id}-backdrop.jpg`);
      try { await download(`${TMDB_IMAGE}/w1280${backdropRemote}`, target); backdropPath = target; } catch { /* text metadata is still useful */ }
    }
  }

  const isEpisode = type === 'tv' && content !== details;
  const contentTitle = isEpisode
    ? (content.name ? `${media.series_title || details.name} · ${content.name}` : media.title)
    : (details.title || details.name || media.title);
  const date = isEpisode ? (content.air_date || '') : (details.release_date || details.first_air_date || '');
  const year = /^\d{4}/.test(date) ? Number(date.slice(0, 4)) : media.year;
  db.updateExternalMetadata(media.id, {
    title: contentTitle,
    overview: content.overview || details.overview || media.overview,
    genres: Array.isArray(details.genres) ? details.genres.map((g: any) => g.name).join(', ') : media.genres,
    poster_path: posterPath,
    backdrop_path: backdropPath,
    external_id: externalId,
    year
  });
  return db.getMedia(media.id);
}

export async function refreshMissingTmdbMetadata(db: VireloDB, dataDir: string, onProgress?: (done: number, total: number) => void) {
  const settings = db.getSettings();
  if (!settings.externalMetadataEnabled || !settings.tmdbApiKey) return { attempted: 0, updated: 0, failed: 0 };
  const candidates = db.listMetadataCandidates(5000);
  let updated = 0;
  let failed = 0;
  for (let index = 0; index < candidates.length; index++) {
    try {
      await refreshTmdbMetadata(db, dataDir, candidates[index].id);
      updated++;
    } catch {
      failed++;
    }
    onProgress?.(index + 1, candidates.length);
    // Be deliberately gentle with a user-provided third-party API quota.
    if (index + 1 < candidates.length) await new Promise((resolve) => setTimeout(resolve, 120));
  }
  return { attempted: candidates.length, updated, failed };
}
