# Phase 3: Transcript + Course Assembly - Context

**Gathered:** 2026-04-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Fetch transcripts for the top 12 scored videos, send them to Claude in a single call, and assemble a structured course JSON (modules, per-video blurbs, comprehension questions, outdated flags, overview, watch time, prerequisites). Wire steps 4 and 5 in `sse.js` to replace the Phase 2 stubs. No frontend, no hints, no persistence.

**Requirements in scope:** TRAN-01, TRAN-02, TRAN-03, CURA-01, CURA-02, CURA-03, CURA-04, CURA-05, CURA-06, CURA-07, QUES-01, QUES-02, QUES-03

</domain>

<decisions>
## Implementation Decisions

### Course Assembly Strategy (CURA-01)

- **D-01:** **Single Claude call** — all 12 transcripts + full assembly instructions sent in one prompt. Claude returns the complete course JSON in one response: modules, video assignments, blurbs, questions, outdated flags, overview, watch time, prerequisites. No multi-call pipeline.
- **D-02:** New file `assembler.js` at project root — houses the assembly prompt builder and the `assembleCourse(videos, transcripts, subject, skillLevel)` function. Keeps `sse.js` thin.

### Course JSON Contract

The `course_assembled` SSE event payload carries `{ course: <CourseObject> }` where `CourseObject` is:

```json
{
  "title": "Subject name",
  "overview": "3-4 sentence overview of the course",
  "totalWatchTime": "4h 20m",
  "prerequisites": ["prerequisite 1", "prerequisite 2"],
  "modules": [
    {
      "title": "Module title",
      "description": "2-3 sentence module description",
      "connectingQuestion": "Question tying module videos together",
      "videos": [
        {
          "videoId": "abc123",
          "title": "Video title from YouTube",
          "channelTitle": "Channel name",
          "thumbnail": "https://i.ytimg.com/vi/abc123/mqdefault.jpg",
          "url": "https://www.youtube.com/watch?v=abc123",
          "durationSeconds": 1800,
          "score": 87,
          "blurb": "1-2 sentence why-this-video rationale",
          "outdated": false,
          "questions": [
            { "type": "recall",      "text": "..." },
            { "type": "conceptual", "text": "..." },
            { "type": "application","text": "..." }
          ]
        }
      ]
    }
  ]
}
```

Fields `videoId`, `title`, `channelTitle`, `thumbnail`, `url`, `durationSeconds`, and `score` come from the scored video object (not from Claude) — assembler merges them. Claude provides: module grouping, `blurb`, `outdated`, `questions`, `connectingQuestion`, module `title`/`description`, course `title`, `overview`, `totalWatchTime`, `prerequisites`.

### "Too Few Videos" Gate (CURA-02)

- **D-03:** When fewer than 5 videos survive Claude curation, emit `course_assembled` as the terminal event with an error shape (no `course` object):
  ```json
  {
    "step": 5,
    "total": 5,
    "error": "TOO_FEW_VIDEOS",
    "message": "Only N videos passed quality review. Try a broader or different search term."
  }
  ```
  Frontend handles it the same as a successful `course_assembled` (terminal event closes `EventSource`) but renders the message instead of a course. No new SSE event type needed.

### Outdated Flag Detection (CURA-06)

- **D-04:** **Pure Claude judgment** — Claude reads transcript/description content and flags a video as `outdated: true` if it finds concrete evidence of staleness (deprecated APIs, old version numbers, superseded tools, explicit "as of [old year]" references). No hardcoded age thresholds. Claude naturally catches "this uses Python 2" or "as of 2018" language in the transcript. Evergreen content (math, physics, conceptual explanations) won't be flagged.

### Transcript Fetching Strategy (TRAN-01, TRAN-02, TRAN-03)

- **D-05:** `fetchTranscript(videoId)` already built in `transcript.js` with captions → description fallback. Phase 3 calls it for all top 12 in parallel (`Promise.all`). No new transcript logic needed.
- **D-06:** Videos where `fetchTranscript` returns `null` (no transcript or description) are excluded before the Claude call (TRAN-03). The assembler receives only videos with usable content.
- **D-07:** Transcripts are passed to Claude untruncated. Token budget is acceptable for 12 videos; if a future quota issue arises, truncation can be added then.

