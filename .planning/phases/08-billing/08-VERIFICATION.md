---
phase: 08-billing
verified: 2026-04-20T00:00:00Z
status: human_needed
score: 9/10 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Upgrade prompt end-to-end: set generation_count=1, period_start=<recent> in Supabase, click Generate — upgrade message with clickable link appears"
    expected: "Error section shows 'You've used your 1 free course this month. Upgrade to Early Access for 20/month.' followed by an 'Upgrade now' link that opens the Clerk billing portal"
    why_human: "Cannot verify DOM rendering, link navigation, and CLERK_ACCOUNT_PORTAL_URL env wiring without a running server with real Supabase state"
  - test: "Normal generation under limit: reset generation_count=0, click Generate — course streams through to completion"
    expected: "SSE opens, course assembles, generation_count incremented to 1 in Supabase after completion"
    why_human: "Cannot verify SSE data flow, Supabase counter increment side-effect, and UI rendering without a running server and real credentials"
---

# Phase 8: Billing Verification Report

**Phase Goal:** Clerk Billing subscription tiers, usage gates, and webhook handling
**Verified:** 2026-04-20T00:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | checkUsage reads plan, generation_count, period_start and returns { allowed, limit, count } | VERIFIED | db.js lines 43-69; Tests 15-19 GREEN (23/23 db tests pass) |
| 2 | checkUsage returns { allowed: false } when count >= limit (1 for free, 20 for early_access) | VERIFIED | db.js line 69: `count < limit`; Test 16 asserts allowed=false at limit=1 count=1 |
| 3 | checkUsage resets count to 0 and updates period_start when period is older than 30 days | VERIFIED | db.js lines 60-67; Test 18 asserts update called with generation_count:0 |
| 4 | incrementGenerationCount calls supabase.rpc('increment_generation_count', { p_clerk_id }) atomically | VERIFIED | db.js line 79; Test 20 asserts RPC args exactly |
| 5 | updateUserPlan writes { plan } to users row matching clerk_id | VERIFIED | db.js lines 91-96; Test 22 asserts update args |
| 6 | GET /api/usage-check returns 200 (allowed) or 429 with { error, message, upgradeUrl } | VERIFIED | server.js lines 133-150; Tests A/B/C GREEN (24/24 server tests pass) |
| 7 | GET /api/course-stream returns 429 JSON before SSE headers when usage gate fires | VERIFIED | server.js lines 68-84 (gate at line 72, before courseStreamHandler at line 87); Tests D/E GREEN |
| 8 | subscriptionItem.active with plan.slug=early_access sets users.plan='early_access'; subscriptionItem.ended sets users.plan='free' with early_access guard | VERIFIED | webhooks.js lines 26-65; Tests 6-12 GREEN (12/12 webhook tests pass); canceled not handled (confirmed) |
| 9 | index.html calls GET /api/usage-check via fetch() before EventSource, shows inline upgrade prompt on 429 | VERIFIED | index.html lines 1012-1024 (checkUsageGate), 994-1006 (showUpgradePrompt), 1569-1576 (gate call before new EventSource); all 7 pattern checks pass |
| 10 | CLERK_ACCOUNT_PORTAL_URL documented in .env.example | VERIFIED | .env.example line 23: `CLERK_ACCOUNT_PORTAL_URL=` with Clerk Dashboard instructions |

**Score:** 10/10 truths verified (automated checks)

