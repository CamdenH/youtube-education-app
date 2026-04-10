---
phase: 05-lazy-hints
plan: "02"
subsystem: server
tags: [hints, assembler, server, claude, express]
dependency_graph:
  requires: [05-01]
  provides: [transcriptSnippet-in-course-json, POST-api-hints-endpoint]
  affects: [assembler.js, server.js]
tech_stack:
  added: []
  patterns: [express-json-middleware, callClaude-wrapper, Socratic-prompt-pattern, input-validation-400]
key_files:
  created: []
  modified:
    - assembler.js
    - server.js
decisions:
  - "generateHints defined as named function in server.js (not inline closure) so callClaude can invoke it via fn(...args) pattern"
  - "transcriptSnippet capped at 2000 chars server-side in generateHints regardless of client-sent value (T-05-02-02/03)"
  - "express.json() placed after express.static() — static file serving does not need body parsing"
  - "anthropic client instantiated at module top level (matches assembler.js pattern)"
metrics:
  duration: "~8 minutes"
  completed: "2026-04-10T20:57:53Z"
  tasks_completed: 2
  files_modified: 2
---

# Phase 05 Plan 02: Server-Side Hints Implementation (GREEN) Summary

**One-liner:** Production server logic for lazy hints — transcriptSnippet field added to assembled course JSON, POST /api/hints route with Socratic Claude prompt and full input validation.

## What Was Built

### Task 1: transcriptSnippet in assembler.js (commit 46489a7)

Updated `mergeClaudeOutput` to accept a `transcripts` third parameter and attach a `transcriptSnippet` field to each video object. The snippet is the first 500 words of the raw transcript text for that video, falling back to `''` if no transcript exists.

Changes:
- `mergeClaudeOutput(claudeCourse, videos, transcripts)` — added `transcripts` parameter with JSDoc
- Inside `.map()`: extract first 500 words via `rawText.split(/\s+/).filter(Boolean).slice(0, 500).join(' ')`
- Add `transcriptSnippet: transcriptSnippet` to each returned video object
- Updated `assembleCourse` call site: `mergeClaudeOutput(claudeCourse, videos, transcripts)`

All 7 assembler tests pass.

### Task 2: POST /api/hints in server.js (commit 4ecd024)

Added the complete hint endpoint including:

1. **New requires** at top: `callClaude`, `parseClaudeJSON` from `./claude`; `Anthropic` SDK; top-level `anthropic` client instance
2. **`express.json()` middleware** after `express.static()` — enables `req.body` parsing for POST routes
3. **`generateHints` function** — builds Socratic prompt with video title, transcript excerpt, and 3 questions; explicitly instructs Claude NOT to state the answer (D-02 constraint); calls `anthropic.messages.create` with `claude-haiku-4-5-20251001`; validates response is array of exactly 3; caps `transcriptSnippet` to 2000 chars before sending to Claude
4. **`POST /api/hints` route** — validates `videoId` (string), `videoTitle` (string), `questions` (array of exactly 3); calls `callClaude(generateHints, ...)` with retry; returns `{ hints: [...] }` on success; catches errors and returns `{ error: 'Failed to generate hints. Please try again.' }` with 500

All 14 server.test.js tests pass. Full suite: 134/134 pass.

## Test Results

| File | Before | After | Status |
|------|--------|-------|--------|
| assembler.test.js | 7 pass | 7 pass | No regressions |
| server.test.js | 10 pass, 4 fail (RED) | 14 pass, 0 fail | GREEN |
| Full suite | 130 pass | 134 pass | All green |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — both fields are wired to real data:
- `transcriptSnippet` in assembler.js reads from the `transcripts` object already present at assembly time
- `POST /api/hints` calls real Claude via `callClaude` wrapper

## Threat Flags

None — all threat mitigations from the plan's STRIDE register are implemented:
- T-05-02-01: Input validation (400 for missing/invalid videoId, videoTitle, questions)
- T-05-02-02: transcriptSnippet truncated to 2000 chars server-side before Claude call
- T-05-02-03: express.json() default 100kb body limit applies; no limit raised
- T-05-02-05: Generic error message returned to client; raw error logged to console only

## Self-Check: PASSED

Files confirmed present:
- assembler.js — contains `function mergeClaudeOutput(claudeCourse, videos, transcripts)`, `transcriptSnippet`, `slice(0, 500).join(' ')`
- server.js — contains `app.use(express.json())`, `app.post('/api/hints',`, `generateHints`, `NOT state the answer`, `slice(0, 2000)`, all error messages

Commits confirmed in git log:
- 46489a7 — feat(05-02): add transcriptSnippet to mergeClaudeOutput in assembler.js
- 4ecd024 — feat(05-02): add POST /api/hints route to server.js

All tests: 134/134 pass.
