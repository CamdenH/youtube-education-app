# Architecture Patterns

**Project:** YouTube Learning Curator
**Researched:** 2026-03-18
**Confidence:** HIGH (SSE/Express patterns from official docs; pipeline design from first principles given constraints)

---

## Recommended Architecture

This is a single-process Node.js app. There is no database, no frontend framework, and no build step. The entire server is `server.js`; the entire UI is `index.html`. The complexity lives in one place: the five-step AI pipeline that runs on every course generation request.

```
index.html (browser)
  |
  |-- POST /api/generate  ──────────────────────────────────────────────┐
  |                                                                       |
  |-- GET  /api/generate/stream?jobId=X (SSE)  <── progress events ──   |
  |                                                                       |
  |-- POST /api/hints  (lazy, per-video)                                 |
  |                                                                       |
  |-- GET  /  (serves index.html)                                        |
                                                                          |
server.js                                                                 |
  ├── Static file serving (GET /)                                        |
  ├── Route: POST /api/generate  ──── launches pipeline job ────────────┘
  ├── Route: GET  /api/generate/stream  ──── SSE progress stream
  ├── Route: POST /api/hints  ──── lazy hint generation
  │
  ├── Pipeline Orchestrator  (the heart of server.js)
  │   ├── Step 1: generateSearchQueries()   [Claude]
  │   ├── Step 2: searchYouTube()           [YouTube API]
  │   ├── Step 3: scoreVideos()             [pure JS scoring + Claude channel rating]
  │   ├── Step 4: fetchTranscripts()        [YouTube captions API, fallback: description]
  │   └── Step 5: assembleCourse()          [Claude curation + module structure + questions]
  │
  ├── YouTube API Client  (thin wrapper over youtube-search-api / googleapis)
  ├── Anthropic Client    (thin wrapper over @anthropic-ai/sdk)
  └── Job Store           (in-memory Map: jobId → { status, events[], result })
```

---

## Component Boundaries

| Component | Responsibility | Lives In | Communicates With |
|-----------|---------------|----------|-------------------|
| HTTP layer | Route definitions, req/res, SSE headers, error middleware | `server.js` top section | All others |
| Job Store | In-memory map of active generation jobs; stores SSE event queue and final result | `server.js` (Map literal) | Pipeline Orchestrator, SSE route |
| Pipeline Orchestrator | Sequential coordination of 5 steps; emits progress events; holds the job lifecycle | `server.js` middle section | YouTube Client, Anthropic Client, Job Store |
| YouTube API Client | Wraps YouTube Data API v3 — search, video details, captions list + download | `server.js` bottom section (named functions) | Pipeline Orchestrator |
| Anthropic Client | Wraps `@anthropic-ai/sdk` — sends prompts, handles retries, parses JSON responses | `server.js` bottom section (named functions) | Pipeline Orchestrator |
| Scoring Engine | Pure deterministic function: video stats → 0–100 score | `server.js` bottom section | Pipeline Orchestrator (Step 3) |
| SSE Route | Reads from Job Store event queue; streams events to browser; closes when job ends | `server.js` route handler | Job Store |
| index.html | EventSource consumer; renders course; localStorage persistence; export/checkbox logic | `index.html` | HTTP layer (routes) |

---

## Data Flow

### Course Generation Flow

```
Browser                     server.js                      External
  |                              |                              |
  |-- POST /api/generate ------->|                              |
  |                              |-- generate jobId             |
  |<-- { jobId } ---------------|                              |
  |                              |                              |
  |-- GET /api/generate/stream ->|                              |
  |   (SSE connection open)      |                              |
  |                              |                              |
  |                              |== Step 1: generateSearchQueries ==|
  |                              |-- prompt "generate 6-8 queries" ->|
  |                              |<-- [ query1, query2, ... ] -------|
  |<-- event: step { step: 1, msg: "Generating search queries..." }  |
  |                              |                              |
  |                              |== Step 2: searchYouTube ===========|
  |                              |-- search(query1) ----------------->|
  |                              |-- search(query2) ----------------->|  (parallel)
  |                              |-- ... (all queries in parallel) -->|
  |                              |<-- raw video results --------------|
  |                              |-- getVideoDetails(ids) ----------->|
  |                              |<-- stats (likes, views, duration)->|
  |<-- event: step { step: 2, msg: "Searching YouTube..." }          |
  |                              |                              |
  |                              |== Step 3: scoreVideos ==============|
  |                              |-- score each video (pure JS)       |
  |                              |-- Claude: rate channel credibility ->|
  |                              |<-- credibility scores --------------|
  |                              |-- sort by final score              |
  |                              |-- take top 12                      |
  |<-- event: step { step: 3, msg: "Scoring videos..." }             |
  |                              |                              |
  |                              |== Step 4: fetchTranscripts =========|
  |                              |-- captionsList(videoId) ----------->|
  |                              |<-- caption track list --------------|
  |                              |-- download caption track ---------->|
  |                              |<-- transcript text -----------------|
  |                              |   (fallback: use description)       |
  |<-- event: step { step: 4, msg: "Fetching transcripts..." }       |
  |                              |                              |
  |                              |== Step 5: assembleCourse ============|
  |                              |-- large curation prompt + videos -->|
  |                              |<-- { modules[], per-video data } ---|
  |<-- event: step { step: 5, msg: "Assembling course..." }          |
  |                              |                              |
  |<-- event: done { course: {...} }                                   |
  |   (SSE connection closes)    |                              |
```

