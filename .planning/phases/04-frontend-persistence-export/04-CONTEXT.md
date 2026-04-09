# Phase 4: Frontend + Persistence + Export - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Full rewrite of `index.html` from the Phase 1 SSE test stub into the complete, usable UI. Delivers: subject + skill level search form, real-time SSE-driven pipeline loading animation, course rendering (modules, video cards, comprehension questions accordions, watched checkboxes), course history via localStorage, per-video watched state, and markdown export download. No hint generation (Phase 5). No backend changes.

**Requirements in scope:** FRNT-01, FRNT-02, FRNT-03, FRNT-04, FRNT-05, FRNT-06, FRNT-07, FRNT-08, FRNT-09, FRNT-10, PERS-01, PERS-02, PERS-03, EXPO-01

</domain>

<decisions>
## Implementation Decisions

### Watched State Scope (PERS-02)

- **D-01:** Watched state is **global by videoId** — a flat map `{ [videoId]: true }` stored in a single localStorage key. If the same video appears in multiple saved courses, checking it once marks it watched everywhere. Simple schema, predictable behavior.

### Generation Flow Transitions (FRNT-01, FRNT-02)

- **D-02:** The **search form stays visible** during pipeline generation. The "Generate course" button changes to "Generating..." (disabled). Pipeline loading section appears below the form when generation starts.
- **D-03:** When `course_assembled` fires and the course renders, the **pipeline loading section is removed from the DOM**. Course view takes its place cleanly — no stale progress steps cluttering the page.
- **D-04:** If a course is already displayed and the user submits a new search, the **old course clears immediately** when the user clicks "Generate course". Pipeline loading takes its place. No confirmation dialog — generating a new course is the obvious intent.

### Error State Placement (FRNT-02 error path)

- **D-05:** Pipeline errors (quota exceeded, too few videos, general failure) **replace the pipeline section** in place. The same area where pipeline steps were showing switches to the error message text. The form re-enables so the user can retry. Error copy from the UI-SPEC copywriting contract applies verbatim.

### localStorage Schema (PERS-01, PERS-02, PERS-03)

- **D-06:** Each course history entry stores the **full course JSON plus metadata**: subject, skillLevel, generatedAt (ISO timestamp), and the complete course object. No regeneration needed on restore. At ~50KB per entry × 10 max entries ≈ 500KB total — well within localStorage limits.
- **D-07:** PERS-03 eviction strategy: when localStorage quota is exceeded on write, **evict the oldest entry by generatedAt timestamp** (earliest date removed first), then retry the write. This is the most predictable behavior for the user.
- **D-08:** localStorage key names and object structure are **Claude's discretion** — planner/executor should choose sensible, namespaced keys (e.g. `ylc_history`, `ylc_watched`, `ylc_recent_searches`) and document them inline. No specific key names are locked.

### Claude's Discretion

- Exact localStorage key names and array/object structure (D-08)
- How the search form's skill level selector renders (dropdown vs radio buttons — UI-SPEC doesn't specify the input type, only the label and options: beginner/intermediate/advanced/all levels)
- Score badge tier color logic (the UI-SPEC references tiers but Claude implements the threshold values: e.g. 80+ = green, 60–79 = blue, below 60 = muted)
- Exact CSS class naming and JS function structure for the rewritten index.html
- Reveal thinking points button (FRNT-08): Phase 4 renders the button and loading state wiring but the click handler is a **no-op stub** — Phase 5 wires the actual API call

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — Phase 4 requirements: FRNT-01–10, PERS-01–03, EXPO-01. Traceability table confirms scope.
- `.planning/PROJECT.md` — Stack constraints (Node.js + Express, vanilla JS, no frontend framework, no build step, no npm frontend deps), API key handling, key architectural decisions

### UI Design Contract
- `.planning/phases/04-frontend-persistence-export/04-UI-SPEC.md` — **Primary visual reference.** Approved. Covers: design system, spacing scale, typography, color palette, every component's visual design, copywriting contract, markdown export format, accessibility minimums, layout structure. Downstream agents should treat this as the visual ground truth for Phase 4.

### Phase 4 Success Criteria
- `.planning/ROADMAP.md` §Phase 4 — 6 success criteria that define "done" for this phase

### Prior Phase Context
- `.planning/phases/01-foundation/01-CONTEXT.md` — SSE event contract (5 named events, payloads), dev cache design, flat file structure
- `.planning/phases/03-transcript-course-assembly/03-CONTEXT.md` — Course JSON contract (locked shape the frontend renders against), `course_assembled` payload structure, TOO_FEW_VIDEOS error shape

No external ADRs or design docs beyond the files listed above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `index.html` — 271-line Phase 1 stub. CSS custom properties (colors, spacing, typography) already declared in `:root` and match the UI-SPEC exactly. SSE event handling pattern reusable. Progress bar DOM and CSS reusable. **The entire `<style>` block is a valid starting point** — Phase 4 adds to it, not replaces it from scratch.
- `sse.js` → `courseStreamHandler` — already emits all 5 named SSE events with correct payload shapes. Frontend listens for these exact event names.

### Established Patterns
- Vanilla JS, no modules, no build step — all JS lives inline in `<script>` at bottom of `index.html`
- `'use strict'` at top of every JS file (apply inside the inline `<script>` block too)
- SSE event handling pattern from Phase 1 stub: `eventSource.addEventListener(eventName, handler)` per named event

### Integration Points
- `GET /api/course-stream?subject=...&level=...` — SSE endpoint; frontend adds subject + level as query params
- `POST /api/hint` — Phase 5 endpoint; Phase 4 renders the button as a no-op stub only
- Course JSON shape from `course_assembled` event is the locked contract from Phase 3 CONTEXT.md

</code_context>

<specifics>
## Specific Ideas

- The search form sends subject + skill level as query params on the SSE URL: `/api/course-stream?subject=encodeURIComponent(subject)&level=level`
- Recent searches (FRNT-03) update when the user clicks "Generate course" — not on every keystroke, not on successful completion only; update at submit time so even a failed search is remembered
- The markdown export filename is derived from the course title: lowercase, spaces replaced by hyphens, non-alphanumeric stripped, e.g. `intro-to-machine-learning.md`
- Score badge tiers referenced in UI-SPEC: Claude's discretion on exact thresholds but the pattern is color-coded numeric badge on each video card

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 04-frontend-persistence-export*
*Context gathered: 2026-04-09*
