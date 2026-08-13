<div align="center">
  <img src="https://raw.githubusercontent.com/Riyoway/virelo/main/web/public/virelo-icon-512.png" alt="Virelo" width="128" />

  <h1>Virelo</h1>

  <p>Turn any folder into a private, streaming-style video library.</p>

  <p>
    <a href="https://github.com/Riyoway/virelo/stargazers"><img src="https://img.shields.io/github/stars/Riyoway/virelo?style=flat-square&logo=github&label=Stars" alt="GitHub stars" /></a>
    <a href="https://github.com/Riyoway/virelo/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/Riyoway/virelo/ci.yml?style=flat-square&logo=github-actions&label=CI" alt="CI status" /></a>
    <a href="https://www.npmjs.com/package/virelo"><img src="https://img.shields.io/npm/v/virelo?style=flat-square&logo=npm&label=npm" alt="npm version" /></a>
    <a href="https://github.com/Riyoway/virelo/blob/main/LICENSE"><img src="https://img.shields.io/github/license/Riyoway/virelo?style=flat-square&label=License" alt="MIT license" /></a>
  </p>

  <p>
    <a href="#quick-start">Quick start</a> ·
    <a href="#features">Features</a> ·
    <a href="#cli">CLI</a> ·
    <a href="#development">Development</a>
  </p>
</div>

> Virelo runs on your machine, keeps your video files where they are, and gives them a fast web interface with search, progress tracking, favorites, and Shorts.

## ⚡ Quick start

Run Virelo in the folder you want to serve:

```bash
npx virelo
```

Virelo scans the current directory, starts at `http://127.0.0.1:41777`, and opens the library in your browser.

To serve another folder without changing directories:

```bash
npx virelo --media ~/Videos
```

If port `41777` is already in use, let the operating system choose an available one:

```bash
npx virelo --media ~/Videos --random-port
```

<details>
<summary><strong>Windows example</strong></summary>

```powershell
npx virelo --media "C:\Users\You\Videos" --random-port
```

</details>

## ✨ Features

| | | |
| --- | --- | --- |
| 📚 | **Library** | Recursive scanning, folders, search, and sorting. |
| ▶️ | **Playback** | Range streaming, seeking, watch progress, and queue controls. |
| 📱 | **Shorts** | A vertical feed for portrait videos with swipe-friendly controls. |
| 💜 | **Favorites** | Save videos for quick access from the library. |
| 🖼️ | **Artwork** | Optional thumbnails, metadata, and artwork with FFmpeg and TMDB. |
| 🌐 | **Responsive UI** | Works on desktop, tablet, and mobile screens. |
| 📦 | **PWA** | Install Virelo as an app when supported by your browser. |
| 🔒 | **Private by default** | Localhost binding, no accounts, no telemetry, and no advertising. |

## 🧭 CLI

```text
virelo [options]

-m, --media <path>  Use a media directory (repeatable)
-d, --data <path>   Store data and cache in this directory (default: ~/.virelo)
-H, --host <host>   Bind address (default: 127.0.0.1)
-p, --port <port>   HTTP port (default: 41777; use 0 for an available port)
    --random-port   Select an available HTTP port automatically
    --no-open       Do not open a browser
-h, --help          Show help
-v, --version       Show version
```

### Common commands

```bash
# Serve the current directory
npx virelo

# Serve multiple directories
npx virelo --media ~/Movies --media ~/Clips

# Use a custom data directory
npx virelo --media ~/Videos --data ~/.config/virelo

# Allow access from a trusted local network
npx virelo --host 0.0.0.0

# Select an available port explicitly
npx virelo --port 0
```

If `--media` is omitted, Virelo serves the directory where the command is run. Supplying `--media` replaces that default for the current run.

## 🎞️ Media support

Virelo recognizes common movie and episode naming patterns:

```text
Movies/
  Blade Runner (1982).mkv

Series/
  Example Show/
    Season 01/
      Example.Show.S01E01.mkv
      Example.Show.S01E02.mkv
```

Supported containers include MP4, M4V, MKV, WebM, MOV, AVI, WMV, MPEG, TS, M2TS, FLV, OGV, and 3GP. Browser codec support determines whether a file can play directly.

## 🧰 Optional tools

Virelo works without FFmpeg for formats supported by the browser. Installing `ffmpeg` and `ffprobe` adds:

- thumbnails and media probing
- codec detection
- HLS fallback for formats browsers cannot play directly

TMDB integration is also optional. Configure it from **Settings → Network** when you want external metadata or artwork. Source video files are never sent to TMDB.

## 💾 Data

The default data directory is `~/.virelo`:

```text
~/.virelo/
  virelo.db
  thumbnails/
  artwork/
  cache/
    hls/
```

Videos stay in their original folders and are never copied into the data directory. Use `--data <path>` to choose another location.

## 🔐 Network access

Virelo binds to `127.0.0.1` by default. To access it from another device on a trusted LAN:

```bash
npx virelo --host 0.0.0.0
```

Virelo does not include user accounts or authentication. Use LAN binding only on a network you trust, or put an authenticated reverse proxy in front of it.

See [SECURITY.md](SECURITY.md) before exposing Virelo beyond the host computer.

## 🛠️ Development

```bash
git clone https://github.com/Riyoway/virelo.git
cd virelo
npm ci
npm run check
node dist/cli.js --no-open
```

| Command | Purpose |
| --- | --- |
| `npm run build` | Build the server and web app |
| `npm run typecheck:web` | Type-check the web app |
| `npm test` | Run the test suite |
| `npm run check` | Build, type-check, test, and inspect the npm package |
| `npm run dev:web` | Start the Vite development server |
| `npm run dev:server` | Build and run the server in watch mode |

Read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a change.

<details>
<summary><strong>Stack</strong></summary>

The web app uses React, Vite, HeroUI, Tailwind CSS, TanStack Router, TanStack Query, Zustand, Phosphor Icons, and hls.js. The server uses Fastify, Node SQLite, chokidar, and optional FFmpeg tools.

</details>

## 🚀 Releases

Version tags matching `v*` trigger the npm publish workflow. Configure the repository's `NPM_TOKEN` secret before creating a release tag.

```bash
npm version patch
git push --follow-tags
```

The package name `virelo` and the CLI command `virelo` are intentionally the same, so the published package starts with `npx virelo`.

## 🤝 Contributing

Issues and pull requests are welcome. If you find a bug, include your operating system, Node.js version, Virelo command, and the relevant terminal output.

## 🔒 Privacy

Virelo has no telemetry, analytics, advertising, account registration, or automatic update checks. External metadata and artwork requests remain disabled until configured in Settings.

See [PRIVACY.md](PRIVACY.md) for details.

## 📄 License

[MIT](LICENSE)
