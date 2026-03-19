# Project Research Summary

**Project:** YouTube Learning Curator
**Domain:** AI-powered YouTube educational content curation and structured course generation
**Researched:** 2026-03-18
**Confidence:** MEDIUM-HIGH

## Executive Summary

The YouTube Learning Curator is a single-user local tool that transforms a subject and skill level into a structured learning course sourced entirely from YouTube. The recommended approach is a Node.js + Express backend serving a vanilla JS frontend over a five-step AI pipeline: Claude generates search queries, YouTube Data API v3 returns candidate videos, a deterministic scoring algorithm ranks them, the unofficial timedtext endpoint fetches transcripts, and a final Claude call assembles modules with comprehension questions. The entire product lives in two files: `server.js` and `index.html`. No database, no frontend framework, no build step.

The most important architectural insight from research is that the pipeline must be asynchronous from the perspective of the HTTP layer. A `POST /api/generate` returns a `jobId` immediately; the browser connects to a separate `GET /api/generate/stream` SSE endpoint to receive progress events. This pattern prevents HTTP timeouts on the 30-90 second pipeline and keeps the server non-blocking. The in-memory Job Store (a plain `Map`) is sufficient for a single-user tool. All Claude calls must demand strict JSON output with explicit schemas — the Step 5 course assembly prompt is the riskiest call and warrants the most prompt iteration time.

The two highest-risk items are (1) the YouTube captions API, which requires OAuth for the official download endpoint and must be replaced with the undocumented timedtext endpoint from day one, and (2) YouTube API quota, which costs 600-800 units per generation and will exhaust the 10,000-unit daily limit during active development without a caching layer. Both risks have clear mitigations that must be built into the initial scaffolding rather than retrofitted later.

---

## Key Findings

### Recommended Stack

The stack is intentionally minimal: Express 4.x, `googleapis` for YouTube Data API v3, `@anthropic-ai/sdk` for Claude, and `dotenv` for secrets. Native Node.js `fetch` handles the timedtext endpoint. Native `EventSource` on the client and Express `res.write()` on the server handle SSE with no additional libraries. `nodemon` is the only dev dependency.

**Core technologies:**
- `Express 4.x`: HTTP server and static file serving — battle-tested, mature SSE patterns, no benefit from v5 migration
- `googleapis`: YouTube Data API v3 client — handles auth headers, quota error parsing, and batched `videos.list` calls
- `@anthropic-ai/sdk`: Claude API — handles retry on 529 overload, clean async interface; use non-streaming mode since SSE progress is step-level, not token-level
- `dotenv`: Environment config — two keys (`YOUTUBE_API_KEY`, `ANTHROPIC_API_KEY`), called before all other imports
- Undocumented timedtext endpoint (`/api/timedtext?v={id}&lang=en&fmt=json3`): transcript source — no auth required, community-verified, fallback to video description required

**Critical version note:** `googleapis` and `@anthropic-ai/sdk` version numbers in STACK.md are low-confidence estimates. Run `npm view googleapis version` and `npm view @anthropic-ai/sdk version` before writing `package.json`.

### Expected Features

**Must have (table stakes):**
- Subject + skill level input form — entry point; no form = no product
- SSE-driven pipeline progress display — generation takes 10-30s; blank screen causes abandonment
- Structured course output with 3-4 modules, titles, descriptions, and video order
- Video thumbnails, titles, channel names, and direct YouTube links per video
- "Why this video" blurb per video — distinguishes curation from plain search results
- Comprehension questions per video (recall, conceptual, application) — the core learning scaffold
- localStorage course history (last 10 courses) with exact restore on load
- Dark mode default, mobile responsive at 375px minimum
- Error state handling for quota exhaustion, transcript unavailability, and Claude failures

