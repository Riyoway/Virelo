# Virelo

Virelo turns a folder of videos into a private, streaming-style web library.

```bash
cd /path/to/videos
npx virelo
```

Virelo scans the directory where the command is run, starts a server on `http://127.0.0.1:4177`, and opens it in your browser. No account or setup file is required.

## Features

- Recursive video scanning and automatic rescans when files change
- Movie, series, season, and episode filename parsing
- SQLite catalog and watch progress
- Search, folders, favorites, Continue Watching, and Shorts
- HTTP range streaming and browser seeking
- Optional FFmpeg thumbnails, media probing, and HLS fallback
- Responsive web UI for desktop, tablet, and mobile
- Optional TMDB metadata and artwork, disabled until configured
- Localhost-only access by default

## Requirements

- Node.js 22.16 or newer
- Optional: `ffmpeg` and `ffprobe` available in `PATH`

Without FFmpeg, Virelo can still scan and directly play formats supported by the browser. FFmpeg adds thumbnails, codec detection, and HLS conversion for formats the browser cannot play directly.

## CLI

```text
virelo [options]

-m, --media <path>  Use a media directory (repeatable)
-d, --data <path>   Store data and cache in this directory (default: ~/.virelo)
-H, --host <host>   Bind address (default: 127.0.0.1)
-p, --port <port>   HTTP port (default: 4177)
    --no-open        Do not open a browser
-h, --help           Show help
-v, --version        Show version
```

If `--media` is omitted, Virelo uses the current directory. Supplying one or more `--media` options replaces that default for the current run.

```bash
# Serve the current directory
npx virelo

# Serve one directory without changing directories
npx virelo --media ~/Videos

# Combine multiple directories
npx virelo --media ~/Movies --media ~/Clips

# Allow access from devices on the same trusted LAN
npx virelo --host 0.0.0.0
```

## Media names

Virelo recognizes common movie and episode naming patterns.

```text
Movies/
  Blade Runner (1982).mkv

Series/
  Example Show/
    Season 01/
      Example.Show.S01E01.mkv
      Example.Show.S01E02.mkv
```

Supported containers include MP4, M4V, MKV, WebM, MOV, AVI, WMV, MPEG, TS, M2TS, FLV, OGV, and 3GP. Browser codec support still determines whether a file can direct-play without FFmpeg.

## Metadata

TMDB integration is optional.

1. Open **Settings → Network**.
2. Add a TMDB API key.
3. Enable **External metadata**.
4. Enable **External artwork** if poster and backdrop downloads are wanted.
5. Save settings and scan the library.

Virelo stores fetched metadata and artwork in its data directory. Source video files are never sent to TMDB.

## Data

The default data directory is:

```text
~/.virelo/
  virelo.db
  thumbnails/
  artwork/
  cache/
    hls/
```

Videos stay in their original folders and are never copied into the data directory. Use `--data <path>` to choose another location.

## Network access

Virelo binds to `127.0.0.1` by default. `--host 0.0.0.0` makes it reachable from the local network, but Virelo does not include user accounts or authentication. Use only a trusted LAN or place an authenticated reverse proxy in front of it.

For a reverse proxy with a non-local hostname, explicitly allow the hostname:

```bash
VIRELO_TRUSTED_HOSTS=media.example.com virelo --host 0.0.0.0
```

See [SECURITY.md](SECURITY.md) before exposing Virelo beyond the host computer.

## Development

```bash
git clone https://github.com/Riyoway/virelo.git
cd virelo
npm ci
npm run check
node dist/cli.js --no-open
```

The web app is built with React, Vite, HeroUI, Tailwind CSS, TanStack Router, TanStack Query, Zustand, Phosphor Icons, and hls.js. The server uses Fastify, Node SQLite, chokidar, and optional FFmpeg tools.

Useful commands:

```text
npm run build         Build the server and web app
npm run typecheck:web Type-check the web app
npm test              Run the test suite
npm run check         Build, type-check, test, and inspect the npm package
npm run dev:web       Start the Vite development server
npm run dev:server    Build and run the server in watch mode
```

Read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a change.

## Release

Version tags matching `v*` trigger the npm publish workflow. Configure the repository's `NPM_TOKEN` secret before creating a release tag.

```bash
npm version patch
git push --follow-tags
```

The package name `virelo` and CLI command `virelo` are intentionally the same, so the published package starts with `npx virelo`.

## Privacy

Virelo has no telemetry, analytics, advertising, account registration, or automatic update checks. External metadata and artwork requests remain disabled until configured in Settings. See [PRIVACY.md](PRIVACY.md) for details.

## License

[MIT](LICENSE)
