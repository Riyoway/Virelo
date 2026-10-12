# Contributing

Thanks for contributing to Virelo.

## Before opening a change

- Search existing issues and pull requests.
- Keep each change focused on one problem.
- Open an issue first for large features or changes to stored data and public APIs.
- Do not include copyrighted media, service branding, API keys, or personal paths in fixtures and screenshots.

## Development

Virelo requires Node.js 22.16 or newer.

```bash
npm ci
npm run check
```

`npm run check` builds both applications, runs every test, and inspects the package that would be published to npm.

For UI work, verify desktop and mobile layouts, keyboard navigation, reduced-motion behavior, and both direct playback and FFmpeg fallback when available.

## Pull requests

- Add or update tests for behavior changes.
- Update README and CHANGELOG when public behavior changes.
- Keep user-facing text direct and free of implementation details.
- Confirm `npm run check` succeeds before requesting review.

New contributions are licensed under AGPL-3.0-only, as described in [LICENSE](LICENSE). Include any required copyright and license notices for third-party material. This does not change the terms under which earlier contributions were received.
