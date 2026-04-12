# Phase 3 Validation: Transcript + Course Assembly

**Generated:** 2026-04-08
**Phase:** 03 — transcript-course-assembly
**Status:** Ready for execution

## Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node:test` |
| Config file | None — invoked via `package.json` scripts |
| Quick run command | `node --test --test-concurrency=1 tests/unit/assembler.test.js` |
| Full suite command | `node --test --test-concurrency=1 tests/unit/*.test.js` |

## Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | Created In |
|--------|----------|-----------|-------------------|------------|
| TRAN-01 | fetchTranscript called for top 12 scored videos | unit | `node --test --test-concurrency=1 tests/unit/sse.test.js` | Plan 03-03 |
| TRAN-02 | Description fallback used when fetchTranscript returns null | unit | `node --test --test-concurrency=1 tests/unit/sse.test.js` | Plan 03-03 |
| TRAN-03 | Videos with null transcript + no description are excluded | unit | `node --test --test-concurrency=1 tests/unit/sse.test.js` | Plan 03-03 |
| CURA-01 | assembleCourse called with top 12 videos + transcripts | unit | `node --test --test-concurrency=1 tests/unit/assembler.test.js` | Plan 03-01/02 |
| CURA-02 | TOO_FEW_VIDEOS gate fires when < 5 videos | unit | `node --test --test-concurrency=1 tests/unit/assembler.test.js` | Plan 03-01/02 |
| CURA-03 | Modules array has 3–4 entries | unit | `node --test --test-concurrency=1 tests/unit/assembler.test.js` | Plan 03-01/02 |
| CURA-04 | Each module has title, description, connectingQuestion | unit | `node --test --test-concurrency=1 tests/unit/assembler.test.js` | Plan 03-01/02 |
| CURA-05 | Each video has non-empty blurb | unit | `node --test --test-concurrency=1 tests/unit/assembler.test.js` | Plan 03-01/02 |
| CURA-06 | outdated field is boolean on each video | unit | `node --test --test-concurrency=1 tests/unit/assembler.test.js` | Plan 03-01/02 |
| CURA-07 | Course has overview, totalWatchTime, prerequisites | unit | `node --test --test-concurrency=1 tests/unit/assembler.test.js` | Plan 03-01/02 |
| QUES-01 | Each video has 3 questions: recall, conceptual, application | unit | `node --test --test-concurrency=1 tests/unit/assembler.test.js` | Plan 03-01/02 |
| QUES-02 | Questions grounded in transcript content (prompt test) | unit (source text) | `node --test --test-concurrency=1 tests/unit/assembler.test.js` | Plan 03-01/02 |
| QUES-03 | Each module has connectingQuestion | unit | `node --test --test-concurrency=1 tests/unit/assembler.test.js` | Plan 03-01/02 |

## Wave 0 Gaps

None — existing test infrastructure covers Phase 3. No new framework, config, or fixture files needed. `assembler.test.js` is a Plan 03-01 deliverable, not a prerequisite.

## Success Criteria

From ROADMAP.md §Phase 3:

1. For a real subject, the pipeline returns a valid course JSON with 3-4 modules, each containing title, description, and connecting question
2. Each video in the course has a "why this video" blurb and exactly 3 questions (one recall, one conceptual, one application)
3. A video with no available transcript falls back to its description; a video with neither is excluded from the course
4. If fewer than 5 videos survive Claude curation, the API returns a structured message prompting the user to broaden their search instead of an empty course
5. The course JSON includes overview text, estimated total watch time, and a prerequisite knowledge list

---
*Phase: 03-transcript-course-assembly*
*Validation architecture derived from RESEARCH.md §7*
