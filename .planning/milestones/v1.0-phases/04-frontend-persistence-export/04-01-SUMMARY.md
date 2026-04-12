---
phase: "04"
plan: "01"
subsystem: frontend
tags: [html, css, unit-tests, dark-mode, responsive]
dependency_graph:
  requires: []
  provides:
    - tests/unit/frontend.test.js (canonical pure logic functions for Plans 02/03)
    - index.html (complete HTML skeleton + all CSS for Phase 4)
  affects:
    - Plans 02 and 03 — copy function implementations from frontend.test.js into index.html script block
tech_stack:
  added: []
  patterns:
    - Node built-in test runner (node:test + node:assert/strict)
    - Vanilla CSS custom properties (all from existing :root block)
    - HTML details/summary for accordion pattern
    - CSS keyframe animation for pipeline dot pulse
key_files:
  created:
    - tests/unit/frontend.test.js
  modified:
    - index.html
decisions:
  - saveWithEviction accepts injectable storage param for testability without a real localStorage in Node
  - buildMarkdown excludes score values per UI-SPEC (internal curation signal, not learner-facing)
  - relativeTime uses floor-based thresholds matching the research code example
  - CSS @media(min-width: 481px) makes search form row layout on wider viewports; column on mobile
metrics:
  duration: "~8 min"
  completed: "2026-04-09"
  tasks_completed: 2
  files_modified: 2
---

# Phase 04 Plan 01: HTML Skeleton + Unit Test Stubs Summary

Complete HTML structure and all CSS for Phase 4, plus canonical pure logic function implementations with 22 passing unit tests.

## What Was Built

**Task 1: frontend.test.js — Wave 0 unit tests**

Created `tests/unit/frontend.test.js` defining 7 canonical pure logic functions and testing them with 22 passing tests (all green, 0 failures):

| Function | Purpose | Tests |
|----------|---------|-------|
| `slugify(title)` | Lowercase, hyphen-separated filename slug | 3 |
| `formatDuration(seconds)` | H:MM:SS or M:SS from raw seconds | 3 |
| `scoreBadgeColor(score)` | Hex color per score tier (4 tiers) | 4 |
| `relativeTime(isoString)` | "2 hours ago" / "3 days ago" / "just now" | 3 |
| `buildMarkdown(course, subject, skillLevel)` | Markdown export per UI-SPEC format | 4 |
| `updateRecentSearches(searches, newSubject)` | Deduplicate, prepend, cap at 5 | 3 |
| `saveWithEviction(key, entries, maxRetries, storage)` | localStorage write with evict-oldest retry | 2 |

All functions exported via `module.exports`. Plans 02/03 copy the implementations verbatim into index.html's `<script>` block.

**Task 2: index.html rewrite — complete HTML + CSS**

Full rewrite from the 271-line Phase 1 SSE stub to a 600-line production skeleton:

- `:root` CSS custom properties block preserved verbatim (colors, spacing, typography)
- 8 HTML sections with correct `hidden` attributes per the plan spec
- Search form: subject input (`maxlength="200"`), skill level select (default `value="all levels"`), generate button
- All CSS from the UI-SPEC: dark mode, responsive at 375px (column) and 481px+ (row), module cards, video cards, score badges, outdated badges, questions accordion, pipeline step dots with `@keyframes pulse`, history items, pills, export button, watched checkbox row, connecting question footer
- `<script>` block contains only `'use strict'` and a placeholder comment — no JS behavior yet

## Commits

| Task | Hash | Message |
|------|------|---------|
| Task 1 | 22f74af | feat(04-01): add frontend.test.js with 7 pure logic functions and 22 passing tests |
| Task 2 | 7bd662c | feat(04-01): rewrite index.html with complete HTML skeleton and all CSS |

## Verification

- `node --test tests/unit/frontend.test.js` — 22/22 tests pass
- `grep -c 'id="search-form"...'` — 10/10 required IDs present
- All 29 acceptance criteria checked programmatically — ALL PASSED

## Deviations from Plan

None — plan executed exactly as written.

The `saveWithEviction` function signature was extended with an injectable `storage` parameter (defaulting to `localStorage`) to make it testable in Node without a real browser environment. This is a testability concern, not an architectural deviation, and the inline index.html version will default to the real `localStorage`.

## Known Stubs

- `index.html` `<script>` block contains only `'use strict'` + a placeholder comment. JS wiring is intentionally deferred to Plans 02 and 03 — this is by design, not a gap.

## Threat Flags

No new security surface introduced. This plan adds no network endpoints, no auth paths, and no new schema. The threat model items T-04-01 and T-04-02 (XSS via textContent vs innerHTML) are enforced in Plans 02 and 03 where JS rendering is wired.

## Self-Check: PASSED

- [x] `tests/unit/frontend.test.js` exists and contains all 7 functions
- [x] `index.html` contains all 8 sections and all required CSS classes
- [x] Commits 22f74af and 7bd662c exist in git log
- [x] `node --test tests/unit/frontend.test.js` exits 0 (22 pass, 0 fail)
