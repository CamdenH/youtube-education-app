# Domain Pitfalls

**Domain:** YouTube API + Claude API educational content curation app
**Project:** YouTube Learning Curator
**Researched:** 2026-03-18
**Confidence:** MEDIUM-HIGH (training knowledge on well-established APIs; web verification restricted in this session — flag quota numbers for spot-check)

---

## Critical Pitfalls

Mistakes that cause rewrites, silent data corruption, or blocked pipeline execution.

---

### Pitfall 1: YouTube Captions API Is Not a Public API

**What goes wrong:** You call `captions.list` with an API key, get a 200 response listing captions tracks, then call `captions.download` — and get a 403 every time. The download endpoint requires OAuth 2.0, not a simple API key. The app is a no-auth personal tool, so OAuth is out of scope.

**Why it happens:** The YouTube Data API v3 documentation lists `captions.list` and `captions.download` as standard endpoints, but the download method requires the authenticated owner of the video. An API key only gives read access to public metadata — never caption content via the official API.

**Consequences:** The transcript pipeline (which feeds the comprehension questions — a core differentiator) silently fails for every video. If the fallback to video description is not implemented and tested first, the entire question-generation feature breaks.

**Prevention:**
- Do NOT use `captions.download` at all. Design around it from day one.
- Use the unofficial `timedtext` endpoint instead: `https://www.youtube.com/api/timedtext?v={VIDEO_ID}&lang=en&fmt=srv3` (or `fmt=json3`). This is an undocumented endpoint that YouTube's own web player uses. It returns auto-generated and manual captions for videos that have them. No auth required.
- The `fmt=json3` variant returns structured JSON with start times and text segments. Parse the `events[].segs[].utf8` fields to reconstruct the transcript.
- Always implement and test the description fallback before building transcript-dependent features, because the timedtext endpoint:
  - Returns 200 with empty body for some videos (no captions exist)
  - Returns 200 with only auto-generated (often low quality) captions for others
  - May return captions in the wrong language
  - Is undocumented and could break without warning

**Detection:** If `captions.list` returns tracks but every `captions.download` call returns 403 — this is the issue.

**Phase:** Address in Phase 1 (backend pipeline). The timedtext approach must be decided before writing any transcript-dependent code.

**Confidence:** HIGH — this is a well-known limitation documented extensively in YouTube API issue trackers and Stack Overflow threads.

---

### Pitfall 2: YouTube Data API v3 Quota Exhaustion Mid-Pipeline

**What goes wrong:** `search.list` costs 100 quota units per call. The pipeline runs 6-8 search queries to generate the video pool. That's 600-800 quota units per course generation, before any `videos.list` calls. The default daily quota is 10,000 units. Five to fifteen course generations per day exhaust the quota — subsequent calls return `quotaExceeded` errors with HTTP 403.

**Why it happens:** Developers focus on making the pipeline work and don't account for cumulative quota across the generation flow. Each `search.list` call with `maxResults=10` returns up to 10 video IDs. `videos.list` with `part=statistics,snippet,contentDetails` costs 1 unit per call (up to 50 IDs per request) — cheap by comparison. The quota killer is always `search.list`.

**Consequences:** Pipeline fails silently or with an unhandled 403 mid-stream. If using SSE, the stream closes with an error state and the user sees a broken loading screen.

**Prevention:**
- Budget explicitly: 6 queries × 100 = 600 units minimum per generation. Plan for ~800 max (some retries).
- Batch `videos.list` calls: always pass up to 50 video IDs in a single request using the `id` parameter as a comma-separated list. Never call `videos.list` once per video.
- Deduplicate video IDs before calling `videos.list` — the same video can appear in multiple search result sets.
- Cache search results during development. Write results to a `.cache/` directory keyed by query hash. Skip live API calls when cache is warm. This is critical for iterating on the scoring algorithm without burning quota.
- Add explicit quota error handling: catch HTTP 403 with `reason: quotaExceeded`, surface a clear user-facing message ("Daily YouTube quota exceeded — try again tomorrow"), and do not retry automatically.
- In the SSE stream, emit a `quota_error` event type so the frontend can display a specific message rather than a generic failure.

**Detection:** Watch for `403` responses with body `{ "error": { "errors": [{ "reason": "quotaExceeded" }] } }`.

