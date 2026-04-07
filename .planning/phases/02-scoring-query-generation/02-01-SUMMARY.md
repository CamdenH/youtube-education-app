---
phase: 02-scoring-query-generation
plan: 02-01
subsystem: testing
tags: [tdd, stubs, anthropic-sdk, nyquist-compliance]
dependency_graph:
  requires: []
  provides: [queries-test-contract, scorer-test-contract, anthropic-sdk]
  affects: [02-02, 02-03]
tech_stack:
  added: ["@anthropic-ai/sdk ^0.82.0"]
  patterns: [try-catch-require-guard, contract-stub-tests]
key_files:
  created:
    - tests/unit/queries.test.js
    - tests/unit/scorer.test.js
  modified:
    - package.json
    - package-lock.json
decisions:
  - "@anthropic-ai/sdk installed at ^0.82.0 (latest available at execution time)"
  - "try/catch guard on require() prevents test runner crash when implementation modules don't exist yet"
metrics:
  duration: "~5 min"
  completed: "2026-04-06"
  tasks_completed: 2
  files_created: 2
  files_modified: 2
---

# Phase 02 Plan 01: Wave 0 Test Stubs and SDK Install Summary

Wave 0 Nyquist compliance — @anthropic-ai/sdk installed and contract stubs created for `queries.js` (PIPE-02) and `scorer.js` (SCOR-01 through SCOR-05) before implementation modules exist.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Install @anthropic-ai/sdk and create queries.test.js stub | b3e26be | package.json, package-lock.json, tests/unit/queries.test.js |
| 2 | Create scorer.test.js stub | af2e47e | tests/unit/scorer.test.js |

## Verification Results

Both test files run to completion without crashing the test runner:

```
node --test --test-concurrency=1 tests/unit/scorer.test.js tests/unit/queries.test.js
# tests 14 / pass 10 / fail 4
```

The 4 failures are by design: the `generateQueries is exported as a function` and `scoreVideos is exported as a function` stubs (and their dependent component tests) call `assert.fail()` when the implementation modules aren't present. This is the expected contract signal for Plans 02 and 03.

Full suite (npm test): 76 tests / 72 pass / 4 fail — no pre-existing tests regressed.

## What Was Built

- **@anthropic-ai/sdk ^0.82.0** added to package.json dependencies and installed
- **tests/unit/queries.test.js** — 4 stubs for PIPE-02 contract: function export, array shape, beginner/advanced differentiation, plain array return (not wrapped object)
- **tests/unit/scorer.test.js** — 10 stubs for SCOR-01 through SCOR-05 and deterministic scorer components: scoreVideos export, 0-100 range, skill-level weight difference, credibility prompt anchors, single Claude call, description quality 0-10, scoreDuration ideal/short range, scoreLikeRatio zero viewCount and string inputs

Both files use the `try/catch require guard` pattern established by the plan — if the module doesn't exist, the module-presence tests call `assert.fail()` with an actionable message, and all other stubs pass unconditionally.

## Deviations from Plan

None — plan executed exactly as written. The test output (4 expected failures, runner completing without crash) matches the plan's acceptance criteria exactly.

## Known Stubs

By design — the following stubs exist and will remain failing until their implementation plans run:

| Stub | File | Reason |
|------|------|--------|
| `generateQueries is exported as a function` | tests/unit/queries.test.js:16 | queries.js created in Plan 02 |
| `scoreVideos is exported as a function` | tests/unit/scorer.test.js:17 | scorer.js created in Plan 03 |
| `scoreDuration returns 20 for...` | tests/unit/scorer.test.js:47 | scorer.js created in Plan 03 |
| `scoreLikeRatio returns 0 when...` | tests/unit/scorer.test.js:57 | scorer.js created in Plan 03 |

These stubs are intentional and tracked — they will turn green when Plans 02 and 03 create the implementation modules.

## Self-Check: PASSED

- FOUND: tests/unit/queries.test.js
- FOUND: tests/unit/scorer.test.js
- FOUND: node_modules/@anthropic-ai/sdk
- FOUND commit: b3e26be (Task 1)
- FOUND commit: af2e47e (Task 2)
