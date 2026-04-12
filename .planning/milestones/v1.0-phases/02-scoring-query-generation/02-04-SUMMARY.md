---
phase: 02-scoring-query-generation
plan: 02-04
subsystem: pipeline-wiring
tags: [sse, pipeline, validation, integration]
dependency_graph:
  requires: [02-02, 02-03]
  provides: [real-pipeline-sse, pipe-01-validation]
  affects: [sse.js, server.js, tests/unit/server.test.js, tests/unit/sse.test.js]
tech_stack:
  added: []
  patterns:
    - require.cache injection for module mocking in Node 22 (no mock.module available)
    - Input validation at route boundary before SSE stream opens
    - Promise.all for concurrent YouTube searches
key_files:
  created: []
  modified:
    - sse.js
    - server.js
    - tests/unit/server.test.js
    - tests/unit/sse.test.js
decisions:
  - require.cache injection used for sse.test.js mocking (mock.module not available in Node 22.22.0)
  - VALID_LEVELS placed in server.js route boundary (not sse.js or queries.js) per plan constraint
  - Existing 'GET /api/course-stream returns SSE headers' test updated to include valid query params
metrics:
  duration: ~8 min
  completed: 2026-04-06
  tasks_completed: 3
  files_modified: 4
---

# Phase 02 Plan 04: Pipeline Wiring and Input Validation Summary

**One-liner:** Real generateQueries → searchVideos → fetchVideoStats → scoreVideos pipeline wired into courseStreamHandler with subject/skill_level validation at the route boundary.

## What Was Built

### Task 1: Input validation in server.js (commit b9d5b53)

Added `VALID_LEVELS` Set and two guards at the top of the `/api/course-stream` route handler — before `courseStreamHandler` is called and before SSE headers are flushed. Missing or oversized `subject` returns HTTP 400 JSON. `skill_level` not in the allowlist returns HTTP 400 JSON.

Updated the existing `'GET /api/course-stream returns SSE headers'` test to pass `?subject=test&skill_level=beginner` — required after validation was added (the test previously called the route with no params).

### Task 2: Real pipeline in sse.js (commit 9cb7a29)

Replaced the stub `courseStreamHandler` (5-event loop with `_delayMs` delays and `STUB_EVENTS`) with the real pipeline:

1. `generateQueries(subject, skillLevel)` → `sendEvent(query_generated)`
2. `Promise.all(queries.map(searchVideos))` → deduplicate video IDs → `fetchVideoStats(videoIds)` → `sendEvent(videos_fetched)`
3. `scoreVideos(videos, skillLevel)` → `sendEvent(scored)`
4. Stub `transcripts_fetched` (Phase 3)
5. Stub `course_assembled` with `{ title: subject, overview: '', modules: [] }` (Phase 3)

Updated `sse.test.js` to mock the three pipeline dependencies via `require.cache` injection (Node 22.22.0 does not support `mock.module`). Added two new tests verifying `query_generated` includes the `queries` array and `scored` includes the `videos` array.

### Task 3: PIPE-01 validation tests in server.test.js (commit 8b2d5ea)

Appended 4 new tests to `tests/unit/server.test.js`:
- Missing `subject` → 400 with `subject` in error message
- `subject` over 200 chars → 400
- Invalid `skill_level` (`expert`) → 400 with `skill_level` in error message
- Valid inputs → not 400, response has `text/event-stream` content-type

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed regression: existing SSE headers test called route without query params**
- **Found during:** Task 1
- **Issue:** `'GET /api/course-stream returns SSE headers'` fetched `/api/course-stream` with no query params, which now returns 400 after validation was added.
- **Fix:** Added `?subject=test&skill_level=beginner` to the fetch URL in the existing test.
- **Files modified:** `tests/unit/server.test.js`
- **Commit:** b9d5b53

**2. [Rule 3 - Blocking] mock.module not available in Node 22.22.0**
- **Found during:** Task 2
- **Issue:** `mock.module` from `node:test` is not a function in Node 22.22.0, making the original approach for mocking pipeline dependencies in sse.test.js fail at load time.
- **Fix:** Used `require.cache` injection — registered stub module entries before requiring `sse.js` so the stubs are picked up by `courseStreamHandler`.
- **Files modified:** `tests/unit/sse.test.js`
- **Commit:** 9cb7a29

**3. [Rule 3 - Blocking] node_modules missing in worktree**
- **Found during:** Task 2 (npm test)
- **Issue:** The worktree had no `node_modules/` so `@anthropic-ai/sdk` was not resolvable, causing `queries.test.js` and `scorer.test.js` to fail with MODULE_NOT_FOUND.
- **Fix:** Ran `npm install` in the worktree.
- **Files modified:** none (runtime dependency install)
- **Commit:** n/a

## Known Stubs

| Stub | File | Line | Reason |
|------|------|------|--------|
| `transcripts_fetched` event | sse.js | ~102 | Phase 3 will wire real transcript fetching |
| `course_assembled` event with `{ title, overview: '', modules: [] }` | sse.js | ~108 | Phase 3 will wire real course assembly via Claude |

These stubs are intentional — the plan explicitly specifies them as Phase 3 work. They do not block the Phase 2 goal (query generation + scoring pipeline verified via SSE events 1-3).

## Threat Flags

None — all surfaces were accounted for in the plan's threat model. T-02-04-01 and T-02-04-02 are mitigated by the validation added in Task 1.

## Self-Check: PASSED

Files exist:
- sse.js — FOUND
- server.js — FOUND
- tests/unit/server.test.js — FOUND
- tests/unit/sse.test.js — FOUND
- .planning/phases/02-scoring-query-generation/02-04-SUMMARY.md — FOUND (this file)

Commits exist:
- b9d5b53 — feat(02-04): add input validation for subject and skill_level in server.js
- 9cb7a29 — feat(02-04): replace courseStreamHandler stub with real pipeline in sse.js
- 8b2d5ea — test(02-04): extend server.test.js with PIPE-01 input validation tests

Test results: 92/92 pass (`npm test`)
