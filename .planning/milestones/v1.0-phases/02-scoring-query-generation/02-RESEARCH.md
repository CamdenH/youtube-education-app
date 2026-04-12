# Phase 2: Scoring + Query Generation — Research

**Researched:** 2026-04-06
**Domain:** Claude API integration, video scoring algorithm, query generation prompting
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01 — Score components and base caps:** like ratio (max 40), duration (max 20), channel credibility (max 20), recency (max 10), description quality (max 10).

**D-02 — Skill-level weight shift (recency ↔ credibility):**
- Beginner: recency ~15pts, credibility ~15pts
- Intermediate / All levels: recency ~10pts, credibility ~20pts (balanced defaults)
- Advanced: recency ~5pts, credibility ~25pts

**D-03 — Description quality weight stays flat across all levels** (fixed 10pts cap).

**D-04 — "all levels" uses balanced/intermediate weights.**

**D-05 — Duration soft falloff tiers:**
- 8–45 min = full 20pts
- 3–8 min OR 45–60 min = partial credit (~10pts)
- Under 3 min OR over 60 min = 0pts

**D-06 — Advanced level extends upper ideal range to 8–60 min** (full 20pts up to 60 min; falloff begins beyond 60 min).

**D-07 — Angle diversity:** Claude generates 6–8 queries covering different angles (conceptual overview, tutorial/how-to, real-world application, common mistakes, deep-dive subtopics).

**D-08 — Skill level shapes angle emphasis:** beginner → intro/overview/tutorial; advanced → lecture/deep-dive/research.

**D-09 — Prompt includes explicit diversity instruction** — each query must be meaningfully different (angle, format, or intent).

**D-10 — Claude returns a plain JSON array of query strings only** — no metadata, no angle labels.

**D-11 — Merit-based channel credibility** — 20/20 achievable by any channel with demonstrated depth and rigor, regardless of institutional affiliation.

**D-12 — Channel credibility prompt includes 3–4 calibration anchor examples** spanning the full range: top institutional (e.g., MIT OCW), top indie (e.g., 3Blue1Brown), competent-but-commercial, low-quality/off-topic.

**D-13 — All unique channels from candidate set scored in exactly one Claude batch call** (no per-channel calls).

### Claude's Discretion

