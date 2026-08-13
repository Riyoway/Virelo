import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { VireloDB } from '../dist/db.js';

function seed(db, library, path, title, width, height) {
  return db.upsertMedia({
    library_id: library.id,
    path, filename: path.split('/').pop(), title, sort_title: title.toLowerCase(), kind: 'movie',
    series_title: null, season: null, episode: null, year: null, duration: 30, width, height,
    video_codec: 'h264', audio_codec: 'aac', container: 'mp4', folder: '', size: 1, mtime: 1,
    thumbnail_path: null, poster_path: null, backdrop_path: null, overview: null, genres: null, external_id: null
  });
}

async function withDb(run) {
  const dir = await mkdtemp(join(tmpdir(), 'virelo-shorts-'));
  try {
    await Promise.all(['thumbnails', 'artwork', 'cache'].map((name) => mkdir(join(dir, name), { recursive: true })));
    const db = new VireloDB(dir);
    try { run(db); }
    finally { db.close(); }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('shorts feed defaults to portrait videos and paginates', async () => {
  await withDb((db) => {
    const library = db.addLibrary('/tmp/media', 'Media');
    const portrait = seed(db, library, '/tmp/media/vertical.mp4', 'Vertical Clip', 720, 1280);
    seed(db, library, '/tmp/media/wide.mp4', 'Wide Movie', 1920, 1080);
    seed(db, library, '/tmp/media/unknown.mp4', 'Unknown Dimensions', null, null);

    const defaultFeed = db.getShorts({});
    assert.equal(defaultFeed.total, 1);
    assert.equal(defaultFeed.items[0].id, portrait.id);

    const landscapeFeed = db.getShorts({ includeLandscapes: true });
    assert.equal(landscapeFeed.total, 2);

    const firstPage = db.getShorts({ limit: 1, offset: 0, includeLandscapes: true });
    const secondPage = db.getShorts({ limit: 1, offset: 1, includeLandscapes: true });
    assert.equal(firstPage.items.length, 1);
    assert.equal(secondPage.items.length, 1);
    assert.notEqual(firstPage.items[0].id, secondPage.items[0].id);
  });
});

test('likes persist and join into the shorts feed', async () => {
  await withDb((db) => {
    const library = db.addLibrary('/tmp/media', 'Media');
    const clip = seed(db, library, '/clip.mp4', 'Clip', 720, 1280);

    const before = db.getShorts({});
    assert.equal(before.items[0].liked, 0);

    db.setLike(clip.id, true);
    const liked = db.getShorts({});
    assert.equal(liked.items[0].liked, 1);

    db.setLike(clip.id, false);
    const unliked = db.getShorts({});
    assert.equal(unliked.items[0].liked, 0);
  });
});

test('shorts feed reports watch progress', async () => {
  await withDb((db) => {
    const library = db.addLibrary('/tmp/media', 'Media');
    const clip = seed(db, library, '/clip.mp4', 'Clip', 720, 1280);
    db.setProgress(clip.id, 12, 30);
    const feed = db.getShorts({});
    assert.equal(feed.items[0].progress_position, 12);
    assert.equal(feed.items[0].progress_completed, 0);
  });
});
