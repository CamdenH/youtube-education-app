# Phase 5: Lazy Hints - Research

**Researched:** 2026-04-10
**Domain:** Vanilla JS frontend fetch, Express route, Claude prompt engineering, localStorage persistence
**Confidence:** HIGH

## Summary

Phase 5 is a well-scoped wire-up. Phase 4 already built the complete DOM scaffolding — `.hint-text` `<p>` elements per question, the `.btn-hints` button, the CSS for hints and button states — and left the click handler as a `/* Phase 5: POST /api/hint */` no-op. This phase replaces that no-op with a real `fetch()` call to a new `POST /api/hints` endpoint in `server.js`, which calls Claude via the existing `callClaude` wrapper in `claude.js`.

The three work streams are: (1) server-side route + Claude prompt in `server.js`, (2) frontend click handler replacing the stub in `index.html`, and (3) localStorage persistence of fetched hints in a `ylc_hints` key (a flat map keyed by `videoId`) so hints survive page reloads. The localStorage schema must stay consistent with `ylc_history`, `ylc_watched`, and `ylc_searches` established in Phase 4.

No new npm dependencies are needed. No new files are needed — the route goes directly in `server.js` (matching the flat-file convention), and the Claude call function is defined inline in the route handler using `callClaude`.

**Primary recommendation:** Wire the stub button to `fetch('POST /api/hints')`, render all 3 hints atomically on success, show per-video inline error + retry on failure, persist fetched hints in `ylc_hints` localStorage map.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Hints are persisted in localStorage alongside the course — stored as part of the saved course entry (or as a parallel map keyed by videoId). No re-fetch on reload, zero extra API cost on revisit. Exact schema is Claude's discretion but must be consistent with the existing `ylc_history`/`ylc_watched` localStorage structure from Phase 4.
- **D-02:** Each hint is a Socratic nudge — a guiding question or reframe that points the user toward the answer without giving it away. Example tone: *"Think about what happens when X increases — what does the formula predict?"*. Hints must NOT state the answer or give away the conclusion. The Claude prompt must explicitly instruct this constraint.
- **D-03:** If the hint fetch fails, the loading state clears and an inline error message appears where hints would be, with a "Try again" button. The user stays in control — clicking "Try again" re-fires the same `POST /api/hints` call. The error and retry button are scoped to that video's questions section only — no other video's state is affected.
- **D-04:** `POST /api/hints` receives a JSON body with: `videoId`, `videoTitle`, `questions` (array of 3 question strings), and `transcriptSnippet` (the first ~500 words of the transcript, or the description fallback if no transcript). Claude has full context to generate grounded, video-specific Socratic nudges without any server-side re-fetching.

### Claude's Discretion

- Exact localStorage schema for stored hints (must be consistent with Phase 4 schema)
- Exact character/word length of each Socratic hint (aim for 1-2 sentences)
- How `transcriptSnippet` is truncated (first N words or first N characters of the stored transcript)
- Button copy for the retry action ("Try again" or similar)
- Whether hints are stored under the course entry or in a separate `ylc_hints` key

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HINT-01 | POST /api/hints accepts videoId + all 3 questions, returns all 3 hints in one Claude call | Route pattern established in server.js; callClaude wrapper in claude.js; express.json() middleware needed |
| HINT-02 | Hints generated lazily: triggered when user clicks "Reveal thinking points", not at course generation time | Button stub already exists at line 1294-1298 of index.html; click handler is no-op |
| HINT-03 | Hint prompts instruct Claude to give thoughtful direction without revealing the full answer | Socratic nudge prompt pattern; D-02 constraint must be in system/user prompt |
</phase_requirements>

---

## Standard Stack

### Core (all already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@anthropic-ai/sdk` | `^0.82.0` | Claude API client | Already in package.json [VERIFIED: package.json] |
| `express` | `^4.18` | HTTP server + route | Already in package.json [VERIFIED: package.json] |
| `node:test` | built-in | Test runner | Established Phase 1 convention [VERIFIED: package.json test script] |

**No new dependencies.** The entire phase is achievable with existing installed packages.