### Hint Flow (lazy, post-generation)

```
Browser                     server.js                      Anthropic
  |                              |                              |
  |-- POST /api/hints ---------->|                              |
  |   { videoId, transcript,     |-- prompt: "generate 3       |
  |     questions[] }            |   hints for these 3 Qs" --->|
  |                              |<-- { hints: [h1,h2,h3] } ---|
  |<-- { hints: [h1,h2,h3] } ---|                              |
```

---

## How to Organize a Large server.js

Keep everything in one file but use **section comments** as hard boundaries. The file has five zones, top-to-bottom, each doing one thing:

```
// ─── ZONE 1: INIT & CONFIG ──────────────────────────────────────
// require(), dotenv, express(), constants, Job Store Map

// ─── ZONE 2: HTTP ROUTES ─────────────────────────────────────────
// GET /  →  serve index.html
// POST /api/generate  →  start job, return jobId
// GET  /api/generate/stream  →  SSE handler
// POST /api/hints  →  lazy hint generation

// ─── ZONE 3: PIPELINE ORCHESTRATOR ──────────────────────────────
// async function runPipeline(jobId, subject, skillLevel)
// Calls steps in sequence; calls emit(jobId, event) between steps

// ─── ZONE 4: PIPELINE STEPS ──────────────────────────────────────
// async function generateSearchQueries(subject, skillLevel)
// async function searchYouTube(queries, skillLevel)
// async function scoreVideos(videos, skillLevel)
// async function fetchTranscripts(videos)
// async function assembleCourse(videos, subject, skillLevel)

// ─── ZONE 5: API CLIENTS ─────────────────────────────────────────
// async function callClaude(prompt, systemPrompt)
// async function youtubeSearch(query)
// async function youtubeVideoDetails(ids)
// async function youtubeCaptions(videoId)
// function scoreVideo(video, skillLevel)  ← pure, synchronous
```

**When to split into separate files:** Only if `server.js` exceeds ~700 lines AND two developers are colliding in the same section. For a personal tool, that threshold will not be hit. The zone-comment approach is sufficient.

---

## Pipeline Orchestration Pattern

### Job Store Pattern

Use a plain `Map` as the in-memory job store. Every generation request creates a job entry. The SSE route reads from that entry.

```javascript
// Simple, effective for single-process personal tool
const jobs = new Map();
// jobs.get(jobId) = {
//   status: 'running' | 'done' | 'error',
//   events: [],          // buffered events for late SSE connections
//   result: null,        // set when status === 'done'
//   error: null,         // set when status === 'error'
//   createdAt: Date.now()
// }
```

**Why buffered events:** If the SSE connection opens after the pipeline has already emitted step 1, replay all buffered events so the browser is always current.

### SSE Endpoint Pattern (Express)

```javascript
app.get('/api/generate/stream', (req, res) => {
  const { jobId } = req.query;
  const job = jobs.get(jobId);
  if (!job) return res.status(404).end();

  // SSE headers (verified against MDN spec)
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');   // disable nginx buffering if ever proxied
  res.flushHeaders();

  // Replay buffered events
  job.events.forEach(evt => sendSSE(res, evt));

  // If already done, close
  if (job.status === 'done' || job.status === 'error') {
    sendSSE(res, { type: 'done', data: job.result || { error: job.error } });
    return res.end();
  }

  // Register this response as the live listener
  job.listener = res;

  // Clean up on client disconnect
  req.on('close', () => {
    job.listener = null;
  });
});

function sendSSE(res, payload) {
  // Use named events so the browser can addEventListener by type
  res.write(`event: ${payload.type}\n`);
  res.write(`data: ${JSON.stringify(payload.data)}\n\n`);
}
```

