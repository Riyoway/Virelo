import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createVireloServer } from '../dist/server.js';

test('health remains available when FFmpeg tools cannot be started', async () => {
  const root = await mkdtemp(join(tmpdir(), 'virelo-server-test-'));
  const dataDir = join(root, 'data');
  const mediaDir = join(root, 'media');
  await Promise.all([
    mkdir(join(dataDir, 'cache', 'hls'), { recursive: true }),
    mkdir(join(dataDir, 'thumbnails'), { recursive: true }),
    mkdir(join(dataDir, 'artwork'), { recursive: true }),
    mkdir(mediaDir, { recursive: true })
  ]);
  const previousFfmpeg = process.env.FFMPEG_PATH;
  const previousFfprobe = process.env.FFPROBE_PATH;
  const previousLogLevel = process.env.VIRELO_LOG_LEVEL;
  process.env.FFMPEG_PATH = join(root, 'missing-ffmpeg');
  process.env.FFPROBE_PATH = join(root, 'missing-ffprobe');
  process.env.VIRELO_LOG_LEVEL = 'silent';
  let app;
  try {
    ({ app } = await createVireloServer({
      dataDir,
      host: '127.0.0.1',
      port: 4177,
      mediaPaths: [mediaDir]
    }));
    const response = await app.inject({ method: 'GET', url: '/api/health' });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), {
      ok: true,
      version: '0.1.0',
      ffmpeg: false,
      ffprobe: false,
      scan: {
        running: false,
        startedAt: null,
        finishedAt: null,
        total: 0,
        scanned: 0,
        added: 0,
        updated: 0,
        skipped: 0,
        errors: 0,
        message: 'Idle'
      }
    });
  } finally {
    if (app) await app.close();
    if (previousFfmpeg === undefined) delete process.env.FFMPEG_PATH;
    else process.env.FFMPEG_PATH = previousFfmpeg;
    if (previousFfprobe === undefined) delete process.env.FFPROBE_PATH;
    else process.env.FFPROBE_PATH = previousFfprobe;
    if (previousLogLevel === undefined) delete process.env.VIRELO_LOG_LEVEL;
    else process.env.VIRELO_LOG_LEVEL = previousLogLevel;
    await rm(root, { recursive: true, force: true });
  }
});
