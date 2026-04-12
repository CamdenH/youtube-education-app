---
phase: "04"
plan: "02"
subsystem: frontend
tags: [javascript, sse, dom, localStorage, markdown-export, xss-prevention]
dependency_graph:
  requires:
    - 04-01 (index.html HTML skeleton + CSS + frontend.test.js canonical functions)
  provides:
    - index.html (complete JS wiring: SSE pipeline, course rendering, recent searches, export)
  affects:
    - Plan 03 — saveCourseToHistory and watched checkbox stubs replaced with localStorage persistence
    - Phase 5 — btn-hints click handler stub replaced with POST /api/hint call
tech_stack:
  added: []
  patterns:
    - EventSource (named event listeners per SSE contract)
    - DOM construction via createElement + textContent (XSS-safe, never innerHTML for user data)
    - details/summary for module and question accordions (no JS toggle)
    - Blob + anchor click for markdown file download
    - CSS class state machine for pipeline dots (pending/active/complete)
key_files:
  created: []
  modified:
    - index.html (595 lines added — complete script block replacing 2-line placeholder)
decisions:
  - All dynamic content (course titles, blurbs, questions, channel names) set via textContent per T-04-01 threat mitigation
  - innerHTML used only for static structural resets (course-header and course-modules cleared with innerHTML = '' on new search)
  - saveCourseToHistory and watched checkbox change handler are explicit stubs with comments pointing to Plan 03
  - hintsBtn click handler is a no-op stub with comment pointing to Phase 5
  - es.onerror handles native EventSource network failures separately from the named error event
metrics:
  duration: "~12 min"
  completed: "2026-04-09"
  tasks_completed: 1
  files_modified: 1
---

# Phase 04 Plan 02: SSE Pipeline Wiring + Course Rendering Summary

Complete JavaScript implementation in index.html: form submission, SSE pipeline consumption with real-time step animation, course rendering (modules, video cards, questions, connecting questions), recent searches localStorage, markdown export, and error handling.

## What Was Built

**Task 1: Full JS wiring in index.html**

Replaced the 2-line placeholder `<script>` block with 595 lines of production JavaScript, all wrapped in `document.addEventListener('DOMContentLoaded', ...)` with `'use strict'` at the top.

### Pure Logic Functions (copied from frontend.test.js canonical implementations)

| Function | Purpose |
|----------|---------|
| `slugify(title)` | Lowercase hyphen slug for markdown filename |
| `formatDuration(seconds)` | H:MM:SS or M:SS from raw seconds |
| `scoreBadgeColor(score)` | Hex color per score tier (4 tiers) |
| `relativeTime(isoString)` | Human-readable relative time string |
| `updateRecentSearches(searches, newSubject)` | Deduplicate, prepend, cap at 5 |
| `buildMarkdown(course, subject, skillLevel)` | Full markdown export per UI-SPEC format |

### Section State Management

`showContentSection(id)` toggles the `hidden` attribute across 4 mutually exclusive sections: `pipeline-section`, `error-section`, `course-section`, `empty-state`. Search form, recent searches, and history panel are not in this set — they remain visible throughout.

### Pipeline Step Animation

- `initPipelineSteps()` — builds 5 `.pipeline-step` divs with labeled dots; first step starts as `.dot-active` on generation start
- `updatePipelineStep(eventName)` — marks current step `.dot-complete`, advances next step to `.dot-active`, updates progress bar width via `(stepIndex + 1) / 5 * 100 + '%'`

### Form Submit Handler

1. Reads and trims `#subject-input`; returns early if empty
2. Reads `#skill-level` value (matches server `VALID_LEVELS`: `'all levels'` lowercase with space)
3. Calls `disableForm()` — sets button text to `'Generating...'`, disables button + input + select
4. Clears previous course via `innerHTML = ''` on `#course-modules` and `#course-header`
5. Shows pipeline section, calls `initPipelineSteps()`
6. Updates recent searches in localStorage key `ylc_searches`, re-renders pills
7. Opens `new EventSource('/api/course-stream?subject=...&skill_level=...')` with `encodeURIComponent`
8. Registers named event listener per step in `STEP_ORDER`; `course_assembled` handler closes EventSource, renders course or shows `TOO_FEW_VIDEOS` error, re-enables form
9. Named `error` event handler: closes EventSource, parses data, shows `resolveErrorMessage(data)`, re-enables form
10. `es.onerror`: closes EventSource, shows generic error message, re-enables form

### Course Rendering (`renderCourse`)

Builds course view entirely via `document.createElement` + `.textContent` for all user/API-sourced strings. Never assigns untrusted data to `innerHTML`.