- Exact scoring weight values within the directional constraints (D-02, D-05)
- Specific partial credit values for soft falloff tiers
- File structure for new Phase 2 modules (e.g., `scorer.js`, `queries.js`, or combined)
- Description quality prompt criteria details (SCOR-05 — Claude rates 0–10 for educational depth)
- Exact calibration anchor values for channel credibility (D-12 defines range structure; specific numbers are Claude's discretion)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PIPE-01 | User can submit a subject + skill level (beginner/intermediate/advanced/all) to trigger course generation | `req.query.subject` and `req.query.skill_level` already flow into `courseStreamHandler` via the GET /api/course-stream route; scoring and query modules receive these as parameters |
| PIPE-02 | Server generates 6–8 targeted YouTube search queries via Claude, shaped by skill level | `queries.js` exports `generateQueries(subject, skillLevel)` → calls `callClaude` → returns string array; prompt engineering findings in Architecture Patterns |
| SCOR-01 | Each video scored 0–100 using 5-component formula | `scorer.js` exports `scoreVideos(videos, skillLevel)` with deterministic components (like ratio, duration) + Claude components (credibility, description quality) |
| SCOR-02 | Skill level adjusts scoring weights | Weight table is a plain JS object keyed by `skillLevel`; deterministic — no Claude call needed |
| SCOR-03 | Channel credibility rated 0–20 by Claude (institutional affiliation + content depth/rigor) | Part of batch call in SCOR-04; one prompt scores all channels in one messages.create call |
| SCOR-04 | All unique channels sent to Claude in one batch call | `scoreChannelCredibility(channels)` → exactly one `callClaude` call; returns `{ [channelId]: score }` map |
| SCOR-05 | Description quality rated 0–10 by Claude for educational depth | Included in the same batch call as SCOR-03 OR as a second call on descriptions — see Architecture Patterns for both options |

</phase_requirements>

---

## Summary

Phase 2 introduces two categories of work: (1) deterministic scoring components computed entirely in JavaScript from YouTube API data already in cache, and (2) Claude API calls for the subjective signals — channel credibility, description quality, and query generation. The deterministic components (like ratio, duration, recency) are straightforward formulas; the Claude components require prompt engineering for consistent, calibrated outputs.

The `@anthropic-ai/sdk` package at version 0.82.0 is the only new dependency this phase adds. It installs as a CommonJS-compatible package and integrates cleanly with the existing `callClaude` retry wrapper. The client reads `ANTHROPIC_API_KEY` from the environment; dotenv is already configured in server.js.

The critical architectural decision is how to structure the Claude calls. Channel credibility (SCOR-04) is explicitly locked to exactly one batch call for all channels from the candidate set. Description quality (SCOR-05) can piggyback onto that same call or be a second call on descriptions — the tradeoff is prompt complexity vs. call count. The planner should pick one approach and document it. Query generation (PIPE-02) is a separate call that runs before video search, not during scoring.

**Primary recommendation:** Two new files at project root — `queries.js` (generateQueries function) and `scorer.js` (scoreVideos, scoreChannelCredibility, and all component scoring functions). Keep them small and focused; the SSE pipeline in `sse.js` orchestrates them.

---

## Project Constraints (from CLAUDE.md)

- `'use strict'` at top of every JS file [VERIFIED: codebase]
- `module.exports` only — no ESM [VERIFIED: codebase]
- Flat file structure at project root — no src/ subdirectory [VERIFIED: codebase]
- Tests use `node --test --test-concurrency=1 tests/unit/*.test.js` [VERIFIED: package.json]
- Cache keys: `search_<md5>.json` for search results, `video_<id>.json` for video detail [VERIFIED: cache.js, youtube.js]
- Do not add dependencies without asking — `@anthropic-ai/sdk` is explicitly deferred to Phase 2 and pre-approved in CONTEXT.md [VERIFIED: code context note in 02-CONTEXT.md]
- Write clean, readable code suitable for public sharing
- Before implementing anything non-trivial, explain approach and wait for approval

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@anthropic-ai/sdk` | 0.82.0 | Claude API client — messages.create, automatic retry, auth | Official Anthropic SDK; pre-approved for Phase 2; CommonJS compatible via `require()` |
| `node:crypto` | built-in | MD5 hashing for cache keys | Already used in `cache.js`; zero install cost |

**No additional dependencies required.** Like ratio, duration, and recency scoring are pure math on data already fetched. The SDK is the only new install.

### Version Verification

```
npm view @anthropic-ai/sdk version  → 0.82.0  (verified 2026-04-06)
npm view @anthropic-ai/sdk time.modified  → 2026-04-01T19:51:53.420Z
```

[VERIFIED: npm registry]

### Installation

```bash
npm install @anthropic-ai/sdk
```

This adds `@anthropic-ai/sdk` to `dependencies` in package.json.

---

## Architecture Patterns

### Recommended File Structure (new files only)

```
queries.js      # generateQueries(subject, skillLevel) → string[]
scorer.js       # scoreVideos(videos, skillLevel) → scored video array
                # scoreChannelCredibility(channels) → { channelId: score }
                # scoreDuration(durationSec, skillLevel) → number
                # scoreRecency(publishedAt, skillLevel) → number
                # scoreLikeRatio(likeCount, viewCount) → number
```

Both files live at project root, alongside `claude.js`, `youtube.js`, etc. [VERIFIED: CLAUDE.md convention, existing project structure]

### Pattern 1: Anthropic SDK — CommonJS Instantiation

The SDK exports a default class that reads `ANTHROPIC_API_KEY` from `process.env` automatically.

```javascript
// Source: https://platform.claude.com/docs/en/api/client-sdks
'use strict';

const Anthropic = require('@anthropic-ai/sdk');

// Instantiate once at module level (connection pooling, shared auth)
const anthropic = new Anthropic();
// ANTHROPIC_API_KEY read from process.env automatically
```

[VERIFIED: platform.claude.com/docs/en/api/client-sdks]

### Pattern 2: Messages API Call

```javascript
// Source: https://platform.claude.com/docs/en/api/client-sdks
const response = await anthropic.messages.create({
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 1024,
  messages: [{ role: 'user', content: prompt }]
});
const text = response.content[0].text;
```

[VERIFIED: platform.claude.com/docs/en/api/client-sdks]

### Pattern 3: Wrapping in callClaude

The existing `callClaude(fn, ...args)` wrapper handles retries with exponential backoff. Use it for all Claude API calls:

```javascript
// Source: claude.js (existing codebase)
const { callClaude, parseClaudeJSON } = require('./claude');

async function generateQueries(subject, skillLevel) {
  const text = await callClaude(async () => {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: buildQueryPrompt(subject, skillLevel) }]
    });
    return response.content[0].text;
  });
  return parseClaudeJSON(text); // strips code fences, parses array
}
```

[VERIFIED: claude.js codebase pattern]

### Pattern 4: Scoring Weight Table

Weight table is a plain JS object — no Claude call, no computation. Deterministic at module load time.

```javascript
// All values are caps (max achievable), not flat weights
// Points shift between recency and credibility by skill level per D-02
const WEIGHTS = {
  beginner:     { likeRatio: 40, duration: 20, credibility: 15, recency: 15, description: 10 },
  intermediate: { likeRatio: 40, duration: 20, credibility: 20, recency: 10, description: 10 },
  advanced:     { likeRatio: 40, duration: 20, credibility: 25, recency:  5, description: 10 },
};
WEIGHTS['all levels'] = WEIGHTS.intermediate; // D-04: all levels = intermediate
```

Note: credibility cap exceeds SCOR-01's stated max of 20 at advanced level (25 per D-02). The planner must decide whether to cap the returned Claude score at the credibility weight cap, or to let the formula total remain at 100 by redistributing from another component. This is a minor arithmetic question for the planner to resolve — the directional decision is locked.

[ASSUMED — specific weight values; D-02 gives directional constraint but final numbers are Claude's discretion]

### Pattern 5: ISO 8601 Duration Parsing

YouTube `contentDetails.duration` returns ISO 8601 format (e.g., `PT15M30S`, `PT1H23M45S`). Parse with a single regex:

```javascript
// Source: YouTube API contentDetails.duration field, verified against real format
function parseDurationSeconds(iso) {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (parseInt(m[1] || 0) * 3600)
       + (parseInt(m[2] || 0) * 60)
       + parseInt(m[3] || 0);
}
// PT15M30S → 930 sec (15.5 min)
// PT1H23M45S → 5025 sec (83.75 min)
// PT5M → 300 sec (5 min)
```

[VERIFIED: tested against YouTube API format in Node 22.22.0]

### Pattern 6: Like Ratio Scoring

YouTube removed dislike counts from the public API in December 2021. "Like ratio" now means `likeCount / viewCount`. Educational videos typically see 2–5% like ratios; scaling 4% → 40pts gives a reasonable distribution.

```javascript
function scoreLikeRatio(likeCount, viewCount, maxPts) {
  if (!viewCount || viewCount === 0) return 0;
  const ratio = Number(likeCount) / Number(viewCount); // API returns strings
  const EXCELLENT_RATIO = 0.04; // 4% = max pts
  return Math.round(Math.min(ratio / EXCELLENT_RATIO, 1) * maxPts);
}
```

[ASSUMED — 4% threshold is a reasonable educational benchmark; no published standard exists]

### Pattern 7: Channel Credibility Batch Call (SCOR-03, SCOR-04)

One call, all channels. Prompt includes calibration anchors (D-12). Returns a JSON object keyed by channel name or ID.

```javascript
async function scoreChannelCredibility(channels) {
  // channels: [{ id, name, subscriberCount }]
  const prompt = buildCredibilityPrompt(channels);
  const text = await callClaude(async () => {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }]
    });
    return response.content[0].text;
  });
  return parseClaudeJSON(text); // { "MIT OpenCourseWare": 20, "SomeTutorial": 11 }
}
```

[VERIFIED: approach matches SCOR-04 requirement and D-13 decision]

### Pattern 8: Description Quality Scoring (SCOR-05)

Two viable approaches for the planner to choose between:

**Option A — Batch with credibility (one total call for both):**
Combine channel credibility and description quality into one prompt. Input: channel list + description list. Output: `{ channels: { name: score }, descriptions: { videoId: score } }`. Reduces API calls but increases prompt complexity.

**Option B — Separate call per batch (two Claude calls total in scorer):**
Run credibility first, then descriptions as a second call. Simpler prompts, easier to test independently, slightly more latency and cost.

Both are architecturally valid. The planner should pick one. Option A is preferred for a single-user personal tool where simplicity of runtime matters less than reducing Claude API calls.

### Pattern 9: SSE Integration Points

`courseStreamHandler` in `sse.js` currently emits stubs. Phase 2 replaces the first two stubs with real calls:

```
req.query.subject, req.query.skill_level
  → generateQueries(subject, skillLevel)          → sendEvent(res, 'query_generated', {...})
  → for each query: searchVideos(query)            → (already implemented in youtube.js)
  → fetchVideoStats(videoIds)                      → (already implemented in youtube.js)
  → scoreVideos(videos, skillLevel)               → sendEvent(res, 'scored', {...})