### Pipeline Orchestrator Pattern

```javascript
async function runPipeline(jobId, subject, skillLevel) {
  const emit = (type, data) => {
    const evt = { type, data };
    const job = jobs.get(jobId);
    job.events.push(evt);               // buffer for replays
    if (job.listener) sendSSE(job.listener, evt);
  };

  try {
    emit('step', { step: 1, label: 'Generating search queries', total: 5 });
    const queries = await generateSearchQueries(subject, skillLevel);

    emit('step', { step: 2, label: 'Searching YouTube', total: 5 });
    const videos = await searchYouTube(queries, skillLevel);

    emit('step', { step: 3, label: 'Scoring videos', total: 5 });
    const scored = await scoreVideos(videos, skillLevel);

    emit('step', { step: 4, label: 'Fetching transcripts', total: 5 });
    const withTranscripts = await fetchTranscripts(scored);

    emit('step', { step: 5, label: 'Assembling course', total: 5 });
    const course = await assembleCourse(withTranscripts, subject, skillLevel);

    const job = jobs.get(jobId);
    job.status = 'done';
    job.result = course;
    emit('done', { course });
    if (job.listener) job.listener.end();

  } catch (err) {
    const job = jobs.get(jobId);
    job.status = 'error';
    job.error = err.message;
    emit('error', { message: err.message });
    if (job.listener) job.listener.end();
  }
}
```

**Key decision:** `POST /api/generate` responds immediately with `{ jobId }` and calls `runPipeline(jobId, ...)` without `await`. The pipeline runs asynchronously while the browser connects to the SSE stream. This avoids HTTP timeout issues on long-running pipelines (30–90 seconds is normal for 5 API steps).

---

## Claude Prompt Architecture

Each Claude call should follow this structure:

1. **System prompt:** Role + output format contract (always JSON)
2. **User prompt:** Task data (subject, videos, transcripts, etc.)
3. **Response:** Claude returns only valid JSON — no prose wrapping

### Prompt 1: Search Query Generation

```
SYSTEM: You are an educational content strategist. You generate precise YouTube
search queries to find the best instructional content for a given subject and skill level.
Always respond with valid JSON matching the schema provided.

USER: Generate 6-8 YouTube search queries to find educational videos about:
Subject: {subject}
Skill level: {skillLevel}

Queries should vary in specificity — some broad, some narrow, some targeting
specific subtopics. For "beginner" level, bias toward "introduction", "explained",
"for beginners". For "advanced", bias toward "deep dive", "internals", "advanced".

Respond with:
{ "queries": ["query1", "query2", ...] }
```

### Prompt 2: Channel Credibility Rating (batched in Step 3)

```
SYSTEM: You are an academic quality assessor evaluating YouTube channels as
educational sources. Rate channels by content depth and rigor, not popularity.
Always respond with valid JSON matching the schema provided.

USER: Rate the educational credibility (0–10) of each channel.
Consider: institutional affiliation, content depth, pedagogical clarity, rigor.
Do NOT boost score just for high subscriber count.

Channels:
{channels.map(c => `- ${c.name}: ${c.description}`).join('\n')}

Respond with:
{ "ratings": { "channelId": score, ... } }
```

### Prompt 3: Course Assembly + Curation (Step 5, largest prompt)

```
SYSTEM: You are an expert curriculum designer. You receive a list of scored
YouTube videos and their transcripts, then:
1. Reject any videos with poor educational quality (irrelevant, shallow, clickbait)
2. Organize the remaining videos into 3–4 thematic modules
3. Write a "why this video" blurb for each video
4. Write 3 comprehension questions per video (one recall, one conceptual, one application)
5. Flag any video whose content may be outdated (>3 years old for fast-moving topics)
Always respond with valid JSON matching the schema provided.

USER: Subject: {subject}
Skill level: {skillLevel}

Videos (top 12 by score):
{videos.map(v => `
ID: ${v.id}
Title: ${v.title}
Channel: ${v.channelName}
Duration: ${v.duration}
Score: ${v.score}
Transcript excerpt: ${v.transcript.slice(0, 800)}
`).join('\n---\n')}

Respond with the schema:
{
  "modules": [
    {
      "title": "...",
      "description": "...",
      "learningProgression": "...",
      "connectingQuestion": "...",
      "videos": [
        {
          "id": "...",
          "whyThisVideo": "...",
          "outdated": false,
          "questions": [
            { "type": "recall", "text": "...", "hint": null },
            { "type": "conceptual", "text": "...", "hint": null },
            { "type": "application", "text": "...", "hint": null }
          ]
        }
      ]
    }
  ]
}
```

