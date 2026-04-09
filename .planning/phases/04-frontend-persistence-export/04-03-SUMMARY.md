---
phase: "04"
plan: "03"
subsystem: frontend
tags: [javascript, localStorage, persistence, history, watched-state, xss-prevention]
dependency_graph:
  requires:
    - 04-01 (index.html HTML skeleton + CSS + frontend.test.js canonical functions)
    - 04-02 (index.html full JS wiring — SSE pipeline, course rendering, stubs for Plan 03)
  provides:
    - index.html (complete localStorage persistence: ylc_history, ylc_watched, eviction)
  affects:
    - Phase 5 — hint wiring builds on top of the stable course data structure now persisted
tech_stack:
  added: []
  patterns:
    - localStorage read/write with QuotaExceededError + NS_ERROR_DOM_QUOTA_REACHED eviction
    - Global watched state by videoId (flat map, not per-course)
    - History restore via full JSON round-trip (no regeneration)
    - textContent for all localStorage-sourced strings (XSS mitigation, T-04-02)
key_files:
  created: []
  modified:
    - index.html (123 lines added — replaced stubs with full localStorage persistence)
decisions:
  - currentSubject/currentSkillLevel declared in DOMContentLoaded closure so restoreCourse can set them for export context
  - renderHistory sets history-empty hidden=true explicitly when entries exist (prevents ghost empty message)
  - Watched checkbox reads ylc_watched fresh from localStorage at render time per Pitfall 4 prevention (D-01)
  - saveHistory uses inline try/catch per plan spec (not saveWithEviction from test file — no injectable storage needed in browser)
metrics:
  duration: "~8 min"
  completed: "2026-04-09"
  tasks_completed: 1
  files_modified: 1
---

# Phase 04 Plan 03: localStorage Persistence — History, Watched State, Eviction Summary

Full localStorage persistence wired into index.html: course history saved on generation (last 10, newest first), watched checkboxes global by videoId, quota overflow eviction, history panel with titles/skill badges/relative timestamps, and course restore on history item click.

## What Was Built

**Task 1: localStorage persistence — history, watched state, eviction**

Replaced two stubs from Plan 02 and added five new functions in the `<script>` block:

| Function | Purpose |
|----------|---------|
| `loadHistory()` | Read `ylc_history` from localStorage; default to `[]`; try/catch for corrupt data |
| `saveHistory(entries)` | Write to `ylc_history`; catch `QuotaExceededError`/`NS_ERROR_DOM_QUOTA_REACHED`; evict oldest by `generatedAt`, retry once; silent fail on second failure |
| `renderHistory(history)` | Show/hide `#history-panel`; build history items with `textContent` for title, skill-badge, and relativeTime metadata |
| `restoreCourse(index)` | Read entry from `ylc_history`, call `renderCourse`, set `currentSubject`/`currentSkillLevel`, mark `.active` on clicked item, scroll course into view |
| `saveCourseToHistory(course, subject, skillLevel)` | Build entry with full course JSON + metadata, unshift to history, cap at 10, save, re-render history panel |

**Watched state wiring:**

The watched checkbox stub in `renderCourse` was replaced with:
1. Read `ylc_watched` at render time: `checkbox.checked = !!watched[video.videoId]`
2. `change` handler writes/deletes `video.videoId` from `ylc_watched` flat map

Per D-01: same video appearing in multiple courses reflects the same watched state everywhere.

**Export context tracking:**

Added `let currentSubject = ''; let currentSkillLevel = '';` in the DOMContentLoaded closure. Set in the form submit handler on generate, and set in `restoreCourse` from the history entry — ensures the export button has correct context regardless of how the course was loaded.

**DOMContentLoaded initialization:**

Added `loadHistory()` + `renderHistory(initialHistory)` after the existing `renderRecentSearches` call.

## Commits

| Task | Hash | Message |
|------|------|---------|
| Task 1 | 1089507 | feat(04-03): wire localStorage persistence — history, watched state, eviction |

## Verification

- `node --test tests/unit/frontend.test.js` — 22/22 tests pass (0 failures)
- `grep 'ylc_history' index.html` — 3 matches
- `grep 'ylc_watched' index.html` — 4 matches
- `grep 'QuotaExceededError' index.html` — 1 match (eviction present)
- `grep 'textContent' index.html` — 28 matches (XSS mitigation throughout, including all history rendering)

## Deviations from Plan

None — plan executed exactly as written.

The `saveHistory` function uses inline try/catch (as specified in the plan's code sample) rather than the `saveWithEviction` generic function from `frontend.test.js`. This is correct — `saveWithEviction` has an injectable `storage` parameter for testability in Node, but the browser inline version doesn't need that abstraction. The eviction logic (sort by generatedAt, shift oldest, retry once) is identical.

## Known Stubs

- "Reveal thinking points" button click handler — no-op comment; Phase 5 implements `POST /api/hint`

This stub does not prevent Plan 03's goal from being achieved. History persistence, watched state, and course restore all work as specified.

## Threat Flags

No new security surface introduced.

Threat mitigations applied per plan threat model:

| Threat ID | Mitigation Applied |
|-----------|-------------------|
| T-04-02 | All localStorage-sourced strings (course titles, subjects, skill levels, history titles) rendered via `textContent` in `renderHistory` and passed through existing `renderCourse` — no innerHTML XSS surface |
| T-04-07 | `saveHistory` catches `QuotaExceededError` and `NS_ERROR_DOM_QUOTA_REACHED`, evicts oldest entry by `generatedAt` ascending, retries once; second failure silently fails |

## Self-Check: PASSED

- [x] `index.html` modified — 123 lines added, stubs replaced
- [x] Commit 1089507 exists in git log
- [x] `node --test tests/unit/frontend.test.js` exits 0 (22 pass, 0 fail)
- [x] `grep 'ylc_history' index.html` — 3 matches found
- [x] `grep 'ylc_watched' index.html` — 4 matches found
- [x] `grep 'QuotaExceededError' index.html` — 1 match found
- [x] `grep 'textContent' index.html` — 28 matches (XSS mitigation present throughout)
- [x] `function loadHistory(` present
- [x] `function saveHistory(` present
- [x] `function renderHistory(` present
- [x] `function restoreCourse(` present
- [x] `function saveCourseToHistory(` present (full implementation, not stub)
- [x] `checkbox.checked` present (watched state read at render time)
- [x] `currentSubject` present (export context tracking)
- [x] `scrollIntoView` present (history restore scroll behavior)
- [x] `NS_ERROR_DOM_QUOTA_REACHED` present (Firefox quota error name)
- [x] `generatedAt` present (history entry metadata)
- [x] `.sort(` present (eviction sort by generatedAt)
- [x] `.shift()` present (evict oldest entry)
- [x] `history.slice(0, 10)` present (10-entry cap)
