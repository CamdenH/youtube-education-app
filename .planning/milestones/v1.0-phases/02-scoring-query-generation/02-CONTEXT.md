# Phase 2: Scoring + Query Generation - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the scoring engine (0–100 per video), Claude-powered channel credibility rating (single batch call), Claude-powered description quality rating, and Claude query generation from subject + skill level. No frontend, no transcript fetching, no course assembly. This phase produces ranked candidate videos that Phase 3 will curate into a course.

**Requirements in scope:** PIPE-01, PIPE-02, SCOR-01, SCOR-02, SCOR-03, SCOR-04, SCOR-05

</domain>

<decisions>
## Implementation Decisions

### Scoring Weights by Skill Level (SCOR-01, SCOR-02)

- **D-01:** Base formula components and max points: like ratio (40), duration (20), channel credibility (20), recency (10), description quality (10). These caps define the shape; weights shift within them by level.
- **D-02:** Primary skill-level shift is **recency ↔ credibility**: as level increases from beginner to advanced, recency weight drops (beginners need current tutorials; advanced learners want rigorous lectures regardless of age) and the freed points go to channel credibility.
  - Beginner: recency ~15pts max, credibility ~15pts max
  - Intermediate / All levels: recency ~10pts max, credibility ~20pts max (balanced defaults)
  - Advanced: recency ~5pts max, credibility ~25pts max (or redistribute into credibility + description)
  - Exact values are Claude's discretion — the directional strategy is locked; implementation can tune
- **D-03:** Description quality weight stays **flat across all levels** (fixed 10pts cap). It's a general signal of content care, not a level-specific indicator.
- **D-04:** `"all levels"` uses **balanced/intermediate weights** — same weight profile as intermediate. A neutral mix that doesn't favor any level.

### Duration Scoring Curve (SCOR-01)

- **D-05:** Soft falloff outside the 8–45 min range:
  - 8–45 min = full 20pts
  - 3–8 min OR 45–60 min = partial credit (~10pts)
  - Under 3 min OR over 60 min = 0pts
  - Exact partial credit values are Claude's discretion; the tier structure is locked
- **D-06:** Skill level **extends the upper ideal range for advanced learners**:
  - Beginner / Intermediate / All levels: ideal range 8–45 min
  - Advanced: ideal range 8–60 min (full points up to 60 min; falloff begins beyond 60 min)
  - This reflects advanced learners' tolerance for full university-length lectures

### Query Generation Strategy (PIPE-02)

- **D-07:** **Angle diversity** — Claude generates 6–8 queries covering different angles: conceptual overview, tutorial/how-to, real-world application, common mistakes, deep-dive subtopics. Goal is to maximize variety in what gets surfaced from YouTube, not to escalate depth or enumerate subtopics.
- **D-08:** Skill level shapes angle emphasis, not just vocabulary:
  - Beginner queries → intro/overview/tutorial angles
  - Advanced queries → lecture/deep-dive/research angles
  - (Already locked in requirements; confirmed here as the implementation strategy)
- **D-09:** Prompt includes explicit diversity instruction — Claude must ensure each query is meaningfully different (different angle, format, or intent). Reduces redundant search results before scoring.
- **D-10:** Claude returns a **plain JSON array of query strings only** — no metadata, no angle labels. Simpler to parse; scoring engine handles quality downstream.

### Channel Credibility Calibration (SCOR-03, SCOR-04)

- **D-11:** **Merit-based scoring** — top score (20/20) is achievable by any channel with demonstrated content depth and rigor, regardless of institutional affiliation. Institutional affiliation is one positive signal, not a requirement for maximum score. Top-tier indie educators (e.g., 3Blue1Brown, Fireship) can reach max.
- **D-12:** Channel credibility prompt **includes calibration examples** (3–4 anchor points spanning the full range) to ensure consistent scoring across batches and avoid score clustering. Example anchors should cover: top institutional (e.g., MIT OCW), top indie (e.g., 3Blue1Brown), competent but commercial channel, and low-quality/off-topic channel.
- **D-13:** All unique channels from a candidate set are scored in **exactly one Claude batch call** (SCOR-04 requirement confirmed as the implementation pattern — no per-channel calls).

### Claude's Discretion

- Exact scoring weight values within the directional constraints (D-02, D-05)
- Specific partial credit values for soft falloff tiers (D-05)
- File structure for new Phase 2 modules (e.g., `scorer.js`, `queries.js` or combined)
- Description quality prompt criteria details (SCOR-05 — Claude rates 0–10 for educational depth)
- Exact calibration anchor values for channel credibility (D-12 defines the range structure; specific numbers are Claude's discretion)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — Full v1 requirements; Phase 2 requirements are PIPE-01, PIPE-02, SCOR-01–05. Traceability table confirms scope.
- `.planning/PROJECT.md` — Stack constraints (Node.js + Express, no frameworks, no build step), API key handling, key architectural decisions

### Phase 2 Success Criteria
- `.planning/ROADMAP.md` §Phase 2 — 4 success criteria that define "done" for this phase

### Prior Phase Context
- `.planning/phases/01-foundation/01-CONTEXT.md` — SSE event contract, dev cache design, flat file structure, `callClaude`/`parseClaudeJSON` API

No external ADRs or design docs — all requirements fully captured in decisions above and REQUIREMENTS.md.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `claude.js` — `callClaude(fn, ...args)` retry wrapper and `parseClaudeJSON(text)` already built and tested; Phase 2 wires in `@anthropic-ai/sdk` and calls through these
- `youtube.js` — `searchVideos(query)` and `fetchVideoStats(videoIds[])` ready to use; scoring engine consumes their output directly
- `cache.js` — `cacheGet(key)`, `cacheSet(key, data)`, `queryHash(str)` available for caching Claude credibility scores if desired
- `server.js` — `courseStreamHandler` stub pipeline is where Phase 2 wires in real `query_generated` and `scored` SSE events

### Established Patterns
- Flat file structure at project root — new Phase 2 files (`scorer.js`, `queries.js` or similar) live at root alongside existing modules
- `'use strict'` at top of every module
- CommonJS `require()`/`module.exports` throughout — no ES modules
- Error classes in `youtube.js` (YouTubeAPIError, YouTubeQuotaError) as the pattern for typed errors
- `@anthropic-ai/sdk` intentionally deferred to Phase 2 — add to `package.json` dependencies now

### Integration Points
- `server.js` `courseStreamHandler` → replace stub events with real pipeline calls
- `PIPE-01` — form input (`subject`, `skill_level`) comes in via query params on `GET /api/course-stream`
- Phase 2 output feeds directly into Phase 3 (`fetchVideoStats` results + scores → transcript fetch for top 12)
- Phase 1 deviation to close: `videoDuration: 'any'` in `searchVideos` was intentional; duration filtering now happens in scorer, not search params

</code_context>

<specifics>
## Specific Ideas

- Calibration anchor examples for channel credibility prompt: MIT OCW / Stanford (institutional top), 3Blue1Brown (indie top), common programming tutorial channel (mid-tier), gaming/entertainment crossover (low)
- STATE.md notes a concern: "Scoring weight calibration has no established benchmark — plan offline histogram test against cached Phase 1 data before Claude integration." Planner should include a task for manually inspecting score distributions against cached data before wiring SSE.
- Query generation prompt should reference the angle diversity list explicitly so Claude generates varied angles, not just vocabulary variants

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-scoring-query-generation*
*Context gathered: 2026-04-06*
