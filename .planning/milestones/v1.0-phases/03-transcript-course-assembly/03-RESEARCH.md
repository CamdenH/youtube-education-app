# Phase 3 Research: Transcript + Course Assembly

**Researched:** 2026-04-08
**Domain:** Claude API assembly, transcript fetching, SSE pipeline wiring
**Confidence:** HIGH — all findings read directly from project source files

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: Single Claude call — all 12 transcripts + full assembly instructions sent in one prompt
- D-02: New file `assembler.js` at project root — houses `buildAssemblyPrompt` and `assembleCourse(videos, transcripts, subject, skillLevel)`
- D-03: TOO_FEW_VIDEOS gate at <5 videos; emit `course_assembled` with error shape, no `course` key
- D-04: Pure Claude judgment for outdated flags — no hardcoded age thresholds
- D-05: `fetchTranscript(videoId)` in `transcript.js` is ready to use as-is
- D-06: Videos where `fetchTranscript` returns `null` are excluded before the Claude call
- D-07: Transcripts passed to Claude untruncated
- D-08: Step 4 SSE event = `transcripts_fetched`; fires after parallel fetch, reports count fetched vs. skipped
- D-09: Step 5 SSE event = `course_assembled`; fires after `assembleCourse` resolves
- D-10: `assembler.js` is the only new file; no other reorganization

### Claude's Discretion
- Exact assembly prompt wording and structure
- How Claude calculates and formats `totalWatchTime`
- Exact module count (3–4; Claude decides)
- Whether to use system prompt + user message or single user message
- Description-fallback question quality caveat handling

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TRAN-01 | Transcripts fetched via YouTube timedtext endpoint for top 12 scored videos | `fetchTranscript` exists in `transcript.js`; call `Promise.all` over `scoredVideos.slice(0, 12)` |
| TRAN-02 | Video description used as fallback when transcript unavailable | Already implemented inside `fetchTranscript` via `transcriptHandler`; the `fetchTranscript` function itself does NOT do the description fallback — see §1.2 below |
| TRAN-03 | Videos with neither transcript nor description are skipped entirely | Filter out null results before passing to `assembleCourse` |
| CURA-01 | Top 12 scored videos + transcripts sent to Claude for course assembly | Single `callClaude` call in `assembler.js` using established pattern from `scorer.js` |
| CURA-02 | Fewer than 5 surviving videos → friendly error, not a crash | TOO_FEW_VIDEOS gate in `assembleCourse` before the Claude call |
| CURA-03 | Remaining videos organized into 3–4 thematic modules, ordered by learning progression | Prompt instruction to Claude |
| CURA-04 | Each module has title, 2–3 sentence description, connecting question | Specified in course JSON contract; Claude generates these |
| CURA-05 | Each video has 1–2 sentence "why this video" rationale | `blurb` field in course JSON contract; Claude generates |
| CURA-06 | Videos with stale content flagged with outdated warning | `outdated` boolean in course JSON contract; Claude judges from transcript content |
| CURA-07 | Course includes overview, estimated total watch time, prerequisite list | `overview`, `totalWatchTime`, `prerequisites` in course JSON contract |
| QUES-01 | 3 comprehension questions per video: recall, conceptual, application | `questions` array in course JSON contract; Claude generates |
| QUES-02 | Questions transcript-grounded; description-fallback questions acceptable | Prompt instruction; Claude's discretion on quality notation |
| QUES-03 | 1 connecting question per module | `connectingQuestion` in course JSON contract; Claude generates |
</phase_requirements>

---

## 1. Existing Code Audit

### 1.1 sse.js — courseStreamHandler

Steps 4 and 5 are currently stubs (lines 113–128):

```javascript
// Steps 4–5: Stubs (Phase 3 will replace these)
sendEvent(res, 'transcripts_fetched', {
  step: 4,
  total: 5,
  message: 'Transcript fetching coming in Phase 3',
});

sendEvent(res, 'course_assembled', {
  step: 5,
  total: 5,
  message: 'Course ready (stub — Phase 3)',
  course: { title: subject, overview: '', modules: [] },
});

clearInterval(heartbeatInterval);
res.end();
```

**Variables in scope at the point where steps 4–5 execute:**
- `subject` — string, from `req.query.subject`
- `skillLevel` — string, from `req.query.skill_level`
- `scoredVideos` — array returned by `scoreVideos(videos, skillLevel)`; sorted descending by score
- `heartbeatInterval` — the setInterval ID (must be cleared before `res.end()`)
- `res` — Express response object with `write` / `end` methods

