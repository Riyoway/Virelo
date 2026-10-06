# Privacy

Virelo runs on the host computer and stores its catalog, settings, thumbnails, watch progress, favorites, cached HLS segments, and optional artwork in the configured data directory.

## Default behavior

Virelo does not include telemetry, analytics, advertising, account registration, or automatic update checks. New installations match filenames against Cinemeta during library scans and cache the returned metadata and artwork locally. Online matching and artwork downloads can be disabled independently in Settings.

## Optional external requests

When online metadata is enabled, Virelo sends the parsed title, media type, release year when available, and season/episode numbers when applicable to Cinemeta. It downloads matched posters, backdrops, and episode images when artwork is enabled. An existing user-provided TMDB key, or the optional `VIRELO_TMDB_API_KEY` environment variable, makes Virelo use TMDB instead for backward compatibility and localized results. Disabling online metadata stops future provider requests initiated by Virelo.

## Video files

Virelo streams source videos only to clients connected to the Virelo server. Metadata matching never uploads video files to a third party.
