# Privacy

Virelo runs on the host computer and stores its catalog, settings, thumbnails, watch progress, favorites, cached HLS segments, and optional artwork in the configured data directory.

## Default behavior

Virelo does not include telemetry, analytics, advertising, account registration, or automatic update checks. It does not request external metadata or artwork unless those options are enabled in Settings.

## Optional external requests

When external metadata is enabled and a user-provided TMDB API key is configured, Virelo sends title search queries and media identifiers to TMDB. Enabling external artwork also allows poster and backdrop downloads. Disabling these settings stops future TMDB requests initiated by Virelo.

## Video files

Virelo streams source videos only to clients connected to the Virelo server. Its built-in TMDB integration never uploads video files to a third party.