**Should have (differentiators):**
- Multi-signal video scoring (0-100): like ratio, duration optimality, recency, description quality, channel credibility
- Skill level propagated structurally through all pipeline stages — not just a filter, but changes module progression logic and scoring weights
- Transcript-grounded comprehension questions using the 3-tier Bloom's taxonomy (recall / conceptual / application)
- Outdated content flagging — especially critical for fast-moving domains
- Lazy hint generation — one batch Claude call per video when user expands, not upfront
- Markdown export (whitelisted fields only — no hints, no scores)
- Progress checkboxes per video stored in localStorage

**Defer to v2+:**
- Lazy hint generation: implement after core question UI is stable
- Channel credibility via Claude: start with simpler heuristic (subscriber log scale + keyword match); replace in v2
- Outdated flagging: requires stable transcript pipeline first
- Animated per-step SSE progress: implement basic step counter first, enhance later

**Never build:** In-app video playback, user authentication, database, answer storage, social features, drag-and-drop editing, or a framework-based frontend.

### Architecture Approach

The architecture is a single-process Node.js server organized into five named zones within one `server.js` file: Init/Config, HTTP Routes, Pipeline Orchestrator, Pipeline Steps, and API Clients. The browser posts to `POST /api/generate` (returns a `jobId`), connects to `GET /api/generate/stream` for SSE progress, and sends lazy hint requests to `POST /api/hints`. The pipeline orchestrator runs detached from the HTTP layer and buffers SSE events in the Job Store so late-connecting SSE clients receive a full replay.

**Major components:**
1. **HTTP Layer** — route definitions, SSE headers, error middleware; the only entry point for browser requests
2. **Job Store** — in-memory `Map` of `{ status, events[], result, listener }`; buffers events for replay; jobs expire after 30 minutes
3. **Pipeline Orchestrator** — sequential 5-step async function; emits `step` events between stages; transitions job to `done` or `error`
4. **Pipeline Steps** — five named async functions (generateSearchQueries, searchYouTube, scoreVideos, fetchTranscripts, assembleCourse); each communicates with one external API
5. **Scoring Engine** — pure synchronous function producing 0-100 score from video stats; no API calls; directly testable with cached data
6. **index.html** — EventSource consumer; renders course; localStorage persistence; export and checkbox logic

### Critical Pitfalls

1. **YouTube captions.download requires OAuth (403 always)** — Never use the official captions download endpoint. Use `https://www.youtube.com/api/timedtext?v={id}&lang=en&fmt=json3` from day one. Build and test the description fallback before any transcript-dependent feature, because the timedtext endpoint returns empty bodies for some videos.

2. **YouTube quota exhaustion during development** — `search.list` costs 100 units per call; 6-8 queries = 600-800 units per generation run. Build a `.cache/` directory cache keyed by query hash before iterating on the pipeline. Catch HTTP 403 `quotaExceeded` explicitly and emit a distinct `quota_error` SSE event.

3. **Claude returns invalid or misshapen JSON** — Use Anthropic's JSON mode (`"type": "json_object"`) if available for the target model, or strip markdown fencing and validate schema on every call. Add an `extractJSON()` utility before writing the first Claude call. Retry once with stricter instructions on parse failure. Truncate transcripts to 2,000-3,000 words before sending to avoid context window overflow.

4. **SSE EventSource reconnects restart the pipeline** — `EventSource` auto-reconnects on connection loss, which triggers a new pipeline run and burns quota. Send a heartbeat comment (`': heartbeat\n\n'`) every 15 seconds. Close `EventSource` immediately on terminal events (`complete`, `error`). Guard the `POST /api/generate` route against duplicate in-flight requests.

5. **localStorage quota exceeded on large course histories** — A full 10-course history can approach or exceed the 5MB browser limit. Wrap all `setItem` calls in try/catch with evict-oldest retry. Store only parsed output — never raw Claude responses or transcript text. Enforce the 10-course cap before writing, not after.

---

## Implications for Roadmap

The ARCHITECTURE.md build order is strongly opinionated and dependency-driven. The phases below follow it directly, with pitfall mitigations woven in at the appropriate stage.

