---
phase: 01-foundation
plan: 03
subsystem: api
tags: [youtube-api, transcript, caching, express, node-fetch, xml-parsing, error-handling]

# Dependency graph
requires:
  - phase: 01-foundation plan 01
    provides: cache.js (cacheGet, cacheSet, queryHash) — used by both youtube.js and transcript.js

provides:
  - youtube.js with searchVideos (cache-aware, quota-safe) and fetchVideoStats (batched, per-video caching)
  - transcript.js with fetchTranscript (timedtext + cache), parseTimedtextXml (regex entity decoder), and transcriptHandler (Express route with description fallback)
  - YouTubeAPIError and YouTubeQuotaError custom error classes for structured error handling in server.js

affects:
  - Phase 2 (scoring pipeline — consumes searchVideos and fetchVideoStats)
  - Phase 3 (course assembly — calls transcriptHandler or fetchTranscript directly)
  - server.js (mounts transcriptHandler at GET /api/transcript/:videoId, catches YouTubeQuotaError for SSE error events)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Cache-first pattern: check cacheGet before every external API call, write result with cacheSet on success
    - Per-entity caching: each video cached individually as video_{videoId}.json for partial cache hits
    - Graceful null return: fetchTranscript returns null (not throws) so callers can implement their own fallback
    - Three-tier fallback: captions -> description -> HTTP 404
    - Custom error hierarchy: YouTubeQuotaError extends YouTubeAPIError for instanceof discrimination

key-files:
  created:
    - youtube.js
    - transcript.js
    - tests/unit/youtube.test.js
    - tests/unit/transcript.test.js
  modified: []

key-decisions:
  - "videoDuration: 'any' in searchVideos (not medium/long) — duration filtering deferred to Phase 2 scoring to save quota"
  - "fetchVideoStats batches all uncached IDs into a single videos.list call — one API call regardless of how many IDs"
  - "fetchTranscript silently returns null on network errors — callers handle fallback, no exception propagation"
  - "timedtext XML parsed with regex (no xml2js) — strip tags with /<[^>]+>/g, decode entities manually, collapse whitespace"
  - "text.length > 50 sanity check in fetchTranscript — avoids caching/returning empty or trivially short transcripts"

patterns-established:
  - "Cache-first pattern: cacheGet -> return cached OR fetch -> cacheSet -> return fresh"
  - "Structured YouTube error handling: handleYouTubeError inspects error.errors[0].reason to discriminate quota vs other errors"
  - "Express handler try/catch with 500 INTERNAL fallback — all handler errors caught and returned as JSON"

requirements-completed: [PIPE-03, PIPE-04, INFR-04, PIPE-07]

# Metrics
duration: 3min
completed: 2026-03-19
---

# Phase 01 Plan 03: YouTube API Client and Transcript Fetching Summary

**YouTube Data API v3 search/stats client with cache-first caching, quota error discrimination, plus timedtext transcript endpoint with description fallback and regex XML parser.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-19T08:30:00Z
- **Completed:** 2026-03-19T08:32:41Z
- **Tasks:** 2 of 2
- **Files modified:** 4 (2 created, 2 test files)

## Accomplishments

- searchVideos fetches YouTube search.list with all required params, caches results by queryHash key, skips fetch on cache hit
- fetchVideoStats batches uncached IDs into a single videos.list call, caches each video individually as video_{videoId}.json
- handleYouTubeError discriminates quotaExceeded/dailyLimitExceeded into YouTubeQuotaError vs generic YouTubeAPIError
- fetchTranscript fetches timedtext XML, parses with regex stripper + entity decoder, returns null for empty/short responses
- transcriptHandler implements three-tier fallback: captions -> video description -> HTTP 404 with NO_TRANSCRIPT error code
- 25 tests pass across both modules (11 youtube, 14 transcript)

## Task Commits

Each task was committed atomically:

1. **Task 1: youtube.js with search, stats, and quota error handling** - `adcaf1f` (feat)
2. **Task 2: transcript.js with timedtext fetch, fallback, and Express handler** - `ff291fa` (feat)

_Note: TDD tasks — tests written first (RED), then implementation (GREEN), committed together per task._

## Files Created/Modified

- `/Users/camdenhosn/PycharmProjects/Youtube-Education-App/youtube.js` - YouTube Data API v3 client: searchVideos, fetchVideoStats, error classes
- `/Users/camdenhosn/PycharmProjects/Youtube-Education-App/transcript.js` - Transcript fetching: parseTimedtextXml, fetchTranscript, transcriptHandler
- `/Users/camdenhosn/PycharmProjects/Youtube-Education-App/tests/unit/youtube.test.js` - 11 tests covering URL construction, cache behavior, error discrimination
- `/Users/camdenhosn/PycharmProjects/Youtube-Education-App/tests/unit/transcript.test.js` - 14 tests covering XML parsing, cache behavior, handler fallback paths

## Decisions Made

- `videoDuration: 'any'` in searchVideos as a deliberate PIPE-03 deviation — duration filtering is deferred to Phase 2 scoring to avoid per-category quota waste on separate API calls
- fetchVideoStats batches all uncached IDs into one API call using comma-separated `id=` param (not one call per ID)
- fetchTranscript returns null (not throws) on network failure or short content — callers own the fallback decision
- timedtext XML parsed with regex only (`/<[^>]+>/g` + entity replacement) per CONTEXT.md spec — no xml2js dependency needed

## Deviations from Plan

None - plan executed exactly as written (PIPE-03 deviation was documented in plan as intentional).

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. Modules use `process.env.YOUTUBE_API_KEY` which was already specified in 01-01 as a required env var.

## Next Phase Readiness

- youtube.js and transcript.js are ready for Phase 2 scoring pipeline to consume
- All cache integration points established: search_{hash}.json, video_{id}.json, transcript_{id}.json
- YouTubeQuotaError exported for server.js to catch and emit structured SSE error events
- Phase 2 can call fetchVideoStats with all video IDs from searchVideos results in a single batched call

---
*Phase: 01-foundation*
*Completed: 2026-03-19*
