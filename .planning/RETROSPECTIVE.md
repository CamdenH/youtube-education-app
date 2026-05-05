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

## Milestone: v2.0 — SaaS

**Shipped:** 2026-04-26
**Phases:** 4 (6–9) | **Plans:** 19 | **Timeline:** 14 days (2026-04-12 → 2026-04-26)

### What Was Built
- Clerk auth: `requireUser` middleware, idempotent user upsert via `user.created` webhook (svix HMAC-SHA256), landing.html + onboarding.html static pages
- Supabase persistence: global JSONB cache table (replaced .cache/ filesystem), per-user courses table with RLS, async cache.js rewrite
- Clerk Billing: free/early_access tiers, atomic `increment_generation_count` Postgres RPC, `subscriptionItem.active/ended` webhook handlers
- Usage gate: fetch() preflight before EventSource catches 429 (native SSE can't read HTTP status); DOM-constructed upgrade prompt
- Marketing pages: landing.html (nav + how-it-works + sample preview), pricing.html (two-tier grid + Clerk auth detection), onboarding.html (welcome flow + tier notice)
- 186 passing tests at close

### What Worked
- **TDD wave 0 across all phases:** Planting RED stubs in phase 8 plan 01 before implementing billing functions (plans 02–04) kept the test baseline honest — every implementation plan had a concrete RED target to turn GREEN
- **Postgres RPC for atomic counter:** `increment_generation_count` as a server-side SQL function eliminated the app-level read-then-write race condition entirely — the right call, made early
- **Middleware route order discipline:** Establishing the exact middleware order (raw body → clerkMiddleware → static → json → protected routes) in a single plan prevented subtle auth bugs across all subsequent phases
- **fetch() preflight pattern for gated SSE:** The insight that native EventSource can't read HTTP status codes led to a clean architectural pattern — fetch first, then open EventSource only on success
- **Short phases (5–12 min each in phase 9):** Tight, single-responsibility plans made phase 9 feel smooth — each plan delivered exactly one thing with no ambiguity

### What Was Inefficient
- **Human checkpoint blocking:** Plans that required human-run SQL migrations (07-01, 08-01) created cross-session waits — the migration + checkpoint pattern works but adds friction; future phases could pre-stage migrations in earlier plans
- **Clerk CDN placeholder values:** Shipping onboarding/landing with `CLERK_PUBLISHABLE_KEY_PLACEHOLDER` in the HTML creates a manual deploy step that's easy to forget; should be wired via env var server-side injection in a future phase
- **3 VERIFICATION.md files left at human_needed:** Phases 7–9 human verification was never completed — browser testing, live Clerk flows, and webhook end-to-end weren't run. Deferred at close.
- **watched state deferred:** Per-user watched checkboxes were listed as an Active v2.0 requirement but never planned into a phase — surfaced only at milestone close

### Patterns Established
- `getAuth(req)` inline for HTML route auth gates (not `requireUser` which returns 401 JSON — wrong for HTML routes)
- Fetch preflight before EventSource: `checkUsageGate()` async → `showUpgradePrompt()` on 429 → `new EventSource(...)` only on `allowed: true`
- `subscriptionItem.active/ended` (not `subscription.created/deleted`) — Clerk Billing event names that actually fire
- Vacuous-pass TDD pattern: negative-assertion stubs (assert NO call was made) are trivially GREEN before implementation — correct TDD behavior, not a false positive
- Marketing pages never link to `/app` — all CTAs on unauthenticated pages point to Clerk auth URLs or `/pricing`

### Key Lessons
1. **Know your webhook event names before you write the handler.** `subscriptionItem.active/ended` vs `subscription.created/deleted` — Clerk fires the former, not the latter. Confirmed in research phase, saved a debugging session.
2. **The fetch() preflight pattern solves SSE rate-gating cleanly.** Native EventSource has no error handling for HTTP status — if you need to gate an SSE stream, always preflight with fetch(). Now a permanent pattern.
3. **Atomic DB operations belong in the DB, not the app.** The usage counter increment is a single SQL UPDATE on the server — no read-then-write, no race condition. Apply this to any counter or boolean flip that gets concurrent writes.
4. **Plan human verification tasks explicitly.** All three VERIFICATION.md files ended as `human_needed` with no clear owner or timeline. Future milestones should include an explicit "human UAT" plan with acceptance criteria.

### Cost Observations
- Model mix: primarily sonnet (planning + implementation), haiku for scoring/queries at runtime
- Sessions: multiple across 14 days
- Notable: 14-day milestone (vs 25 days for v1.0) — SaaS infra work was well-scoped; most phases completed in one session

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 MVP | 5 | 18 | Established baseline — TDD wave 0, require.cache mocking, flat module structure |
| v2.0 SaaS | 4 | 19 | Clerk+Supabase stack; fetch() preflight pattern; atomic Postgres RPC; HTML route auth gate pattern |

### Cumulative Quality

| Milestone | Tests | Dependencies Added |
|-----------|-------|-------------------|
| v1.0 | 124+ | @anthropic-ai/sdk only (Phase 2) |
| v2.0 | 186 | @supabase/supabase-js, @clerk/express, svix |

### Top Lessons (Verified Across Milestones)

1. Cache before quota — always build the cache layer before iterating on quota-sensitive APIs
2. Batch Claude calls — group same-type inference into one call; never call per-item in a loop
3. Know your webhook event names before writing the handler — Clerk fires `subscriptionItem.*`, not `subscription.*`
4. Atomic DB operations belong in the DB — counters/flags with concurrent writes go in a Postgres RPC, not app-level read-then-write
5. Plan human verification explicitly — `human_needed` items without an owner or timeline become deferred debt at milestone close
