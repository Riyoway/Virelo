# Row scrolling — 2026-10-06

## Cause and fix
- Reproduced on the actual Recently added row: a 120px wheel input left scrollLeft at 0 with the hook still requesting frames; the following right-arrow click also stayed at 0.
- Fine-pointer media rows had CSS proximity snapping applied to each custom eased scroll write. Disable snapping on these rows only; touch-only rows keep native snapping and swiping.
- Buttons and keyboard commands now cancel wheel easing before starting the same native smooth scroll used previously.
- Wheel direction reversal starts from the current position, rather than first consuming the pending movement in the other direction.
- Normalize pixel/line/page deltas, finish subpixel/rounded steps, clamp after resizing, and bound animation lifetime. Small deltas must not spin until the safety deadline.
- Horizontal trackpad input, pointer interaction and navigation cancel custom easing. Pinch zoom and outward wheel input at the edges remain native.
- Reduced-motion wheel scrolling is immediate. Transient animation values do not cause React state updates on every frame.

## Verification
- scripts/audit-row-scroll.mjs uses real Home/Library components and CSS. npm uses fixture API responses; web reads a fresh test-only IndexedDB catalog.
- Covers both Recently added and Movies: buttons before/after/while wheeling, keyboard takeover, native horizontal input, direction reversal, tiny deltas, line/page units, reduced motion, pointer takeover, resized bounds, both edges, unmount cleanup and folder rails.
- A touch-device browser context verifies native snap, vertical-wheel passthrough and a CDP touch swipe. This is emulation, not a physical-device test.
- scripts/audit-home.mjs remains the separate Home curation/layout regression audit.
- Result: 86 row-scrolling browser assertions pass across both apps, plus the existing 102 Home audit assertions. npm check passes 54 tests and package dry-run; web check passes 25 tests. Both typechecks and builds pass.
- Build and typecheck run in isolated validation directories; the user's running npm server and compiled assets are not overwritten.

Run both test Vite apps at ports 5198 (npm) and 5199 (web), set VIRELO_TEST_NODE_PACKAGE and VIRELO_TEST_CHROMIUM if using external Playwright runtimes, then run node scripts/audit-row-scroll.mjs in npm or node --experimental-strip-types scripts/audit-row-scroll.mjs in web.
