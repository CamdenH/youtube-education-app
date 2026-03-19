# Phase 1: Foundation - Research

**Researched:** 2026-03-19
**Domain:** Node.js + Express server, SSE streaming, YouTube Data API v3, file-based dev caching, transcript fetching
**Confidence:** HIGH (stack is locked; all major decisions already made in CONTEXT.md)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**SSE Event Contract**
- Named verb-noun events: `query_generated`, `videos_fetched`, `scored`, `transcripts_fetched`, `course_assembled`
- Payload shape: `{ step: N, total: 5, message: "..." }` — step and total for progress, message for UI display
- Terminal events: `course_assembled` (success) and `error` (failure) — frontend closes EventSource on either
- `course_assembled` payload carries the full course JSON inline: `{ course: { title, overview, modules: [...] } }` — no follow-up request needed
- `error` payload: `{ code: "QUOTA_EXCEEDED"|"...", message: "user-readable string" }`
- Heartbeat: SSE comment line (`: heartbeat\n\n`) every 15 seconds — invisible to `addEventListener`, keeps proxies alive
- Phase 1 stub behavior: emit all 5 real named events with hardcoded realistic stub data and small delays between them so Phase 4 frontend can be built and tested against the full event sequence immediately

**Dev Cache Design**
- Cache key: MD5 hash of the query string — `crypto.createHash('md5').update(query).digest('hex')`
- Separate cache files by data type (not one bundle per query):
  - Search results: `.cache/search_{hash}.json` (keyed by query hash)
  - Video stats: `.cache/video_{videoId}.json` (keyed by YouTube videoId)
  - Transcripts: `.cache/transcript_{videoId}.json` (keyed by YouTube videoId)
- No TTL — cache files persist indefinitely; clear with `rm -rf .cache/` when fresh data is needed
- `.cache/` added to `.gitignore` alongside `.env`

**Server File Structure**
- Thin `server.js` entry point (~50 lines): Express app setup, route registration, `app.listen()`
- Logic split into flat module files at project root (not in a subfolder):
  - `youtube.js` — YouTube Data API v3 search + video stats fetch
  - `cache.js` — read/write `.cache/` logic
  - `sse.js` — SSE send-event helper, heartbeat setup
  - `transcript.js` — timedtext fetch + fallback + XML parsing
- All files flat at root alongside `package.json`, `index.html`, `.env.example`

**Transcript Endpoint Format**
- `GET /api/transcript/:videoId` returns plain concatenated text (no timestamps):
  ```json
  { "videoId": "dQw4w9WgXcQ", "source": "captions", "text": "Full transcript text..." }
  ```
- `source` field: `"captions"` if from timedtext, `"description"` if fallback
- When neither transcript nor description available: HTTP 404 with structured error:
  ```json
  { "error": "NO_TRANSCRIPT", "videoId": "dQw4w9WgXcQ", "message": "No transcript or description available" }
  ```
- Phase 3 calling code checks HTTP status to decide whether to skip the video

**Tech Stack — npm Packages**
- YouTube API: raw `fetch()` calls to `https://www.googleapis.com/youtube/v3` with `key=` query param — no `googleapis` package
- Phase 1 `package.json` dependencies: `express ^4.18`, `dotenv ^16` only
- `@anthropic-ai/sdk` added in Phase 2 (when Claude calls are needed)
- Timedtext XML parsed with regex/string stripping — no `xml2js` or XML library:
  - Strip all tags with `/<[^>]+>/g`
  - Decode HTML entities (`&amp;`, `&lt;`, `&gt;`, `&quot;`, `&#39;`)
  - Collapse whitespace and trim

