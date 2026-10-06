# Shorts entry selection — 2026-10-06

- Cause: a Shorts card linked to the generic feed without passing its media ID. The freshly randomized feed therefore started with an unrelated clip.
- Cards and their Play action now carry a validated positive integer startId. Feed ordering pins that clip before pagination; the remaining clips keep their session's seeded random order.
- The selected ID is part of the query key. Changing it remounts the feed, resetting the active clip, scroll position and session seed instead of reusing an old selection.
- Header, mobile navigation and View all explicitly clear the pinned selection and retain random discovery.
- The clip's context-menu Play action resumes the current video without routing to a different/random feed.
- Missing or excluded selections show an unavailable message, not unrelated playback. Existing Shorts eligibility/library visibility still applies.
- Direct links and reloads preserve the chosen first clip; the browser-only app's legacy /shorts redirect also preserves it.

## Verification

- npm: full check passes (build, typecheck, 59 tests and package dry-run).
- web: full check passes (typecheck, build and 28 tests).
- The npm repository's scripts/audit-shorts-navigation.mjs exercises both actual browser apps: 33 assertions pass, including card clicks, right-click Play, current-clip resume, reload, same-route ID changes, late-page selection, pagination, random discovery, unavailable selections and the web redirect.
- Browser fixtures use a fresh temporary SQLite database and browser context/IndexedDB. The running user's server, compiled assets and real libraries are not modified.
- The React skill's derived-state/keyed-reset guidance is applied to feed selection; no effect-based playback/scroll reset is added.

## Browser audit

Start isolated npm/web Vite copies on 5198/5199. Supply VIRELO_TEST_NODE_PACKAGE and VIRELO_TEST_CHROMIUM for external Playwright/Chromium, plus VIRELO_TEST_SHORTS_ASSETS pointing to a test-only directory with portrait.mp4, then run node scripts/audit-shorts-navigation.mjs from the npm copy with its rebuilt server modules.