**Phase:** Address in Phase 1 (core backend pipeline). Caching layer should be built before any significant testing iteration begins.

**Confidence:** HIGH — quota costs are documented in the YouTube API quota calculator.

---

### Pitfall 3: Claude Returns Invalid JSON (or Valid JSON with Wrong Shape)

**What goes wrong:** Claude's response is not valid JSON, or it wraps JSON in a markdown code block (` ```json ... ``` `), or it returns JSON with a different key structure than expected. `JSON.parse()` throws or the downstream code fails with `Cannot read property of undefined`.

**Why it happens:** Three sub-causes:
1. The prompt says "respond with JSON" but Claude adds explanation text before or after.
2. Claude uses a slightly different key name (`modules` vs `module_list`, `whyThisVideo` vs `why_this_video`).
3. For long transcripts, Claude hits its context window and truncates — producing syntactically invalid JSON.

**Consequences:** The entire course generation fails at the Claude call. If error handling is not granular, the SSE stream closes and the user sees no useful feedback.

**Prevention:**
- Use the Anthropic API's native JSON mode where available: set `"type": "json_object"` in the response format. This guarantees syntactically valid JSON output. (Verify this is available on the specific model being used — claude-sonnet-4-5.)
- If JSON mode is not used, add a stripping step: `const cleaned = response.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()`.
- Define and document the exact JSON schema in the prompt. Use TypeScript-style type annotations in the prompt itself — Claude follows these reliably.
- Add Zod (or a hand-rolled validator) to validate the shape after parsing. Fail fast with a descriptive error rather than letting undefined propagate.
- For the module organization call (the most structurally complex), test the prompt against at least 10 edge cases before shipping: subjects with few good videos, highly technical subjects, subjects where all videos are long-form, and subjects where all videos are short.
- Truncate transcripts before sending. Do not send full transcripts to Claude for question generation — extract the first 2,000-3,000 words (or chunk by token estimate). Long transcripts risk both context window overflow and slow responses.

**Detection:** Log every raw Claude response before `JSON.parse()` during development. If the log shows markdown fencing or explanation text, the prompt needs tightening.

**Phase:** Address in Phase 2 (Claude integration). Schema validation should be added alongside the first Claude call, not retrofitted later.

**Confidence:** HIGH — JSON output reliability is a well-documented challenge for all LLM API integrations.

---

### Pitfall 4: SSE Connection Drops Silently and the Client Never Retries

**What goes wrong:** The Express SSE endpoint sends events for several seconds, then the connection closes (either because Express processes a request, the Node.js process has an idle timeout, or a reverse proxy (nginx, etc.) has a read timeout). The browser's `EventSource` object enters a reconnect loop, but the server has no state — so it restarts the entire pipeline, burning quota again.

**Why it happens:** `EventSource` auto-reconnects by default with exponential backoff. Each reconnect triggers a new `GET /api/generate`. Without any guard, this means multiple simultaneous pipeline runs.

**Consequences:** Quota doubled or tripled per user session. Race conditions in the SSE response if two pipeline runs emit events to the same client simultaneously.

**Prevention:**
- Set `res.setHeader('X-Accel-Buffering', 'no')` to prevent nginx buffering if deployed behind a proxy.
- Set `res.setHeader('Cache-Control', 'no-cache')` and `res.setHeader('Connection', 'keep-alive')`.
- Send a periodic heartbeat comment every 15 seconds: `res.write(': heartbeat\n\n')`. This keeps the connection alive through proxy idle timeouts.
- On the client, close the `EventSource` immediately upon receiving the terminal event (e.g., `type: "complete"` or `type: "error"`). Call `eventSource.close()` in both the `onmessage` and `onerror` handlers after a terminal event.
- Track in-progress requests server-side (a simple `Set` of in-progress request IDs). Reject duplicate requests from the same session within a TTL window.
- This is a local tool — no reverse proxy is likely. But the heartbeat and immediate-close patterns are still worth implementing.

**Detection:** Open Chrome DevTools Network tab. Watch the SSE connection. If you see repeated `(pending)` entries for the same endpoint, EventSource is reconnecting.

**Phase:** Address in Phase 3 (SSE + loading UI). The heartbeat must be in the initial implementation, not added after observing the bug.