### Claude's Discretion
- Exact retry implementation for INFR-02 (max 2 retries, exponential backoff — structure is clear from requirements)
- Claude JSON validation/stripping approach for INFR-03 (strip markdown code fences, parse, retry on failure)
- Exact index.html stub for Phase 1 (minimal placeholder that verifies SSE connection, not final UI)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFR-01 | Node.js + Express server (server.js) serves static index.html and API routes; API keys loaded from .env via dotenv | Express 4.x static middleware + dotenv 16.x confirmed current |
| INFR-02 | Claude API calls include retry logic (max 2 retries) with exponential backoff | Not applicable to Phase 1 (Claude added Phase 2); pattern documented for awareness |
| INFR-03 | Claude JSON responses stripped and validated before use; malformed responses trigger a retry | Not applicable to Phase 1; pattern documented for awareness |
| INFR-04 | YouTube API quota errors surface as a friendly user-facing message (not a raw 403) | HTTP 403 response check from fetch() + SSE error event pattern confirmed |
| INFR-05 | SSE connection sends a heartbeat comment every 15 seconds; frontend closes EventSource on terminal events | Comment heartbeat `\`: heartbeat\n\n\`` confirmed correct SSE protocol; setInterval + req.on('close') cleanup confirmed |
| INFR-06 | .env.example and README.md with setup instructions | Static file creation task, no library research needed |
| PIPE-03 | YouTube Data API v3 search called per query (type: video, maxResults: 8, videoDuration: medium/long, relevanceLanguage: en, safeSearch: strict) | search.list endpoint confirmed, quota cost 100 units per call, all filter params verified |
| PIPE-04 | Full video stats fetched for each result (snippet, statistics, contentDetails, topicDetails) | videos.list endpoint confirmed, quota cost 1 unit per call, batch by comma-separated IDs confirmed |
| PIPE-05 | Dev caching layer (file-based) prevents quota exhaustion during development | Node.js built-in crypto + fs confirmed sufficient; no external library needed |
| PIPE-06 | GET /api/course-stream SSE endpoint streams named progress events to frontend | SSE headers + named event format confirmed; comment heartbeat confirmed |
| PIPE-07 | GET /api/transcript/:videoId returns raw transcript for a given video | Timedtext endpoint approach documented with CRITICAL reliability caveat |
</phase_requirements>

---

## Summary

Phase 1 builds the server scaffolding that all subsequent phases run on. The stack is fully locked: Express 4.x (not 5), dotenv 16, raw fetch() for YouTube, and no external XML library. The decisions in CONTEXT.md are precise and correct — this research primarily validates them, surfacing one significant risk and two implementation details requiring care.

**The single highest-risk item is the transcript endpoint.** YouTube's timedtext/captions system has undergone active changes in 2025. The classic `https://www.youtube.com/api/timedtext?v=VIDEO_ID&lang=en` URL now reportedly requires POT (Proof of Origin Token) parameters for some videos, returning empty responses without them. The approach locked in CONTEXT.md (direct timedtext fetch + description fallback) is the right minimum-viable starting point, but the implementation must handle empty/error responses gracefully. The STATE.md already flags: "manually verify response shape for 10-20 educational videos before building transcript pipeline." This flag should be treated as a hard prerequisite, not optional.

**Express version selection matters.** npm's default `npm install express` now installs Express 5.2.1. The CONTEXT.md locks `express ^4.18` — this must be specified explicitly in package.json to avoid accidentally getting v5, which has breaking changes in routing syntax, res.send(), and static file dotfiles behavior.

**Primary recommendation:** Implement the five files in dependency order (cache.js → youtube.js → sse.js → transcript.js → server.js), with the stub SSE pipeline in server.js emitting all five events so the Phase 4 frontend has a working target immediately.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| express | ^4.18 (4.22.1 current) | HTTP server, routing, static file serving | Locked in CONTEXT.md; v4 chosen over v5 due to simpler API and no breaking changes |
| dotenv | ^16 (17.3.1 current) | Load .env file into process.env at startup | De facto standard for Node.js env config; explicit version lock per CONTEXT.md |