Note: `hint` is always `null` at assembly time. Hints are generated lazily by Prompt 4.

### Prompt 4: Lazy Hint Generation (POST /api/hints)

```
SYSTEM: You are a Socratic tutor. Generate one hint per question that nudges
the learner toward the answer without giving it away. Always respond with valid JSON.

USER: Video transcript excerpt:
{transcript.slice(0, 600)}

Questions:
1. {questions[0].text}
2. {questions[1].text}
3. {questions[2].text}

Respond with:
{ "hints": ["hint for Q1", "hint for Q2", "hint for Q3"] }
```

### JSON Parsing Strategy

Claude sometimes wraps JSON in markdown fences. Use this extraction pattern:

```javascript
function extractJSON(text) {
  // Strip ```json ... ``` fences if present
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  return JSON.parse(raw.trim());
}
```

If parsing fails, retry the Claude call once with "Return ONLY raw JSON, no markdown" appended to the system prompt.

---

## Error Handling Across Async Steps

### Principle: Fail the Job, Not the Server

Every pipeline step can fail (rate limit, bad API key, network timeout). The orchestrator catches all errors and transitions the job to `error` state, then emits an SSE `error` event. The server never crashes.

```javascript
// Per-step error: fail gracefully per video, not the whole pipeline
async function fetchTranscripts(videos) {
  return Promise.all(videos.map(async (video) => {
    try {
      const transcript = await youtubeCaptions(video.id);
      return { ...video, transcript };
    } catch (_err) {
      // Fallback: use description, mark transcript as synthetic
      return { ...video, transcript: video.description, transcriptFallback: true };
    }
  }));
}
```

### Error Taxonomy

| Error Type | Source | Strategy |
|------------|--------|----------|
| YouTube quota exceeded | YouTube API 403 | Fail entire pipeline, clear message to UI |
| Individual caption unavailable | YouTube captions 404 | Per-video fallback to description, continue |
| Claude API timeout | Anthropic timeout | Retry once with 5s delay; fail job on second failure |
| Claude returns invalid JSON | Anthropic response | Retry with stricter JSON instruction; fail step on second failure |
| Claude rejects all videos | Step 5 curation | Return empty modules array; UI shows "no quality videos found" |
| Missing env vars on startup | dotenv | `process.exit(1)` at startup with clear error message |

### Express Error Middleware

```javascript
// Must be defined LAST in server.js after all routes
// Four-argument signature required for Express to treat as error middleware
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  // Don't leak stack traces to client
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});
```

**Note on Express version:** Express 5 (released stable 2024) auto-catches rejected promises in route handlers. Use Express 5 (`npm install express@5`) to avoid wrapping every async handler in try/catch.

---

## Scoring Engine Design

The scoring engine is synchronous and pure — no API calls, no side effects. This makes it testable and predictable.

```
finalScore = (
  likeRatio        * weight.likeRatio        +   // likes / (likes + dislikes)
  durationScore    * weight.duration         +   // optimal range: 8–25 min
  recencyScore     * weight.recency          +   // decay function on publishedAt
  descriptionScore * weight.description      +   // length + keyword signals
  channelScore     * weight.channel              // from Claude credibility rating
)
```

Skill-level weight adjustments (example):
- **Beginner:** boost `durationScore` weight (shorter is better), boost `recencyScore`
- **Advanced:** boost `channelScore`, reduce `recencyScore` penalty (seminal content ages well)

Channel credibility from Claude runs as a **single batch call** in Step 3 — deduplicate channels from all candidate videos, call Claude once with all channel names/descriptions, get back a `{ channelId: score }` map. This keeps Claude API calls to a minimum.

---

## Scalability Considerations

This is a personal local tool. Scalability is not a concern. However, one structural decision matters for correctness:

| Concern | Approach |
|---------|----------|
| Multiple concurrent generations | The Job Store Map handles N concurrent jobs correctly. No state is shared between jobs. |
| Job cleanup | Delete jobs from the Map after 30 minutes to prevent memory leak on long sessions. Use `setTimeout` per job. |
| YouTube API quota | Each generation uses ~10–20 search queries + 1 video details batch = ~100–200 quota units. Daily quota is 10,000 units. Safe for personal use. |
| Claude token cost | Step 5 assembly prompt is the largest. With 12 videos × 800-char transcript excerpt, expect ~8,000–12,000 input tokens per generation. Budget accordingly. |

---

## Suggested Build Order

Build in this order to unblock everything downstream:

1. **Express skeleton + SSE infrastructure** — Static file serving, Job Store, SSE route, `runPipeline` stub that emits fake progress events. Proves the browser-server SSE connection works before any real pipeline exists.

2. **YouTube search + video details** — Step 2 only. Returns raw videos. Validate API key, confirm quota usage, see real data.

3. **Scoring engine** — Pure function, no API calls. Build and test with static video data from Step 2. This is the critical differentiator logic.

4. **Claude: search query generation** — Step 1. Small prompt, easy to validate. Now the full Step 1→2→3 chain works.

5. **Transcript fetching** — Step 4. Build the happy path (captions API) then the fallback (description). Test both.

6. **Claude: course assembly** — Step 5. Largest and most complex prompt. Iterate on prompt until output schema is consistent.

7. **Full pipeline integration** — Wire all 5 steps through the orchestrator with real SSE events.

8. **index.html UI** — Build against the real API. Render course, localStorage history, export, checkboxes, hints lazy-load.

9. **Lazy hints** — POST /api/hints route + Prompt 4. Add last because it depends on the course structure being stable.

**Rationale for this order:**
- Steps 1 and 2 establish the SSE contract the UI depends on — nothing else can be tested end-to-end without it
- Scoring engine has no external dependencies — it can be built and validated independently
- Claude prompts are the riskiest component (schema drift, token limits, unexpected output) — start with the small one (Step 1) to establish the `callClaude` + `extractJSON` pattern before hitting the large Step 5 prompt
- UI is built last because it's pure rendering against a stable API contract

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Awaiting Pipeline in the Route Handler
**What:** `app.post('/api/generate', async (req, res) => { const course = await runPipeline(...); res.json(course); })`
**Why bad:** Pipeline takes 30–90 seconds. HTTP will timeout. Client gets no progress.
**Instead:** Start pipeline detached, return `jobId` immediately, stream progress over SSE.

### Anti-Pattern 2: One Claude Call Per Video for Channel Credibility
**What:** Calling Claude once per channel to get a credibility rating.
**Why bad:** 12 videos from 8 channels = 8 Claude API calls in Step 3. Slow and expensive.
**Instead:** Deduplicate channels, send one batch prompt with all channel descriptions, get back a map.

### Anti-Pattern 3: Streaming Claude Responses Through SSE
**What:** Piping Claude streaming tokens directly to the SSE stream.
**Why bad:** Complicates JSON extraction, brittle, no benefit for this use case (the UI shows step progress, not token-by-token output).
**Instead:** Non-streaming Claude calls. Emit one SSE event per completed step.

### Anti-Pattern 4: Fetching All Transcripts Before Scoring
**What:** Fetching transcripts for all candidate videos (potentially 60–80 from 8 searches) before scoring.
**Why bad:** YouTube captions API is slow and rate-limited. Most of these videos will be discarded.
**Instead:** Score first (likes/views/duration are in the search results), take top 12, then fetch transcripts only for those 12.

### Anti-Pattern 5: Free-Form Claude Responses
**What:** Asking Claude to "describe the course" in prose and then parsing it.
**Why bad:** Parsing natural language is fragile. Claude will vary its format across calls.
**Instead:** Always demand JSON in the system prompt, always specify the exact schema, always use `extractJSON()` for parsing.

---

## Sources

- MDN Web Docs, "Using server-sent events" — https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events (verified 2026-03-18, HIGH confidence)
- Express.js official docs, "Error handling" — https://expressjs.com/en/guide/error-handling.html (verified 2026-03-18, HIGH confidence)
- Pipeline design and Claude prompt architecture — derived from first principles given the constraints in PROJECT.md (MEDIUM confidence, validated by reasoning over known YouTube Data API v3 and Anthropic SDK behavior)
- YouTube Data API v3 quota costs — 100 units per search call, 1 unit per video.list call (HIGH confidence, stable API fact)