**Confidence:** HIGH — SSE keepalive and EventSource reconnect behavior is standard browser/Node behavior.

---

### Pitfall 5: localStorage Size Limit Causes Silent Failures

**What goes wrong:** `localStorage.setItem()` throws a `QuotaExceededError` when the stored data exceeds ~5MB (browser-dependent). The app saves the last 10 courses. A single course can be large: 12 videos × transcript excerpts × comprehension questions × hints = easily 50-200KB of JSON per course. Ten courses = 500KB-2MB. With Claude responses included verbatim, this can tip past 5MB.

**Why it happens:** Developers test with 2-3 small courses, see localStorage working, and don't test the "last 10 with full data" scenario until real usage hits the limit.

**Consequences:** `setItem` throws synchronously. If uncaught, the entire save operation fails silently. The user thinks their course was saved. On reload, the course is gone.

**Prevention:**
- Always wrap `localStorage.setItem()` in a try/catch. On `QuotaExceededError`, evict the oldest course and retry once.
- Store courses in a compact format. Do not store raw Claude response text — store only the parsed, structured output. Strip fields the UI doesn't use (e.g., intermediate pipeline data).
- Do not store transcripts in localStorage — they are only needed during generation. Store only the generated questions and hints.
- Enforce the 10-course cap before writing, not after. Remove the oldest entry first, then write the new one.
- Add a byte-size estimate function: `new Blob([JSON.stringify(courses)]).size` gives you the byte size. Log it during development to track growth.

**Detection:** Open DevTools Application tab > Local Storage. Watch the total size as you save courses. Chrome shows the size per key.

**Phase:** Address in Phase 4 (localStorage persistence). Implement defensively from the first save operation.

**Confidence:** HIGH — localStorage limits are well-documented browser behavior; the 5MB figure is consistent across modern browsers.

---

## Moderate Pitfalls

---

### Pitfall 6: Scoring Algorithm Produces Flat Score Distribution

**What goes wrong:** All 50 candidate videos receive scores clustered in the 60-75 range. The top 12 by score are not meaningfully better than the bottom 12. Claude then has to "reject poor-quality ones" from a pool where nothing is clearly poor — and may keep videos that are genuinely low quality, or reject good ones arbitrarily.

**Why it happens:** Score components (like ratio, duration, recency, etc.) are normalized independently and weighted, but the weights are tuned for average-case videos. Channels with 1M+ subscribers artificially dominate the credibility score. Short videos (under 5 minutes) and very long videos (over 3 hours) cluster at opposite ends of the duration score but both get middling final scores when averaged with other components.

**Prevention:**
- Design the scoring function to produce a wide distribution. Test it against 50 real videos from a single query before any Claude integration. Print a histogram of scores. If the distribution is too narrow (e.g., std dev < 10), the weights or normalization need adjustment.
- Apply non-linear transforms for like ratio (log scale works better than linear for very high like-count videos).
- Duration scoring should use a peak-reward function: score peaks at 10-20 minutes (ideal educational length), drops for very short or very long. A Gaussian or tent function is appropriate.
- Cap the subscriber count's influence on channel credibility. A 10M-subscriber channel is not 100× more credible than a 100K-subscriber channel. Use `log10(subscribers)` normalized to 0-1.
- Test edge cases: a subject with only long-form content (full university lectures), a subject with only short clips, a brand-new subject where all videos are recent.

**Phase:** Address in Phase 1 (scoring algorithm). Iterate offline with cached data before connecting to Claude.

**Confidence:** MEDIUM — based on general experience with scoring/ranking systems; specific to this app's parameter design.

---

### Pitfall 7: Timedtext Endpoint Returns Auto-Generated Captions with Garbage Quality

**What goes wrong:** The transcript returned by the timedtext endpoint is auto-generated ASR (automatic speech recognition) output. For technical subjects, it frequently mangles terminology: "neural nets" becomes "neural knits", "eigenvector" becomes "I give vector", variable names are broken up, equations are described as verbal noise. Claude generates comprehension questions from this garbage text and produces nonsensical or wrong questions.

**Why it happens:** YouTube's ASR is optimized for conversational speech, not technical jargon. No human-edited captions exist for many educational videos.