> **Version note:** `npm install express` currently installs **5.2.1**. You MUST write `"express": "^4.18"` in package.json explicitly. Express 5 has breaking changes: optional param syntax changed (`:name?` → `{/:name}`), `req.param()` removed, static dotfiles default changed. Express 4.22.1 is the current v4 release.

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node:crypto (built-in) | Node 22.x | MD5 hashing for cache keys | Built-in, zero install cost; MD5 is appropriate for cache keys (not security) |
| node:fs (built-in) | Node 22.x | Reading and writing .cache/ files | Built-in |
| node:path (built-in) | Node 22.x | Constructing .cache/ file paths | Built-in |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| express ^4.18 | express ^5 | v5 auto-handles async errors which is nice, but breaking changes in routing syntax break this project's simple patterns; v4 is stable and sufficient |
| raw fetch() for YouTube | googleapis npm package | googleapis is large (multiple MB), adds a dependency, requires OAuth setup even for public API key; raw fetch is 20 lines per call |
| node:crypto MD5 | uuid or nanoid | MD5 of query string gives stable, reproducible, human-debuggable cache filenames; uuid is random and untraceable |

**Installation:**
```bash
npm init -y
npm install express@4 dotenv
```

**Version verification (confirmed 2026-03-19):**
- `express`: 4.22.1 (latest v4), 5.2.1 (latest overall — do NOT use)
- `dotenv`: 17.3.1 (latest)

---

## Architecture Patterns

### Recommended Project Structure
```
project-root/
├── server.js          # Entry point: app setup, route registration, app.listen()
├── youtube.js         # YouTube Data API v3: searchVideos(), fetchVideoStats()
├── cache.js           # File cache: cacheGet(key), cacheSet(key, data)
├── sse.js             # SSE helpers: sendEvent(res, event, data), startHeartbeat(res), stopHeartbeat()
├── transcript.js      # Transcript fetch: fetchTranscript(videoId), fallbackToDescription(videoStats)
├── index.html         # Minimal stub: EventSource test, not final UI
├── package.json
├── .env               # YOUTUBE_API_KEY=... (gitignored)
├── .env.example       # YOUTUBE_API_KEY=your_key_here
├── .gitignore         # .env, .cache/, node_modules/
└── .cache/            # Auto-created; gitignored
    ├── search_{hash}.json
    ├── video_{videoId}.json
    └── transcript_{videoId}.json
```

### Pattern 1: SSE Named Events with Comment Heartbeat

**What:** Express route holds the response open, writes named SSE events using `res.write()`, sends a comment-format heartbeat on a timer, and cleans up on client disconnect.

**When to use:** Any streaming endpoint where the client needs progress updates without polling.

**Correct SSE headers (all four required):**
```javascript
// Source: https://masteringjs.io/tutorials/express/server-sent-events
// Source: https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events

res.setHeader('Content-Type', 'text/event-stream');
res.setHeader('Cache-Control', 'no-cache');
res.setHeader('Connection', 'keep-alive');
res.setHeader('X-Accel-Buffering', 'no'); // Disables nginx buffering — critical for proxied deployments
res.flushHeaders(); // Send headers immediately before writing events
```

**Named event format (sse.js sendEvent helper):**
```javascript
// Named event format — client: addEventListener('videos_fetched', handler)
function sendEvent(res, eventName, data) {
  res.write(`event: ${eventName}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

// Comment heartbeat — invisible to addEventListener, keeps proxy connections alive
function sendHeartbeat(res) {
  res.write(': heartbeat\n\n');
}
```

**Heartbeat + cleanup pattern:**
```javascript
function startHeartbeat(res) {
  return setInterval(() => sendHeartbeat(res), 15000);
}