The full `require` block at the top of `sse.js`:
```javascript
const { generateQueries } = require('./queries');
const { searchVideos, fetchVideoStats } = require('./youtube');
const { scoreVideos } = require('./scorer');
```

Phase 3 must add: `const { assembleCourse } = require('./assembler');` and `const { fetchTranscript } = require('./transcript');`.

### 1.2 transcript.js — fetchTranscript

**Signature:**
```javascript
async function fetchTranscript(videoId)
// Returns: Promise<{ source: 'captions', text: string } | null>
```

**Behavior:**
- Cache-first: reads `transcript_{videoId}.json` via `cacheGet`
- Fetches `https://www.youtube.com/api/timedtext?v={videoId}&lang=en&fmt=srv3`
- Parses timedtext XML to plain text via `parseTimedtextXml`
- Returns `{ source: 'captions', text }` if parsed text length > 50 chars
- Returns `null` on fetch failure, empty response, or text < 50 chars
- Writes cache on successful fetch

**Critical note on TRAN-02:** The description fallback is implemented in `transcriptHandler` (the HTTP route handler), NOT inside `fetchTranscript`. When `sse.js` calls `fetchTranscript` directly, it will only get captions or null — it will NOT automatically fall back to video description. To satisfy TRAN-02, `assembleCourse` must either: (a) have its caller pass description text explicitly when `fetchTranscript` returns null, or (b) `sse.js` must construct a fallback from `video.snippet.description` when `fetchTranscript` returns null.

**The scored video objects already have `snippet.description`** — so the assembler's caller in `sse.js` can check: if `fetchTranscript` returns null but `video.snippet.description` is non-empty (>50 chars), use `{ source: 'description', text: video.snippet.description }` as the transcript. This matches the logic in `transcriptHandler` exactly.

### 1.3 claude.js — callClaude / parseClaudeJSON

**callClaude signature:**
```javascript
async function callClaude(fn, ...args)
// fn: async function to call (wraps anthropic.messages.create)
// args: positional args passed to fn (last arg may be { _testDelayBase } for tests)
// Returns: Promise<*> — whatever fn returns
// Throws: original error after 3 total attempts (1 + 2 retries)
```

Retry logic: up to 2 retries, exponential backoff starting at 1000ms. The retry wrapper calls `fn(...callArgs)` — the caller provides the full lambda that creates the Anthropic message.

**parseClaudeJSON signature:**
```javascript
function parseClaudeJSON(text)
// text: raw string from Claude (may have ```json ... ``` fences)
// Returns: parsed JavaScript object
// Throws: SyntaxError if not valid JSON after fence stripping
```

Strips both ` ```json ` and ` ``` ` opening/closing fences before `JSON.parse`.

### 1.4 scorer.js — scoreVideos output shape

`scoreVideos` uses `{ ...video, score, scoreBreakdown }` spread — meaning the output objects contain all original YouTube API fields plus two additions.

**Full shape of a scored video object:**
```javascript
{
  // --- YouTube API fields (from fetchVideoStats) ---
  id: string,                        // video ID (e.g. "dQw4w9WgXcQ")
  snippet: {
    channelTitle: string,
    publishedAt: string,             // ISO 8601
    description: string,
    title: string,                   // confirmed present in sse.test.js STUB_VIDEO
  },
  statistics: {
    likeCount: string,               // YouTube returns strings
    viewCount: string,
  },
  contentDetails: {
    duration: string,                // ISO 8601 (e.g. "PT20M")
  },

  // --- Added by scoreVideos ---
  score: number,                     // 0–100 integer
  scoreBreakdown: {
    likeRatioScore: number,
    durationScore: number,
    recencyScore: number,
    credScore: number,
    descScore: number,
  },
}
```

**Note:** `durationSeconds` is NOT a field on the scored video object — it must be computed in the assembler from `contentDetails.duration` using the same ISO 8601 parser pattern found in `scorer.js` (`parseDurationSeconds`). The CONTEXT.md course JSON contract requires `durationSeconds` as a number on each video — the assembler must derive it.

**`snippet.title` is confirmed present** — the sse.test.js `STUB_VIDEO` fixture includes it, and it appears in the CONTEXT.md course JSON contract.