### Phase 1: Backend Foundation and Pipeline Skeleton
**Rationale:** The SSE contract and job store pattern must exist before any pipeline step can be tested end-to-end. YouTube API integration with quota caching must be in place before any scoring iteration begins — otherwise development burns the daily quota limit.
**Delivers:** Working Express server with static file serving, Job Store, SSE route that streams fake progress events, YouTube search and `videos.list` with `.cache/` caching, and a stub pipeline that proves the browser-server SSE connection works.
**Addresses:** Subject + skill level input, SSE progress display
**Avoids:** Pitfall 1 (captions OAuth) — timedtext approach decided here; Pitfall 2 (quota) — caching layer built first; Pitfall 8 (CORS) — Express static serving from the start

### Phase 2: Scoring Engine and Claude Query Generation
**Rationale:** The scoring engine is pure and has no external dependencies — it can be built and validated against cached YouTube data from Phase 1. Claude query generation is the simplest Claude call and establishes the `callClaude()` + `extractJSON()` + schema validation pattern before the complex Step 5 prompt.
**Delivers:** Working 0-100 video scoring with wide score distribution (test histogram offline), Claude search query generation (Step 1), full Step 1 -> 2 -> 3 pipeline chain
**Addresses:** Multi-signal video scoring, skill level propagation into query generation
**Avoids:** Pitfall 6 (flat score distribution) — test histogram against cached data before Claude integration; Pitfall 3 (Claude JSON) — establish extractJSON pattern on simple prompt first

### Phase 3: Transcript Fetching and Claude Course Assembly
**Rationale:** Transcripts are required before the course assembly prompt can be tested; assembly is the most complex Claude call and warrants the most iteration time. Building transcript fetching first isolates that failure mode.
**Delivers:** Timedtext transcript fetch with description fallback, ASR quality detection heuristic, full Step 4 -> 5 pipeline, Claude course assembly producing structured modules with "why this video" blurbs, comprehension questions (all 3 types), and outdated flags
**Addresses:** Transcript-grounded questions, 3-tier question taxonomy, module organization, "why this video" blurbs, outdated flagging
**Avoids:** Pitfall 1 (captions 403) — using timedtext; Pitfall 7 (ASR garbage quality) — quality heuristic and title/description fallback in prompt; Pitfall 9 (skill level ignored) — explicit structural instruction per level

### Phase 4: Frontend and SSE Integration
**Rationale:** The UI is built last, against a stable API contract. All backend behavior is known. SSE production patterns (heartbeat, terminal close) must be correct before the frontend is built on top of them.
**Delivers:** Full `index.html` with course rendering, SSE EventSource with heartbeat and terminal close, localStorage course history with quota protection, progress checkboxes, markdown export with whitelisted fields
**Addresses:** Course display, localStorage persistence, history reload, progress tracking, markdown export, dark mode, mobile responsiveness
**Avoids:** Pitfall 4 (SSE reconnect) — heartbeat and immediate close; Pitfall 5 (localStorage quota) — try/catch + evict-oldest; Pitfall 10 (export includes hints) — `toCourseExport()` whitelist function; Pitfall 12 (URL encoding) — `encodeURIComponent()` on all query params

### Phase 5: Lazy Hints, Channel Credibility, and Polish
**Rationale:** These features depend on the course structure being stable. Lazy hints add the POST /api/hints route and per-video loading state flags. Channel credibility via Claude replaces the simpler v1 heuristic with a batched Claude call.
**Delivers:** Lazy hint generation (POST /api/hints, one batch call per video), per-video hint loading state, channel credibility via Claude (batched single call), error state UI improvements, edge case testing across skill levels
**Addresses:** Lazy hint generation, channel credibility scoring, hint race condition prevention
**Avoids:** Pitfall 13 (hint race condition) — per-video loading state flag

### Phase Ordering Rationale

