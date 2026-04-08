---
phase: 03-transcript-course-assembly
verified: 2026-04-08T22:12:49Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Run the full pipeline against a real subject (e.g., 'machine learning / beginner') with valid YOUTUBE_API_KEY and ANTHROPIC_API_KEY set"
    expected: "Pipeline emits all 5 SSE events; course_assembled payload contains a JSON object with 3-4 modules, each having title + description + connectingQuestion; each video has blurb, outdated flag, and 3 questions (recall/conceptual/application)"
    why_human: "All behavioral verification of module count (3-4), question grounding in transcripts, and blurb quality requires a live Claude call against real YouTube data — cannot verify LLM output conformance from unit tests alone"
  - test: "Trigger the description fallback path: find a real video that has no captions but has a description > 50 chars; verify it appears in the course"
    expected: "Video appears in course with source='description'; course still assembles successfully"
    why_human: "Unit test uses a stub fetchTranscript; real timedtext availability varies by video and cannot be replicated in offline tests"
  - test: "Trigger TOO_FEW_VIDEOS by searching a very niche subject that returns fewer than 5 usable videos"
    expected: "course_assembled SSE event carries { error: 'TOO_FEW_VIDEOS', message: '...', step: 5, total: 5 } with no course key; no crash, connection closes cleanly"
    why_human: "Real YouTube search results required to produce a naturally sparse result set"
---

# Phase 3: Transcript + Course Assembly Verification Report

**Phase Goal:** Transcripts are fetched for the top 12 scored videos, Claude assembles them into a structured course with modules, per-video blurbs, comprehension questions, and outdated flags, and the pipeline produces a complete course JSON object.

**Verified:** 2026-04-08T22:12:49Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Pipeline returns valid course JSON with 3-4 modules, each with title + description + connecting question | VERIFIED (unit) / ? (live) | `assembleCourse` merges Claude JSON into module structure; prompt enforces 3-4 modules; 7/7 assembler tests pass including D (structure) and G (Claude output used) |
| 2 | Each video has a "why this video" blurb and exactly 3 questions (recall/conceptual/application) | VERIFIED | assembler.test.js Tests C, E, F confirm blurb, 3 questions, correct types, boolean outdated; mergeClaudeOutput copies `blurb`, `questions`, `outdated` from Claude response |
| 3 | Video with no transcript falls back to description; video with neither is excluded | VERIFIED | sse.js lines 133-147 implement fallback (desc.length > 50) and exclusion (skippedCount++); sse.test.js tests confirm both paths |
| 4 | If fewer than 5 videos survive, API returns structured TOO_FEW_VIDEOS message instead of empty course | VERIFIED | assembler.js lines 177-184 implement gate at `videos.length < 5`; assembler.test.js Test A confirms no Claude call and correct error shape; sse.test.js TOO_FEW_VIDEOS test confirms event shape |
| 5 | Course JSON includes overview text, estimated total watch time, and prerequisite knowledge list | VERIFIED | mergeClaudeOutput returns `{ title, overview, totalWatchTime, prerequisites, modules }`; assembler.test.js Test D asserts all three fields are present |

