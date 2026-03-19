# Technology Stack

**Project:** YouTube Learning Curator
**Researched:** 2026-03-18
**Confidence note:** External tools (WebFetch, WebSearch, npm CLI) were unavailable during this research session. Version numbers are based on training data through August 2025. Versions MUST be verified with `npm view <pkg> version` before writing package.json.

---

## Recommended Stack

### Core Framework

| Technology | Version (verify) | Purpose | Why |
|------------|-----------------|---------|-----|
| Node.js | 20 LTS or 22 LTS | Runtime | LTS branch guarantees stability; 20 is widely deployed, 22 is current LTS as of late 2024. Either works. Use whatever is on your machine. |
| Express | 4.x (4.19+) | HTTP server | Express 5 reached stable in late 2024 but has breaking changes (promise rejection handling, path-to-regexp v8). For a simple single-file server there's no compelling reason to take on v5 migration risk. Stick with 4.x. |

**Confidence (Express version):** MEDIUM — Express 5.0.0 was released stable in late 2024 per my training data, but adoption in patterns/tutorials is still primarily 4.x. Verify current recommended version before choosing.

### YouTube Integration

| Technology | Version (verify) | Purpose | Why |
|------------|-----------------|---------|-----|
| `googleapis` | ^140.x | YouTube Data API v3 | Official Google client library. Handles auth, quota headers, type-safe API calls. Alternative is raw fetch to `https://www.googleapis.com/youtube/v3/` — do NOT use raw fetch; the googleapis client handles retry, error parsing, and API key injection correctly. |

**What to use from googleapis:** Only `youtube` service via `google.youtube('v3')`. Do not pull in the full client — tree-shaking doesn't apply to CJS but the import is scoped correctly if you only instantiate the youtube service.

**Confidence (googleapis version):** LOW — version number is a guess. Run `npm view googleapis version` to get current. The API pattern (`google.youtube('v3').search.list(...)`) is stable across versions.

### AI Integration

| Technology | Version (verify) | Purpose | Why |
|------------|-----------------|---------|-----|
| `@anthropic-ai/sdk` | ^0.27.x | Claude API calls + streaming | Official SDK. Handles auth headers, retry on 529 (overload), and exposes a clean streaming interface via `stream()`. Do NOT use raw fetch to `api.anthropic.com` — the SDK's streaming abstraction is essential for the SSE pipeline. |

**Model to use:** `claude-sonnet-4-5` as specified in PROJECT.md. At call time, always pass model as a config constant so you can update it in one place.

**Confidence (@anthropic-ai/sdk version):** LOW — SDK was at ~0.24-0.27 range as of my cutoff. Run `npm view @anthropic-ai/sdk version` to confirm current. The API surface (`client.messages.create(...)`, `client.messages.stream(...)`) is stable.

### Configuration

| Technology | Version (verify) | Purpose | Why |
|------------|-----------------|---------|-----|
| `dotenv` | ^16.x | Load `.env` into `process.env` | Zero-dependency, standard pattern for local dev. Call `dotenv.config()` at the top of `server.js` before any other imports that read env vars. |

**Pattern:** One `.env` file, two keys:
```
YOUTUBE_API_KEY=...
ANTHROPIC_API_KEY=...
```
Never commit `.env`. Add `.env` to `.gitignore` on day one.

**Confidence (dotenv):** HIGH — dotenv 16.x has been stable for years. The API has not changed.

### HTTP / SSE

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Native `http` / Express response object | Built-in | SSE for pipeline progress | No extra library needed. Express's `res.write()` is sufficient for SSE. See SSE pattern below. |
| `cors` | ^2.x | Allow browser requests from file:// or different port | Simple middleware. Only needed if you ever open `index.html` directly as a file rather than serving it through Express. If Express serves `index.html`, skip cors entirely. |

**Confidence (cors):** HIGH — cors 2.x has been stable for years.

### Dev Tooling

| Technology | Version (verify) | Purpose | Why |
|------------|-----------------|---------|-----|
| `nodemon` | ^3.x | Auto-restart server on file change | Standard local dev tool. Only in devDependencies. |

**Confidence (nodemon):** MEDIUM — nodemon 3.x was current as of my cutoff. Verify.

---

## What NOT to Use