### 1.5 queries.js — callClaude usage pattern

The established pattern (replicate this in `assembler.js`):

```javascript
const Anthropic = require('@anthropic-ai/sdk');
const { callClaude, parseClaudeJSON } = require('./claude');

const anthropic = new Anthropic(); // reads ANTHROPIC_API_KEY from process.env

async function myFunction(...) {
  const prompt = buildPrompt(...);

  const text = await callClaude(async () => {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });
    return response.content[0].text;
  });

  const parsed = parseClaudeJSON(text);
  // validate shape, throw on bad response
  return parsed;
}
```

**Model in use:** `claude-haiku-4-5-20251001` — used in both `queries.js` and `scorer.js`.

**Max tokens used so far:** 512 for query generation, 1024 for scoring. The assembly call with 12 transcripts will require a much larger `max_tokens` budget for the response (see §4).

### 1.6 cache.js — cacheGet / cacheSet

```javascript
function cacheGet(filename)
// filename: string e.g. "search_abc123.json"
// Returns: parsed object or null (synchronous, fs.existsSync + JSON.parse)

function cacheSet(filename, data)
// filename: string e.g. "transcript_abc123.json"
// data: JSON-serializable object
// Side effect: writes to .cache/{filename}, creates dir if needed
```

Cache is synchronous file I/O, `__dirname`-relative `.cache/` directory. Transcript results are already cached at key `transcript_{videoId}.json` by `fetchTranscript`. There is no existing cache key pattern for assembled course output — this is Claude's discretion per the locked decisions.

---

## 2. Test Infrastructure

### Framework and runner
- Node.js built-in test runner (`node:test`)
- Run: `node --test --test-concurrency=1 tests/unit/*.test.js`
- `--test-concurrency=1` enforces serial execution to prevent `.cache/` race conditions
- Test files live at `tests/unit/*.test.js`

### How callClaude is mocked (established pattern)

Both `queries.test.js` and `scorer.test.js` use the same require-cache injection technique:

```javascript
const CLAUDE_PATH = require.resolve('../../claude');
const MODULE_PATH = require.resolve('../../<module>');
const SDK_PATH    = require.resolve('@anthropic-ai/sdk');

function loadModuleWithMock(fakeCallClaude) {
  delete require.cache[MODULE_PATH];
  delete require.cache[CLAUDE_PATH];

  // Inject fake claude.js
  require.cache[CLAUDE_PATH] = {
    id: CLAUDE_PATH, filename: CLAUDE_PATH, loaded: true,
    exports: {
      callClaude: fakeCallClaude,
      parseClaudeJSON: require(CLAUDE_PATH).parseClaudeJSON, // keep real parser
    },
    children: [], paths: Module._nodeModulePaths(path.dirname(CLAUDE_PATH)),
    require: (id) => require(id),
  };

  // Inject fake @anthropic-ai/sdk so `new Anthropic()` doesn't blow up
  delete require.cache[SDK_PATH];
  const fakeAnthropic = function Anthropic() {};
  fakeAnthropic.prototype.messages = { create: async () => ({}) };
  require.cache[SDK_PATH] = {
    id: SDK_PATH, filename: SDK_PATH, loaded: true,
    exports: fakeAnthropic,
    children: [], paths: Module._nodeModulePaths(path.dirname(SDK_PATH)),
    require: (id) => require(id),
  };

  return require(MODULE_PATH);
}

function cleanup() {
  delete require.cache[MODULE_PATH];
  delete require.cache[CLAUDE_PATH];
  delete require.cache[SDK_PATH];
}
```

The mock `fakeCallClaude` receives the async lambda as its first argument and returns a raw JSON string (what the real Claude API returns before `parseClaudeJSON`). It does NOT call `fn()` — it bypasses the Anthropic SDK entirely.

### sse.test.js pattern (for testing the updated courseStreamHandler)

`sse.test.js` stubs dependencies by injecting into `require.cache` before `require('../../sse')`. The `scoreVideos` stub returns `videos.map(v => ({ ...v, score: 75, scoreBreakdown: {} }))`. Phase 3 tests will need to add stubs for `./transcript` (`fetchTranscript`) and `./assembler` (`assembleCourse`) using the same cache injection approach.

