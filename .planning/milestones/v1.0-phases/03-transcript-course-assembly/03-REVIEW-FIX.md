---
phase: 03-transcript-course-assembly
fixed_at: 2026-04-08T22:24:57Z
review_path: .planning/phases/03-transcript-course-assembly/03-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 03: Code Review Fix Report

**Fixed at:** 2026-04-08T22:24:57Z
**Source review:** .planning/phases/03-transcript-course-assembly/03-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (WR-01 through WR-04; IN-* excluded by fix_scope)
- Fixed: 4
- Skipped: 0

## Fixed Issues

### WR-01: Unguarded `response.content[0]` will throw if Claude returns no content blocks

**Files modified:** `assembler.js`
**Commit:** 7549de6
**Applied fix:** Inside the `callClaude` callback in `assembleCourse`, replaced the bare `response.content[0].text` read with a two-step guard: capture `response.content && response.content[0]` into `block`, then throw a descriptive `Error` if `block` or `block.text` is falsy before returning `block.text`.

---

### WR-02: Hallucinated videoId is passed through silently, producing a malformed video object

**Files modified:** `assembler.js`
**Commit:** cb7725d
**Applied fix:** In `mergeClaudeOutput`, replaced the silent `return claudeVideo` pass-through when `scored` is falsy with a `console.warn` log followed by `return null`. Added `.filter(Boolean)` at the end of the `.map()` call so the `null` entries are removed from the module's `videos` array before the merged course is returned.

---

### WR-03: Test stub restore is not inside `try/finally` — corruption risk if handler throws

**Files modified:** `tests/unit/sse.test.js`
**Commit:** 6592fae
**Applied fix:** In the description-fallback test, wrapped the `await courseStreamHandler(req, res)` call in a `try/finally` block. The two stub-restore assignments (`transcriptStub._impl` and `fetchVideoStats`) were moved into the `finally` clause so they execute unconditionally, preventing later tests from running with corrupted stub state.

---

### WR-04: `video.snippet` accessed without null guard in `buildAssemblyPrompt`

**Files modified:** `assembler.js`
**Commit:** da824ee
**Applied fix:** In `buildAssemblyPrompt`'s `.map()` callback, added `const snippet = v.snippet || {};` before the template literal, then derived `title` and `channelTitle` from `snippet` with `'(untitled)'` and `'(unknown channel)'` as fallbacks. The template literal now references `title` and `channelTitle` instead of `v.snippet.title` and `v.snippet.channelTitle`.

---

_Fixed: 2026-04-08T22:24:57Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