| Category | Avoid | Why |
|----------|-------|-----|
| YouTube client | `ytdl-core`, `youtube-dl` wrappers | These are for video download, not API queries. Wrong tool. |
| YouTube transcript | `youtube-transcript` npm package | Unmaintained, breaks frequently as YouTube changes internal endpoints. Use the captions API directly (see pattern below). |
| AI streaming | Raw `fetch` to Anthropic API | The SDK's streaming abstraction handles chunked SSE parsing, error recovery, and token counting. Don't rebuild it. |
| Frontend | React, Vue, any framework | PROJECT.md explicitly forbids this. Vanilla JS + one HTML file. |
| HTTP client | `axios`, `node-fetch` | Node 18+ has native `fetch`. Use it. The googleapis and anthropic SDKs manage their own HTTP internally. |
| Process manager | `pm2` | Overkill for a local tool. `nodemon` for dev, `node server.js` for production. |
| Environment | `config` npm package, `dotenv-safe` | dotenv alone is sufficient for two keys. |

---

## YouTube Captions / Transcript Fetching

This is the trickiest part of the stack. Two options exist:

### Option A: YouTube Data API v3 Captions Endpoint (AVOID for this use case)

`youtube.captions.list()` and `youtube.captions.download()` — the download endpoint requires **OAuth 2.0**, not an API key. Since this app has no auth, this endpoint is **not usable**.

**Confidence:** HIGH — this is clearly documented in YouTube API docs.

### Option B: Undocumented Timedtext Endpoint (USE THIS)

YouTube serves auto-generated and manual captions via a public (no auth) endpoint:

```
https://www.youtube.com/api/timedtext?v={VIDEO_ID}&lang=en&fmt=json3
```

**Parameters:**
- `v` — video ID
- `lang` — language code (use `en` as default, fall back to first available)
- `fmt` — format. Use `json3` (structured JSON with timestamps) or `srv1` (simple XML). `json3` is easiest to parse.
- `tlang` — auto-translate to a language if no native captions exist (use sparingly)

**How to discover available captions for a video:**

```
https://www.youtube.com/api/timedtext?v={VIDEO_ID}&type=list
```

Returns XML listing available caption tracks. Parse the `lang_code` attributes to find what's available before attempting download.

**Fetch pattern (Node.js native fetch):**

```javascript
async function fetchTranscript(videoId) {
  // 1. Get available tracks
  const listUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&type=list`;
  const listRes = await fetch(listUrl);
  const listXml = await listRes.text();
  // Parse for lang_code="en" or first available track
  // ...

  // 2. Fetch the transcript
  const transcriptUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&fmt=json3`;
  const res = await fetch(transcriptUrl, {
    headers: { 'Accept-Language': 'en-US,en;q=0.9' }
  });
  if (!res.ok) return null; // fall back to video description

  const data = await res.json();
  // data.events is an array of { tStartMs, dDurationMs, segs: [{ utf8 }] }
  const text = data.events
    .filter(e => e.segs)
    .flatMap(e => e.segs.map(s => s.utf8))
    .join(' ')
    .replace(/\n/g, ' ');
  return text;
}
```

**Caveats:**
- This endpoint is undocumented and could break without notice. The PROJECT.md already accounts for fallback to video description.
- Auto-generated captions exist for most English videos but quality varies.
- Some videos have captions disabled entirely — always handle null/empty response.
- YouTube occasionally returns a 200 with empty body for videos with no captions. Check `data.events` before accessing.
- User-Agent header is generally not required but adding a browser-like Accept-Language header improves reliability.

**Confidence:** MEDIUM — this endpoint has been used reliably by the open-source community for years (e.g., the `youtube-transcript` package uses it internally). But it is undocumented and carries breakage risk.

### Fallback Strategy (Required)

```javascript
async function getVideoText(video) {
  const transcript = await fetchTranscript(video.id);
  if (transcript && transcript.length > 200) {
    return { source: 'transcript', text: transcript };
  }
  // Fall back to description
  return { source: 'description', text: video.snippet.description || '' };
}
```

Always pass `source` to Claude so it can calibrate question quality accordingly.

---

## SSE Pattern for Pipeline Progress

The loading pipeline has multiple stages (query generation, YouTube search, scoring, transcript fetch, Claude curation, question generation). Use Server-Sent Events to stream progress to the frontend.

### Server-Side (Express)

