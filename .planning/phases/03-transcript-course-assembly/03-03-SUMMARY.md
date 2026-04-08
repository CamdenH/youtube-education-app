---
phase: 03-transcript-course-assembly
plan: "03"
subsystem: api
tags: [sse, transcript, assembler, course-assembly, node-test]

# Dependency graph
requires:
  - phase: 03-transcript-course-assembly
    provides: fetchTranscript (transcript.js) and assembleCourse (assembler.js) — both implemented and tested in plans 01 and 02
provides:
  - courseStreamHandler fully wired: steps 4 (transcript fetch + description fallback) and 5 (course assembly via Claude)
  - transcripts_fetched SSE event with correct payload shape
  - course_assembled SSE event with success shape or TOO_FEW_VIDEOS error shape
  - 3 new sse.test.js tests covering Phase 3 behavior
affects: [phase 04, phase 05, server.js integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Mutable-cell stub indirection: stub exports a wrapper function that delegates to _impl — safe for post-require per-test overrides even when sse.js uses destructuring"
    - "Description fallback in sse.js step 4: fetchTranscript null + snippet.description.length > 50 → { source: 'description', text: desc }"
    - "TOO_FEW_VIDEOS terminal event: courseResult emitted directly (no course key); success shape wraps result in { step, total, message, course }"

key-files:
  created: []
  modified:
    - sse.js
    - tests/unit/sse.test.js

key-decisions:
  - "Mutable-cell indirection pattern for test stubs: sse.js uses destructuring (const { fetchTranscript } = require('./transcript')), so post-require cache mutation has no effect on the bound variable. Solution: stub exports a wrapper (...args) => stub._impl(...args) so per-test swaps of _impl propagate through the already-captured wrapper."

patterns-established:
  - "Mutable-cell stub pattern: when a module uses destructuring, stub via wrapper + _impl cell rather than replacing exports.fn after require"

requirements-completed: [TRAN-01, TRAN-02, TRAN-03, CURA-01, CURA-02, CURA-03, CURA-04, CURA-05, CURA-06, CURA-07, QUES-01, QUES-02, QUES-03]

# Metrics
duration: 15min
completed: 2026-04-08
---

# Phase 3 Plan 3: Wire steps 4 and 5 in sse.js — Summary

**courseStreamHandler fully wired end-to-end: parallel transcript fetch with description fallback, TOO_FEW_VIDEOS gate, and Claude course assembly — 102/102 tests green**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-08T00:00:00Z
- **Completed:** 2026-04-08T00:15:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Replaced stub steps 4-5 in `courseStreamHandler` with real `fetchTranscript` + `assembleCourse` calls
- Step 4 runs `Promise.all` over top 12 scored videos; applies description fallback (> 50 chars) when transcript is null; excludes videos with neither
- Step 5 calls `assembleCourse(videosWithTranscripts, transcripts, subject, skillLevel)`; emits TOO_FEW_VIDEOS error shape directly or wraps success in `{ step, total, message, course }`
- sse.test.js extended with transcript/assembler stubs using mutable-cell indirection, plus 3 new Phase 3 tests

## Task Commits

Each task was committed atomically:

1. **Tasks 1 & 2: Wire sse.js steps 4-5 and update sse.test.js** - `75c6b96` (feat)

**Plan metadata:** (docs commit — see final commit)

## Files Created/Modified

- `sse.js` — requires `./transcript` and `./assembler`; step 4 transcript fetch loop with fallback; step 5 assembly and conditional event emission
- `tests/unit/sse.test.js` — transcript/assembler stubs via mutable-cell pattern; 3 new tests for transcripts_fetched shape, description fallback, TOO_FEW_VIDEOS

## Decisions Made

- **Mutable-cell stub indirection:** `sse.js` uses destructuring at require time, so post-load cache mutation cannot swap the bound function. Solved by having the stub export a thin wrapper `(...args) => stub._impl(...args)` — `_impl` can be swapped per-test and all invocations through the wrapper see the new implementation. This avoids module re-loading and is idiomatic for Node's built-in test runner without `mock.module()`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Mutable-cell stub pattern required for override tests**
- **Found during:** Task 2 (sse.test.js update)
- **Issue:** Plan's suggested override pattern (`require.cache[path].exports.fn = async () => ...`) does not work when `sse.js` binds functions via destructuring at load time — the override has no effect on the already-captured variable.
- **Fix:** Changed transcript and assembler stubs to use a `_impl` mutable cell behind a thin wrapper function. Per-test overrides swap `_impl` rather than replacing the export property.
- **Files modified:** `tests/unit/sse.test.js`
- **Verification:** All 16 sse.test.js tests pass, including the 2 override tests (description fallback, TOO_FEW_VIDEOS).
- **Committed in:** `75c6b96`

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Required fix for correctness of override tests. No scope creep.

## Issues Encountered

The plan's suggested test override pattern (`require.cache[path].exports.fetchTranscript = async () => null`) assumes module access via `require('./transcript').fetchTranscript()` at call time. Since `sse.js` uses `const { fetchTranscript } = require('./transcript')`, the function is captured by value. Post-load cache mutation is invisible to the captured reference. Resolved by the mutable-cell indirection pattern documented above.

## Known Stubs

None — steps 4 and 5 are fully wired. No placeholder data flows to the UI.

## Next Phase Readiness

- Phase 3 pipeline complete: all 5 SSE events are real (no stubs remaining in `courseStreamHandler`)
- 102/102 unit tests green
- Phase 4 (frontend integration, localStorage history, export) can begin

---
*Phase: 03-transcript-course-assembly*
*Completed: 2026-04-08*