The test uses `makeMockRes()` (captures `write()` calls in `writes[]`) and `makeMockReq()` (captures event listeners). The `course_assembled` test asserts `payload.course.title` is truthy — Phase 3 must ensure the real `course_assembled` payload satisfies this.

---

## 3. Integration Contracts

### What scoredVideos looks like entering step 4

After `const scoredVideos = await scoreVideos(videos, skillLevel)` on line 105 of `sse.js`, the array is sorted descending by `score`. Each element has:

| Field | Type | Source |
|-------|------|--------|
| `id` | string | YouTube API |
| `snippet.title` | string | YouTube API |
| `snippet.channelTitle` | string | YouTube API |
| `snippet.publishedAt` | string (ISO 8601) | YouTube API |
| `snippet.description` | string | YouTube API |
| `statistics.likeCount` | string | YouTube API |
| `statistics.viewCount` | string | YouTube API |
| `contentDetails.duration` | string (ISO 8601) | YouTube API |
| `score` | number (0–100) | scoreVideos |
| `scoreBreakdown` | object | scoreVideos |

Step 4 receives `scoredVideos.slice(0, 12)`.

### Transcript data structure passed to assembleCourse

After filtering nulls, the `transcripts` argument to `assembleCourse` is a Map or parallel array relating a video to its transcript. The most natural representation (matching how `scorer.js` relates channels to videos) is an object keyed by `videoId`:

```javascript
// e.g. { "abc123": { source: "captions", text: "..." }, ... }
```

This is Claude's discretion for the internal signature, but the type must be deterministic for test mocking.

### Course JSON output contract

Claude is responsible for returning a JSON object matching this exact shape (from CONTEXT.md):

```json
{
  "title": "...",
  "overview": "...",
  "totalWatchTime": "Xh Ym",
  "prerequisites": ["..."],
  "modules": [
    {
      "title": "...",
      "description": "...",
      "connectingQuestion": "...",
      "videos": [
        {
          "videoId": "...",
          "blurb": "...",
          "outdated": false,
          "questions": [
            { "type": "recall", "text": "..." },
            { "type": "conceptual", "text": "..." },
            { "type": "application", "text": "..." }
          ]
        }
      ]
    }
  ]
}
```

The assembler merges the Claude output with the scored video data to add `title`, `channelTitle`, `thumbnail`, `url`, `durationSeconds`, and `score` — fields Claude does not generate. This merge step happens in `assembler.js` after `parseClaudeJSON`.

**Thumbnail and URL patterns (from CONTEXT.md §Specifics):**
- Thumbnail: `https://i.ytimg.com/vi/{videoId}/mqdefault.jpg`
- URL: `https://www.youtube.com/watch?v={videoId}`

---

## 4. Token Budget Analysis

### Transcript lengths

No hardcoded transcript length limits exist anywhere in the codebase. `fetchTranscript` applies only a minimum (50 chars) — there is no upper cap. `parseTimedtextXml` normalizes whitespace but does not truncate.

**Realistic estimates (training knowledge, not verified in this session):**
- A 20-minute tutorial video: ~3,000–5,000 words ≈ 4,000–6,000 tokens
- A 60-minute lecture: ~8,000–12,000 words ≈ 10,000–16,000 tokens
- 12 videos at 20 min average: ~48,000–72,000 tokens of transcript content alone

**Claude claude-haiku-4-5 context window:** 200,000 tokens input [ASSUMED — not verified in this session against current Anthropic docs]. With 12 transcripts averaging 5,000 tokens each (60,000 tokens) plus prompt overhead, the single call should fit comfortably within the context window.

