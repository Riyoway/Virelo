# Playback quality ceiling — 2026-10-06

## Behavior

- Explicit resolution choices are ceilings, not per-file resets: 720p → 1080p source plays at 720p; 720p → 480p source plays at 480p; the following higher-resolution source still uses the saved 720p ceiling.
- Both players use the same preference parser/resolver. A versioned localStorage key retains choices across reloads and accepts the existing npm preference as a migration fallback. If storage is blocked, the current tab still retains its choice.
- Preferences belong to the browser and origin (including port), not an account or every device.
- Highest available is the default locally; Auto remains available/default only for npm network access, unless a manual ceiling has been selected. Web has no Auto option.
- Unavailable lower resolutions and failed conversion, handoff, or audio-switch preparations stay paused and expose an error. No implicit original-quality/Auto fallback is allowed for a manual ceiling. Users can explicitly select a different quality or retry.
- Initial native preloading is disabled while a manual ceiling is selected so the original high-resolution source is not downloaded speculatively.
- npm applies the bounded HLS level before the first segment loads, caps ABR, handles portrait streams by their short side, and retains 360p in high-resolution ladders.
- Resetting the prior HLS instance cannot remove the next direct-play source. Preparation-generated pause events do not erase play intent. Web restores position only when metadata belongs to the prepared source.

## Verification

- `tests/playback-quality.test.mjs`: ten isolated unit cases per repository, including persistence, legacy migration, blocked storage, invalid ladders, missing bounded resolutions, and portrait HLS level selection.
- `scripts/audit-quality.mjs`: both local players plus npm network access. Actual AVC browser conversion and actual HLS playback use generated synthetic clips; controlled failures exercise quality/audio handoffs without changing real media or the running library.
- Start the npm Vite development server on 5198 and the web Vite server on 5199; run `node scripts/audit-quality.mjs` with Playwright installed and FFmpeg on PATH.
- Optional overrides: `VIRELO_TEST_NODE_PACKAGE` (a package.json beside the installed Playwright package), `VIRELO_TEST_CHROMIUM`, `VIRELO_TEST_NPM_URL`, `VIRELO_TEST_WEB_URL`, and `VIRELO_TEST_QUALITY_ASSETS`.
- Without supplied fixtures, the audit generates its own temporary clips/manifests and never touches users' media.
- Production validation builds run in isolated checkouts, leaving the live npm server and its dist assets intact.

No version bump, publish, commit, push, or server restart is included in this change.

## Recorded results

- npm: full build, frontend type check, 47 automated tests, and package dry run passed.
- web: full build, frontend type check, and 18 automated tests passed.
- Quality browser audit: 57 checks passed across npm local, npm network, and web, with real HLS/AVC playback and controlled failures.
- Home browser audit: 72 checks passed; no runtime errors or layout regressions.
- Production npm playback audit: direct network playback, adaptive handoff, manual switching, pause preservation, next-file direct playback, failed Auto handoff recovery, and first compatible-audio playback all passed without runtime errors.
- Only audit servers were stopped. The user's live server on port 41777 and its dist files were preserved.