// In route handler:
const heartbeatInterval = startHeartbeat(res);
req.on('close', () => {
  clearInterval(heartbeatInterval);
});
```

**Why `\n\n` is mandatory:** The SSE spec requires two newlines to terminate an event. A single `\n` continues the current event field. Missing the second newline means the client never receives the event.

**Why comments (`: heartbeat\n\n`) not named events for heartbeat:** `addEventListener('heartbeat', ...)` would fire on named heartbeat events and potentially trigger unwanted logic. SSE comments (lines starting with `:`) are completely invisible to `addEventListener` — they only keep the TCP connection alive.

### Pattern 2: YouTube Data API v3 via Raw fetch()

**What:** Two-step fetch per search query: (1) search.list to get video IDs, (2) videos.list batch call for full stats.

**Quota arithmetic (10,000 units/day default):**
- `search.list`: **100 units** per call
- `videos.list`: **1 unit** per call (regardless of how many IDs are batched)
- PIPE-02 calls for 6-8 queries per course generation
- Cost per generation: 6-8 × 100 (search) + 1 (batch stats) = **601–801 units**
- Safe limit: ~12 course generations per day before quota exhaustion without caching

**search.list call:**
```javascript
// Source: https://developers.google.com/youtube/v3/docs/search/list
const params = new URLSearchParams({
  key: process.env.YOUTUBE_API_KEY,
  part: 'snippet',
  q: query,
  type: 'video',
  maxResults: '8',
  videoDuration: 'medium',   // 4–20 min; use 'long' for >20 min
  relevanceLanguage: 'en',
  safeSearch: 'strict',
  order: 'relevance'
});
const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
```

**videos.list batch call (1 unit for all IDs):**
```javascript
// Source: https://developers.google.com/youtube/v3/docs/videos/list
const ids = videoIds.join(','); // Comma-separated list
const params = new URLSearchParams({
  key: process.env.YOUTUBE_API_KEY,
  part: 'snippet,statistics,contentDetails,topicDetails',
  id: ids
});
const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`);
```

**Note on videoDuration filter:**
`medium` = 4–20 minutes, `long` = 20+ minutes. REQUIREMENTS.md says "duration: medium/long" — this means making two search calls per query (one medium, one long) OR accepting `any` and filtering by duration in the scoring stage. Given quota cost is 100 per search call, the scoring filter approach is more quota-efficient.

**403/quota error detection:**
```javascript
const data = await res.json();
if (!res.ok) {
  const reason = data?.error?.errors?.[0]?.reason;
  if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') {
    // Surface as SSE error event, not server crash
    sendEvent(res, 'error', { code: 'QUOTA_EXCEEDED', message: 'YouTube API quota exceeded. Try again tomorrow.' });
  }
}
```

### Pattern 3: File-Based Cache (cache.js)

**What:** Read-before-fetch, write-after-fetch pattern using synchronous-ish fs operations.

```javascript
// Source: Node.js built-in crypto + fs
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const CACHE_DIR = path.join(__dirname, '.cache');

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function queryHash(query) {
  return crypto.createHash('md5').update(query).digest('hex');
}

function cacheGet(filename) {
  const filepath = path.join(CACHE_DIR, filename);
  if (!fs.existsSync(filepath)) return null;
  return JSON.parse(fs.readFileSync(filepath, 'utf8'));
}

function cacheSet(filename, data) {
  ensureCacheDir();
  fs.writeFileSync(path.join(CACHE_DIR, filename), JSON.stringify(data, null, 2));
}
```

**File naming convention:**
- Search: `search_${queryHash(query)}.json`
- Video stats: `video_${videoId}.json`
- Transcript: `transcript_${videoId}.json`

### Pattern 4: Transcript Fetch (transcript.js)

**CRITICAL CAVEAT:** YouTube's timedtext endpoint reliability is degraded in 2025. The classic direct URL `https://www.youtube.com/api/timedtext?v=VIDEO_ID&lang=en` now requires POT (Proof of Origin Token) parameters for some videos, which is not feasible to generate server-side without browser automation. The approach locked in CONTEXT.md is still correct as a starting point — the key is graceful fallback handling.

**Recommended implementation approach:**

```javascript
// Step 1: Try timedtext endpoint (may return empty for some videos)
// Step 2: If empty/error → fall back to video description
// Step 3: If description also empty → return 404 NO_TRANSCRIPT

async function fetchTranscript(videoId) {
  // Try captions via timedtext
  const timedtextUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&fmt=srv3`;
  try {
    const res = await fetch(timedtextUrl);
    const xml = await res.text();
    if (xml && xml.trim().length > 0 && xml.includes('<')) {
      const text = parseTimedtextXml(xml);
      if (text.length > 50) { // sanity check: real transcript has more than 50 chars
        return { source: 'captions', text };
      }
    }
  } catch (e) {
    // Silent fallthrough to description
  }
  return null; // Caller handles fallback to description
}

