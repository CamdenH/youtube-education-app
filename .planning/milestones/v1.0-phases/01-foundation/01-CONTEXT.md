# Phase 1: Foundation - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the Express server, SSE infrastructure, YouTube API client, and dev caching layer. No frontend rendering, no Claude calls, no scoring logic. The pipeline skeleton streams realistic fake progress events to verify the SSE connection end-to-end. This phase creates the foundation every subsequent phase runs on.

**Requirements in scope:** INFR-01, INFR-02, INFR-03, INFR-04, INFR-05, INFR-06, PIPE-03, PIPE-04, PIPE-05, PIPE-06, PIPE-07

</domain>

<decisions>
## Implementation Decisions

### SSE Event Contract
- Named verb-noun events: `query_generated`, `videos_fetched`, `scored`, `transcripts_fetched`, `course_assembled`
- Payload shape: `{ step: N, total: 5, message: "..." }` — step and total for progress, message for UI display
- Terminal events: `course_assembled` (success) and `error` (failure) — frontend closes EventSource on either
- `course_assembled` payload carries the **full course JSON inline**: `{ course: { title, overview, modules: [...] } }` — no follow-up request needed
- `error` payload: `{ code: "QUOTA_EXCEEDED"|"...", message: "user-readable string" }`
- Heartbeat: SSE comment line (`: heartbeat\n\n`) every 15 seconds — invisible to `addEventListener`, keeps proxies alive
- Phase 1 stub behavior: emit all 5 real named events with hardcoded realistic stub data and small delays between them so Phase 4 frontend can be built and tested against the full event sequence immediately

### Dev Cache Design
- Cache key: MD5 hash of the query string — `crypto.createHash('md5').update(query).digest('hex')`
- Separate cache files by data type (not one bundle per query):
  - Search results: `.cache/search_{hash}.json` (keyed by query hash)
  - Video stats: `.cache/video_{videoId}.json` (keyed by YouTube videoId)
  - Transcripts: `.cache/transcript_{videoId}.json` (keyed by YouTube videoId)
- No TTL — cache files persist indefinitely; clear with `rm -rf .cache/` when fresh data is needed
- `.cache/` added to `.gitignore` alongside `.env`

### Server File Structure
- Thin `server.js` entry point (~50 lines): Express app setup, route registration, `app.listen()`
- Logic split into flat module files at project root (not in a subfolder):
  - `youtube.js` — YouTube Data API v3 search + video stats fetch
  - `cache.js` — read/write `.cache/` logic
  - `sse.js` — SSE send-event helper, heartbeat setup
  - `transcript.js` — timedtext fetch + fallback + XML parsing
- All files flat at root alongside `package.json`, `index.html`, `.env.example`

### Transcript Endpoint Format
- `GET /api/transcript/:videoId` returns plain concatenated text (no timestamps):
  ```json
  { "videoId": "dQw4w9WgXcQ", "source": "captions", "text": "Full transcript text..." }
  ```
- `source` field: `"captions"` if from timedtext, `"description"` if fallback
- When neither transcript nor description available: **HTTP 404** with structured error:
  ```json
  { "error": "NO_TRANSCRIPT", "videoId": "dQw4w9WgXcQ", "message": "No transcript or description available" }
  ```
- Phase 3 calling code checks HTTP status to decide whether to skip the video

### Tech Stack — npm Packages
- YouTube API: **raw `fetch()`** calls to `https://www.googleapis.com/youtube/v3` with `key=` query param — no `googleapis` package
- Phase 1 `package.json` dependencies: `express ^4.18`, `dotenv ^16` only
- `@anthropic-ai/sdk` added in Phase 2 (when Claude calls are needed)
- Timedtext XML parsed with **regex/string stripping** — no `xml2js` or XML library:
  - Strip all tags with `/<[^>]+>/g`
  - Decode HTML entities (`&amp;`, `&lt;`, `&gt;`, `&quot;`, `&#39;`)
  - Collapse whitespace and trim

### Claude's Discretion
- Exact retry implementation for INFR-02 (max 2 retries, exponential backoff — structure is clear from requirements)
- Claude JSON validation/stripping approach for INFR-03 (strip markdown code fences, parse, retry on failure)
- Exact index.html stub for Phase 1 (minimal placeholder that verifies SSE connection, not final UI)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — Full v1 requirements; Phase 1 requirements are INFR-01–06, PIPE-03–07. Check traceability table for scope.
- `.planning/PROJECT.md` — Stack constraints (Node.js + Express, vanilla JS, no frontend framework, no build step), API key handling, key architectural decisions

### Phase 1 Success Criteria
- `.planning/ROADMAP.md` §Phase 1 — 5 success criteria that define "done" for this phase; planner tasks must map to these

No external ADRs or design docs — all requirements fully captured in decisions above and REQUIREMENTS.md.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project, no existing source code

### Established Patterns
- Codebase maps in `.planning/codebase/` were generated pre-stack-decision and reference Python/React — **ignore them**. The actual stack is Node.js + Express + vanilla JS as defined in PROJECT.md.

### Integration Points
- `server.js` → serves `index.html` at root and mounts all API routes
- `index.html` → connects to `GET /api/course-stream` via `EventSource` (Phase 4 builds this out)
- `.env` → `YOUTUBE_API_KEY` and `ANTHROPIC_API_KEY` loaded via `dotenv` at server startup

</code_context>

<specifics>
## Specific Ideas

- Phase 1 stub events should use realistic-looking stub payloads (e.g., "Generated 7 search queries", "Fetched 48 videos") so Phase 4 UI development can begin against a real event sequence
- The `total: 5` in the SSE payload refers to the 5 pipeline stages (matches PIPE-06 named events) — useful for a progress bar

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-03-19*