- Phase 1 must come first because the SSE infrastructure is what every subsequent phase is tested through, and the quota caching must exist before any pipeline iteration
- Phase 2 builds on Phase 1's cached data — the scoring engine can iterate without any new API calls
- Phase 3 is gated on Phase 2 because the transcript fetch and assembly prompt require scored candidates as input
- Phase 4 is the UI, deliberately built last against a known-stable API contract; building UI earlier creates churn as the backend API changes
- Phase 5 defers features that require the course data structure to be stable — hints would break if the question schema changed during Phase 3 iteration

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3:** The timedtext endpoint is undocumented and needs hands-on verification that it returns usable data for the target video types before the transcript pipeline is built around it. The Step 5 Claude prompt schema also needs empirical prompt iteration — plan for 5-10 test runs against real data.
- **Phase 2:** Scoring weight calibration requires offline testing against real YouTube data. The algorithm is custom and has no established template to follow.

Phases with standard patterns (skip research-phase):
- **Phase 1:** Express SSE patterns are well-documented; Job Store is a standard in-memory pattern; YouTube Data API v3 search and `videos.list` are stable and documented.
- **Phase 4:** localStorage, EventSource, and vanilla JS DOM patterns are all well-established with no ambiguity.
- **Phase 5:** Anthropic SDK batch calls and per-item loading state are standard patterns.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Core patterns (Express SSE, googleapis, anthropic SDK) are HIGH confidence. Specific package versions are LOW — must be verified with `npm view` before writing package.json. The timedtext endpoint is community-verified but undocumented. |
| Features | MEDIUM | Feature categorization (table stakes vs differentiators) is based on training knowledge of adjacent tools, not live competitor research. The core feature set from PROJECT.md is well-defined. |
| Architecture | HIGH | SSE/Job Store/Express patterns are from official docs or first principles with no ambiguity. Pipeline orchestration pattern is clean and well-reasoned. The 5-zone server.js structure is straightforward. |
| Pitfalls | HIGH | Top 5 pitfalls are all based on documented API behavior (YouTube OAuth requirement, quota units, localStorage limits, EventSource reconnect behavior) or widely-documented LLM integration patterns. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **timedtext endpoint reliability:** The unofficial YouTube timedtext endpoint is the single biggest unverified assumption in the entire project. Before building transcript-dependent features in Phase 3, manually call the endpoint for 10-20 representative educational videos and confirm the JSON structure matches STACK.md's documented `events[].segs[].utf8` shape. If it has changed, the fallback-to-description path becomes the primary path.
- **Claude JSON mode availability on claude-sonnet-4-5:** PITFALLS.md flags that `"type": "json_object"` response format availability is model-specific. Verify this is supported on `claude-sonnet-4-5` before building the `callClaude()` wrapper. If unavailable, the `extractJSON()` stripping approach is the fallback.
- **Package version verification:** All npm package versions in STACK.md are flagged as requiring verification. Run `npm view` for `express`, `googleapis`, `@anthropic-ai/sdk`, `dotenv`, and `nodemon` before writing `package.json`.
- **Scoring weight calibration:** The exact scoring weights (like ratio, duration, recency, description, channel credibility) have no established benchmark values. Plan for an offline calibration session in Phase 2 using cached video data before integrating with the rest of the pipeline.

---

## Sources

### Primary (HIGH confidence)
- Express.js official docs — SSE patterns, error middleware, route handling
- YouTube Data API v3 official docs — quota unit costs, `videos.list` parts, captions OAuth requirement
- MDN Web Docs — EventSource API, SSE spec, localStorage limits
- Anthropic Node SDK documentation — `messages.create()`, JSON mode, retry behavior

### Secondary (MEDIUM confidence)
- Training knowledge of AI learning tools ecosystem (Merlin, Glasp, Coursera, Khan Academy) — feature categorization
- Community usage of YouTube timedtext endpoint — transcript approach and `json3` format
- General LLM integration patterns — Claude JSON output reliability, prompt schema enforcement

### Tertiary (LOW confidence)
- npm package version estimates (googleapis ~140.x, @anthropic-ai/sdk ~0.27.x, nodemon ~3.x) — requires verification before use
- Scoring algorithm design from ranking/recommendation system literature — weights and normalization approach need empirical validation

---

*Research completed: 2026-03-18*
*Ready for roadmap: yes*
