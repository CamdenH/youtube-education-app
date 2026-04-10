---
phase: 05-lazy-hints
plan: "01"
subsystem: tests
tags: [tdd, hints, localStorage, server]
dependency_graph:
  requires: []
  provides: [test-harness-for-POST-api-hints, test-harness-for-persistHints-loadHints]
  affects: [tests/unit/server.test.js, tests/unit/frontend.test.js]
tech_stack:
  added: []
  patterns: [inline-function-test-pattern, mock-storage-injection, app.listen(0)-ephemeral-port]
key_files:
  created: []
  modified:
    - tests/unit/server.test.js
    - tests/unit/frontend.test.js
decisions:
  - "persistHints/loadHints defined inline in frontend.test.js per existing file pattern; canonical implementations copied to index.html in Plan 03"
  - "POST /api/hints tests fail RED with 404 (route not yet registered) — confirms test scaffold is meaningful"
metrics:
  duration: "~8 minutes"
  completed: "2026-04-10T20:54:00Z"
  tasks_completed: 2
  files_modified: 2
---

# Phase 05 Plan 01: Lazy Hints Test Harness (RED) Summary

**One-liner:** TDD RED scaffold — 4 failing server tests for POST /api/hints + 7 passing frontend tests for localStorage hint persistence helpers.

## What Was Built

Added failing test cases to establish the test contract before any production code is written. Two files extended, no production code touched.

### Task 1: POST /api/hints test cases (server.test.js)

Four test cases appended that target `POST /api/hints` — a route that does not exist yet. All 4 fail at RED with status 404 (route missing), confirming the tests exercise a real gap:

1. `POST /api/hints returns 400 when videoId is missing`
2. `POST /api/hints returns 400 when questions is not an array of 3`
3. `POST /api/hints returns 400 when videoTitle is missing`
4. `POST /api/hints returns 500 JSON when Claude call fails`

Commit: `0086754`

### Task 2: persistHints / loadHints test cases (frontend.test.js)

Seven test cases appended using the existing inline-function pattern. Canonical implementations of `persistHints` and `loadHints` defined inline with mock storage injection (no DOM, no real localStorage):

- `persistHints`: 2 tests (write to ylc_hints, isolation between videos)
- `loadHints`: 4 tests (read back stored value, missing key, different key, storage throws)

All 7 pass immediately because they use pure logic with mock storage. No external dependencies.

Commit: `007c979`

## Test Results

| File | Before | After | Status |
|------|--------|-------|--------|
| server.test.js | 10 pass, 0 fail | 10 pass, 4 fail (RED) | Correct — route missing |
| frontend.test.js | 21 pass, 0 fail | 28 pass, 0 fail | All pass |

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None — this plan adds only test code. No production stubs introduced.

## Threat Flags

None — test files only, no new network endpoints or trust boundaries introduced.

## Self-Check: PASSED

All files confirmed present, all commit hashes verified in git log, all acceptance criteria strings found in test files.