```

`videos_fetched` event is emitted between search and scoring. `scored` carries the ranked video list.

[VERIFIED: sse.js event names match REQUIREMENTS.md PIPE-06 event list]

### Anti-Patterns to Avoid

- **Separate Claude call per channel:** SCOR-04 explicitly requires one batch call. Never loop over channels with individual requests.
- **Storing Anthropic client in req/res:** Instantiate once at module level (not inside request handlers).
- **Parsing YouTube duration with parseInt directly:** The string is ISO 8601, not a number — it always requires regex parsing.
- **String comparison for likeCount/viewCount:** YouTube returns stats as strings — convert with `Number()` before arithmetic.
- **Mutating video objects from fetchVideoStats:** Add a `score` property to a shallow copy, not the cached original, to avoid polluting the cache data.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Claude API auth + retry | Custom fetch wrapper to api.anthropic.com | `@anthropic-ai/sdk` + existing `callClaude` | SDK handles auth headers, versioning, connection pooling; `callClaude` handles retries |
| JSON fence stripping | New regex or parser | Existing `parseClaudeJSON` in `claude.js` | Already tested, handles both ```json and ``` variants |
| Exponential backoff | Custom retry loop | Existing `callClaude` in `claude.js` | Already tested with injectable delay for fast tests |
| ISO 8601 duration parsing | External library | Single regex (shown above) | 10-line solution covers all YouTube duration formats |
| Score clamping | Complex conditional | `Math.min(value, max)` | One-liner for every component |

**Key insight:** The three Claude API calls (query gen, channel credibility, description quality) all follow the exact same pattern: build a prompt string → pass an async function to `callClaude` → parse the text result with `parseClaudeJSON`. Implementing this pattern once in `queries.js` and once in `scorer.js` is all that's needed.

---

## Common Pitfalls

### Pitfall 1: YouTube Statistics Are Strings, Not Numbers

**What goes wrong:** `likeCount / viewCount` returns `NaN` or `Infinity` because YouTube returns both as strings (`"12345"`, not `12345`).

**Why it happens:** The YouTube Data API v3 returns all statistics fields as strings to preserve precision for large integers.

**How to avoid:** Always wrap in `Number()` before arithmetic: `Number(stats.likeCount) / Number(stats.viewCount)`.

**Warning signs:** Like ratio score is always 0 or NaN in tests; adding `console.log(typeof likeCount)` reveals `"string"`.

[VERIFIED: youtube.js fetchVideoStats uses `part: 'statistics'`; YouTube API docs confirm string format]

### Pitfall 2: Missing Statistics Fields

**What goes wrong:** Some YouTube videos return `statistics: {}` with no `likeCount` or `viewCount` — new videos, channels with hidden stats, or age-restricted content.

**Why it happens:** YouTube allows channel owners to hide like counts and view counts.

**How to avoid:** Guard every statistics access: `const likes = Number(video.statistics?.likeCount || 0)`. Return 0 for missing fields rather than throwing.

**Warning signs:** `TypeError: Cannot read property 'likeCount' of undefined` in tests.

[VERIFIED: YouTube API allows hidden statistics; confirmed common in practice]

### Pitfall 3: Claude Returns Unexpected JSON Shape

**What goes wrong:** `parseClaudeJSON` succeeds but the resulting value is a different shape than expected — e.g., object with a `queries` key instead of a bare array.

**Why it happens:** Without explicit schema instruction, Claude may wrap the requested array in an object for clarity.

**How to avoid:** Prompts must include explicit format instruction: "Return a JSON array of strings only, with no wrapper object, no keys, and no explanation." Validate shape after parsing: `if (!Array.isArray(result)) throw new Error(...)`.

**Warning signs:** `result.queries` is the array; `result[0]` is undefined.

[ASSUMED — based on prompt engineering experience; verified by CONTEXT.md D-10 decision to require plain array]

### Pitfall 4: Channel Credibility Score Keyed by Name vs. ID

**What goes wrong:** Claude returns `{ "MIT OpenCourseWare": 18 }` but the scorer tries to look up `{ "UC...": 18 }` using the channel ID.

**Why it happens:** Claude knows channel names, not channel IDs. The prompt input must normalize the key used for lookup.

**How to avoid:** Prompt the batch call with channel names, and maintain a `name → id` mapping locally. After parsing, remap the result from name-keyed to id-keyed. Or use channel ID in the prompt input explicitly.

**Warning signs:** All channel credibility scores come back as 0 because no key matches.

[ASSUMED — based on how Claude processes channel identity; no official documentation]

### Pitfall 5: Score Total Exceeds 100 at Advanced Level

**What goes wrong:** With `credibility: 25` at advanced level, a perfect video scores 40+20+25+5+10 = 100. But the SCOR-01 requirement states max 20 for channel credibility. The D-02 decision intentionally pushes credibility above 20 for advanced.

**Why it happens:** D-02 redistributes points from recency to credibility; the caps shift.

**How to avoid:** Accept that the weight table shifts; the total always sums to 100 (40+20+25+5+10=100). The SCOR-01 max-20 for credibility is the intermediate/baseline cap; D-02 overrides it by level. The scorer simply uses the weight from the WEIGHTS table for each level — no clamping to 20.

**Warning signs:** None if the weight table is built correctly; confusion arises only when re-reading SCOR-01 alongside D-02.

[VERIFIED: arithmetic confirmed — beginner 40+20+15+15+10=100, intermediate 40+20+20+10+10=100, advanced 40+20+25+5+10=100]

### Pitfall 6: Score Distribution Clustering

**What goes wrong:** All scored videos cluster in the 55–65 range, making ranking meaningless.

**Why it happens:** Like ratio formula is too generous (a 2% ratio nets 20pts instead of a spread). Or credibility scores from Claude all come back near 15/20.

**How to avoid:** The CONTEXT.md explicitly flags this concern: run an offline histogram test against cached Phase 1 data before wiring SSE. The plan must include a discrete task for scoring cached videos and inspecting the distribution.

**Warning signs:** Standard deviation of scores is under 10 points.

[VERIFIED: concern documented in STATE.md and 02-CONTEXT.md specifics section]

---

## Code Examples

### Query Generation Prompt Template

```javascript
// Prompt structure for generateQueries — builds skill-level differentiated angles
function buildQueryPrompt(subject, skillLevel) {
  const angleHints = {
    beginner:     'introduction, overview, tutorial, beginner guide, explained simply, getting started',
    intermediate: 'tutorial, how-to, practical guide, real-world application, common mistakes',
    advanced:     'lecture, deep dive, research, advanced concepts, theory, university course',
    'all levels': 'overview, tutorial, practical guide, explained, how-to',
  };
  const angles = angleHints[skillLevel] || angleHints['all levels'];

  return `Generate 6-8 YouTube search queries to find the best educational videos about "${subject}" for a ${skillLevel} learner.

Requirements:
- Each query must target a DIFFERENT angle or format: ${angles}
- Queries must be meaningfully different — not just vocabulary variants of the same intent
- Optimize for YouTube search (concise, specific, natural language)
- Avoid redundancy: if two queries would surface the same videos, replace one

Return ONLY a JSON array of query strings. No wrapper object, no keys, no explanation.

Example format: ["query one", "query two", "query three"]`;
}
```

[ASSUMED — prompt structure based on D-07, D-08, D-09, D-10 decisions; specific wording is Claude's discretion]

### Channel Credibility Prompt Template

```javascript
// Prompt for batch channel credibility scoring
function buildCredibilityPrompt(channels) {
  const channelList = channels
    .map(c => `- "${c.name}" (${c.subscriberCount ? c.subscriberCount.toLocaleString() + ' subscribers' : 'subscribers unknown'})`)
    .join('\n');

  return `Rate each YouTube channel's credibility for educational content on a scale of 0–20.

Scoring criteria:
- Content depth and rigor (primary signal)
- Demonstrated expertise (academic, professional, or community-recognized)
- Consistency of educational quality across videos
- Institutional affiliation is ONE positive signal, not a requirement

Calibration anchors (do not score these — use them to calibrate):
- MIT OpenCourseWare: 20/20 (institutional, rigorous, peer-reviewed curriculum)
- 3Blue1Brown: 20/20 (indie, exceptional depth, visualization-based mathematical rigor)
- [Typical programming tutorial channel with ads]: 12/20 (competent but commercially motivated)
- [Gaming/entertainment channel that occasionally covers tech]: 3/20 (off-topic primary content)

Channels to score:
${channelList}

Return ONLY a JSON object mapping channel name to integer score (0–20). No explanation.

Example: {"Channel Name": 15, "Another Channel": 8}`;
}
```

[ASSUMED — calibration anchor values are Claude's discretion per D-12; structure matches D-11, D-12, D-13]

### scoreVideos Function Shape

```javascript
// scorer.js — top-level export consumed by courseStreamHandler
async function scoreVideos(videos, skillLevel) {
  const weights = WEIGHTS[skillLevel] || WEIGHTS.intermediate;

  // 1. Extract unique channels for batch credibility call
  const uniqueChannels = deduplicateChannels(videos);
  const credibilityMap = await scoreChannelCredibility(uniqueChannels); // one Claude call

  // 2. Score descriptions in batch (Option A: separate call; Option B: included above)
  const descQualityMap = await scoreDescriptionQuality(videos); // one Claude call

  // 3. Deterministic components — no Claude call
  return videos.map(video => {
    const likeRatioScore  = scoreLikeRatio(video.statistics, weights.likeRatio);
    const durationScore   = scoreDuration(video.contentDetails.duration, skillLevel, weights.duration);
    const recencyScore    = scoreRecency(video.snippet.publishedAt, skillLevel, weights.recency);
    const credScore       = Math.min(credibilityMap[video.snippet.channelTitle] || 0, weights.credibility);
    const descScore       = Math.min(descQualityMap[video.id] || 0, weights.description);

    const total = likeRatioScore + durationScore + recencyScore + credScore + descScore;

    return { ...video, score: total, scoreBreakdown: { likeRatioScore, durationScore, recencyScore, credScore, descScore } };
  }).sort((a, b) => b.score - a.score);
}
```

[ASSUMED — function signature and structure; planner has discretion over exact implementation]

---

## Model Selection Guidance

For this phase, two Claude API calls are needed: query generation and scoring (credibility + description quality). Cost and latency matter for a personal tool.

| Model | API ID | Input $/MTok | Output $/MTok | Recommendation |
|-------|--------|-------------|-------------|----------------|
| Haiku 4.5 | `claude-haiku-4-5-20251001` | $1 | $5 | **Recommended** — fastest, cheapest; sufficient for structured JSON output tasks |
| Sonnet 4.6 | `claude-sonnet-4-6` | $3 | $15 | Use if Haiku produces low-quality query diversity or poor calibration |
| Opus 4.6 | `claude-opus-4-6` | $5 | $25 | Overkill for these tasks |

**Recommendation:** Start with `claude-haiku-4-5-20251001` for all three calls. Upgrade to Sonnet only if offline testing reveals poor query diversity or score clustering attributable to model quality.

[VERIFIED: model IDs and pricing from platform.claude.com/docs/en/about-claude/models/overview, 2026-04-06]

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime | Yes | v22.22.0 | — |
| npm | Package install | Yes | 10.9.4 | — |
| `@anthropic-ai/sdk` | Claude calls | Not yet | — | Must install before Phase 2 begins |
| `ANTHROPIC_API_KEY` env var | Claude calls | Not set in shell | — | Must be in `.env` before integration tests |
| `YOUTUBE_API_KEY` env var | searchVideos | Not set in shell | — | Phase 1 cache will serve; unit tests mock fetch |

**Missing dependencies with no fallback:**
- `@anthropic-ai/sdk` — must be installed (`npm install @anthropic-ai/sdk`) as Wave 0 task
- `ANTHROPIC_API_KEY` — must be populated in `.env` before any Claude call executes (unit tests can mock the anthropic client)

**Note on testing without API keys:** Unit tests for `queries.js` and `scorer.js` can mock the Anthropic client using the same pattern as youtube.test.js mocks `global.fetch`. The anthropic client instance is module-level — tests can require the module with a mock client injected or stub the `callClaude` function.

[VERIFIED: environment probed via shell commands 2026-04-06]

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node:test` (v22.22.0) |
| Config file | None — invoked via npm test script |
| Quick run command | `node --test --test-concurrency=1 tests/unit/scorer.test.js tests/unit/queries.test.js` |
| Full suite command | `npm test` (runs all tests/unit/*.test.js serially) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PIPE-01 | `req.query.subject` + `req.query.skill_level` flow into courseStreamHandler | integration | `node --test --test-concurrency=1 tests/unit/server.test.js` | ✅ (extend existing) |
| PIPE-02 | generateQueries returns array of 6–8 distinct strings | unit | `node --test --test-concurrency=1 tests/unit/queries.test.js` | ❌ Wave 0 |
| PIPE-02 | "beginner" and "advanced" queries are demonstrably different | unit | `node --test --test-concurrency=1 tests/unit/queries.test.js` | ❌ Wave 0 |
| SCOR-01 | scoreVideos returns numeric score 0–100 per video | unit | `node --test --test-concurrency=1 tests/unit/scorer.test.js` | ❌ Wave 0 |
| SCOR-02 | advanced weights deprioritize recency vs beginner | unit | `node --test --test-concurrency=1 tests/unit/scorer.test.js` | ❌ Wave 0 |
| SCOR-03 | credibility prompt includes calibration anchors | unit | inspect prompt string in scorer.test.js | ❌ Wave 0 |
| SCOR-04 | exactly one Claude call for all channels in candidate set | unit | mock `callClaude`, assert call count === 1 | ❌ Wave 0 |
| SCOR-05 | description quality rated 0–10 | unit | mock Claude, assert descScore in [0,10] | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `node --test --test-concurrency=1 tests/unit/scorer.test.js tests/unit/queries.test.js`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/unit/scorer.test.js` — covers SCOR-01, SCOR-02, SCOR-03, SCOR-04, SCOR-05
- [ ] `tests/unit/queries.test.js` — covers PIPE-02

*(Existing tests/unit/server.test.js and tests/unit/sse.test.js will need extension for PIPE-01 integration but the files already exist.)*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | N/A (single-user tool, no auth layer) |
| V3 Session Management | No | N/A |
| V4 Access Control | No | N/A |
| V5 Input Validation | Yes | `subject` and `skill_level` from query params must be validated before use in prompts |
| V6 Cryptography | No | MD5 used only for cache keying, not security |

### Input Validation for Prompt Injection

`subject` and `skill_level` are passed directly into Claude prompts. A malicious user could submit a `subject` like `"ignore previous instructions and..."`.

**Mitigation for a personal tool:** At minimum, validate `skill_level` against an allowlist (`['beginner', 'intermediate', 'advanced', 'all levels']`) and enforce a max length on `subject` (e.g., 200 chars). The CONTEXT.md does not call for full prompt injection hardening — this is a personal tool. But basic guards are appropriate.

```javascript
const VALID_LEVELS = new Set(['beginner', 'intermediate', 'advanced', 'all levels']);
if (!VALID_LEVELS.has(req.query.skill_level)) {
  return res.status(400).json({ error: 'Invalid skill_level' });
}
if (!req.query.subject || req.query.subject.length > 200) {
  return res.status(400).json({ error: 'subject required, max 200 chars' });
}
```

[ASSUMED — personal tool; no explicit security requirement in REQUIREMENTS.md; basic input validation is standard practice]

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 4% like ratio as the "excellent" threshold for educational content | Code Examples (scoreLikeRatio) | Scores skew too high (all videos near 40pts) or too low (all near 0pts); fixable via offline calibration test |
| A2 | Prompt wording for generateQueries (specific text) | Code Examples | Claude returns wrong shape (object instead of array) or redundant queries; fixable by prompt iteration |
| A3 | Prompt wording for buildCredibilityPrompt (specific text, calibration anchor numbers) | Code Examples | Scores cluster; fixable by prompt iteration and anchor tuning |
| A4 | Channel credibility keyed by channel name in prompt output | Common Pitfalls | Score lookup fails (all channels get 0 credibility); fixable by changing prompt key scheme |
| A5 | `claude-haiku-4-5-20251001` produces adequate query diversity | Model Selection | May need upgrade to Sonnet; no impact on architecture, only on model ID string |
| A6 | `scoreVideos` returning `scoreBreakdown` field | Code Examples | Planner may want a different shape; zero risk to correctness |

---

## Open Questions

1. **Description quality: batch with credibility or separate call?**
   - What we know: D-13 locks channel credibility to one batch call; description quality has no equivalent constraint
   - What's unclear: Whether combining them (Option A) or separating them (Option B) is preferred
   - Recommendation: Planner decides; document choice in PLAN.md. Option A (combined) reduces API calls for a personal tool. Option B (separate) keeps prompts simpler and easier to test.

2. **Score calibration benchmark**
   - What we know: STATE.md explicitly flags this — "plan offline histogram test against cached Phase 1 data before Claude integration"
   - What's unclear: No Phase 1 cache data exists on this machine (`.cache/` is empty), so offline testing requires at minimum running a real YouTube search first
   - Recommendation: The plan must include a task for running a real search, populating cache, then running the scorer offline and inspecting the distribution before wiring SSE events. This is not a blocker but should be its own plan step.

3. **Anthropic client placement — module-level vs. factory function**
   - What we know: `new Anthropic()` reads `ANTHROPIC_API_KEY` at instantiation; module-level instantiation fails if the key isn't set when `require('./scorer')` runs in tests
   - What's unclear: Whether tests need to set `process.env.ANTHROPIC_API_KEY` before requiring scorer.js, or if a lazy getter is preferable
   - Recommendation: Set `process.env.ANTHROPIC_API_KEY = 'test-key'` before requiring the module in test files (same pattern as `youtube.test.js` sets `YOUTUBE_API_KEY`). Module-level instantiation is fine.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| YouTube dislike count in like ratio | `likeCount / viewCount` only | Dec 2021 (YouTube removed dislikes) | Can't compute true like/dislike ratio; like-to-view ratio is the accepted alternative |
| `claude-3-haiku-20240307` | `claude-haiku-4-5-20251001` | 2025 release; haiku-3 deprecated Apr 19, 2026 | claude-3-haiku-20240307 will stop working in two weeks; use haiku-4-5 from the start |

**Deprecated:**
- `claude-3-haiku-20240307`: Officially deprecated, retires **April 19, 2026** — 13 days from research date. Do not use. [VERIFIED: platform.claude.com/docs/en/about-claude/models/overview]

---

## Sources

### Primary (HIGH confidence)
- `platform.claude.com/docs/en/api/client-sdks` — SDK installation pattern, messages.create signature, CommonJS require
- `platform.claude.com/docs/en/about-claude/models/overview` — Model IDs, pricing, deprecation dates
- npm registry (`npm view @anthropic-ai/sdk`) — version 0.82.0, published 2026-04-01
- Existing codebase (`claude.js`, `sse.js`, `youtube.js`, `cache.js`, `server.js`) — integration patterns, test conventions

### Secondary (MEDIUM confidence)
- CONTEXT.md decisions D-01 through D-13 — locked decisions from user discussion
- STATE.md accumulated decisions — prior architectural choices
- REQUIREMENTS.md — PIPE-01, PIPE-02, SCOR-01–05

### Tertiary (LOW confidence)
- 4% like ratio threshold for educational content — no published benchmark; reasonable estimate
- Prompt wording templates — functional but require offline iteration against real data

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — SDK version verified via npm registry; CommonJS pattern verified via official docs
- Architecture: HIGH — integration points confirmed from codebase; scoring formula math verified
- Scoring weight values: MEDIUM — directional strategy locked in CONTEXT.md; exact numbers are discretionary
- Prompt templates: LOW — structure is correct; exact wording requires offline calibration
- Pitfalls: HIGH — statistics-as-strings and missing fields are verified YouTube API behaviors

**Research date:** 2026-04-06
**Valid until:** 2026-05-06 (model list changes frequently; verify deprecation dates before execution)
