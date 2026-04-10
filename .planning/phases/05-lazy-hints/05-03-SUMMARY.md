---
phase: 05-lazy-hints
plan: "03"
subsystem: frontend
tags: [hints, localStorage, fetch, DOM, UX]
dependency_graph:
  requires: [05-01, 05-02]
  provides: [fetchHints, persistHints, loadHints, renderHints, ylc_hints-integration]
  affects: [index.html]
tech_stack:
  added: []
  patterns: [fetch-POST-pattern, localStorage-flat-map, inline-error-retry-UX, reload-restore-pattern]
key_files:
  created: []
  modified:
    - index.html
decisions:
  - "fetchHints uses btn/container parameter names (not hintsBtn) matching the async function signature; renderCourse uses hintsBtn variable name — both correctly hide the button"
  - "transcriptSnippet truncated client-side to first 500 words before POST — matches server-side cap, no extra data sent"
  - "renderHints uses document.createTextNode for hint text — no XSS risk (T-05-03-02 mitigated)"
  - "Button disabled immediately on click, re-enabled only on failure — prevents concurrent requests (T-05-03-04 mitigated)"
metrics:
  duration: "~5 minutes"
  completed: "2026-04-10T21:00:00Z"
  tasks_completed: 1
  files_modified: 1
status: pending-human-verify
---

# Phase 05 Plan 03: Frontend Hint Wiring Summary

**One-liner:** Complete frontend hint interaction — fetchHints() wired to button click, per-video loading/error/retry states, ylc_hints localStorage persistence and reload restore.

## What Was Built

### Task 1: CSS + helper functions + fetchHints click handler (commit 53cb4d9)

Three changes to `index.html`:

**CSS additions** (after `.btn-hints:focus`):
- `.hint-error` — destructive color, label-size font for inline error message
- `.btn-retry-hint` — same accent-border style as `.btn-hints` but smaller padding; hover + focus states

**Helper functions added** (before Course Rendering section):
- `persistHints(videoId, hints)` — writes to `ylc_hints` flat map in localStorage; try/catch best-effort
- `loadHints(videoId)` — reads from `ylc_hints`; returns null on miss or parse error
- `renderHints(videoId, hints, questionsContainer)` — queries `.hint-text[data-video-id]` elements, writes `<span class="hint-label">Thinking point: </span>` + text node into each, unhides them
- `showHintError(container, retryFn)` — appends `.hint-error` paragraph with "Could not load hints." and a `.btn-retry-hint` "Try again" button that re-fires retryFn
- `clearHintError(container)` — removes any `[data-hint-error]` element from container
- `fetchHints(video, btn, container)` — async: sets loading state, POSTs to `/api/hints`, renders + persists on success, shows error + re-enables button on failure

**renderCourse changes** (no-op stub replaced):
- Checks `loadHints(video.videoId)` at render time; if stored hints exist, calls `renderHints` immediately and sets `hintsBtn.hidden = true`
- Otherwise wires `click` listener calling `fetchHints(video, hintsBtn, questionsDetails)`

## Test Results

| File | Before | After | Status |
|------|--------|-------|--------|
| frontend.test.js | 28 pass | 28 pass | No regressions |
| Full suite | 134 pass | 134 pass | All green |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all data paths are wired:
- `fetchHints` sends real POST to `/api/hints` (implemented in Plan 02)
- `persistHints`/`loadHints` use real `localStorage`
- `renderHints` writes to real `.hint-text` DOM elements created in the questions loop

## Threat Flags

None — all STRIDE mitigations from the plan's threat register are implemented:
- T-05-03-01: Input sourced from server-assembled course JSON, not user-editable fields
- T-05-03-02: `document.createTextNode` used for hint text — no innerHTML injection risk
- T-05-03-03: localStorage is per-origin, client-only — accepted risk
- T-05-03-04: Button disabled immediately on click, stays disabled until success (hidden) or failure (re-enabled)

## Human Verify Checkpoint — PENDING

**Status:** Awaiting human verification of end-to-end browser behavior.

### What to verify

Run `node server.js` and open http://localhost:3000. Then:

1. Generate a course on any topic (e.g. "neural networks / beginner")
2. Wait for course to fully render
3. Expand the questions accordion on any video
4. Confirm "Reveal thinking points" button is visible
5. Click "Reveal thinking points"
   - Expected: Button text changes to "Loading hints..." and button is disabled — ONLY on the clicked video
   - Expected: After Claude responds (~2-5 seconds), all 3 hints appear below each question, each prefixed "Thinking point:"
   - Expected: The "Reveal thinking points" button disappears after hints load
   - Expected: Another video's questions accordion is unaffected (button still shows, no loading state)
6. Reload the page; click History to restore the same course
   - Expected: The video that had hints rendered should show hints immediately (no button visible) — restored from ylc_hints
   - Expected: Other videos that had no hints still show the "Reveal thinking points" button
7. Test error path: disconnect from the internet (or temporarily stop the server and restart to simulate), click "Reveal thinking points" on a different video
   - Expected: After timeout/failure, button re-enables with "Reveal thinking points" text, and "Could not load hints. Try again" appears inline below the button
   - Expected: Clicking "Try again" re-fires the hint fetch

Hint content quality check: Read 2-3 hints. Each should be a guiding question or reframe that points toward the answer — NOT a statement of the answer itself.

**Resume signal:** Type "approved" if all behaviors above work correctly, or describe any issues observed.

## Self-Check: PASSED

Files confirmed present:
- index.html contains all required strings: `.hint-error {`, `.btn-retry-hint {`, `const HINTS_KEY = 'ylc_hints'`, `function persistHints(`, `function loadHints(`, `function renderHints(`, `function showHintError(`, `function clearHintError(`, `async function fetchHints(`, `fetch('/api/hints',`, `method: 'POST'`, `'Loading hints...'`, `'Reveal thinking points'`, `'Thinking point: '`, `'Could not load hints. '`, `'Try again'`, `loadHints(video.videoId)`, `hintsBtn.hidden = true`
- index.html does NOT contain `/* Phase 5: POST /api/hint */` (stub replaced)
- Commit 53cb4d9 verified in git log

All tests: 134/134 pass.
