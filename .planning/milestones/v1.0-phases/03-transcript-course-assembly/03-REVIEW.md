---
phase: 03-transcript-course-assembly
reviewed: 2026-04-08T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - assembler.js
  - sse.js
  - tests/unit/assembler.test.js
  - tests/unit/sse.test.js
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-04-08
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

The phase adds `assembler.js` (single-call Claude course assembly), wires it into `courseStreamHandler` in `sse.js` (steps 4–5), and provides test coverage for both. The overall structure is clean, the pipeline logic is correct, and the TOO_FEW_VIDEOS gate and description fallback are implemented as specified. No security vulnerabilities or data loss risks were found.

Four warnings stand out: a crash path when Claude returns an empty content array, a silent data-corruption path when Claude hallucinates a videoId, a missing `try/finally` in a test that mutates shared stub state, and a null-guard gap on `video.snippet` in the prompt builder. Three informational items cover a missing negative test path, a missing convention violation in a related file, and a minor test coverage gap.

## Warnings

### WR-01: Unguarded `response.content[0]` will throw if Claude returns no content blocks

**File:** `assembler.js:193`
**Issue:** The inner function passed to `callClaude` reads `response.content[0].text` without checking whether `response.content` is non-empty. The Anthropic SDK can return a `stop_reason` of `"max_tokens"` with an empty `content` array, or a response object in an unexpected shape. In either case, `response.content[0]` is `undefined` and `.text` throws a `TypeError`, which surfaces to the caller as an unhandled error rather than a meaningful message.
**Fix:**
```js
const response = await anthropic.messages.create({
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 8192,
  messages: [{ role: 'user', content: prompt }],
});
const block = response.content && response.content[0];
if (!block || !block.text) {
  throw new Error('Claude returned an empty response — no content blocks');
}
return block.text;
```

---

### WR-02: Hallucinated videoId is passed through silently, producing a malformed video object

**File:** `assembler.js:125`
**Issue:** When Claude invents a `videoId` that does not exist in `videoMap`, the function returns `claudeVideo` as-is. The raw Claude object has only `videoId`, `blurb`, `outdated`, and `questions` — it is missing `title`, `channelTitle`, `thumbnail`, `url`, `durationSeconds`, and `score`. The frontend will receive this malformed object with no indication that anything went wrong. The silent pass-through is harder to debug than an explicit log or filtered-out entry.
**Fix:** At minimum, log a warning so the issue surfaces in server logs. Optionally filter hallucinated videos out entirely:
```js
if (!scored) {
  console.warn(`[assembler] Claude returned unknown videoId "${claudeVideo.videoId}" — skipping`);
  return null; // filter out below with .filter(Boolean)
}
```
And in the outer `.map()`:
```js
videos: (module.videos || []).map(claudeVideo => { ... }).filter(Boolean),
```

---

### WR-03: Test stub restore is not inside `try/finally` — corruption risk if handler throws

**File:** `tests/unit/sse.test.js:383-415`
**Issue:** The description-fallback test (line 383) mutates shared stub state (`transcriptStub._impl` and `require.cache[youtubePath].exports.fetchVideoStats`) and restores them on lines 403-404, but only after `await courseStreamHandler(req, res)`. If `courseStreamHandler` throws before completing, the restore lines are never reached and subsequent tests run with the wrong stubs. Because tests run serially (`--test-concurrency=1`), this could silently corrupt later assertions.
**Fix:**
```js
try {
  await courseStreamHandler(req, res);
} finally {
  transcriptStub._impl = async () => ({ source: 'captions', text: 'Transcript text here.' });
  require.cache[youtubePath].exports.fetchVideoStats = async () => [STUB_VIDEO];
}
```

---

### WR-04: `video.snippet` accessed without null guard in `buildAssemblyPrompt`

**File:** `assembler.js:40-41`
**Issue:** `v.snippet.title` and `v.snippet.channelTitle` are accessed directly in the `.map()`. The YouTube API always populates `snippet` for list responses, but the function signature accepts any array of "scored video objects" and makes no assertion about shape. If a video arrives without a `snippet` (e.g., a future refactor or an edge case in `fetchVideoStats`), this throws a `TypeError` mid-prompt-build, which is harder to trace than a validation error.
**Fix:** Add a guard at the top of the `.map()` callback:
```js
const snippet = v.snippet || {};
const title       = snippet.title       || '(untitled)';
const channelTitle = snippet.channelTitle || '(unknown channel)';
```
Then use `title` and `channelTitle` in the template literal.

---

## Info

### IN-01: No negative test for `parseClaudeJSON` failure path in assembler

**File:** `tests/unit/assembler.test.js`
**Issue:** All seven tests use a `fakeCallClaude` that returns valid JSON. There is no test covering the case where Claude returns non-JSON (e.g., a plain apology string). In that case `parseClaudeJSON` throws a `SyntaxError` which propagates out of `assembleCourse`. The behavior is correct (the error bubbles to `server.js` for SSE error event emission), but the path is untested.
**Fix:** Add a test along these lines:
```js
test('assembleCourse propagates SyntaxError when Claude returns invalid JSON', async () => {
  const fakeCallClaude = async () => 'Sorry, I cannot help with that.';
  const { assembleCourse } = loadAssemblerWithMock(fakeCallClaude);
  const videos = [makeVideo('v1'), makeVideo('v2'), makeVideo('v3'), makeVideo('v4'), makeVideo('v5')];
  await assert.rejects(
    () => assembleCourse(videos, {}, 'Subject', 'beginner'),
    SyntaxError
  );
  cleanup();
});
```

---

### IN-02: No test for the hallucinated-videoId pass-through path in `mergeClaudeOutput`

**File:** `tests/unit/assembler.test.js`
**Issue:** The `if (!scored) return claudeVideo` branch (assembler.js line 125) is never exercised by the test suite. If WR-02 is addressed (warn + filter), there is still no test confirming the behaviour.
**Fix:** Add a test where `STUB_COURSE_FROM_CLAUDE.modules[0].videos` contains a videoId not in the `videos` array, and assert either that the video is absent from the result or that the result still has the expected shape.

---

### IN-03: `transcript.js` is missing `'use strict'` at the top

**File:** `transcript.js:1`
**Issue:** Every other JS file in the project begins with `'use strict'` as required by CLAUDE.md. `transcript.js` does not — it starts directly with `const { cacheGet, cacheSet } = require('./cache');`. This file is not in the review scope for this phase, but it was observed during cross-module reading and should be flagged.
**Fix:** Add `'use strict';` as the first line of `transcript.js`.

---

_Reviewed: 2026-04-08_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