function parseTimedtextXml(xml) {
  // Strip all XML/HTML tags
  let text = xml.replace(/<[^>]+>/g, ' ');
  // Decode HTML entities
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  // Collapse whitespace
  return text.replace(/\s+/g, ' ').trim();
}
```

**Why `fmt=srv3` over no fmt:** The `srv3` format returns an XML structure with `<p>` tags containing the text. Without a format parameter the response may be empty for auto-generated captions.

**Innertube API as advanced fallback (Phase 3 concern, not Phase 1):** A more reliable approach uses YouTube's internal Innertube API (`https://www.youtube.com/youtubei/v1/get_transcript`) with a two-step fetch (get params from `next?prettyPrint=false`, then call `get_transcript`). This is more complex and out of scope for Phase 1 — the stub transcript endpoint just needs to demonstrate the interface shape.

### Anti-Patterns to Avoid

- **Using `res.send()` or `res.end()` in SSE routes:** These terminate the connection. Use `res.write()` only.
- **Not calling `res.flushHeaders()`:** Without this, Express may buffer the headers until the first event, causing the client to hang waiting for the connection to open.
- **Forgetting `clearInterval` on `req.on('close')`:** Heartbeat timers will leak and keep trying to write to a closed socket.
- **Missing `X-Accel-Buffering: no`:** nginx (common in production/staging) buffers responses by default. Without this header, the client receives all events in one burst at the end.
- **Single `\n` at end of SSE event:** Must be `\n\n` (two newlines). Single newline continues the current field.
- **Installing Express without version pin:** `npm install express` installs v5 now. Pin to `express@4` or `"express": "^4.18"` in package.json.
- **Fetching videos.list one-at-a-time:** Each search.list returns up to 8 video IDs. Always batch all IDs into one videos.list call (1 quota unit instead of N).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cache key generation | Custom string hashing | `crypto.createHash('md5')` from Node built-in | Built-in, deterministic, well-tested |
| XML tag stripping | Custom XML parser | Regex `/<[^>]+>/g` + entity decode | Timedtext XML is simple enough; full parser adds a dependency for minimal benefit |
| Environment variable loading | Manual `fs.readFile('.env')` | `dotenv` package | dotenv handles edge cases: quoted values, multi-line, comment lines, BOM |
| YouTube API client | Custom class wrapping fetch | Raw `fetch()` with URLSearchParams | The YouTube v3 REST API is simple enough that a thin wrapper beats a large SDK dependency |

**Key insight:** This phase's stack is intentionally minimal. Every external dependency that gets added is a dependency that can break across Node.js updates or npm audit warnings. The built-in `crypto`, `fs`, and `path` modules handle all data-wrangling needs without adding to `node_modules`.

---

## Common Pitfalls

### Pitfall 1: Express Version Mismatch
**What goes wrong:** Developer runs `npm install express` and gets v5.2.1 instead of v4.x. Routes with optional params (`/:videoId?`) silently change behavior. `res.send()` with non-string body may throw.
**Why it happens:** Express 5 became the npm `latest` tag in late 2024/early 2025.
**How to avoid:** Always specify `npm install express@4` or write `"express": "^4.18"` in package.json before installing.
**Warning signs:** `npm ls express` shows `5.x.x`; route tests fail with cryptic type errors.

### Pitfall 2: SSE Events Never Arrive at Client
**What goes wrong:** Browser `EventSource` connects but no events arrive even though the server is writing them.
**Why it happens:** Missing `res.flushHeaders()` call, or nginx/proxy buffering the response.
**How to avoid:** Call `res.flushHeaders()` immediately after setting headers. Add `X-Accel-Buffering: no` header.
**Warning signs:** No events in browser DevTools until the connection closes, then all events arrive simultaneously.