The one gap: `server.js` currently does not call `express.json()`. The new `POST /api/hints` route will need `req.body` parsed. This requires adding `app.use(express.json())` before the route registration. `express.json()` is built into Express 4.x — no new package needed. [VERIFIED: existing server.js]

**Installation:** Nothing to install.

---

## Architecture Patterns

### Project Structure (flat — no changes)

```
(project root)
├── server.js       ← add POST /api/hints route + express.json() middleware
├── claude.js       ← reuse callClaude and parseClaudeJSON as-is
├── index.html      ← replace no-op stub with real fetchHints() function
└── tests/unit/
    ├── server.test.js    ← add POST /api/hints test cases
    └── frontend.test.js  ← add hint fetch + localStorage restore tests
```

No new files. No new subdirectories.

### Pattern 1: Route Registration in server.js

The existing `POST` route follows the same shape as the `GET /api/course-stream` route — validate inputs, call internal logic, catch errors, return structured JSON.

```javascript
// Source: existing server.js integration pattern [VERIFIED: server.js]
'use strict';

app.use(express.json()); // Add before routes — parses req.body for POST

app.post('/api/hints', async (req, res) => {
  const { videoId, videoTitle, questions, transcriptSnippet } = req.body;

  // Input validation
  if (!videoId || typeof videoId !== 'string') {
    return res.status(400).json({ error: 'videoId is required' });
  }
  if (!Array.isArray(questions) || questions.length !== 3) {
    return res.status(400).json({ error: 'questions must be an array of 3 strings' });
  }
  if (!videoTitle || typeof videoTitle !== 'string') {
    return res.status(400).json({ error: 'videoTitle is required' });
  }

  try {
    const hints = await callClaude(generateHints, videoId, videoTitle, questions, transcriptSnippet || '');
    return res.json({ hints }); // Array of 3 hint strings
  } catch (err) {
    console.error('[hints] Claude error:', err);
    return res.status(500).json({ error: 'Failed to generate hints. Please try again.' });
  }
});
```

### Pattern 2: Claude Prompt for Socratic Hints

The prompt must explicitly enforce D-02: do not reveal the answer. The response must be a JSON array of exactly 3 hint strings (one per question), parseable by `parseClaudeJSON`.

```javascript
// Source: established claude.js pattern [VERIFIED: claude.js, assembler.js pattern]
async function generateHints(videoId, videoTitle, questions, transcriptSnippet) {
  const { default: Anthropic } = require('@anthropic-ai/sdk'); // or top-level require
  const anthropic = new Anthropic();

  const prompt = `You are a Socratic tutor helping a student think through comprehension questions about a video they just watched.

Video title: ${videoTitle}
Transcript excerpt: ${transcriptSnippet}

For each of the following questions, provide one thinking hint. A hint must:
- Be a guiding question or reframe that nudges the student toward the answer
- NOT state the answer or conclusion directly
- Be 1-2 sentences maximum
- Be specific to this video's content, not generic

