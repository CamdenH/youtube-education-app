# Phase 5: Lazy Hints — Context

**Gathered:** 2026-04-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire the "Reveal thinking points" button stub left by Phase 4 into a real `POST /api/hints` endpoint. When a user clicks the button for a video, the server makes one Claude call returning all 3 Socratic hints for that video's questions. The frontend shows a per-video loading state, renders hints on success, and shows an inline error + retry on failure. Fetched hints are persisted in localStorage alongside the course so they survive page reloads. No changes to course generation pipeline.

**Requirements in scope:** HINT-01, HINT-02, HINT-03

</domain>

<decisions>
## Implementation Decisions

### Hint Persistence (HINT-01)

- **D-01:** Hints are **persisted in localStorage alongside the course** — stored as part of the saved course entry (or as a parallel map keyed by videoId). No re-fetch on reload, zero extra API cost on revisit. Exact schema is Claude's discretion but must be consistent with the existing `ylc_history`/`ylc_watched` localStorage structure from Phase 4.

### Hint Content Format (HINT-02)

- **D-02:** Each hint is a **Socratic nudge** — a guiding question or reframe that points the user toward the answer without giving it away. Example tone: *"Think about what happens when X increases — what does the formula predict?"*. Hints must NOT state the answer or give away the conclusion. The Claude prompt must explicitly instruct this constraint.

### Error UX (HINT-01 error path)

- **D-03:** If the hint fetch fails, the loading state clears and **an inline error message appears where hints would be, with a "Try again" button**. The user stays in control — clicking "Try again" re-fires the same `POST /api/hints` call. The error and retry button are scoped to that video's questions section only — no other video's state is affected.

### API Input Shape (HINT-01 server contract)

- **D-04:** `POST /api/hints` receives a JSON body with: `videoId`, `videoTitle`, `questions` (array of 3 question strings), and `transcriptSnippet` (the first ~500 words of the transcript, or the description fallback if no transcript). Claude has full context to generate grounded, video-specific Socratic nudges without any server-side re-fetching.

### Claude's Discretion

- Exact localStorage schema for stored hints (must be consistent with Phase 4 schema)
- Exact character/word length of each Socratic hint (aim for 1-2 sentences)
- How `transcriptSnippet` is truncated (first N words or first N characters of the stored transcript)
- Button copy for the retry action ("Try again" or similar)
- Whether hints are stored under the course entry or in a separate `ylc_hints` key

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — HINT-01, HINT-02, HINT-03
- `.planning/PROJECT.md` — Stack constraints, API key handling

### Prior Phase Context
- `.planning/phases/04-frontend-persistence-export/04-CONTEXT.md` — localStorage schema (D-06, D-08), button stub location (FRNT-08 note), course JSON shape the frontend uses
- `.planning/phases/03-transcript-course-assembly/03-CONTEXT.md` — Course JSON contract, question structure (3 questions per video: recall/conceptual/application)

### Phase 5 Success Criteria
- `.planning/ROADMAP.md` §Phase 5 — 3 success criteria that define "done"

No external ADRs or design docs beyond the files listed above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Integration Points
- `server.js` — add `POST /api/hints` route alongside existing `GET /api/course-stream` and `GET /api/transcript/:videoId`
- `index.html` — Phase 4 left a "Reveal thinking points" button stub with a no-op click handler (FRNT-08). Phase 5 replaces the no-op with the real fetch call.
- `claude.js` — `callClaude` retry wrapper is reusable for the hints Claude call (same pattern as scorer.js and assembler.js)

### Established Patterns
- All AI calls go through `callClaude` in `claude.js` with exponential backoff retry
- `'use strict'` at top of every JS file
- `module.exports` only — no ESM
- Error mapping: catch errors in the route handler in `server.js`, return structured JSON error; frontend maps to inline UI state

</code_context>

<specifics>
## Specific Implementation Notes

- The hint fetch fires on button click — not on accordion open. The accordion must be expanded first (Phase 4 UX), but the API call fires when the user explicitly clicks "Reveal thinking points".
- Each video's hints state is independent — fetching/failing for one video has no effect on others.
- `transcriptSnippet` sent to Claude should be the same transcript data already fetched during course generation (available from the saved course JSON or re-truncated client-side). No new transcript API calls needed.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 05-lazy-hints*
*Context gathered: 2026-04-10*
