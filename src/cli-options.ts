import { resolve } from 'node:path';

export interface CliOptions {
  dataDir?: string;
  help: boolean;
  host: string;
  mediaPaths: string[];
  openBrowser: boolean;
  port: number;
  version: boolean;
}

export class CliUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CliUsageError';
  }
}

const VALUE_OPTIONS: ReadonlyMap<string, 'media' | 'data' | 'host' | 'port'> = new Map([
  ['--media', 'media'], ['-m', 'media'],
  ['--data', 'data'], ['-d', 'data'],
  ['--host', 'host'], ['-H', 'host'],
  ['--port', 'port'], ['-p', 'port']
] as const);

export function parseCliArgs(args: string[], cwd = process.cwd()): CliOptions {
  let data: string | undefined;
  let host = '127.0.0.1';
  let port = 4177;
  let openBrowser = true;
  let help = false;
  let version = false;
  const media: string[] = [];

  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument === '--help' || argument === '-h') { help = true; continue; }
    if (argument === '--version' || argument === '-v') { version = true; continue; }
    if (argument === '--no-open') { openBrowser = false; continue; }

    const equalsIndex = argument.indexOf('=');
    const option = equalsIndex > 0 ? argument.slice(0, equalsIndex) : argument;
    const optionType = VALUE_OPTIONS.get(option);
    if (!optionType) throw new CliUsageError(`Unknown option: ${argument}`);

    const inlineValue = equalsIndex > 0 ? argument.slice(equalsIndex + 1) : undefined;
    const value = inlineValue ?? args[++index];
    if (!value || (inlineValue === undefined && value.startsWith('-'))) {
      throw new CliUsageError(`${option} requires a value.`);
    }

    if (optionType === 'media') media.push(resolve(cwd, value));
    else if (optionType === 'data') data = resolve(cwd, value);
    else if (optionType === 'host') host = value.trim();
    else {
      port = Number(value);
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new CliUsageError('Port must be an integer between 1 and 65535.');
      }
    }
  }

  if (!host) throw new CliUsageError('Host cannot be empty.');
  const mediaPaths = [...new Set(media.length ? media : [resolve(cwd)])];
  return { dataDir: data, help, host, mediaPaths, openBrowser, port, version };
}
