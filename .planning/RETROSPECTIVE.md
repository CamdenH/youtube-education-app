# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — MVP

**Shipped:** 2026-04-12  
**Phases:** 5 | **Plans:** 18 | **Timeline:** 25 days (2026-03-18 → 2026-04-12)

### What Was Built
- Full YouTube curation pipeline: Claude query generation → YouTube search + stats → 5-component scoring → timedtext transcript fetch → Claude course assembly → SSE streaming to browser
- Complete index.html frontend: SSE-driven loading state, module/video card rendering, comprehension questions, localStorage history + watched state, markdown export
- Lazy hint generation: POST /api/hints fires one Claude call per video on first question expand, persisted to localStorage
- 124+ unit tests via node:test with require.cache injection mocking pattern throughout

### What Worked
- **TDD wave 0 pattern:** Scaffolding RED stubs before implementation caught integration issues early and kept test coverage honest throughout phases 2–5
- **Flat module structure:** No subdirectories, no abstractions — every module at root made navigation fast and cross-module reads obvious
- **require.cache injection for mocking:** Avoided test framework dependency while enabling clean module isolation in Node 22 (no mock.module available)
- **Single-batch Claude calls:** Grouping channel credibility + description quality into one scoreVideos call and all 3 hints into one /api/hints call kept latency and cost low
- **File cache early:** Placing dev cache in Phase 1 eliminated quota exhaustion during all subsequent iteration phases

### What Was Inefficient
- **REQUIREMENTS.md traceability not updated as phases completed:** By Phase 5, 37/48 requirements still showed "Pending" in the table — documentation debt that required manual correction at milestone close
- **ROADMAP.md plan checkboxes never marked complete:** Plans had SUMMARY.md files but ROADMAP.md `[ ]` items were never checked off as work completed — cosmetic but creates confusion
- **STATE.md performance metrics stale:** Velocity table only reflected Phase 1 data throughout; no mechanism updated it phase-by-phase

### Patterns Established
- `require.cache[require.resolve('./module')] = { exports: mock }` — standard mocking pattern for all test files; no test framework needed
- `callClaude(async () => anthropic.messages.create(...))` — retry wrapper used in queries.js, scorer.js, assembler.js, server.js consistently
- `makeTestApp()` helper in server.test.js — fresh Express instances with injected mock handlers for route unit testing
- Wave 0 (RED stubs) → Wave 1 (implementation) → Wave 2 (integration wiring) — reliable 3-wave plan structure
- `_delayMs` and `_testDelayBase` injectable parameters for test-speed control without timer mocking

### Key Lessons
1. **Put caching before anything quota-sensitive.** The file cache in Phase 1 was the single biggest velocity enabler — never build a quota-burning API client without a cache layer first.
2. **Batch all same-type Claude calls.** Every place we were tempted to call Claude per-item (per-channel credibility, per-question hints), batching into one call was the right answer on both cost and latency.
3. **Keep requirements traceability live, not retrospective.** Updating REQUIREMENTS.md at milestone close instead of plan-by-plan created unnecessary cleanup work and obscured real progress.
4. **SSE + streaming UX is worth the complexity.** The user experience of watching pipeline steps animate in real time justifies the SSE infrastructure investment — don't flatten to a single response endpoint.

### Cost Observations
- Model mix: haiku-4-5 for scoring/queries/hints (cost-sensitive loops), sonnet for course assembly (quality-sensitive)
- Sessions: multiple across 25 days
- Notable: Batch Claude calls made per-course cost predictable — 3 Claude calls total per generation (queries, scoring, assembly) + 1 on-demand per hint reveal

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 MVP | 5 | 18 | Established baseline — TDD wave 0, require.cache mocking, flat module structure |

### Cumulative Quality

| Milestone | Tests | Zero-Dep Additions |
|-----------|-------|-------------------|
| v1.0 | 124+ | @anthropic-ai/sdk only (Phase 2) |

### Top Lessons (Verified Across Milestones)

1. Cache before quota — always build the cache layer before iterating on quota-sensitive APIs
2. Batch Claude calls — group same-type inference into one call; never call per-item in a loop