### SSE Pipeline Wiring

- **D-08:** `sse.js` step 4 (`transcripts_fetched`) fires after parallel transcript fetch completes, reporting how many transcripts were retrieved vs. skipped.
- **D-09:** `sse.js` step 5 (`course_assembled`) fires after `assembleCourse` resolves, carrying the full course JSON (or the `TOO_FEW_VIDEOS` error shape).
- **D-10:** `assembler.js` is the only new file. `sse.js` imports and calls it. No other file reorganization.

### Claude's Discretion

- Exact assembly prompt wording and structure
- How Claude calculates and formats `totalWatchTime` (can sum `durationSeconds` from the scored video objects, or estimate from transcript length)
- Exact module count (CURA-03 says 3–4; Claude decides based on content)
- Whether to use a system prompt + user message or a single user message for the assembly call
- Description-fallback question quality caveat language (QUES-02 says these are "acceptable but noted as lower quality" — Claude's discretion on how to note it, or whether to note it at all in the question text)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — Phase 3 requirements: TRAN-01–03, CURA-01–07, QUES-01–03. Traceability table confirms scope.
- `.planning/PROJECT.md` — Stack constraints, API key handling, key architectural decisions

### Phase 3 Success Criteria
- `.planning/ROADMAP.md` §Phase 3 — 5 success criteria that define "done" for this phase

### Prior Phase Context
- `.planning/phases/01-foundation/01-CONTEXT.md` — SSE event contract, dev cache design, flat file structure
- `.planning/phases/02-scoring-query-generation/02-CONTEXT.md` — `scoreVideos` output shape, `callClaude`/`parseClaudeJSON` usage pattern

No external ADRs or design docs — all requirements fully captured in decisions above and REQUIREMENTS.md.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `transcript.js` — `fetchTranscript(videoId)` returns `{ source: 'captions'|'description', text }` or `null`. Cache-first, already handles both fallback paths. Ready to use as-is.
- `claude.js` — `callClaude(fn, ...args)` and `parseClaudeJSON(text)` — same pattern used in `scorer.js` and `queries.js`
- `cache.js` — `cacheGet` / `cacheSet` available if transcript caching of assembly result is desired (Claude's discretion)
- `sse.js` — Steps 4 and 5 are stubs; Phase 3 replaces them with real pipeline calls. `courseStreamHandler` already has `scoredVideos` in scope from step 3.

### Established Patterns
- Flat file at root — `assembler.js` lives alongside `scorer.js`, `queries.js`
- `'use strict'` + CommonJS `module.exports`
- New Anthropic client instantiated at module top: `const anthropic = new Anthropic()`
- Prompt builder as a private named function (e.g., `buildAssemblyPrompt(videos, transcripts, subject, skillLevel)`)
- Single exported function consumed by `sse.js` (e.g., `assembleCourse(videos, transcripts, subject, skillLevel)`)

### Integration Points
- `sse.js` `courseStreamHandler` → `scoredVideos.slice(0, 12)` → fetch transcripts → filter nulls → `assembleCourse` → emit `course_assembled`
- `assembler.js` output must match the locked course JSON contract above (D-02 shape) exactly — Phase 4 frontend is built against it

</code_context>

<specifics>
## Specific Ideas

- The thumbnail URL pattern for YouTube is `https://i.ytimg.com/vi/{videoId}/mqdefault.jpg` — assembler can construct this from videoId without needing a separate API field
- The YouTube video URL is `https://www.youtube.com/watch?v={videoId}` — same, construct from videoId
- `totalWatchTime` can be computed from `durationSeconds` on the videos that survived curation (assembler sums them and formats as "Xh Ym")
- Assembly prompt should tell Claude to assign each video to exactly one module and not invent new videos

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 03-transcript-course-assembly*
*Context gathered: 2026-04-08*
