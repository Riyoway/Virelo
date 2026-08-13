#!/usr/bin/env node
import { stat } from 'node:fs/promises';
import open from 'open';
import { defaultDataDir, ensureDataDirs } from './config.js';
import { CliUsageError, DEFAULT_PORT, parseCliArgs } from './cli-options.js';
import { VIRELO_VERSION } from './version.js';

function usage() {
  console.log(`Virelo — personal media server

Usage:
  npx virelo [options]
  virelo [options]

Options:
  -m, --media <path>  Use a media directory (repeatable)
  -d, --data <path>   Store data and cache in this directory (default: ~/.virelo)
  -H, --host <host>   Bind address (default: 127.0.0.1)
  -p, --port <port>   HTTP port (default: ${DEFAULT_PORT}; use 0 for an available port)
      --random-port   Select an available HTTP port automatically
      --no-open       Do not open a browser
  -h, --help          Show help
  -v, --version       Show version

With no --media option, Virelo serves the directory where the command is run.
`);
}

async function loadServer() {
  const emitWarning = process.emitWarning;
  process.emitWarning = ((warning: string | Error, ...args: unknown[]) => {
    const type = typeof args[0] === 'string' ? args[0] : undefined;
    if (type === 'ExperimentalWarning' && String(warning).includes('SQLite')) return;
    Reflect.apply(emitWarning, process, [warning, ...args]);
  }) as typeof process.emitWarning;
  try {
    return await import('./server.js');
  } finally {
    process.emitWarning = emitWarning;
  }
}

async function main() {
  const options = parseCliArgs(process.argv.slice(2));
  if (options.help) { usage(); return; }
  if (options.version) { console.log(VIRELO_VERSION); return; }

  for (const path of options.mediaPaths) {
    let readable = false;
    try { readable = (await stat(path)).isDirectory(); } catch { /* handled below */ }
    if (!readable) throw new CliUsageError(`Media directory cannot be read: ${path}`);
  }

  const dataDir = options.dataDir ?? defaultDataDir();
  ensureDataDirs(dataDir);
  const { startServer } = await loadServer();
  const { app, port } = await startServer({ dataDir, host: options.host, port: options.port, mediaPaths: options.mediaPaths });
  const browserHost = options.host === '0.0.0.0' || options.host === '::' ? '127.0.0.1' : options.host;
  const url = `http://${browserHost}:${port}`;
  console.log(`\nVirelo is ready\n  Local:  ${url}\n  Media:  ${options.mediaPaths.join(', ')}\n  Data:   ${dataDir}${options.host === '0.0.0.0' ? `\n  LAN:    http://<your-lan-ip>:${port}` : ''}\n`);
  if (options.openBrowser) void open(url).catch(() => undefined);

  const shutdown = async () => {
    process.off('SIGINT', shutdown);
    process.off('SIGTERM', shutdown);
    await app.close();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Virelo could not start: ${message}`);
  if (error instanceof CliUsageError) console.error('Run "virelo --help" for usage.');
  process.exitCode = 1;
});