Note: Truths 9 and 10 pass automated checks; truth 9 requires human end-to-end verification (see Human Verification Required section).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/08_billing.sql` | DDL for generation_count, period_start, increment_generation_count RPC | VERIFIED | All 4 required tokens present: ADD COLUMN IF NOT EXISTS generation_count, ADD COLUMN IF NOT EXISTS period_start, increment_generation_count, LANGUAGE sql VOLATILE |
| `db.js` | checkUsage, incrementGenerationCount, updateUserPlan exported | VERIFIED | All three functions defined (lines 43-97); all three in module.exports (lines 154-165) |
| `server.js` | GET /api/usage-check route, usage gate in /api/course-stream, counter increment after saveCourse | VERIFIED | usage-check route at line 133; gate at line 72 before courseStreamHandler line 87; incrementGenerationCount at line 93 inside if (course) block after saveCourse |
| `webhooks.js` | subscriptionItem.active and subscriptionItem.ended handlers | VERIFIED | Both handlers present (lines 26-65); updateUserPlan imported from db.js (line 4); subscriptionItem.canceled NOT handled |
| `index.html` | checkUsageGate(), showUpgradePrompt(), async click handler, preflight before EventSource | VERIFIED | All 7 pattern checks pass; checkUsageGate at line 1012, showUpgradePrompt at line 994, async handler at line 1533, gate call at line 1571 |
| `.env.example` | CLERK_ACCOUNT_PORTAL_URL and all project env vars documented | VERIFIED | All 5 required keys present |
| `tests/unit/db.test.js` | Tests 15-23 covering checkUsage, incrementGenerationCount, updateUserPlan | VERIFIED | 23/23 tests GREEN |
| `tests/unit/webhooks.test.js` | Tests 6-12 covering subscriptionItem.active/ended | VERIFIED | 12/12 tests GREEN |
| `tests/unit/server.test.js` | Tests A-E covering usage-check and course-stream gate | VERIFIED | 24/24 tests GREEN |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| db.js checkUsage | Supabase users table | `supabase.from('users').select('plan, generation_count, period_start').eq('clerk_id', clerkId).single()` | VERIFIED | db.js lines 44-49 |
| db.js incrementGenerationCount | Supabase RPC increment_generation_count | `supabase.rpc('increment_generation_count', { p_clerk_id: clerkId })` | VERIFIED | db.js line 79 |
| GET /api/course-stream (requireUser) | checkUsage gate | `checkUsage(req.userId)` called at line 72, before `courseStreamHandler` at line 87 | VERIFIED | Gate fires before SSE headers |
| saveCourse call | incrementGenerationCount | Called at line 93 inside `if (course)` block, after `await saveCourse(...)` at line 90 | VERIFIED | Nested try/catch — errors logged but don't fail request |
| GET /api/usage-check | checkUsage | `db.checkUsage(req.userId)` at line 136 — same function, no SSE | VERIFIED | server.js line 133-150 |
| btn-generate click handler | GET /api/usage-check fetch() preflight | `checkUsageGate()` at index.html line 1571, before `new EventSource(...)` at line 1580 | VERIFIED | index.html lines 1569-1580 |
| 429 response from /api/usage-check | showUpgradePrompt(body.message, body.upgradeUrl) | `gateRes.status === 429` branch at line 1572 | VERIFIED | index.html lines 1572-1575 |
| webhooks.js subscriptionItem.active handler | db.updateUserPlan(payerId, 'early_access') | `evt.data.payerId + planSlug === 'early_access'` guard | VERIFIED | webhooks.js lines 26-44 |
| webhooks.js subscriptionItem.ended handler | db.updateUserPlan(payerId, 'free') | `planSlug === 'early_access'` guard prevents free-plan false downgrade | VERIFIED | webhooks.js lines 46-65 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| server.js GET /api/usage-check | usageResult | db.checkUsage(req.userId) → supabase.from('users').select() | Yes — reads live Supabase users row | FLOWING |
| server.js GET /api/course-stream gate | usageResult | db.checkUsage(req.userId) → same Supabase query | Yes — same live query path | FLOWING |
| server.js incrementGenerationCount | (void — side effect) | supabase.rpc('increment_generation_count') → Postgres atomic UPDATE | Yes — atomic Postgres UPDATE | FLOWING |
| webhooks.js subscriptionItem handlers | payerId, planSlug | evt.data (Clerk webhook payload, post verifyWebhook) → updateUserPlan → supabase.from('users').update({ plan }) | Yes — writes live Supabase users row | FLOWING |
| index.html showUpgradePrompt | message, upgradeUrl | 429 JSON body from /api/usage-check (server env var CLERK_ACCOUNT_PORTAL_URL) | Yes — server-controlled env var | FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED — requires running server with live Supabase and Clerk credentials. The three functions (checkUsage, incrementGenerationCount, updateUserPlan) are covered by unit tests with mocked Supabase chains. Server routes tested via node:test integration tests (24/24 pass).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| D-09 | 08-03, 08-05 | 429 response body: `{ error: 'usage_limit_reached', message: string, upgradeUrl: string }` | SATISFIED | server.js lines 79-83 and 142-147; Test C asserts exact `error: 'usage_limit_reached'` |
| D-10 | 08-05 | Frontend shows inline upgrade message with link to Clerk billing portal on 429 | SATISFIED (partial — automated checks pass; human end-to-end needed) | index.html checkUsageGate() + showUpgradePrompt() wired correctly; requires human verification of runtime behavior |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| webhooks.js | 43 | `// If plan.slug is not early_access (e.g. it's the free plan activating), take no action` — intentional silent no-op for non-early_access active events | INFO | Correct behavior per D-12 guard; not a stub |
| index.html | 1020-1022 | `catch (_) { return { allowed: true }; }` — fails open on network error | INFO | Intentional design decision per T-8-05-04: server gate is authoritative; frontend gate is UX-only |

