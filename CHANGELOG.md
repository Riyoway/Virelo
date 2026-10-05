# Changelog

## Unreleased

- Remove persistent Shorts play/pause controls, move sound above Like, shuffle each Shorts visit and preserve clip alignment on rotation.
- Respect pause/play intent during quality and audio preparation, cancel stale source restores, and keep preparation overlays off paused playback.
- Add per-video metadata reset that preserves files, thumbnails, favorites and watch progress without automatic rematching.
- Contain field focus, flatten native seek tracks, and fix context-menu event propagation and keyboard focus.
- Keep queue selection stable on refresh and add repeatable browser/FFmpeg regression audits.

- Start playable videos directly on LAN connections instead of waiting for Auto quality renditions; prepare adaptive HLS only after sustained buffering.
- Keep preparation indicators off already-playing video and retain the session's bandwidth estimate between adaptive videos.
- Start compatible HLS from completed segments while conversion continues, copying H.264 video when only audio needs conversion.
- Preserve playback positions during progressive HLS handoffs and keep interrupted caches and failed conversion jobs from being mistaken for ready playback.

## 0.2.1 — 2026-08-22

- Fixed first-play audio fallback starting before FFmpeg had finished writing the converted HLS playlist.
- Stabilized converted audio playback by retrying audio start and resynchronizing it with the video clock.

## 0.2.0 — 2026-08-22

- Added selectable audio tracks and embedded text subtitles to the video player.
- Added progressive, audio-only AAC/HLS fallback for AC-3 and other browser-incompatible codecs without re-encoding compatible video.
- Added cached adaptive HLS playback with Auto bandwidth selection and manual quality controls based on each video's source resolution.
- Fixed playback duration and saved progress while switching adaptive quality levels.
- Made localhost playback direct-play the original file without preparing adaptive variants; LAN playback still defaults to Auto.
- Remembered the selected quality between videos and capped it at each video's source resolution instead of upscaling.
- Made overflowing library and folder chips scroll horizontally with a mouse wheel while preserving native trackpad and touch scrolling.
- Smoothed mouse-wheel movement across overflowing library and folder chip rows.
- Stabilized audio track switching by preserving the video clock, waiting for audio metadata before seeking, and resuming the audio clock after buffering.
- Restored playback positions after HLS source switches without reapplying the item's old saved progress.
- Kept hover previews at the card's original size and removed redundant preview playback controls.

## 0.1.2 — 2026-08-15

- Added setup-free movie and series metadata matching with automatic poster, backdrop, and episode artwork downloads.
- Kept user-provided TMDB keys as an optional compatibility path for localized metadata.
- Added a visible Play All queue with previous, next, automatic advance, and folder-loop behavior.
- Added a current-video loop control and made normal playback start automatically.
- Improved Termux folder watching by ignoring hidden directories and using polling where required.

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