Questions:
${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

Respond with a JSON array of exactly 3 hint strings, one per question, in the same order.
Example format: ["Hint for Q1...", "Hint for Q2...", "Hint for Q3..."]`;

  const message = await anthropic.messages.create({
    model: 'claude-opus-4-5', // or whichever model the project uses
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  });

  return parseClaudeJSON(message.content[0].text);
}
```

### Pattern 3: Frontend Click Handler (replacing the no-op stub)

The stub is at index.html line 1298. The replacement:

```javascript
// Source: existing index.html pattern [VERIFIED: index.html lines 1293-1299]
hintsBtn.addEventListener('click', () => fetchHints(video, hintsBtn, questionsDetails));

async function fetchHints(video, btn, container) {
  // Build transcriptSnippet from stored course data (client-side truncation)
  const transcript = video.transcript || video.description || '';
  const words = transcript.split(/\s+/).slice(0, 500).join(' ');

  // Loading state — scoped to this button only
  btn.disabled = true;
  btn.textContent = 'Loading hints...';
  clearHintError(container);

  try {
    const res = await fetch('/api/hints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoId: video.videoId,
        videoTitle: video.title,
        questions: video.questions.map(q => q.text),
        transcriptSnippet: words,
      }),
    });

    if (!res.ok) {
      throw new Error('Server error ' + res.status);
    }

    const data = await res.json();
    renderHints(video.videoId, data.hints, container);
    persistHints(video.videoId, data.hints);
    btn.hidden = true; // Button disappears after hints shown
  } catch (err) {
    btn.disabled = false;
    btn.textContent = 'Reveal thinking points';
    showHintError(container, () => fetchHints(video, btn, container));
  }
}
```

### Pattern 4: localStorage Schema for Hints

Consistent with Phase 4 pattern — namespaced key, try/catch on write, flat map by videoId.

```javascript
// Source: existing ylc_watched pattern [VERIFIED: index.html lines 1312-1324]
const HINTS_KEY = 'ylc_hints';

function persistHints(videoId, hints) {
  try {
    const stored = JSON.parse(localStorage.getItem(HINTS_KEY) || '{}');
    stored[videoId] = hints; // Array of 3 hint strings
    localStorage.setItem(HINTS_KEY, JSON.stringify(stored));
  } catch (_) { /* best-effort */ }
}

function loadHints(videoId) {
  try {
    const stored = JSON.parse(localStorage.getItem(HINTS_KEY) || '{}');
    return stored[videoId] || null; // null = not yet fetched
  } catch (_) {
    return null;
  }
}
```

At render time, check `loadHints(video.videoId)` — if non-null, render hints immediately and hide the button. This is the reload-restore path.

### Pattern 5: Inline Error + Retry

Per D-03, error renders inside the questions accordion for that video only.

```javascript
function showHintError(container, retryFn) {
  clearHintError(container);
  const err = document.createElement('p');
  err.className = 'hint-error';
  err.dataset.hintError = 'true';
  err.textContent = 'Could not load hints. ';
  const retryBtn = document.createElement('button');
  retryBtn.className = 'btn-retry-hint';
  retryBtn.textContent = 'Try again';
  retryBtn.addEventListener('click', retryFn);
  err.appendChild(retryBtn);
  container.appendChild(err);
}

function clearHintError(container) {
  const existing = container.querySelector('[data-hint-error]');
  if (existing) existing.remove();
}
```

### Anti-Patterns to Avoid

- **Separate Claude call per question:** REQUIREMENTS.md explicitly marks this out-of-scope. All 3 hints in one call (HINT-01).
- **Fetching hints at course generation time:** HINT-02 is explicit — lazy only, on button click.
- **Global loading state:** Disabling the whole UI or showing a top-level spinner while hints load violates D-03's isolation requirement.
- **Storing hints inside the `ylc_history` course entry:** Hints are mutable (can be re-fetched on retry) while history entries are immutable snapshots. A separate `ylc_hints` key avoids mutating history entries and keeps the structures clean. [ASSUMED — either approach satisfies D-01, but separate key is cleaner]
- **Fetching transcriptSnippet from the server:** D-04 says the client sends the snippet. No new server-side transcript fetch needed.
- **Using ESM or TypeScript:** Prohibited by CLAUDE.md.
- **Adding a new file (e.g., hints.js):** The route belongs in `server.js` per the flat-file convention in CLAUDE.md. `generateHints` as a local function inside `server.js` is fine at this scope.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON body parsing | Custom body reader | `express.json()` built-in middleware | Express 4.x ships it; one line [VERIFIED: express docs] |
| Claude retry/backoff | Custom retry loop | `callClaude(fn, ...args)` in claude.js | Already implemented with exponential backoff + 2 retries [VERIFIED: claude.js] |
| JSON fence stripping | Custom regex | `parseClaudeJSON(text)` in claude.js | Already handles ` ```json ` and ` ``` ` fences [VERIFIED: claude.js] |
| Socratic hint content | Custom heuristic | Claude prompt with explicit no-answer constraint | LLM judgment is better than keyword rules for Socratic framing |

---

## Common Pitfalls

### Pitfall 1: Missing express.json() Middleware

**What goes wrong:** `req.body` is `undefined` on the `POST /api/hints` route. The destructure silently produces `undefined` for all fields. Input validation fails or crashes.

**Why it happens:** Express does not parse JSON bodies by default. `server.js` currently has no body parser because all existing routes are `GET` with query params. [VERIFIED: server.js]

**How to avoid:** Add `app.use(express.json())` before route registration. Place it right after `app.use(express.static(...))`.

**Warning signs:** `req.body` is `undefined` or `{}` in the route handler.

### Pitfall 2: transcriptSnippet Availability

**What goes wrong:** The client tries to send `video.transcript` as the snippet, but the course JSON shape (from Phase 3) does not include a `transcript` field — Claude assembled the course from transcripts but the transcript text itself was not passed through to the final `CourseObject`. [VERIFIED: 03-CONTEXT.md course JSON contract — no `transcript` field in video object]

**Why it happens:** Phase 3 (assembler.js) uses transcripts to write questions and blurbs, but the `transcript` text is not stored in the assembled course JSON. The frontend only has the course object.

**How to avoid:** Two options:
1. Use `video.blurb` + `video.questions` text as a proxy for context (low-fidelity but always available)
2. Pass the transcript text through the course JSON — add an optional `transcriptSnippet` field to each video in `assembleCourse`

Option 2 is cleaner and aligns with D-04. The assembler already has the transcript text at assembly time and can include the first 500 words in each video object. This is the recommended approach. **Flag to planner: this requires a small change to assembler.js to include `transcriptSnippet` in each video object.**

**Warning signs:** `video.transcript` is `undefined` in the frontend; hints are generated without useful context, producing generic rather than video-specific nudges.

### Pitfall 3: Hint State Not Restored on History Load

**What goes wrong:** User generates a course, reveals hints, navigates away, then clicks the course in history. The course renders from `ylc_history` but hints don't appear because the render function doesn't check `ylc_hints`.

**Why it happens:** `renderCourse` is called with the saved course object. The render function must be updated to check `loadHints(video.videoId)` at render time and pre-populate hints if available.

**How to avoid:** At render time, after creating the `hintsBtn` and `.hint-text` elements, call `loadHints(video.videoId)`. If hints exist, call `renderHints()` immediately and hide `hintsBtn`.

**Warning signs:** Hints are in localStorage but not showing after a history restore.

### Pitfall 4: Claude Model Name / Max Tokens

**What goes wrong:** Using a model ID that's been deprecated or a `max_tokens` value too low for 3 hints.

**Why it happens:** Model names evolve. Training knowledge may be stale.

**How to avoid:** Check what model the existing codebase uses (scorer.js, assembler.js, queries.js) and match it exactly. For hints, 512 tokens should be sufficient for 3 × 1-2 sentence hints, but 1024 is a safer ceiling. [ASSUMED — verify actual model used in scorer.js/assembler.js]

### Pitfall 5: Button Stays Disabled on Network Error

**What goes wrong:** `fetch` throws (network failure), the `catch` block runs, but if the button re-enable logic is only in the `catch` and the button is not re-enabled before `showHintError`, the user sees an error message but can't click "Reveal thinking points" again.

**Why it happens:** Async state management — the `finally` block pattern is safer than re-enabling only in `catch`.

**How to avoid:** Use a `finally` block or ensure both success and error paths re-enable the button (success path hides it; error path re-enables it).

---

## Code Examples

### Verified patterns from existing codebase

#### Input Validation Pattern (from server.js)
```javascript
// Source: server.js lines 23-29 [VERIFIED]
if (!subject || subject.length > 200) {
  return res.status(400).json({ error: 'subject is required and must be 200 characters or fewer' });
}
```

#### callClaude Usage Pattern
```javascript
// Source: claude.js lines 26-58 [VERIFIED]
// callClaude wraps any async function with retry + backoff
// Usage: callClaude(myAsyncFn, arg1, arg2, ...)
// The fn receives (arg1, arg2, ...) — no wrapper needed
const hints = await callClaude(generateHints, videoId, videoTitle, questions, transcriptSnippet);
```

#### parseClaudeJSON Usage
```javascript
// Source: claude.js lines 71-80 [VERIFIED]
// Strips ```json fences and parses
const parsed = parseClaudeJSON(message.content[0].text);
// Returns the JS object/array — throws SyntaxError if malformed
```

#### localStorage write with try/catch
```javascript
// Source: index.html saveHistory pattern [VERIFIED: lines 992-1002]
try {
  localStorage.setItem('ylc_hints', JSON.stringify(stored));
} catch (_) { /* best-effort */ }
```

#### makeTestApp pattern (for POST route testing)
```javascript
// Source: server.test.js lines 16-35 [VERIFIED]
// Use makeTestApp with a mock hintsHandler for unit tests
// The real app can be tested with supertest-style fetch to a real listen() server
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-question hint call | Batch all 3 in one call | REQUIREMENTS.md (HINT-01) | Cost control; atomicity |
| SSE for hints | Simple POST/JSON response | This phase design | Hints are short; SSE overhead not justified |

**Not applicable here:** No deprecated APIs or migration needed in this phase.

---

## Open Questions

1. **Does the course JSON include transcript text?**
   - What we know: Phase 3 course JSON contract (03-CONTEXT.md) does not include a `transcript` field in the video object. Transcript text was used by assembler.js internally but not stored.
   - What's unclear: Whether assembler.js was modified post-context to include it, or whether the frontend has another access path.
   - Recommendation: Read assembler.js before planning to confirm the video object shape. If no `transcript` field, the planner should include a task to add `transcriptSnippet` (first 500 words) to each video object in assembler.js.

2. **Which Claude model ID is used in scorer.js / assembler.js?**
   - What we know: `@anthropic-ai/sdk ^0.82.0` is installed. The hints route will use the same model.
   - What's unclear: Exact model string (e.g., `claude-opus-4-5`, `claude-3-5-haiku-20241022`, etc.)
   - Recommendation: Read scorer.js or assembler.js for the model name and use it verbatim.

---

## Environment Availability

Step 2.6: SKIPPED (no new external dependencies — all tooling already confirmed installed).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node:test` |
| Config file | none — invoked directly |
| Quick run command | `node --test --test-concurrency=1 tests/unit/server.test.js` |
| Full suite command | `node --test --test-concurrency=1 tests/unit/*.test.js` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HINT-01 | POST /api/hints returns 3 hints for valid body | unit | `node --test --test-concurrency=1 tests/unit/server.test.js` | Wave 0 |
| HINT-01 | POST /api/hints returns 400 for missing videoId | unit | `node --test --test-concurrency=1 tests/unit/server.test.js` | Wave 0 |
| HINT-01 | POST /api/hints returns 400 for non-3-element questions array | unit | `node --test --test-concurrency=1 tests/unit/server.test.js` | Wave 0 |
| HINT-01 | POST /api/hints returns 500 JSON when Claude call fails | unit | `node --test --test-concurrency=1 tests/unit/server.test.js` | Wave 0 |
| HINT-02 | Button click triggers fetch (not on accordion open) | unit (JSDOM) | `node --test --test-concurrency=1 tests/unit/frontend.test.js` | Wave 0 |
| HINT-01 | Hints rendered atomically — all 3 appear together | unit (JSDOM) | `node --test --test-concurrency=1 tests/unit/frontend.test.js` | Wave 0 |
| HINT-01 | Error state + retry button appear on fetch failure | unit (JSDOM) | `node --test --test-concurrency=1 tests/unit/frontend.test.js` | Wave 0 |
| HINT-01 | Hints persisted to ylc_hints on success | unit (JSDOM) | `node --test --test-concurrency=1 tests/unit/frontend.test.js` | Wave 0 |
| HINT-01 | Hints restored from ylc_hints on render (no button shown) | unit (JSDOM) | `node --test --test-concurrency=1 tests/unit/frontend.test.js` | Wave 0 |
| HINT-01 | Other video hints state unaffected when one fails | unit (JSDOM) | `node --test --test-concurrency=1 tests/unit/frontend.test.js` | Wave 0 |

**Note on frontend.test.js:** The existing file tests DOM rendering from Phase 4. Phase 5 adds cases to it. Review what JSDOM setup exists; if `frontend.test.js` already uses a DOM simulator pattern, follow it.

### Sampling Rate
- **Per task commit:** `node --test --test-concurrency=1 tests/unit/server.test.js tests/unit/frontend.test.js`
- **Per wave merge:** `node --test --test-concurrency=1 tests/unit/*.test.js`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] New `POST /api/hints` test cases in `tests/unit/server.test.js` — covers HINT-01 server contract
- [ ] New hint fetch/render/persist/restore test cases in `tests/unit/frontend.test.js` — covers HINT-01 frontend + HINT-02

*(Existing test files — no new test files needed; append to existing ones)*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth in this phase |
| V3 Session Management | no | localStorage only, no session tokens |
| V4 Access Control | no | No user-scoped data in this phase |
| V5 Input Validation | yes | Validate `videoId` (string), `questions` (array of 3 strings), `videoTitle` (string) — reject malformed bodies with 400 |
| V6 Cryptography | no | No crypto operations |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prompt injection via videoTitle/questions | Tampering | Treat user-supplied strings as data (not instructions) in the prompt; Claude's system prompt separation helps; no eval or shell exec involved |
| Oversized body payload | Denial of service | `express.json()` has a default 100kb body limit — sufficient; do not raise it |
| Sending arbitrary transcriptSnippet to Claude | Tampering | Server does not re-fetch transcript; client sends snippet — consider truncating server-side to 2000 chars as a hard cap regardless of what client sends |

---

## Project Constraints (from CLAUDE.md)

- `'use strict'` at top of every JS file — applies to any function added to server.js
- `module.exports` only — no ESM, no `import/export`
- Tests use `node:test` with `--test-concurrency=1`
- No new npm dependencies without asking first
- No new files/subdirectories unless necessary — route goes in server.js
- No TypeScript, no ESM, no logging frameworks, no ORMs
- No wrapper functions around one-liners
- Explain approach before implementing anything non-trivial
- Flag spotted problems rather than silently fixing them
- Express pinned to `^4.18` [VERIFIED: package.json]

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The course video object does not include a `transcript` or `transcriptSnippet` field — client must send description or blurb as fallback | Pitfall 2, Open Questions | If assembler.js already includes transcript text, the workaround task (modifying assembler.js) is unnecessary |
| A2 | `ylc_hints` separate key is cleaner than storing hints inside ylc_history entries | Architecture Patterns | Minor — either schema satisfies D-01; decision is explicitly Claude's discretion |
| A3 | Claude model string matches what scorer.js/assembler.js use | Code Examples | Wrong model name = runtime error on first hint call |
| A4 | 512–1024 max_tokens is sufficient for 3 × 1-2 sentence hints | Standard Stack | Too low = truncated hints from Claude |

---

## Sources

### Primary (HIGH confidence)
- `server.js` (project root) — existing route patterns, error handling convention [VERIFIED: read in session]
- `claude.js` (project root) — `callClaude`, `parseClaudeJSON` API [VERIFIED: read in session]
- `index.html` lines 1280–1299 — button stub location, `.hint-text` DOM elements, existing localStorage keys [VERIFIED: read in session]
- `package.json` — installed dependencies, test runner command [VERIFIED: read in session]
- `03-CONTEXT.md` — course JSON contract, transcript handling [VERIFIED: read in session]
- `04-CONTEXT.md` — localStorage schema conventions, button stub detail [VERIFIED: read in session]
- `05-CONTEXT.md` — all locked decisions D-01 through D-04 [VERIFIED: read in session]

### Secondary (MEDIUM confidence)
- Express 4.x `express.json()` body parser being built-in — well-established, matches Express 4 docs [ASSUMED — not verified via Context7 in this session but extremely high confidence]

### Tertiary (LOW confidence)
- None.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all existing packages verified in package.json
- Architecture: HIGH — all patterns derived directly from verified existing code
- Pitfalls: HIGH (P1, P3, P5) / MEDIUM (P2, P4) — P2 and P4 depend on assembler.js content not yet read

**Research date:** 2026-04-10
**Valid until:** 2026-05-10 (stable stack, nothing fast-moving)