**Prevention:**
- Before sending a transcript to Claude, check its quality with a simple heuristic: calculate the ratio of non-alphabetic characters (numbers, brackets, underscores) to total characters. Very low ratio on a technical video suggests ASR mangling.
- In the Claude prompt for question generation, add: "If the transcript appears to be low-quality auto-generated captions (garbled text, fragmented sentences, technical terms that appear misspelled), generate questions primarily from the video title and description instead of the transcript."
- Always send the video title and description alongside the transcript — Claude can use these to anchor questions even when the transcript is poor.
- For the outdated flag check, the video description is often more reliable than the transcript for date signals.

**Phase:** Address in Phase 2 (question generation prompts). Add the quality detection heuristic before writing the first question-generation prompt.

**Confidence:** MEDIUM — based on well-known YouTube ASR quality issues for technical content.

---

### Pitfall 8: CORS Errors When the Frontend Makes Direct API Calls

**What goes wrong:** During development, the frontend's `fetch()` call to the backend fails with a CORS error. Or worse: a developer shortcuts and calls the YouTube API directly from the frontend (to skip the backend during UI development), then forgets to remove it — exposing the API key in the browser.

**Why it happens:** Single-file architecture (`index.html`) served from the filesystem (`file://`) or a different port than the Express server. `file://` origin is blocked by CORS by default for `localhost` server calls.

**Prevention:**
- Serve `index.html` from Express itself, not from the filesystem. Add `app.use(express.static('.'))` or serve it via a dedicated route. This makes both the frontend and backend share the same origin — no CORS needed.
- Never put `YOUTUBE_API_KEY` or `ANTHROPIC_API_KEY` in the frontend. All API calls go through the Express backend.
- If CORS middleware is added (for development flexibility), restrict it to `localhost` origins only — never `'*'`.

**Phase:** Address in Phase 1 (Express setup). The static file serving decision must be made before any frontend development begins.

**Confidence:** HIGH — standard CORS behavior.

---

### Pitfall 9: Claude Prompt for Module Organization Ignores Skill Level

**What goes wrong:** The module organization prompt sends all 12 scored videos to Claude and asks for 3-4 modules. Claude organizes them thematically but doesn't differentiate for skill level. A beginner course and an advanced course on the same subject produce nearly identical module structures.

**Why it happens:** Skill level is passed as a parameter but the prompt says "organize these videos into educational modules" without specifying how skill level should change the structure. Claude defaults to topic-based grouping regardless.

**Prevention:**
- Make skill level an explicit structural instruction in the prompt, not just metadata. For beginner: "Create a progressive sequence where each module builds on the previous. Module 1 should establish fundamentals." For advanced: "Assume prior knowledge. Modules should address specialization areas and practical application rather than building from basics."
- Include skill level in the module `description` and `learningProgression` fields so the instructions are concrete and verifiable.
- Test the same subject at all four skill levels and compare outputs before shipping.

**Phase:** Address in Phase 2 (Claude module organization). This is a prompt design issue, not a code issue.

**Confidence:** MEDIUM — based on LLM prompt design experience; the exact behavior depends on the model version.

---

### Pitfall 10: Export Markdown Silently Includes Answers or Private Data

**What goes wrong:** The export function iterates the course data structure and renders comprehension questions. If hints have been fetched (from lazy hint generation), the hint data is in the same object and may accidentally be included in the export.

**Why it happens:** The export function is written to "render everything in the course object" rather than explicitly whitelisting fields. When hints are added to the data structure later, they silently appear in exports.

**Prevention:**
- Write the export function to explicitly enumerate fields: module title, description, video title, YouTube URL, "why this video" blurb, question text. Explicitly exclude: hints, answers, scores, internal API data.
- Use a separate `toCourseExport(course)` function that builds the export-safe representation. Never pass the raw course object to the export renderer.

**Phase:** Address in Phase 4 (export feature). Implement as a whitelist from the start.

**Confidence:** HIGH — this is a simple architectural decision that's easy to get wrong.

---

## Minor Pitfalls

---

### Pitfall 11: videos.list Does Not Return All Requested Fields by Default

**What goes wrong:** `videos.list` is called with `id` and `part=statistics` but the response is missing `duration`. Duration is in `contentDetails`, not `statistics`. The scoring algorithm silently receives `undefined` for duration and produces `NaN` scores.

