# Bounded, demand-driven playback — 2026-10-08

## Incident and scope

Read-only inspection of the user's `.virelo` directory found 43.38 GiB of converted playback cache: 43.13 GiB of whole-film adaptive renditions and 0.25 GiB of audio. There were no seek-window caches. The old encoder generated every quality until EOF and had no disk budget or unused-job cancellation. Artwork, thumbnails and the database were not responsible.

The explicit user-authorized recursive cache cleanup was rejected by the execution tool's safety policy before execution. No alternative deletion mechanism was used. The original cache has not been cleared by this task, and the running user server has not been restarted. The software's normal startup budget pruning takes effect when the user starts the updated server.

At the final read-only check, the live `cache` directory was no longer present and port 41777 was no longer listening, while SQLite, artwork and thumbnails remained present. This external filesystem/process change was not performed by the task; it must not be reported as an agent-executed deletion or restart.

## Replacement

`demand-playback.ts` registers a complete VOD timeline without encoding video. Child manifests address six-second fragments at absolute movie times. Only an actual fragment GET starts FFmpeg, only for that resolution and soundtrack, with `-ss`, `-t` and muxer output timestamp offsets. Auto retains its full rendition catalogue but only requested levels create files. Compatible video, manual/Auto quality and audio-only fallback use the same demand cache; native byte-range playback is unchanged.

The cache identity includes source path, file size, modification time, encoder format version, mode, track, rendition and fragment index. Concurrent clients share a fragment encoder; disconnected last subscribers cancel it. Outputs are temporary until successfully renamed. Two encoders and a bounded waiting queue prevent unlimited processes. A 32 MiB per-fragment limit and 45-second conversion deadline bound failed/oversized work.

`DemandCache` budgets all converted files under the configured `cache` directory, including legacy caches. The default limit is 512 MiB, configurable with `VIRELO_CACHE_MAX_MB` (128–65536 MiB). Startup and fragment generation evict oldest unused files, reserving space for at most two in-flight fragments. Files currently being generated or streamed are pinned. Symbolic links cause a fail-closed error; resolved deletion targets must stay beneath the cache root. Originals, SQLite, artwork and thumbnails are never budget eviction targets. Cache files are reconstructible, not user content; active playback is not silently interrupted to reclaim space.

This supersedes the progressive seek-window encoding described in `seeking-2026-10-07.md`. Status `ready`/`complete` now means the full VOD timeline is addressable, not that the whole film has been encoded. HLS media readiness remains controlled by actual browser fragment decoding.

## Verification

Unit tests cover full-duration playlists, legacy cache isolation, LRU eviction, pinned-response safety, preservation of originals/DB, source errors, lazy preparation, deduplication, requested-rendition-only encoding, absolute fragment timestamps, six-second limits and cancellation.

The isolated real FFmpeg/Chromium audit exercises compatible playback, six-second boundaries, native playback, selected qualities, rapid/paused/distant seeks, audio-only track conversion and synchronization, a real 1:57:21 synthetic clip seeking to 47:24, and cache growth after closing playback. User videos and the live cache are not audit inputs.

The production build passed all 25 browser assertions. Across those playback/seeking/audio scenarios the generated cache was 17,724,076 bytes (16.9 MiB), with no unrequested 480p rendition, abandoned `.part` file or continued growth after leaving playback. Automated tests passed 68/68; server/web builds, web typecheck, package dry run and whitespace checks passed. The browser audit explicitly reveals auto-hidden controls before clicking them, rather than waiting until the film ends and accidentally clicking a changed control.

FFmpeg timestamp reference: [output_ts_offset](https://ffmpeg.org/ffmpeg-formats.html#Format-Options). No publication, version bump or push is included in this request.
