# Changelog

## Unreleased

## 0.1.1 — 2026-08-14

- Improved responsive headers, typography, settings controls and mobile playback navigation.
- Fixed player controls auto-hiding on desktop, phones and tablets.
- Fixed fullscreen playback on iPad.
- Added a dedicated not-found page and normalized dark-theme control states.
- Removed the in-app PWA install prompt.
- Use fixed port `41777` by default for a stable PWA origin, with `--port 0` and `--random-port` available when a conflict occurs.

## 0.1.0 — 2026-08-08

- Initial Virelo release.
- One-command `npx` startup with localhost-only default binding.
- Local library scanning, change watching, SQLite catalog and watch progress.
- Streaming-style responsive React UI built with HeroUI v3 and Phosphor Icons.
- HTTP Range direct play and local FFmpeg HLS fallback.
- Local thumbnail generation and movie/series filename parsing.
- Explicit opt-in TMDB metadata enrichment and separate artwork permission.
- Host/origin validation and restrictive browser security headers.