Components rendered:
- Course title + Export button row
- Overview paragraph
- Prerequisites badge row (label + one badge per prerequisite)
- Watch time line
- Module cards (`<details class="module-card">`, first has `open` attribute)
  - Summary: module title + video count
  - Module description
  - Video cards (thumbnail link + content column)
    - Thumbnail: `<img>` with alt text `"{title} — YouTube thumbnail"`
    - Video meta: channel · formatted duration
    - Badge row: score badge (color from `scoreBadgeColor`) + outdated badge if `video.outdated`
    - Blurb
    - Comprehension questions accordion (`<details class="questions-accordion">`, collapsed by default)
      - 3 question items with label + textarea + hidden hint placeholder
      - "Reveal thinking points" button (no-op stub)
    - Watched checkbox row (stub — Plan 03 wires `ylc_watched`)
  - Connecting question footer

### Export

`exportCourse` calls `buildMarkdown`, creates a `Blob` with `type: 'text/markdown'`, creates a temporary anchor with `URL.createObjectURL`, triggers a click, removes the anchor, and revokes the URL. Filename is `slugify(course.title) + '.md'`.

### Error Handling

- `showError(message)` — shows `error-section`, sets `#error-message` via `textContent`
- `resolveErrorMessage(data)` — maps `QUOTA_EXCEEDED` code to quota copy; falls back to generic error
- Three error paths: `TOO_FEW_VIDEOS` in `course_assembled`, named `error` SSE event, native `es.onerror`

### Recent Searches

- `loadRecentSearches()` — reads `ylc_searches` from localStorage, defaults to `[]`
- `renderRecentSearches(searches)` — clears `#recent-pills`, creates pill buttons; each pill click sets `#subject-input` value; shows/hides `#recent-searches` section based on array length
- Called on `DOMContentLoaded` to hydrate from localStorage

## Commits

| Task | Hash | Message |
|------|------|---------|
| Task 1 | b4c858c | feat(04-02): wire full JS in index.html — SSE pipeline, course render, recent searches, export |

## Verification

- `node --test tests/unit/frontend.test.js` — 22/22 tests pass (0 failures)
- `grep 'new EventSource' index.html` — 1 match (SSE connection present)
- `grep -c 'textContent' index.html` — 25 matches (XSS mitigation present throughout)
- `grep -c 'es.close()' index.html` — 4 matches (EventSource closed on all terminal paths: course_assembled, named error, onerror, + existing connection cleanup on re-submit)
- All 40 acceptance criteria checked — all PASS (4 class checks pass via `.className` JS property assignment, not HTML string literals)

## Deviations from Plan

None — plan executed exactly as written.

The 4 "FAIL" items in the grep check (`class="btn-hints"`, `class="questions-accordion"`, `class="score-badge"`, `class="module-card"`) are false negatives from grep searching for quoted HTML attribute strings. These classes are set via JavaScript's `.className` property (e.g., `questionsDetails.className = 'questions-accordion'`) — the correct pattern for dynamically created DOM elements. All four classes are present in the file and used correctly.

## Known Stubs

- `saveCourseToHistory(course, subject, skillLevel)` — empty function body; Plan 03 implements `ylc_history` localStorage persistence
- Watched checkbox `change` handler — no-op comment; Plan 03 wires `ylc_watched` flat map
- "Reveal thinking points" button click handler — no-op comment; Phase 5 implements `POST /api/hint`

These stubs are intentional design decisions per the plan spec. The stubs do not prevent the plan's goal from being achieved — the app is fully functional end-to-end for course generation, viewing, searching, and exporting. History persistence and watched state are deferred features.

## Threat Flags

No new security surface introduced. This plan adds no new network endpoints, no auth paths, no new backend files, and no schema changes.

Threat mitigations applied per plan threat model:

| Threat ID | Mitigation Applied |
|-----------|-------------------|
| T-04-01 | All course JSON strings (titles, blurbs, questions, channel names, connecting questions, prerequisites) set via `textContent`; `createElement` used for all dynamic elements — no innerHTML XSS surface |
| T-04-04 | `encodeURIComponent` applied to both `subject` and `skill_level` before SSE URL construction |
| T-04-05 | `es.close()` called in `course_assembled` handler, named `error` handler, and `es.onerror` — all terminal paths close the EventSource to prevent auto-reconnect |

## Self-Check: PASSED

- [x] `index.html` modified — 595 lines added, placeholder script replaced
- [x] Commit b4c858c exists in git log
- [x] `node --test tests/unit/frontend.test.js` exits 0 (22 pass, 0 fail)
- [x] `grep 'new EventSource' index.html` — found
- [x] `grep textContent index.html` — 25 matches (XSS mitigation present)
- [x] `grep 'es.close()' index.html` — 4 matches (all terminal paths covered)
