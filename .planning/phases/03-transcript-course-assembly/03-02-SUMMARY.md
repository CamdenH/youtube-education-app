---
phase: "03"
plan: "02"
subsystem: assembler
tags: [course-assembly, claude-api, json-merge, tdd]
dependency_graph:
  requires: [03-01]
  provides: [assembleCourse]
  affects: [sse.js]
tech_stack:
  added: []
  patterns: [single-claude-call, data-merge, gate-pattern]
key_files:
  created: []
  modified:
    - assembler.js
decisions:
  - parseDurationSeconds copied verbatim from scorer.js (no cross-module dependency on private fn)
  - buildAssemblyPrompt embeds full JSON schema inline so Claude cannot misinterpret field names
  - mergeClaudeOutput builds videoMap lookup for O(1) per-video merge
  - assembleCourse uses max_tokens 8192 to accommodate full course JSON with 12 videos and 36 questions
metrics:
  duration: "~4 min"
  completed: "2026-04-08"
  tasks_completed: 2
  files_modified: 1
---

# Phase 03 Plan 02: assembleCourse implementation Summary

**One-liner:** Full `assembleCourse` pipeline — TOO_FEW_VIDEOS gate, single Claude call at max_tokens 8192, ISO 8601 duration parsing, Claude JSON merged with scored video metadata.

## What Was Built

Implemented all four stub functions in `assembler.js`:

- **`parseDurationSeconds`** — ISO 8601 regex (`PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?`) copied exactly from `scorer.js`. Returns 0 on no-match; handles hours, minutes, seconds in any combination.

- **`buildAssemblyPrompt`** — Constructs a single prompt containing the subject, skill level, all video metadata + transcripts (rendered as `--- VIDEO: {id} ---` blocks), assembly instructions, and the full course JSON schema embedded verbatim. Does not call Claude.

- **`mergeClaudeOutput`** — Builds a `videoMap` lookup keyed by `v.id`. Merges Claude's module/video structure (blurb, outdated, questions, connectingQuestion, module title/description, course title/overview/totalWatchTime/prerequisites) with scored video metadata (title, channelTitle, thumbnail URL, YouTube watch URL, durationSeconds, score). Videos Claude invents that aren't in the map pass through as-is.

- **`assembleCourse`** — Async orchestrator: TOO_FEW_VIDEOS gate at `videos.length < 5` (returns error shape without calling Claude), builds prompt, calls Claude via `callClaude` wrapper with `max_tokens: 8192`, parses JSON via `parseClaudeJSON`, merges output.

## Test Results

```
node --test --test-concurrency=1 tests/unit/assembler.test.js
# tests 7 / pass 7 / fail 0

node --test --test-concurrency=1 tests/unit/*.test.js
# tests 99 / pass 99 / fail 0
```

## Done Criteria Verification

- [x] `parseDurationSeconds('PT30M')` returns `1800`; `parseDurationSeconds('PT1H30M15S')` returns `5415`; `parseDurationSeconds('')` returns `0`
- [x] `assembleCourse` with 4 videos returns `{ error: 'TOO_FEW_VIDEOS', ... }` without calling Claude
- [x] `assembleCourse` with 5+ videos calls `callClaude` exactly once with `max_tokens: 8192`
- [x] Merged video objects contain `thumbnail`, `url`, `durationSeconds`, `score`, `title`, `channelTitle` — derived from scored video, not Claude
- [x] `tests/unit/assembler.test.js` passes (7/7 green)
- [x] `tests/unit/*.test.js` passes (99/99, no regressions)

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1+2 | c78ecb0 | feat(03-02): implement assembleCourse, mergeClaudeOutput, buildAssemblyPrompt, parseDurationSeconds |

## Deviations from Plan

None — plan executed exactly as written. Task 1 (parseDurationSeconds + buildAssemblyPrompt) and Task 2 (mergeClaudeOutput + assembleCourse) were committed together since all four functions are in the same file and the tests validate them as a unit.

## Known Stubs

None. `assembleCourse` is fully wired — it calls Claude, parses the response, and merges with real video metadata.

## Threat Flags

None. No new network endpoints, auth paths, or file access patterns introduced. `assembler.js` is a pure computation module invoked internally by `sse.js`.

## Self-Check: PASSED

- assembler.js: FOUND
- Commit c78ecb0: FOUND (git log confirms)
- 99/99 tests green: CONFIRMED