**Prevention:** Always request `part=snippet,statistics,contentDetails` in a single `videos.list` call. Add a validation step that checks required fields are present before scoring.

**Phase:** Phase 1.

**Confidence:** HIGH — documented YouTube API behavior.

---

### Pitfall 12: EventSource Does Not Support POST — Query Parameters Expose Subject in URL

**What goes wrong:** `EventSource` is a browser API that only supports GET requests. The subject and skill level must be passed as query parameters (e.g., `/api/generate?subject=machine+learning&level=beginner`). This is fine for a local personal tool, but if the subject contains special characters (e.g., `C++`, `C#`, `React (library)`), unencoded query parameters break the request.

**Prevention:** Use `encodeURIComponent()` on all query parameters before constructing the EventSource URL. On the server, use `req.query.subject` (Express already decodes it) — don't try to manually parse the raw URL string.

**Phase:** Phase 3.

**Confidence:** HIGH — standard URL encoding behavior.

---

### Pitfall 13: Hint Generation Race Condition When User Expands Multiple Videos Rapidly

**What goes wrong:** The user expands video A's questions, triggering a Claude hint-fetch call. Before it completes, they expand video B's questions, triggering another. Both calls complete and update the same data structure concurrently. Depending on implementation, one call's results overwrite the other's, or the UI shows stale state.

**Prevention:** Track per-video hint fetch state with a `loading` / `loaded` / `error` flag on the video object. If `state === 'loading'`, ignore new expand events for that video. If `state === 'loaded'`, skip the API call entirely (show cached hints). Implement this flag system before writing the hint fetch logic.

**Phase:** Phase 3 (hint generation + UI).

**Confidence:** MEDIUM — depends on specific UI implementation, but a common async race pattern.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|----------------|------------|
| YouTube search pipeline | Quota exhaustion at 600-800 units/generation | Build caching before testing pipeline iterations |
| Transcript fetching | captions.download requires OAuth — will always 403 | Use timedtext endpoint; implement description fallback first |
| Videos.list batching | Duplicate IDs across queries inflate count | Deduplicate before `videos.list`; batch up to 50 per call |
| Scoring algorithm | Flat distribution makes Claude curation ineffective | Test score histogram offline before Claude integration |
| Claude JSON output | Markdown fencing, wrong key names, truncated JSON | Use JSON mode or strip/validate every response |
| SSE connection | EventSource reconnects restart the pipeline | Heartbeat + immediate close on terminal event |
| Skill level in prompts | Claude ignores it structurally | Make skill level an explicit structural instruction, not metadata |
| localStorage persistence | QuotaExceededError on 10 large courses | Try/catch + evict-oldest + store only parsed output, not raw |
| Hint generation | Race condition on rapid video expansion | Per-video loading state flag before first fetch |
| Export function | Accidentally includes hints in "no answers" export | Whitelist fields in toCourseExport(), never raw object |
| ASR caption quality | Technical jargon mangled by auto-captions | Send title + description alongside transcript; quality heuristic check |

---

## Sources

- YouTube Data API v3 quota information: https://developers.google.com/youtube/v3/determine_quota_cost (HIGH confidence — official docs; quota unit costs are stable and well-documented)
- YouTube captions API restrictions: https://developers.google.com/youtube/v3/docs/captions/list (HIGH confidence — official docs confirm OAuth requirement for download)
- Timedtext endpoint pattern: training knowledge from community usage; no official documentation exists (MEDIUM confidence — widely used but undocumented/unofficial; verify it returns data for target videos before committing to this approach)
- Anthropic JSON mode: https://docs.anthropic.com/en/docs/test-and-evaluate/strengthen-guardrails/increase-consistency (MEDIUM confidence — feature availability depends on model; verify for claude-sonnet-4-5 specifically)
- localStorage limits: MDN Web Docs, browser compatibility tables (HIGH confidence — 5MB limit is consistent across all modern browsers)
- SSE/EventSource behavior: MDN EventSource documentation (HIGH confidence — standard browser API behavior)
- Scoring algorithm design patterns: training knowledge from ranking/recommendation system literature (MEDIUM confidence — general principles, not YouTube-specific studies)
