---
phase: "03"
plan: "01"
subsystem: assembler
tags: [scaffold, tdd, skeleton]
dependency_graph:
  requires: []
  provides: [assembler.js, tests/unit/assembler.test.js]
  affects: [sse.js]
tech_stack:
  added: []
  patterns: [require-cache-injection, not-implemented-stubs, tdd-red]
key_files:
  created:
    - assembler.js
    - tests/unit/assembler.test.js
  modified: []
decisions:
  - "assembler.js follows the identical Anthropic SDK + callClaude pattern established in scorer.js"
  - "Test file uses require.cache injection pattern matching scorer.test.js and queries.test.js exactly"
  - "STUB_COURSE_FROM_CLAUDE fixture contains only Claude-generated fields — metadata fields are intentionally absent to test mergeClaudeOutput in Plan 2"
metrics:
  duration: "~3 min"
  completed: "2026-04-08"
  tasks_completed: 2
  files_created: 2
  files_modified: 0
---

# Phase 3 Plan 1: assembler.js scaffold + test stubs Summary

**One-liner:** `assembler.js` skeleton with four stub functions and `tests/unit/assembler.test.js` with 7 TDD-red tests defining the full course assembly contract.

## What Was Built

### assembler.js (project root)

Skeleton module following the exact pattern of `scorer.js`:
- `'use strict'`, `Anthropic` SDK import, `callClaude` + `parseClaudeJSON` from `./claude`
- Four private functions with JSDoc: `parseDurationSeconds`, `buildAssemblyPrompt`, `mergeClaudeOutput` — all throw `new Error('not implemented')`
- One exported async function: `assembleCourse` — throws `new Error('not implemented')`
- `module.exports = { assembleCourse }` only

### tests/unit/assembler.test.js

7 distinct `test()` calls covering the full contract Plan 2 must satisfy:

| Test | What it asserts |
|------|----------------|
| A — TOO_FEW_VIDEOS gate | `< 5 videos` returns `{ error: 'TOO_FEW_VIDEOS' }`, no Claude call |
| B — callClaude count | Called exactly once with 5+ videos |
| C — merged fields | `thumbnail`, `url`, `durationSeconds`, `score`, `title`, `channelTitle` correct |
| D — course structure | `title`, `overview`, `totalWatchTime`, `prerequisites`, `modules` + module fields |
| E — 3 questions | `questions.length === 3` with types recall/conceptual/application |
| F — outdated boolean | `typeof outdated === 'boolean'` |
| G — Claude response used | `result.title` equals `STUB_COURSE_FROM_CLAUDE.title` |

All 7 tests fail with `'not implemented'` — TDD red state confirmed.

## Verification

```
node -e "const a = require('./assembler'); console.log(typeof a.assembleCourse)"
# → function

node --test --test-concurrency=1 tests/unit/assembler.test.js
# → 7/7 FAIL (not implemented) ✓

node --test --test-concurrency=1 tests/unit/scorer.test.js tests/unit/queries.test.js tests/unit/sse.test.js
# → 37/37 PASS ✓
```

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

All stubs are intentional — this is Plan 1 of 3 (scaffold only). Plan 2 implements all function bodies.

| Stub | File | Reason |
|------|------|--------|
| `parseDurationSeconds` | `assembler.js:19` | Plan 2 implements (ISO 8601 parser) |
| `buildAssemblyPrompt` | `assembler.js:35` | Plan 2 implements (Claude prompt builder) |
| `mergeClaudeOutput` | `assembler.js:53` | Plan 2 implements (metadata merge) |
| `assembleCourse` | `assembler.js:79` | Plan 2 implements (full pipeline) |

These stubs are intentional and do not block Plan 1's goal. Plan 2 resolves all of them.

## Self-Check: PASSED

- `assembler.js` exists: FOUND
- `tests/unit/assembler.test.js` exists: FOUND
- Commit `5fe93bc` (assembler.js): FOUND
- Commit `f40b6f6` (assembler.test.js): FOUND
- 7 tests fail with "not implemented": CONFIRMED
- 37 existing tests still pass: CONFIRMED