No blockers found. No stub anti-patterns. No hardcoded empty data returns in production paths.

### Human Verification Required

#### 1. Upgrade Prompt End-to-End

**Test:** Set `generation_count=1` and a recent `period_start` (within 30 days) on your user row in Supabase. Start the server (`node server.js`). Sign in at `/app`. Click "Generate course" with any topic.
**Expected:** Error section displays "You've used your 1 free course this month. Upgrade to Early Access for 20/month." followed by an "Upgrade now" link. The link opens the Clerk Account Portal billing page in a new tab.
**Why human:** Requires running server with real CLERK_ACCOUNT_PORTAL_URL env var, live Supabase session, and visual DOM/link behavior that cannot be verified programmatically.

#### 2. Normal Generation Under Limit

**Test:** Reset `generation_count=0` in Supabase. Click "Generate course" again.
**Expected:** The preflight passes (no upgrade prompt), EventSource opens, course streams to completion, and `generation_count` increments to 1 in Supabase after completion.
**Why human:** Verifies the full path: preflight passes, SSE opens, saveCourse succeeds, incrementGenerationCount fires — requires real Supabase writes and SSE stream to complete.

### Gaps Summary

No gaps found. All 10 must-haves pass automated verification. The phase goal — Clerk Billing subscription tiers, usage gates, and webhook handling — is fully implemented and wired:

- Supabase schema migration: generation_count + period_start columns, increment_generation_count RPC function
- db.js: checkUsage (30-day period reset, tier limits), incrementGenerationCount (atomic RPC), updateUserPlan (idempotent UPDATE)
- server.js: usage gate fires before SSE headers in /api/course-stream; /api/usage-check preflight endpoint; counter incremented after saveCourse
- webhooks.js: subscriptionItem.active (upgrade to early_access with plan.slug guard) and subscriptionItem.ended (downgrade to free with early_access guard preventing false downgrades)
- index.html: async click handler with checkUsageGate() preflight before EventSource; showUpgradePrompt() using DOM construction with noopener noreferrer
- .env.example: CLERK_ACCOUNT_PORTAL_URL documented alongside all other project env vars
- Test coverage: 23/23 db tests, 12/12 webhook tests, 24/24 server tests — all GREEN

Two human verification items are required to confirm runtime behavior of the upgrade prompt and normal generation path.

---

_Verified: 2026-04-20T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
