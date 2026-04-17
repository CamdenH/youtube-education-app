---
phase: 07-course-persistence
plan: "04"
subsystem: sse
tags: [sse, tdd, return-value, d-08]
dependency_graph:
  requires: [07-03]
  provides: [courseStreamHandler-return-contract]
  affects: [server.js (Plan 05)]
tech_stack:
  added: []
  patterns: [tdd-red-green, mutable-stub-cell, let-before-branch]
key_files:
  created: []
  modified:
    - sse.js
    - tests/unit/sse.test.js
decisions:
  - "courseToReturn initialized to null before if/else so the single return handles both branches cleanly"
  - "clearInterval and res.end() remain in a single location — not duplicated per branch"
  - "Return value is the same courseResult reference passed in the SSE event — no copy, no mutation risk (T-7-07 accepted)"
metrics:
  duration: "~1 minute"
  completed: "2026-04-17"
  tasks_completed: 2
  files_modified: 2
---

# Phase 07 Plan 04: courseStreamHandler Return Contract Summary

Added an explicit return value to `courseStreamHandler` in `sse.js`: returns the assembled course object on success, `null` on `TOO_FEW_VIDEOS`. Two-line change (`let courseToReturn = null` + `return courseToReturn`) enables Plan 05 to capture the result for Supabase persistence.

## What Was Built

### Change Pattern

**`sse.js`** — 3-line surgical edit to the terminal section of `courseStreamHandler`

Before (implicit `undefined` return):
```javascript
if (courseResult.error === 'TOO_FEW_VIDEOS') {
  sendEvent(res, 'course_assembled', courseResult);
} else {
  sendEvent(res, 'course_assembled', { step: 5, total: 5, message: 'Course ready', course: courseResult });
}
clearInterval(heartbeatInterval);
res.end();
```

After (explicit return):
```javascript
let courseToReturn = null;
if (courseResult.error === 'TOO_FEW_VIDEOS') {
  sendEvent(res, 'course_assembled', courseResult);
} else {
  sendEvent(res, 'course_assembled', { step: 5, total: 5, message: 'Course ready', course: courseResult });
  courseToReturn = courseResult;
}
clearInterval(heartbeatInterval);
res.end();
return courseToReturn;
```

**`tests/unit/sse.test.js`** — 2 new tests appended

| Test | Assertion |
|------|-----------|
| `courseStreamHandler returns the assembled course object on success (D-08)` | `assert.ok(result)`, `result.title === STUB_COURSE.title`, `result.modules deepEqual STUB_COURSE.modules` |
| `courseStreamHandler returns null on TOO_FEW_VIDEOS (D-08)` | `result === null` (assemblerStub swapped to TOO_FEW_VIDEOS shape, restored in finally) |

### Return Value Contract

| Path | Return value |
|------|-------------|
| Success (`assembleCourse` returns course object) | `courseResult` (same object reference passed in SSE event) |
| TOO_FEW_VIDEOS (`courseResult.error === 'TOO_FEW_VIDEOS'`) | `null` |

## TDD Flow

| Phase | Commit | Result |
|-------|--------|--------|
| RED | 9fdbc88 | 16 pass, 2 fail (new tests fail — `undefined !== null/object`) |
| GREEN | 0beebc2 | 18/18 pass; full suite 153/153 pass |

## Test Counts Before/After

| File | Before | After |
|------|--------|-------|
| sse.test.js | 16 tests | 18 tests |
| **Total suite** | **153** | **153** |

(Total suite count unchanged — sse.test.js gained 2 tests; no other files changed)

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 (RED) | 9fdbc88 | test(07-04): add failing tests for courseStreamHandler return value |
| Task 2 (GREEN) | 0beebc2 | feat(07-04): courseStreamHandler returns course object or null (D-08) |

## Deviations from Plan

None — plan executed exactly as written.

## Threat Mitigations

**T-7-07 (Mutation of returned course object):** Accepted per plan. `courseStreamHandler` is called once per request; `db.saveCourse` (Plan 05) serializes the object into JSONB immediately. No mutation risk.

## Known Stubs

None.

## Self-Check: PASSED

- [x] `sse.js` contains `let courseToReturn = null;` (1 occurrence)
- [x] `sse.js` contains `courseToReturn = courseResult;` (1 occurrence)
- [x] `sse.js` contains `return courseToReturn;` (1 occurrence)
- [x] `tests/unit/sse.test.js` contains `courseStreamHandler returns the assembled course object on success (D-08)`
- [x] `tests/unit/sse.test.js` contains `courseStreamHandler returns null on TOO_FEW_VIDEOS (D-08)`
- [x] `tests/unit/sse.test.js` contains `assert.ok(result, 'courseStreamHandler should return a non-null value on success')`
- [x] `tests/unit/sse.test.js` contains `assert.equal(result, null, 'courseStreamHandler should return null on TOO_FEW_VIDEOS')`
- [x] `node --test --test-concurrency=1 tests/unit/sse.test.js` → 18/18 pass
- [x] `npm test` → 153/153 pass
- [x] Commits 9fdbc88 and 0beebc2 exist