```javascript
app.get('/api/generate', async (req, res) => {
  // SSE headers — must be set before any write
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders(); // flush the 200 + headers immediately

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    send('progress', { step: 'queries', message: 'Generating search queries...' });
    const queries = await generateQueries(subject, level); // Claude call

    send('progress', { step: 'search', message: 'Searching YouTube...' });
    const videos = await searchYouTube(queries);

    send('progress', { step: 'scoring', message: 'Scoring videos...' });
    const scored = scoreVideos(videos, level);

    send('progress', { step: 'transcripts', message: 'Fetching transcripts...' });
    const withText = await fetchTranscripts(scored.slice(0, 12));

    send('progress', { step: 'curation', message: 'Curating with Claude...' });
    const course = await curateCourse(withText, subject, level);

    send('complete', { course });
  } catch (err) {
    send('error', { message: err.message });
  } finally {
    res.end();
  }
});
```

### Client-Side (Vanilla JS)

```javascript
const evtSource = new EventSource(`/api/generate?subject=${encodeURIComponent(subject)}&level=${level}`);

evtSource.addEventListener('progress', (e) => {
  const { step, message } = JSON.parse(e.data);
  updateProgressUI(step, message);
});

evtSource.addEventListener('complete', (e) => {
  const { course } = JSON.parse(e.data);
  evtSource.close();
  renderCourse(course);
});

evtSource.addEventListener('error', (e) => {
  evtSource.close();
  showError(JSON.parse(e.data).message);
});
```

**Important SSE decisions:**
- `GET` not `POST` — `EventSource` only supports GET. Pass subject and level as query params.
- `res.flushHeaders()` is critical — without it, Node.js buffers the response and the client gets nothing until the stream closes.
- No SSE library needed. Express's raw `res.write()` is sufficient.
- The `event:` line is required for named event listeners. Without it, everything fires as `message`.

**Confidence:** HIGH — this is a well-established pattern in Express. No external library needed.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Framework | Express 4.x | Fastify | Fastify has better performance but the ecosystem/examples for SSE are more mature in Express. For a local tool, performance is irrelevant. |
| Framework | Express 4.x | Express 5.x | Express 5 adds async error propagation but requires path-to-regexp v8 which breaks many existing route patterns. No benefit here. |
| YouTube client | googleapis | Raw fetch | Raw fetch means manually building URL params, handling API errors, and parsing quota headers. googleapis is ~200KB but saves significant boilerplate. |
| Transcript | Timedtext endpoint | youtube-transcript npm | youtube-transcript is a thin wrapper around the same endpoint but is poorly maintained and adds a dependency for minimal benefit. |
| Config | dotenv | Hardcoded values | Never. |
| Config | dotenv | `process.env` only (no dotenv) | Node does not auto-load .env files. dotenv.config() is required. |
| Streaming | SSE | WebSocket | WebSockets require a handshake and a separate ws library. SSE is simpler for one-direction server→client streaming and works with native EventSource. |

---

## Installation

```bash
# Initialize package.json
npm init -y

# Production dependencies
npm install express googleapis @anthropic-ai/sdk dotenv

# Optional: cors (only needed if not serving index.html through Express)
# npm install cors

# Dev dependencies
npm install -D nodemon
```

**package.json scripts:**
```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "type": "module"
}
```

**Note on `"type": "module"`:** Using ESM (`import`/`export`) rather than CJS (`require`) is recommended for new Node.js projects in 2025. googleapis and @anthropic-ai/sdk both support ESM. If ESM feels unfamiliar, CJS works fine — just omit `"type": "module"` and use `require()`.

---

## server.js Entry Point Pattern

```javascript
import 'dotenv/config'; // must be first
import express from 'express';
import { google } from 'googleapis';
import Anthropic from '@anthropic-ai/sdk';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url)); // ESM equivalent of __dirname
const app = express();
const PORT = process.env.PORT || 3000;

const youtube = google.youtube({ version: 'v3', auth: process.env.YOUTUBE_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.use(express.json());
app.use(express.static(__dirname)); // serves index.html at /

// Routes here...

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
```

---

## Sources

- Express documentation: https://expressjs.com/en/4x/api.html
- googleapis npm package: https://www.npmjs.com/package/googleapis
- @anthropic-ai/sdk npm: https://www.npmjs.com/package/@anthropic-ai/sdk
- Anthropic Node SDK streaming docs: https://github.com/anthropic-sdk/sdk-node
- YouTube Data API v3 Captions: https://developers.google.com/youtube/v3/docs/captions
- YouTube timedtext endpoint: undocumented, community-verified
- dotenv: https://www.npmjs.com/package/dotenv
- MDN EventSource: https://developer.mozilla.org/en-US/docs/Web/API/EventSource

**Version verification required before writing package.json:**
```bash
npm view express version
npm view @anthropic-ai/sdk version
npm view googleapis version
npm view dotenv version
npm view nodemon version
```
