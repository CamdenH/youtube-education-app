---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: SaaS
status: Ready to plan Phase 6
stopped_at: Roadmap created — ready to plan Phase 6 (Auth)
last_updated: "2026-04-12T00:00:00.000Z"
progress:
  total_phases: 4
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-12)

**Core value:** Surface the best YouTube content for learning a subject with maximum curation precision — the scoring algorithm and Claude prompts are what separate this from a YouTube playlist.
**Current focus:** v2.0 SaaS — Phase 6 (Auth: Clerk middleware, protected routes, user identity, onboarding)

## Current Position

Phase: 6 — Auth
Plan: —
Status: Not started
Last activity: 2026-04-12 — v2.0 SaaS roadmap created

```
v2.0 Progress: [░░░░░░░░░░░░░░░░░░░░] 0% (0/4 phases)
```

## Performance Metrics

**v1.0 MVP (complete):**
- 5 phases, 18 plans, ~2,776 LOC, 124+ tests
- Timeline: 2026-03-18 → 2026-04-12 (25 days)

**v2.0 SaaS (in progress):**
- 4 phases planned, 0 complete
- Requirements: 16 (AUTH ×5, PERSIST ×4, BILL ×4, UI ×3)

## Accumulated Context

### Decisions

**Stack confirmed (research):**
- `@clerk/express` ^2.0.7 — server middleware (replaces EOL `@clerk/clerk-sdk-node`)
- `@supabase/supabase-js` ^2.103.0 — service role key, server-side only, no RLS
- `svix` ^1.90.0 — webhook signature verification
- `@clerk/clerk-js` via CDN script tag in index.html (no npm install, no build step)

**Architectural constraints (load-bearing):**
- Same-origin Railway deployment: Clerk `__session` cookie sent automatically by EventSource — no token-in-URL workaround needed. If frontend ever moves to a separate CDN domain, SSE auth strategy must be revisited.
- Webhook route (`POST /api/webhooks/clerk`) must be registered with `express.raw()` BEFORE `app.use(express.json())` — or Svix signature verification breaks silently.
- Clerk user IDs are TEXT strings, not UUIDs — schema must use `TEXT` for clerk_id column.
- `/` serves landing page, `/app` serves the app — route structure established in Phase 6, not Phase 9. Establishing this late causes Clerk redirect loops.
- Usage gate must use atomic Postgres conditional increment: `UPDATE usage SET count = count + 1 WHERE user_id = $1 AND count < $2 AND month = $3 RETURNING id` — read-then-write in application code is not safe under concurrency.
- Per-row usage log (append-only, one row per generation) preferred over mutable counter — reset is implicit via date filter, no reset job needed.
- `req.userId` attached in `server.js` before delegating to `courseStreamHandler` — avoids changing courseStreamHandler's function signature.
- Course save and usage increment are fire-and-forget after SSE stream closes — DB failure logs but does not retroactively error a completed generation.
- `landing.html` must be fully static HTML — no JS-rendered content — for SEO.

**New files Phase 6+ will add:**
- `auth.js` — exports `requireUser`, `getUserId`
- `db.js` — exports Supabase client + named query functions
- `webhooks.js` — webhook handler (needs its own body parser, extracted from server.js)
- `landing.html` — static marketing landing page served at `/`

**Supabase schema (4 tables):**
- `users` — `clerk_id TEXT UNIQUE`, `email`, `plan TEXT DEFAULT 'free'`, `tier_updated_at TIMESTAMPTZ`
- `courses` — `user_id UUID FK`, `subject`, `skill_level`, `course_json JSONB`, `created_at`
- `cache` — `key TEXT PK`, `data JSONB` (global, MD5-keyed, drop-in replacement for .cache/)
- `usage` — per-row log: one row per generation with `user_id`, `created_at` (gate counts rows in current billing window)

### Open Questions (product decisions, not blockers)

1. **Free tier generation limit** — How many courses/month? Research suggests 3–5 for freemium learning tools. Must be decided before Phase 8 Clerk Dashboard configuration.
2. **Pro vs power differentiation** — What does power offer beyond pro? Three tiers are structurally defined but feature split is unspecified. Must be decided before Phase 8.
3. **localStorage migration scope for recent searches** — Courses and watched state are required migrations. Recent search strings are low-value; clear vs migrate is a call to make before Phase 7 migration design.
4. **Annual billing at launch or v2.1?** — Adds Clerk Dashboard complexity; recommend deferring to v2.1 once monthly billing is stable.
5. **Permanent same-origin architecture?** — Railway same-origin is correct now. If CDN-hosted frontend is ever considered, SSE auth strategy must change entirely.

### Pending Todos

- Decide free tier generation limit before Phase 8 planning
- Decide pro vs power feature split before Phase 8 planning
- Confirm whether to migrate or clear localStorage recent searches before Phase 7 planning

### Blockers/Concerns

None blocking Phase 6 start.

## Session Continuity

Last session: 2026-04-12
Stopped at: v2.0 SaaS roadmap created — ready to plan Phase 6 (Auth)
Resume: Run `/gsd-plan-phase 6` to start Phase 6 Auth planning
