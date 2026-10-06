# Background playback — 2026-10-06

## Findings and changes

Neither app deliberately paused on visibilitychange, and both already disabled focus-triggered query refetches. The defect reproduced in a controlled browser-suspension test: Player treated a hidden video's pause as a user pause and stopped its separate soundtrack. Its ordinary sync loop then used the stopped video as the audio clock.

- A shared lifecycle hook distinguishes hidden-tab suspension from explicit pause and source transitions.
- During hidden-video suspension, the separate soundtrack continues and supplies current time/progress. Normal video-to-audio synchronization is suspended until foreground recovery.
- Foreground recovery seeks the video to the running audio clock, then resumes without replacing the media source.
- Explicit UI/media-key pauses clear play intent, so visibility changes do not undo them.
- Active Shorts can recover on return; inactive or manually paused clips do not resume.
- npm's prepared-audio startup uses a microtask instead of requestAnimationFrame, which can be withheld in background tabs.
- Quality error/preparation gates remain in place: returning to a tab does not bypass a manual quality ceiling or failure.

## Verification and limits

`scripts/audit-background.mjs` uses the real Players and ShortsView in Chromium, generated H.264/AAC fixtures, byte-range responses and real MSE HLS audio. It overrides document visibility and explicitly pauses video to deterministically emulate browser suspension; it does not claim to exercise every browser's real background-tab policy or OS suspension.

The pre-fix controlled reproduction stopped audio in both apps. After the fix, 28 assertions passed for continuing audio, audio-clock catch-up, unchanged sources, explicit UI/media-key pause, direct playback, foreground recovery and Shorts selection. The 57 existing quality assertions also passed, as did both builds/typechecks (47 npm unit tests, 18 web unit tests, npm pack dry-run).

A site cannot force every browser/OS to keep decoding invisible video or keep a frozen/discarded tab alive. This change does not fake document visibility in production, inject silent audio, acquire wake locks, or reload sources on focus.

Primary references:
- [Chrome MSE background video optimization](https://developer.chrome.com/blog/chrome-61-media-updates?hl=en)
- [Chrome background tabs and requestAnimationFrame](https://developer.chrome.com/blog/background_tabs/)

Tests run in isolated checkouts; the user's running npm server and main compiled assets were not rebuilt. Applying npm changes requires stopping that server, running `npm run build`, then restarting. No commit/push or version bump was requested for this change.