**Score:** 5/5 truths verified (all require human smoke-test for live Claude behavior — see Human Verification section)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `assembler.js` | Course assembly module with assembleCourse(), buildAssemblyPrompt(), mergeClaudeOutput(), parseDurationSeconds() | VERIFIED | 202 lines; all 4 functions implemented; no stubs; `module.exports = { assembleCourse }` only |
| `sse.js` | Steps 4-5 wired: parallel transcript fetch + assembleCourse call | VERIFIED | Lines 121-173; requires `./transcript` and `./assembler`; step 4 runs Promise.all over top12; step 5 calls assembleCourse with correct args |
| `tests/unit/assembler.test.js` | 7 tests covering TOO_FEW_VIDEOS, Claude call count, merged fields, structure, questions, outdated flag | VERIFIED | 272 lines; 7 distinct test() calls (A-G); all 7 pass green |
| `tests/unit/sse.test.js` | Updated with transcript/assembler stubs + 3 new Phase 3 tests | VERIFIED | 445 lines; mutable-cell stub pattern for transcript/assembler; 3 new tests at lines 362-444 all pass |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `sse.js` courseStreamHandler | `transcript.js` fetchTranscript | `require('./transcript')` + destructuring, Promise.all | WIRED | Line 12 require; line 122 Promise.all call |
| `sse.js` courseStreamHandler | `assembler.js` assembleCourse | `require('./assembler')` + destructuring | WIRED | Line 13 require; line 158 call with (videosWithTranscripts, transcripts, subject, skillLevel) |
| `assembler.js` assembleCourse | Claude API | callClaude wrapper + anthropic.messages.create | WIRED | Lines 188-195; max_tokens: 8192; model: claude-haiku-4-5-20251001 |
| `assembler.js` mergeClaudeOutput | scored video metadata | videoMap lookup by v.id | WIRED | Lines 116-148; thumbnail, url, durationSeconds, score, title, channelTitle all sourced from scored video |
| `sse.js` step 4 | description fallback | `video.snippet.description.length > 50` check | WIRED | Lines 133-137; `{ source: 'description', text: desc }` constructed when fetchTranscript returns null |
| `sse.js` step 5 | TOO_FEW_VIDEOS error shape | `courseResult.error === 'TOO_FEW_VIDEOS'` branch | WIRED | Lines 160-169; error shape emitted directly without `course` key |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `assembler.js` assembleCourse | `text` (Claude response) | `callClaude` wrapping `anthropic.messages.create` | Yes — real API call with max_tokens 8192 | FLOWING |
| `assembler.js` mergeClaudeOutput | `videoMap[claudeVideo.videoId]` | `videos` array passed from sse.js (scored, real) | Yes — derives from YouTube API + scoring pipeline | FLOWING |
| `sse.js` step 4 | `transcripts` object | `fetchTranscript` per video + description fallback | Yes — real YouTube timedtext + snippet.description | FLOWING |
| `sse.js` step 4 | `videosWithTranscripts` | filtered from `top12` (scoredVideos.slice(0,12)) | Yes — real scored videos | FLOWING |

No hollow props or disconnected data sources found.

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| assembleCourse export exists | `node -e "const a=require('./assembler'); console.log(typeof a.assembleCourse)"` | `function` | PASS |
| TOO_FEW_VIDEOS gate (4 videos) | Node eval in verification | `error: 'TOO_FEW_VIDEOS'`, no `course` key, step=5, message includes count | PASS |
| Full test suite (102 tests) | `node --test --test-concurrency=1 tests/unit/*.test.js` | 102 pass / 0 fail | PASS |
| No stubs remaining | `grep 'not implemented' assembler.js sse.js` | No output | PASS |
| No TODO/FIXME in phase files | `grep 'TODO\|FIXME' assembler.js sse.js` | No output | PASS |