**max_tokens for response:** The course JSON response will be larger than the 1024 tokens used in scorer.js. A course with 12 videos, 3 questions each, 3–4 modules, blurbs, and descriptions could easily reach 3,000–5,000 tokens of JSON. The assembler should use `max_tokens: 8192` to avoid truncated JSON [ASSUMED — should verify against current Anthropic API docs for haiku's output token limit].

**D-07 decision:** Transcripts are untruncated. No truncation code needs to be written.

---

## 5. Anthropic SDK Patterns

### Client instantiation (identical in queries.js and scorer.js)

```javascript
const Anthropic = require('@anthropic-ai/sdk');
const anthropic = new Anthropic(); // reads ANTHROPIC_API_KEY from process.env
```

Package version: `@anthropic-ai/sdk: ^0.82.0` (from package.json).

### Message format

```javascript
anthropic.messages.create({
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 1024,
  messages: [{ role: 'user', content: prompt }],
})
```

Single `user` message, no system prompt used in existing modules (queries.js and scorer.js both use this single-message format). The CONTEXT.md leaves the system prompt vs. single message choice to Claude's discretion for the assembly call.

### Response access

```javascript
response.content[0].text
```

### Wrapped in callClaude

The lambda passed to `callClaude` must return the text string (not the whole response object), because `parseClaudeJSON` operates on the string:

```javascript
const text = await callClaude(async () => {
  const response = await anthropic.messages.create({ ... });
  return response.content[0].text;
});
const parsed = parseClaudeJSON(text);
```

---

## 6. Plan Structure Recommendation

Phase 3 has two deliverables: `assembler.js` (new file) and updated `sse.js` (replace stubs). A test file `tests/unit/assembler.test.js` is also needed.

### Recommended wave breakdown

**Wave 1 — assembler.js core (no SSE wiring yet)**

1. Create `assembler.js` with:
   - `'use strict'` header
   - `require` block: Anthropic SDK, callClaude, parseClaudeJSON
   - `anthropic = new Anthropic()` at module top
   - Private `parseDurationSeconds(iso)` — copy from scorer.js (needed to compute `durationSeconds` for the output contract)
   - Private `buildAssemblyPrompt(videos, transcripts, subject, skillLevel)` — constructs the single large prompt
   - Private `mergeClaudeOutput(claudeCourse, videos)` — merges Claude's JSON with scored video fields (title, channelTitle, thumbnail, url, durationSeconds, score)
   - Exported `assembleCourse(videos, transcripts, subject, skillLevel)` — orchestrates: TOO_FEW_VIDEOS gate → callClaude → parseClaudeJSON → merge → return course object

2. Create `tests/unit/assembler.test.js` covering:
   - `assembleCourse` returns TOO_FEW_VIDEOS error shape when `videos.length < 5`
   - `assembleCourse` calls `callClaude` exactly once
   - Merged video fields (`thumbnail`, `url`, `durationSeconds`, `score`) are correct
   - `parseClaudeJSON` is called on Claude's output (shape validation)
   - Prompt contains subject and skill level

**Wave 2 — sse.js step 4 and step 5 wiring**

1. Add `require` lines at top of `sse.js` for `fetchTranscript` and `assembleCourse`
2. Replace step 4 stub:
   - `Promise.all` over `scoredVideos.slice(0, 12).map(v => fetchTranscript(v.id))`
   - Build per-video transcript map (videoId → transcript result or description fallback)
   - Emit `transcripts_fetched` with count of fetched vs. skipped
3. Replace step 5 stub:
   - Call `assembleCourse(videosWithTranscripts, transcriptMap, subject, skillLevel)`
   - Handle TOO_FEW_VIDEOS return (emit error shape, still call `res.end()`)
   - Emit `course_assembled` with full course object

3. Update `tests/unit/sse.test.js`:
   - Add stub for `./transcript` (fetchTranscript) in require.cache injection block
   - Add stub for `./assembler` (assembleCourse) in require.cache injection block
   - Update existing tests that assert `course_assembled` payload shape (the stub assembler should return a minimal valid course object)

### Key implementation details to lock down in the plan

- The description fallback gap (§1.2): `sse.js` must check `video.snippet.description` when `fetchTranscript` returns null, not rely on `transcriptHandler`
- `durationSeconds` must be computed in the assembler's merge step, not expected from the scored video object
- The `transcripts` parameter shape for `assembleCourse` (Map vs. plain object vs. parallel array) — recommend plain object `{ [videoId]: { source, text } }` keyed by video ID, matching the `credMap`/`descMap` pattern in scorer.js
- `max_tokens` for the assembly Claude call should be set significantly higher than 1024

---

## 7. Validation Architecture

### Test framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node:test` |
| Config file | None — invoked via `package.json` scripts |
| Quick run command | `node --test --test-concurrency=1 tests/unit/assembler.test.js` |
| Full suite command | `node --test --test-concurrency=1 tests/unit/*.test.js` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TRAN-01 | fetchTranscript called for top 12 scored videos | unit | `node --test --test-concurrency=1 tests/unit/sse.test.js` | Wave 2 |
| TRAN-02 | Description fallback used when fetchTranscript returns null | unit | `node --test --test-concurrency=1 tests/unit/sse.test.js` | Wave 2 |
| TRAN-03 | Videos with null transcript + no description are excluded | unit | `node --test --test-concurrency=1 tests/unit/sse.test.js` | Wave 2 |
| CURA-01 | assembleCourse called with top 12 videos + transcripts | unit | `node --test --test-concurrency=1 tests/unit/assembler.test.js` | Wave 1 |
| CURA-02 | TOO_FEW_VIDEOS gate fires when < 5 videos | unit | `node --test --test-concurrency=1 tests/unit/assembler.test.js` | Wave 1 |
| CURA-03 | Modules array has 3–4 entries | unit | `node --test --test-concurrency=1 tests/unit/assembler.test.js` | Wave 1 |
| CURA-04 | Each module has title, description, connectingQuestion | unit | `node --test --test-concurrency=1 tests/unit/assembler.test.js` | Wave 1 |
| CURA-05 | Each video has non-empty blurb | unit | `node --test --test-concurrency=1 tests/unit/assembler.test.js` | Wave 1 |
| CURA-06 | outdated field is boolean on each video | unit | `node --test --test-concurrency=1 tests/unit/assembler.test.js` | Wave 1 |
| CURA-07 | Course has overview, totalWatchTime, prerequisites | unit | `node --test --test-concurrency=1 tests/unit/assembler.test.js` | Wave 1 |
| QUES-01 | Each video has 3 questions: recall, conceptual, application | unit | `node --test --test-concurrency=1 tests/unit/assembler.test.js` | Wave 1 |
| QUES-02 | Questions come from transcript content (prompt test) | unit (source text) | `node --test --test-concurrency=1 tests/unit/assembler.test.js` | Wave 1 |
| QUES-03 | Each module has connectingQuestion | unit | `node --test --test-concurrency=1 tests/unit/assembler.test.js` | Wave 1 |

### Wave 0 Gaps

None — existing test infrastructure covers Phase 3. No new framework, config, or fixture files needed. `assembler.test.js` is a Wave 1 deliverable, not a prerequisite.

---

## 8. Security Domain

Input entering the Claude assembly prompt: `subject` (user-supplied string) and `skillLevel` (validated enum by `server.js` before `courseStreamHandler` is called). Transcript text is fetched from YouTube's timedtext API — external content, not user input. No SQL, no shell execution, no file writes based on user input. The existing validation in `server.js` covers PIPE-01 input validation; no new attack surface is introduced by Phase 3.

ASVS V5 (Input Validation): The subject string is embedded directly in the Claude prompt. Prompt injection is a theoretical risk but is out of scope for a single-user personal tool — the only "attacker" is the tool's own user.

---

## Sources

All findings in this document were read directly from the following project files. No web searches were performed — all claims are VERIFIED from source code unless tagged [ASSUMED].

| File | What was read |
|------|--------------|
| `sse.js` | Full file — steps 4/5 stub code, variables in scope, require block |
| `transcript.js` | Full file — fetchTranscript signature, return shape, caching behavior |
| `claude.js` | Full file — callClaude and parseClaudeJSON signatures |
| `scorer.js` | Full file — scoreVideos output shape, Anthropic client pattern, model name |
| `queries.js` | Full file — callClaude usage pattern, model name, max_tokens |
| `cache.js` | Full file — cacheGet/cacheSet signatures |
| `tests/unit/scorer.test.js` | Full file — mock injection pattern, STUB_VIDEO shape |
| `tests/unit/queries.test.js` | Full file — mock injection pattern, cleanup pattern |
| `tests/unit/sse.test.js` | Full file — courseStreamHandler test patterns, mock res/req shape |
| `tests/unit/transcript.test.js` | Full file — fetchTranscript test patterns |
| `.planning/phases/03-transcript-course-assembly/03-CONTEXT.md` | Full file — locked decisions, course JSON contract |
| `.planning/REQUIREMENTS.md` | Full file — TRAN/CURA/QUES requirement text |
| `package.json` | Test runner config, SDK version |
| `.planning/config.json` | nyquist_validation enabled |

**[ASSUMED] items:**
- Claude claude-haiku-4-5 context window is 200,000 tokens (not verified against current Anthropic docs in this session)
- `max_tokens: 8192` recommendation for assembly response (not verified against current haiku output limits)
