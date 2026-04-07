---
phase: 02-scoring-query-generation
plan: 02-02
subsystem: query-generation
tags: [claude-api, anthropic-sdk, query-generation, tdd, mocking]
dependency_graph:
  requires: [02-01]
  provides: [generateQueries]
  affects: [02-03, 02-04, sse-pipeline]
tech_stack:
  added: []
  patterns: [callClaude-retry-wrapper, require-cache-injection-mocking, angle-diverse-prompting]
key_files:
  created:
    - queries.js
  modified:
    - tests/unit/queries.test.js
decisions:
  - "claude-haiku-4-5-20251001 selected (haiku-3 retires April 19 2026; haiku 4.5 is the replacement)"
  - "callClaude(async () => {...}) pattern wraps anthropic.messages.create for retry behavior"
  - "buildQueryPrompt kept private (not exported) — an implementation detail, not a public contract"
  - "Mocking via require.cache injection — no jest/sinon deps needed; works cleanly with node:test"
  - "SDK mock (fake Anthropic constructor) injected for prompt-content inspection tests"
metrics:
  duration: "~8 min"
  completed: "2026-04-06"
  tasks_completed: 2
  files_created: 1
  files_modified: 1
---

# Phase 02 Plan 02: generateQueries Implementation Summary

`queries.js` implements `generateQueries(subject, skillLevel)` — angle-diverse YouTube search query generation via Claude haiku, with skill-level angle emphasis (D-07, D-08), explicit diversity instruction (D-09), and plain JSON array output (D-10). `queries.test.js` stubs replaced with 6 real assertions covering array shape, error handling, and prompt content.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Implement queries.js with generateQueries | 330f26c | queries.js |
| 2 | Replace queries.test.js stubs with real assertions | 3da8293 | tests/unit/queries.test.js |

## Verification Results

```
node --test --test-concurrency=1 tests/unit/queries.test.js
# tests 6 / pass 6 / fail 0
```

Full suite (npm test): 78 tests / 75 pass / 3 fail — the 3 failures are pre-existing scorer stubs (from Plan 02-01) that depend on `scorer.js` which does not exist yet. No regressions introduced by this plan.

## What Was Built

### queries.js

- `'use strict'`, CommonJS exports, flat-root placement per project conventions
- `buildQueryPrompt(subject, skillLevel)` — private function; `angleHints` keyed by skill level produces angle emphasis per D-07/D-08; prompt contains `"each query must be meaningfully different"` (D-09); instructs Claude to return `"ONLY a JSON array of query strings"` (D-10)
- `generateQueries(subject, skillLevel)` — wraps `anthropic.messages.create` in `callClaude(async () => {...})` for 2-retry exponential backoff; calls `parseClaudeJSON` to strip code fences; validates `Array.isArray(result)` and throws `"generateQueries: expected array from Claude, got object"` on non-array response
- Model: `claude-haiku-4-5-20251001` (replaces deprecated `claude-3-haiku-20240307`)
- `module.exports = { generateQueries }` — only public export

### tests/unit/queries.test.js

Six real assertions replacing four stubs:
1. `generateQueries is exported as a function` — import check
2. `generateQueries returns an array of strings from Claude response` — mocked callClaude returns 7-element JSON; asserts Array, length in [6,8], each string
3. `generateQueries throws if Claude returns wrapped object` — mocked callClaude returns `{"queries": [...]}` JSON; asserts rejects with `"expected array"`
4. `beginner prompt contains beginner angle keywords` — captures prompt via SDK mock; asserts `tutorial`, `introduction`, or `overview`
5. `advanced prompt contains advanced angle keywords` — asserts `lecture`, `deep dive`, or `research`
6. `prompt always contains diversity instruction` — asserts `"meaningfully different"` in every prompt

**Mocking approach:** `require.cache` injection replaces both `claude.js` (`callClaude`) and `@anthropic-ai/sdk` (fake `Anthropic` constructor) per test, then clears cache in `cleanup()`. No third-party test framework deps added.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — no stub patterns remain in `queries.js` or `queries.test.js`.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced. `ANTHROPIC_API_KEY` loaded from environment at module instantiation time (never logged).

## Self-Check: PASSED

- FOUND: queries.js (project root)
- FOUND: tests/unit/queries.test.js (stubs replaced, 6 real tests)
- FOUND commit: 330f26c (Task 1 — feat(02-02): implement queries.js)
- FOUND commit: 3da8293 (Task 2 — test(02-02): replace stubs with real assertions)