---

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| TRAN-01 | fetchTranscript called for top 12 scored videos | SATISFIED | sse.js line 121: `scoredVideos.slice(0, 12)`; line 122: `Promise.all(top12.map(v => fetchTranscript(v.id)))` |
| TRAN-02 | Description fallback when transcript unavailable | SATISFIED | sse.js lines 133-137: null result + desc.length > 50 → `{ source: 'description', text: desc }` |
| TRAN-03 | Videos with neither transcript nor description excluded | SATISFIED | sse.js lines 139-147: `result !== null` guard; else `skippedCount++` |
| CURA-01 | Top 12 videos + transcripts sent to Claude for assembly | SATISFIED | sse.js line 158: `assembleCourse(videosWithTranscripts, transcripts, subject, skillLevel)` |
| CURA-02 | TOO_FEW_VIDEOS gate; user sees friendly message if < 5 | SATISFIED (gate only) | assembler.js lines 177-184: gate fires at `videos.length < 5` before Claude call; message instructs broader search. Note: gate fires on pre-Claude count (videos with transcripts), not post-Claude rejection — this is the implementation's chosen interpretation |
| CURA-03 | 3-4 thematic modules in learning progression order | SATISFIED (prompt-enforced) | buildAssemblyPrompt line 60: "Organize videos into exactly 3 or 4 thematic modules ordered by learning progression" — enforced by Claude instruction |
| CURA-04 | Each module has title, description, connectingQuestion | SATISFIED | mergeClaudeOutput spreads module fields including connectingQuestion; assembler.test.js Test D asserts all three |
| CURA-05 | Each video has 1-2 sentence blurb | SATISFIED (prompt-enforced) | buildAssemblyPrompt: "write a 1-2 sentence 'why this video' blurb"; mergeClaudeOutput copies `blurb` from Claude response |
| CURA-06 | Videos with stale content flagged as outdated | SATISFIED | buildAssemblyPrompt: "set outdated: true if transcript/description contains concrete evidence of staleness"; mergeClaudeOutput copies `outdated` boolean; Test F asserts boolean type |
| CURA-07 | Course has overview, totalWatchTime, prerequisites | SATISFIED | mergeClaudeOutput lines 142-148; assembler.test.js Test D asserts all three top-level fields |
| QUES-01 | 3 questions per video (recall/conceptual/application) | SATISFIED | buildAssemblyPrompt: "Generate exactly 3 comprehension questions per video"; assembler.test.js Test E asserts `questions.length === 3` and correct type order |
| QUES-02 | Questions grounded in transcript content | SATISFIED (prompt-enforced) | buildAssemblyPrompt: "grounded in the transcript content"; transcripts passed verbatim in prompt — quality is Claude's responsibility |
| QUES-03 | 1 connecting question per module | SATISFIED | buildAssemblyPrompt: "a connecting question tying all module videos together"; mergeClaudeOutput spreads `connectingQuestion`; Test D asserts typeof string |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | — | — | — |

No anti-patterns found. Both `assembler.js` and `sse.js` are free of stubs, TODOs, empty returns, or placeholder data paths.

---

### Human Verification Required

The automated verification is fully passing — 102/102 tests green, all key links wired, data flows traced. The items below require a real API execution to verify LLM output conformance.

#### 1. End-to-End Pipeline Smoke Test

**Test:** Start server (`node server.js`), open browser, enter a subject with valid API keys. Watch all 5 SSE events animate. When `course_assembled` arrives, inspect the JSON payload.
**Expected:**
- 3-4 modules present, each with a non-empty `title`, `description`, and `connectingQuestion`
- Each video in each module has `blurb` (string), `outdated` (boolean), `questions` (array of 3 with types recall/conceptual/application)
- Top-level fields: `title` (string), `overview` (string), `totalWatchTime` (formatted "Xh Ym"), `prerequisites` (array)
**Why human:** Claude's output conformance to the JSON schema, module count (3-4), and question grounding can only be verified with a live API call. Unit tests mock Claude's response.

#### 2. Description Fallback in Production

**Test:** Find a real YouTube video that has no available captions (common for older or non-English-captioned videos) but has a description longer than 50 characters. Confirm it appears in the assembled course.
**Expected:** Video included in course; `transcripts` object for that videoId shows `source: 'description'`. Total transcript count in `transcripts_fetched` message reflects inclusion.
**Why human:** Real timedtext endpoint availability varies by video — stubs cannot reproduce this path authentically.

#### 3. TOO_FEW_VIDEOS Live Path

**Test:** Search for a very niche or obscure subject that is unlikely to yield 5 usable educational videos with transcripts or descriptions.
**Expected:** `course_assembled` SSE event contains `{ error: 'TOO_FEW_VIDEOS', message: 'Only N videos...', step: 5, total: 5 }` with no `course` key. Connection closes cleanly (`res.end()` called).
**Why human:** Requires real sparse YouTube search results — cannot be fabricated in unit tests without compromising the gate logic under test.

---

### Gaps Summary

No gaps. All 5 ROADMAP success criteria are satisfied by the implementation. All 13 phase requirements (TRAN-01/02/03, CURA-01 through CURA-07, QUES-01/02/03) are wired and verified at the code level. Three items require human smoke-testing to verify live LLM and real-API behavior — this is expected for a phase whose core value is Claude-powered course assembly.

---

_Verified: 2026-04-08T22:12:49Z_
_Verifier: Claude (gsd-verifier)_
