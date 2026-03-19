---
phase: 01-foundation
plan: "02"
subsystem: infra
tags: [sse, streaming, express, node-test, retry, exponential-backoff, json-parsing]

requires: []

provides:
  - "SSE helpers: sendEvent, sendHeartbeat, startHeartbeat with correct named-event format and heartbeat comment format"
  - "Stub courseStreamHandler emitting all 5 Phase 1 named events (query_generated, videos_fetched, scored, transcripts_fetched, course_assembled)"
  - "Claude retry wrapper: callClaude with 3-attempt retry and exponential backoff (1s, 2s)"
  - "Claude JSON utility: parseClaudeJSON strips markdown code fences before JSON.parse"
  - "Unit tests: 11 tests each for sse.js and claude.js (22 total), all passing"

affects:
  - "Phase 2: callClaude and parseClaudeJSON are the entry points for all Claude API calls"
  - "Phase 4: courseStreamHandler stub enables frontend EventSource integration testing"
  - "server.js: mounts courseStreamHandler at GET /api/course-stream"

tech-stack:
  added: []
  patterns:
    - "SSE named event format: event: {name}\\ndata: {json}\\n\\n via res.write()"
    - "SSE heartbeat as comment line: ': heartbeat\\n\\n' — invisible to addEventListener"
    - "Heartbeat cleanup on req.on('close') to prevent timer leaks"
    - "Injected delay parameter (_delayMs) for test-friendly async functions without timer mocking"
    - "Optional _testDelayBase options object as last arg to callClaude for fast retry tests"
    - "node:test with mock.timers for setInterval unit testing"

key-files:
  created:
    - sse.js
    - claude.js
    - tests/unit/sse.test.js
    - tests/unit/claude.test.js
  modified: []

key-decisions:
  - "Added _delayMs=800 injectable parameter to courseStreamHandler for test-friendly execution without real timer mocking"
  - "Used _testDelayBase options object as last positional arg to callClaude so test delay can be injected without changing the public API"
  - "node:test mock.timers does not support clearInterval as a mockable API — only mock setInterval and setTimeout"

patterns-established:
  - "SSE event format: two separate res.write() calls (event: line, data: line) terminated with double newline"
  - "Heartbeat as SSE comment (': heartbeat\\n\\n') not a named event — keeps proxies alive, invisible to addEventListener"
  - "Injectable delay for testability: async handlers accept optional delay param so tests run without timer mocking"

requirements-completed:
  - INFR-02
  - INFR-03
  - INFR-05
  - PIPE-06

duration: 4min
completed: "2026-03-19"
---

# Phase 01 Plan 02: SSE Infrastructure and Claude Utilities Summary

**SSE named-event helpers with 5-event stub pipeline and Claude retry/JSON-fence-strip utilities — all tested with node:test (22/22 pass)**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-19T08:22:02Z
- **Completed:** 2026-03-19T08:26:51Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- `sse.js` exports `sendEvent`, `sendHeartbeat`, `startHeartbeat`, and `courseStreamHandler` — the complete SSE infrastructure for the course-stream endpoint
- `courseStreamHandler` sets all 4 required SSE headers, starts a 15-second heartbeat, emits all 5 named pipeline events in order, cleans up on client disconnect, and calls `res.end()` after the terminal event
- `claude.js` exports `callClaude` (3-attempt retry with 1s/2s exponential backoff) and `parseClaudeJSON` (strips markdown code fences before JSON.parse) — the utility layer Phase 2 will use for all Claude API calls
- 22 unit tests across both modules: 11 for SSE helpers, 11 for Claude utilities

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: SSE tests** - `0611fd3` (test)
2. **Task 1 GREEN: sse.js implementation** - `5726a24` (feat)
3. **Task 2 RED: Claude tests** - `64d0b3b` (test)
4. **Task 2 GREEN: claude.js implementation** - `0620f6f` (feat)

_TDD tasks produced separate RED (test) and GREEN (implementation) commits._

## Files Created/Modified

- `sse.js` — SSE send-event helper, heartbeat, and 5-event stub course stream handler
- `claude.js` — Claude retry wrapper with exponential backoff and markdown-fence JSON parser
- `tests/unit/sse.test.js` — 11 tests covering all 4 exports and all behavior specified in the plan
- `tests/unit/claude.test.js` — 11 tests covering retry counts, backoff, argument passing, and all parseClaudeJSON fence variations

## Decisions Made

- **Injectable delay parameter:** `courseStreamHandler(req, res, _delayMs = 800)` — adding a third parameter with default 800ms avoids complex timer mocking in tests while keeping production behavior identical. Tests pass `0` for instant execution.
- **_testDelayBase options object:** `callClaude(fn, ...args, { _testDelayBase: 1 })` — the last positional argument is checked for `_testDelayBase` to override the 1000ms backoff base in tests, enabling sub-second retry tests without slow real delays.
- **node:test timer mocking limitation discovered:** `mock.timers.enable({ apis: ['clearInterval'] })` throws `ERR_INVALID_ARG_VALUE` — `clearInterval` is not a mockable timer API in Node 22.22. Only `setInterval` and `setTimeout` are supported.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed node:test mock.timers unsupported 'clearInterval' API**
- **Found during:** Task 1 (sse.js GREEN — running tests after implementation)
- **Issue:** Tests used `t.mock.timers.enable({ apis: ['setInterval', 'clearInterval', 'setTimeout'] })` but Node 22.22 throws `ERR_INVALID_ARG_VALUE` for `clearInterval` as a mockable API
- **Fix:** Removed `clearInterval` from the `apis` array; restructured `courseStreamHandler` tests to use injected `_delayMs=0` instead of timer mocking, avoiding the issue entirely
- **Files modified:** `tests/unit/sse.test.js`, `sse.js` (added _delayMs parameter)
- **Verification:** All 11 SSE tests pass
- **Committed in:** `5726a24` (Task 1 implementation commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug in test timer API usage)
**Impact on plan:** Fix improved test reliability by avoiding fragile timer mocking for async handlers. No behavior change to production sse.js.

## Issues Encountered

- `node:test` `mock.timers` does not support `clearInterval` as a mockable API in Node 22.22.0 — solved by injecting delay as a parameter to `courseStreamHandler` for testing

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `sse.js` is ready for `server.js` to mount at `GET /api/course-stream` (plan 01-03)
- `claude.js` is ready for Phase 2 to import and wrap all Claude API calls
- `courseStreamHandler` stub emits all 5 named events — Phase 4 frontend can build against it immediately
- `tests/unit/` directory established; other test files (cache, youtube, etc.) will be added by subsequent plans

---
*Phase: 01-foundation*
*Completed: 2026-03-19*

## Self-Check: PASSED

- FOUND: sse.js
- FOUND: claude.js
- FOUND: tests/unit/sse.test.js
- FOUND: tests/unit/claude.test.js
- FOUND: .planning/phases/01-foundation/01-02-SUMMARY.md
- Commits verified: 0611fd3, 5726a24, 64d0b3b, 0620f6f
- Tests: 22/22 pass (0 fail, 0 cancelled)
