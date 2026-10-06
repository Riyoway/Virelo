# Player controls and queue audit — 2026-10-07

## Changes shared by npm and browser-only apps

- Keep transport controls on the left and quality, audio, subtitles, PiP and fullscreen together on the right. Wrap safely on narrow screens; measure controls height to keep draggable captions above them.
- Theme scrollbars with thin, subdued tracks instead of unstyled browser chrome. Retain native scrolling, touch and keyboard behavior.
- Provide a video context menu for transport, available track/quality controls, repeat, PiP and fullscreen. Clamp it to the viewport, portal it inside fullscreen, support keyboard navigation and Escape, and suppress native/nested context menus.
- Offer repeat off, repeat video and repeat queue. Keep the selected mode through queue transitions; wrap only in repeat-queue mode, leave explicit next/previous available in repeat-one mode, and loop a single-item queue using the media element.
- Use a flat queue filmstrip with artwork, playing/up-next status and duration. Queue arrows browse the rail without replacing the playing item. Cancel wheel easing when another input takes over.

## Validation

- `npm run check`: npm build, web typecheck, 63 unit/regression tests and package dry-run; browser-only typecheck/build and 32 tests.
- `scripts/audit-player-ui.mjs` in the npm repository: 78 assertions across both apps, including a real media-ended transition, queue boundary wrap, repeat-one, repeat-off, single-item queues, 1440/320/390/844px layouts, independently accessible subtitle lists, right-click/keyboard/fullscreen menus, and queue wheel/button takeover.
- `scripts/audit-player-menus.mjs`: 82 assertions across both apps for independent track menus, keyboard navigation, unavailable tracks, competing changes, viewport containment and fullscreen.
- Screenshots inspected at desktop and mobile widths, including the queue filmstrip.
- npm compiled assets served from the local CLI and checked directly, not just through the dev server. Both local build outputs updated.

Browser audits use generated H.264/AAC test footage and fresh browser contexts. npm API fixtures intercept requests; browser-only fixtures use isolated IndexedDB and stub codec preparation. These tests cover UI and playback/queue state, not real-world transcoding or OS-level PiP behavior. Existing audio conversion and quality algorithms were not changed in this work.

No package publication, version change or release tag is part of this change.
