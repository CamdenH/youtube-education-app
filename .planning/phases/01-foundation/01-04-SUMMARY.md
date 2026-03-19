---
phase: 01-foundation
plan: "04"
subsystem: infra
tags: [express, sse, server-sent-events, html, vanilla-js, css-custom-properties]

# Dependency graph
requires:
  - phase: 01-02
    provides: courseStreamHandler, sendEvent, startHeartbeat from sse.js
  - phase: 01-03
    provides: transcriptHandler from transcript.js, YouTubeQuotaError from youtube.js

provides:
  - Express server entry point (server.js) with all route wiring
  - index.html SSE test stub with full UI-SPEC design token system
  - YouTubeQuotaError catch-to-SSE wiring (INFR-04)
  - Server smoke test suite (6 tests)

affects:
  - Phase 2 (pipeline implementation — replaces stub courseStreamHandler; quota error path already wired)
  - Phase 4 (UI development — index.html design tokens and layout contract established)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "require.main === module guard for test-safe server imports"
    - "module.exports = app for supertest-style testing without server start"
    - "Async route wrapper with headersSent check for SSE error surfacing"
    - "makeTestApp helper in tests for isolated mock handler injection"

key-files:
  created:
    - server.js
    - index.html
    - tests/unit/server.test.js
  modified: []

key-decisions:
  - "Option A wrapper middleware in server.js for quota error wiring — keeps error-to-SSE path visible at integration point rather than buried in sse.js"
  - "makeTestApp pattern in tests to bypass module-cache binding — server.js captures courseStreamHandler reference at require time so monkey-patching sse module has no effect"

patterns-established:
  - "SSE error surfacing: catch around courseStreamHandler checks res.headersSent; if true, emits SSE error event then res.end(); if false, falls back to res.status(500).json()"
  - "Test isolation via makeTestApp: creates fresh express instances with mock handlers for unit-testing route wrapper logic independently"

requirements-completed:
  - INFR-01
  - INFR-04
  - INFR-05

# Metrics
duration: 4min
completed: 2026-03-19
---

# Phase 01 Plan 04: Server Assembly and SSE Stub Frontend Summary

**Express server wiring all modules into a working SSE endpoint, index.html stub with full UI-SPEC design token system, and YouTubeQuotaError catch-to-SSE error surfacing path**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-19T08:35:13Z
- **Completed:** 2026-03-19T08:39:00Z
- **Tasks:** 3
- **Files modified:** 3 created

## Accomplishments
- server.js wires courseStreamHandler, transcriptHandler, dotenv, express.static with require.main guard and module.exports for testing
- YouTubeQuotaError catch path emits SSE `error` event with `{ code: 'QUOTA_EXCEEDED', ... }` so quota exhaustion surfaces to users in Phase 2
- index.html implements all UI-SPEC design tokens (spacing, typography, color custom properties), EventSource with 5 named event listeners, eventSource.close() on both terminal events (INFR-05)
- 6-test server smoke suite: GET / HTML, SSE headers, transcript route registration, 404, quota error SSE emission, generic error SSE emission

## Task Commits

1. **Task 1: Create server.js entry point and index.html SSE stub** - `cf8fce7` (feat)
2. **Task 2: Create server smoke tests** - `e8537fc` (test) — then updated in Task 3
3. **Task 3: Wire YouTubeQuotaError catch path** - `92cb136` (feat)

## Files Created/Modified
- `server.js` — Express entry point: dotenv, static serving, /api/course-stream with quota error wrapper, /api/transcript/:videoId, require.main guard, module.exports = app
- `index.html` — Full SSE test stub: all CSS custom properties from UI-SPEC, EventSource connection, 5 named event listeners, progress bar, event log with dot indicators, connection state management
- `tests/unit/server.test.js` — 6 smoke tests covering route registration, SSE headers, 404, and quota/generic error SSE emission via makeTestApp helper

## Decisions Made
- **Wrapper in server.js (Option A):** Error-to-SSE wiring placed in server.js route handler rather than inside sse.js courseStreamHandler — keeps the integration-level error surfacing visible at the integration layer
- **makeTestApp test pattern:** Since server.js captures courseStreamHandler by value at require time, monkey-patching the sse module exports has no effect. Created a fresh express instance in tests with injected mock handlers to test the wrapper logic directly

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Included sendEvent and YouTubeQuotaError imports in Task 1**
- **Found during:** Task 1 (server.js creation)
- **Issue:** Plan's server.js template in Task 1 showed only courseStreamHandler import from sse, but Task 3 required sendEvent and YouTubeQuotaError for the error wrapper — including both upfront avoided a Task 3 re-edit of server.js
- **Fix:** Added `const { courseStreamHandler, sendEvent } = require('./sse')` and `const { YouTubeQuotaError } = require('./youtube')` in the initial server.js along with the error wrapper route
- **Files modified:** server.js
- **Verification:** All acceptance criteria for both Task 1 and Task 3 satisfied
- **Committed in:** cf8fce7 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (proactive inclusion of Task 3 implementation in Task 1 to avoid redundant edit)
**Impact on plan:** No scope creep. Task 3 TDD cycle focused on adding tests only (implementation already present).

## Issues Encountered

Pre-existing test failures in cache.test.js (test 8) and youtube.test.js (tests 57, 58, 59) when running the full `*.test.js` glob. These are cross-suite test isolation issues (cache directory cleanup races) that existed before this plan. Logged to `deferred-items.md`. Server test suite (`server.test.js`) passes 6/6 with no issues.

## Next Phase Readiness
- `node server.js` starts the server and serves index.html at localhost:3000
- /api/course-stream streams all 5 named SSE events to a browser
- /api/transcript/:videoId route is registered and functional
- YouTubeQuotaError catch path wired — Phase 2 pipeline can throw this error and it will surface as a user-readable SSE event automatically
- Full test suite for server integration (6 tests green)

---
*Phase: 01-foundation*
*Completed: 2026-03-19*

## Self-Check: PASSED

- server.js: FOUND
- index.html: FOUND
- tests/unit/server.test.js: FOUND
- 01-04-SUMMARY.md: FOUND
- Commit cf8fce7: FOUND
- Commit e8537fc: FOUND
- Commit 92cb136: FOUND