### Pitfall 3: YouTube Timedtext Returns Empty Body
**What goes wrong:** `fetch(timedtextUrl)` returns HTTP 200 but the body is empty or `"<timedtext/>"` with no content.
**Why it happens:** (a) Video has no English captions; (b) Video requires POT token (auto-generated captions for some videos); (c) Video is private/restricted.
**How to avoid:** Check `xml.includes('<p ')` or `text.length > 50` before treating it as a valid transcript. Fall back to description silently.
**Warning signs:** `text` property is empty string or whitespace only.

### Pitfall 4: YouTube Quota Exhausted Mid-Development
**What goes wrong:** search.list costs 100 units per call. After 100 search calls the daily quota is gone.
**Why it happens:** Rapid iteration without the cache layer active.
**How to avoid:** Implement `cache.js` and wire it into `youtube.js` before doing any real API calls. The cache must be checked FIRST in every API function.
**Warning signs:** YouTube API returns `403` with `reason: 'quotaExceeded'`.

### Pitfall 5: videoDuration Filter Creates Double-Search Problem
**What goes wrong:** PIPE-03 says "duration: medium/long" but these are separate enum values in the YouTube API — you can't pass both.
**Why it happens:** The API's `videoDuration` parameter only accepts one value: `short`, `medium`, `long`, or `any`.
**How to avoid:** Either (a) use `videoDuration: 'any'` and filter by `contentDetails.duration` during scoring, OR (b) make two search calls per query (one medium, one long) accepting the doubled quota cost. **Recommended: use `any` and filter in scoring** — saves quota.
**Warning signs:** None at runtime — the API silently ignores invalid values, returning results for the valid value only.

### Pitfall 6: SSE Heartbeat Timer Leaks After Client Disconnect
**What goes wrong:** Server process memory grows as clients disconnect and reconnect; eventually crashes.
**Why it happens:** `setInterval` keeps running after `res.write()` would throw because the socket is closed.
**How to avoid:** Always register `req.on('close', () => clearInterval(heartbeatInterval))` before the interval starts.
**Warning signs:** Server logs show `Error: write after end` errors on the SSE route.

---

## Code Examples

### server.js Entry Point Skeleton
```javascript
// Source: Express 4.x official docs + CONTEXT.md decisions
require('dotenv').config();
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Static files
app.use(express.static(__dirname));

// Routes
app.get('/api/course-stream', require('./sse').courseStreamHandler);
app.get('/api/transcript/:videoId', require('./transcript').transcriptHandler);

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
```

### SSE Route Handler with Stub Events
```javascript
// Source: CONTEXT.md decisions + SSE protocol spec
async function courseStreamHandler(req, res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 15000);
  req.on('close', () => clearInterval(heartbeat));

  const STUB_EVENTS = [
    { name: 'query_generated',    step: 1, message: 'Generated 7 search queries' },
    { name: 'videos_fetched',     step: 2, message: 'Fetched 48 candidate videos' },
    { name: 'scored',             step: 3, message: 'Scored and ranked 48 videos' },
    { name: 'transcripts_fetched',step: 4, message: 'Fetched transcripts for top 12 videos' },
    { name: 'course_assembled',   step: 5, message: 'Course ready' },
  ];

  for (const evt of STUB_EVENTS) {
    await new Promise(r => setTimeout(r, 800)); // simulate work
    res.write(`event: ${evt.name}\n`);
    res.write(`data: ${JSON.stringify({ step: evt.step, total: 5, message: evt.message })}\n\n`);
  }
  // No explicit res.end() — EventSource closes when the terminal event fires
}
```

