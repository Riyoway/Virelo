# Separate player settings — 2026-10-06

## Scope

Both npm and browser-only players now expose separate Quality, Audio and Subtitles buttons. Opening a category shows only that category's choices; opening another replaces the previous menu.

- Quality displays the current setting on larger screens. Existing numeric ceilings and network-only Auto rules are unchanged.
- Audio uses a waveform icon to distinguish track selection from the volume button.
- Subtitles includes Off and supported embedded tracks.
- Track controls are omitted when there are no selectable tracks; the original-quality recovery option remains available even when it is the sole quality.
- Long lists scroll inside their own menu. Menus fit the viewport and render outside the video's clipping boundary on small screens, or inside the fullscreen element when fullscreen is active.
- Arrow keys, Home, End, Enter, Escape and Tab are supported. Selection/Escape returns focus; unsupported tracks are skipped.
- Open menus keep player controls visible. Busy options remain disabled to avoid competing conversions.
- Per-video component keys close menus on video changes.

## Validation

`scripts/audit-player-menus.mjs` mounts the real menu component with 22 audio/subtitle tracks and the player's toolbar CSS. It checks category isolation, callbacks, keyboard focus, unavailable/busy choices, four viewport sizes (1440×900, 320×780, 390×844, 844×390), scrolling to the last track and fullscreen containment. It saves screenshots in a temporary directory.

Run isolated Vite servers for npm and web on 5198 and 5199, then:

```powershell
$env:VIRELO_TEST_NODE_PACKAGE='<path to Playwright package.json>'
$env:VIRELO_TEST_CHROMIUM='<path to Chromium executable>'
node scripts/audit-player-menus.mjs
node scripts/audit-quality.mjs
```

The npm production playback audit and UI audit use the independent Quality/Audio selectors as well.

Recorded results: 82 menu assertions and 57 real-player quality regression assertions passed across both apps and network playback. Both production builds/typechecks passed; npm's 47 unit tests and pack dry-run and web's 18 unit tests passed. The npm production FFmpeg audit passed direct playback, adaptive handoff, manual switching, pause preservation, next-video startup, failed Auto recovery and first compatible audio playback with decoded audio and no browser errors. The component harness alone does not assert media decoding.

The running user server and its main checkout's compiled assets were not replaced. To apply npm source changes, stop your server, run `npm run build`, and restart your normal command.
