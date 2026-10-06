# Home header and featured banner — 2026-10-06

- Removed the independent Home browse band. Desktop Home/Movies/Series share the app header; Home and the logo reset the category. Mobile categories sit over the artwork, without adding an opaque strip.
- Kept the existing Virelo typography, neutral streaming palette and metadata-driven shelves. The banner starts behind the header; category state is shared through the existing UI store.
- Replaced thumbnail previews, arrows and the fraction counter with small round dots. Their buttons retain generous tap targets, visible focus and accessible title labels.
- Restored automatic featured-title rotation every 8 seconds. Previous Home enrichment intentionally made selection manual-only.
- Pause on fine-pointer hover, keyboard-visible focus, hidden documents, offscreen banners and reduced-motion preference. Resume with a full reading interval; do not catch up skipped banners. Mouse navigation to Home must not leave the timer permanently blocked by link focus.
- A small pause/resume control supports explicit user intent. Reduced motion keeps manual dot selection without automatic rotation.
- Automatic/pointer artwork changes use only a brief opacity transition with existing duration/easing tokens. Keyboard selection is immediate. No new animation dependencies.
- React effect dependencies use stable callbacks and primitive identity/count; changing categories remounts only the filtered Home content and cancels the old timer.

## Verification

- scripts/audit-home.mjs in the npm repository exercises both apps: 150 assertions pass, including existing shelf/metadata checks, desktop header placement, dot appearance, mouse navigation, timed rotation, pause/resume guards, mobile controls and responsive layout from 320px to 3440px.
- npm full check passes build, typecheck, 59 tests and package dry-run; web full check passes typecheck, build and 28 tests.
- Reviewed desktop and mobile screenshots. Audit artwork is a synthetic fixture, not production library imagery.
- Builds and browser testing run in isolated copies. The user's running server, compiled assets, media and browser database are not overwritten.
- Existing frontend-design, animate and React skills informed the integrated navigation, restrained opacity-only motion and safe timer cleanup.

## Local runtime verification

- The existing CLI on port 41777 was still serving the previous `dist` build. Source changes alone do not update `node dist/cli.js`.
- Rebuilt the npm checkout with `npm run check`, then restarted the CLI on the same host/port with the original media folder and existing data directory. The previous compiled output was backed up before rebuilding.
- Verified that HTTP serves the new asset hashes. A fresh browser confirmed the integrated desktop categories, absence of the old browse band, five featured dots, manual selection and automatic rotation without runtime errors.
- Existing tabs need a reload to load the updated JavaScript. Library metadata, media files and watch history were retained.