### YouTube Search + Stats Fetch Pattern
```javascript
// Source: https://developers.google.com/youtube/v3/docs/search/list
// Source: https://developers.google.com/youtube/v3/docs/videos/list
async function searchVideos(query) {
  const CACHE_KEY = `search_${queryHash(query)}.json`;
  const cached = cacheGet(CACHE_KEY);
  if (cached) return cached;

  const params = new URLSearchParams({
    key: process.env.YOUTUBE_API_KEY,
    part: 'snippet', q: query, type: 'video',
    maxResults: '8', videoDuration: 'any',
    relevanceLanguage: 'en', safeSearch: 'strict'
  });
  const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
  if (!res.ok) handleYouTubeError(await res.json());
  const data = await res.json();
  cacheSet(CACHE_KEY, data);
  return data;
}

async function fetchVideoStats(videoIds) {
  // Videos.list: 1 quota unit for any number of batched IDs
  const params = new URLSearchParams({
    key: process.env.YOUTUBE_API_KEY,
    part: 'snippet,statistics,contentDetails,topicDetails',
    id: videoIds.join(',')
  });
  const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`);
  if (!res.ok) handleYouTubeError(await res.json());
  return (await res.json()).items;
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `npm install express` → v4 | `npm install express` → v5.2.1 | Late 2024 | Must pin to `express@4` explicitly |
| YouTube timedtext URL direct fetch (reliable) | Direct fetch sometimes requires POT token | Mid-2025 | Need empty-body fallback logic |
| `body-parser` as separate package | Built into Express 5 | Express 5.0.0 | No impact for this project (using Express 4) |

**Deprecated/outdated:**
- `googleapis` npm package for YouTube: Technically current but is overkill for simple API key + REST calls. The project has explicitly decided against it.
- `xml2js` for timedtext parsing: Overkill for simple `<p>` tag text extraction. Regex strip is sufficient and adds no dependency.

---

## Open Questions

1. **Timedtext reliability for auto-generated captions**
   - What we know: POT tokens are required for some videos in 2025; the direct timedtext URL returns empty body without them
   - What's unclear: What percentage of educational videos are affected? Does the `fmt=srv3` format work better than default?
   - Recommendation: During Phase 1, build the endpoint with graceful empty-body handling and test against 5–10 real educational video IDs before declaring the transcript endpoint complete. STATE.md already flags this as a known risk.

2. **`videoDuration` filter: medium vs long vs any**
   - What we know: `medium` (4–20 min) and `long` (20+ min) are separate enum values; cannot pass both
   - What's unclear: How much does filtering to `any` + scoring-stage filtering hurt result quality vs using two search calls
   - Recommendation: Use `videoDuration: 'any'` for Phase 1 and apply duration-based scoring in Phase 2. Document in youtube.js with a comment for Phase 2 implementer.

