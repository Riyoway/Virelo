import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { CliUsageError, DEFAULT_PORT, parseCliArgs } from '../dist/cli-options.js';

test('uses the current directory when no media path is supplied', () => {
  const cwd = resolve('test-media');
  const options = parseCliArgs([], cwd);
  assert.deepEqual(options.mediaPaths, [cwd]);
  assert.equal(options.host, '127.0.0.1');
  assert.equal(options.port, DEFAULT_PORT);
  assert.equal(options.openBrowser, true);
});

test('parses repeated media paths and short options', () => {
  const cwd = resolve('workspace');
  const options = parseCliArgs(['-m', 'movies', '--media=shorts', '-d', '.data', '-H', '0.0.0.0', '-p', '8080', '--no-open'], cwd);
  assert.deepEqual(options.mediaPaths, [resolve(cwd, 'movies'), resolve(cwd, 'shorts')]);
  assert.equal(options.dataDir, resolve(cwd, '.data'));
  assert.equal(options.host, '0.0.0.0');
  assert.equal(options.port, 8080);
  assert.equal(options.openBrowser, false);
});

test('supports automatic port selection', () => {
  assert.equal(parseCliArgs(['--port', '0']).port, 0);
  assert.equal(parseCliArgs(['--random-port']).port, 0);
});

test('rejects unknown options and invalid ports', () => {
  assert.throws(() => parseCliArgs(['--wat']), CliUsageError);
  assert.throws(() => parseCliArgs(['--port', '-1']), CliUsageError);
  assert.throws(() => parseCliArgs(['--media']), CliUsageError);
});

test('published CLI help and version come from Virelo package metadata', async () => {
  const help = spawnSync(process.execPath, ['dist/cli.js', '--help'], { encoding: 'utf8' });
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /npx virelo/);
  assert.match(help.stdout, /--random-port/);
  assert.match(help.stdout, /serves the directory where the command is run/);

  const metadata = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const version = spawnSync(process.execPath, ['dist/cli.js', '--version'], { encoding: 'utf8' });
  assert.equal(version.status, 0, version.stderr);
  assert.equal(version.stdout.trim(), metadata.version);
});
