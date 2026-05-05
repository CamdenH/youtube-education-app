# Milestones

## v1.0 MVP (Shipped: 2026-04-12)

**Phases completed:** 5 phases, 18 plans, 21 tasks  
**Timeline:** 2026-03-18 → 2026-04-12 (25 days)  
**LOC:** ~2,776 JS/HTML

**Key accomplishments:**

- Express 4.22.1 scaffold with MD5-keyed file cache (.cache/), 9 passing node:test unit tests
- SSE named-event helpers (sendEvent, sendHeartbeat) with 5-event stub pipeline and Claude retry/JSON-fence-strip utilities — 22/22 tests pass
- YouTube Data API v3 client: searchVideos, fetchVideoStats, quota error discrimination, timedtext transcript endpoint with description fallback and regex XML parser
- Express server wiring all modules into SSE endpoint; index.html stub with UI-SPEC design token system; YouTubeQuotaError catch-to-SSE surfacing
- TDD wave 0: @anthropic-ai/sdk ^0.82.0 installed; queries.js and scorer.js test contracts scaffolded RED
- queries.js: generateQueries with angle-diverse Claude prompting (claude-haiku-4-5); require.cache injection for mocking
- scorer.js: scoreVideos with 5-component WEIGHTS table (beginner/intermediate/advanced/all), D-12 calibration anchors, single-batch Claude call for channel credibility + description quality
- Real SSE pipeline wired: concurrent Promise.all YouTube searches, input validation at route boundary, skill-level-aware query + scoring flow
- assembler.js TDD scaffold (RED stubs); assembleCourse with parseDurationSeconds, buildAssemblyPrompt (inline JSON schema), mergeClaudeOutput (O(1) videoMap)
- courseStreamHandler fully wired end-to-end: parallel transcript fetch with description fallback, TOO_FEW_VIDEOS gate, Claude course assembly — 102/102 tests green
- frontend.test.js: 7 pure logic functions, 22 passing unit tests; complete index.html HTML skeleton and all CSS
- Full JS wiring in index.html: SSE pipeline, course rendering (modules, video cards, scores, questions), recent searches, markdown export
- localStorage persistence: history (last 10 courses), watched checkboxes, evict-oldest on quota overflow
- RED test harness for POST /api/hints and persistHints/loadHints; POST /api/hints endpoint + transcriptSnippet in course JSON
- fetchHints, persistHints, loadHints, renderHints wired in index.html with XSS-safe DOM rendering; 124+ tests passing

---

## v2.0 SaaS (Shipped: 2026-04-26)

**Phases completed:** 4 phases (6–9), 19 plans
**Timeline:** 2026-04-12 → 2026-04-26 (14 days)
**LOC:** ~4,200 JS/HTML (net +9,765 lines in v2.0 range)

**Key accomplishments:**

- Supabase service-role client + idempotent user upsert via Clerk `user.created` webhook (svix HMAC-SHA256); `requireUser` middleware protecting all API routes; landing.html + onboarding.html static auth-flow pages
- Clerk auth wired into server.js with route-order-critical middleware placement (raw body parser → clerkMiddleware → static → json → protected routes)
- Idempotent SQL migration: global `cache` table (MD5-keyed JSONB) replaces .cache/ filesystem; `courses` table with RLS defense-in-depth; async cache.js rewrite
- Per-user course history persisted in Supabase; GET /api/courses route; index.html history UI swapped from localStorage to fetch-on-load + re-fetch-after-mutation pattern
- Billing schema migration: `generation_count` + `period_start` columns + atomic `increment_generation_count` Postgres RPC; db.js checkUsage / incrementGenerationCount / updateUserPlan
- Usage gate in /api/course-stream + GET /api/usage-check; idempotent `subscriptionItem.active/ended` webhook handlers guarded by plan slug
- fetch() preflight before EventSource catches 429 (native SSE cannot read HTTP status); DOM-constructed upgrade prompt (no innerHTML); .env.example with all 9 env vars
- landing.html rebuilt with nav (Pricing + Sign up free), 3-step how-it-works, ML course sample preview; pricing.html two-tier Free/Early Access grid with Clerk client-side auth detection
- onboarding.html rebuilt with welcome content, 3 onboarding bullets, tier notice with /pricing upgrade link; all 3 Wave 0 tests GREEN; 186 tests passing at close

**Known deferred items at close: 4 (see STATE.md Deferred Items)**

**Known gaps:** R-2.11 per-user watched state remains in localStorage (deferred to v3.0)

---