3. **SSE: should the route call `res.end()` after the terminal event?**
   - What we know: EventSource auto-reconnects unless the connection is explicitly ended or the client calls `.close()`; the CONTEXT.md decision says "frontend closes EventSource on terminal events"
   - What's unclear: Whether calling `res.end()` server-side is needed or whether the client-side close is sufficient
   - Recommendation: Call `res.end()` after the terminal event server-side AND have the frontend close the EventSource. Closing server-side prevents the 30-second auto-reconnect cycle if the frontend JS fails to close.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node:test` (v22.22.0 — available, no install required) |
| Config file | None — test files detected by naming convention |
| Quick run command | `node --test tests/unit/*.test.js` |
| Full suite command | `node --test tests/**/*.test.js` |

**Why node:test over Jest:** This is a greenfield Node.js 22 project with zero existing test infrastructure. The built-in `node:test` runner requires no installation, no config file, and supports async tests, mocking, and assertions natively via `node:assert`. Jest 30.x is available but adds a dev dependency and requires package.json `"test"` script configuration. For a simple server with pure functions, the built-in runner is sufficient.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| INFR-01 | Server starts and serves index.html at localhost:3000 | smoke | `node --test tests/unit/server.test.js` | Wave 0 |
| INFR-04 | YouTube 403 produces SSE error event not crash | unit | `node --test tests/unit/youtube.test.js` | Wave 0 |
| INFR-05 | Heartbeat comment sent; EventSource closes on terminal event | unit | `node --test tests/unit/sse.test.js` | Wave 0 |
| PIPE-03 | searchVideos() calls correct URL with correct params, hits cache on second call | unit | `node --test tests/unit/youtube.test.js` | Wave 0 |
| PIPE-04 | fetchVideoStats() batches IDs into one call, returns items array | unit | `node --test tests/unit/youtube.test.js` | Wave 0 |
| PIPE-05 | cacheGet() returns null on miss, cacheSet() writes file, cacheGet() returns data on hit | unit | `node --test tests/unit/cache.test.js` | Wave 0 |
| PIPE-06 | courseStreamHandler() emits 5 named events in correct order with step/total/message | unit | `node --test tests/unit/sse.test.js` | Wave 0 |
| PIPE-07 | fetchTranscript() returns {source, text} or null; HTTP 404 on NO_TRANSCRIPT | unit | `node --test tests/unit/transcript.test.js` | Wave 0 |
| INFR-06 | .env.example and README.md exist with required content | manual | `ls .env.example README.md` | Wave 0 |

### Sampling Rate
- **Per task commit:** `node --test tests/unit/[relevant-module].test.js`
- **Per wave merge:** `node --test tests/unit/*.test.js`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/unit/cache.test.js` — covers PIPE-05: cache miss/hit, file naming, queryHash consistency
- [ ] `tests/unit/youtube.test.js` — covers PIPE-03, PIPE-04, INFR-04: correct URL construction, batching, quota error handling (mock fetch)
- [ ] `tests/unit/sse.test.js` — covers INFR-05, PIPE-06: event format, heartbeat format, stub event sequence
- [ ] `tests/unit/transcript.test.js` — covers PIPE-07: empty body fallback, XML parsing, 404 shape
- [ ] `tests/unit/server.test.js` — covers INFR-01: server starts, GET / returns 200, GET /api/transcript/bad returns 404
- [ ] `tests/` directory — does not exist yet

---

## Sources

### Primary (HIGH confidence)
- https://developers.google.com/youtube/v3/docs/search/list — search.list params, quota cost (100 units), videoDuration enum values
- https://developers.google.com/youtube/v3/docs/videos/list — videos.list batch by comma-separated IDs, quota cost (1 unit), available parts
- https://masteringjs.io/tutorials/express/server-sent-events — Express SSE headers, res.flushHeaders(), req.on('close') cleanup pattern
- `npm view express version` / `npm view express versions` — v5.2.1 is current latest; v4.22.1 is latest v4 (verified 2026-03-19)
- `npm view dotenv version` — 17.3.1 current (verified 2026-03-19)
- Node.js 22.22.0 built-in `node:test` — confirmed available via `node -e "require('node:test')"`

### Secondary (MEDIUM confidence)
- https://github.com/yt-dlp/yt-dlp/issues/13075 — POT token requirement for YouTube timedtext in 2025; removing pot= parameter causes empty response
- https://scrapecreators.com/blog/how-to-scrape-youtube-transcripts-with-node-js-in-2025 — Innertube API two-step approach for more reliable transcript fetching (Phase 3 consideration)
- WebSearch: Express 5 breaking changes — confirmed from multiple sources: v5 is now `latest` on npm, optional param syntax changed, req.param() removed
- WebSearch: SSE X-Accel-Buffering header — confirmed by multiple SSE implementation guides as required for nginx deployments

### Tertiary (LOW confidence)
- WebSearch: YouTube timedtext `fmt=srv3` behavior — multiple sources reference this format for auto-generated captions; not officially documented
- WebSearch: POT token scope (which videos are affected) — unclear from available sources; manual testing required per STATE.md recommendation

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified via npm registry; Express v4 vs v5 distinction is critical and confirmed
- Architecture: HIGH — all patterns are from official docs or CONTEXT.md locked decisions
- SSE implementation: HIGH — headers and format from official MDN spec + verified tutorial sources
- YouTube API patterns: HIGH — verified against official Google developer docs
- Transcript reliability: LOW-MEDIUM — timedtext endpoint behavior in 2025 is partially undocumented; POT token requirement confirmed by yt-dlp issue tracker but scope unclear

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (30 days) — timedtext/transcript section may need re-evaluation sooner if YouTube changes its API further
