---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: SaaS
status: Active
stopped_at: Phase 9 plan 04 complete — plan 05 (Wave 2 onboarding.html) next
last_updated: "2026-04-26T19:17:18Z"
progress:
  total_phases: 4
  completed_phases: 3
  total_plans: 24
  completed_plans: 23
  percent: 96
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-12)

**Core value:** Surface the best YouTube content for learning a subject with maximum curation precision — the scoring algorithm and Claude prompts are what separate this from a YouTube playlist.
**Current focus:** v2.0 SaaS — Phase 9 (SaaS UI / Landing Page) planned. 5 plans in 4 waves ready to execute.

## Current Position

Phases 6 (Auth), 7 (Course Persistence), and 8 (Billing) complete.
Phase 8 all 5 plans done — migration, db.js billing functions, server.js usage gate, webhooks.js subscription handlers, index.html fetch() preflight + upgrade prompt. 183 tests passing.
Phase 9 plan 01 done — Wave 0 TDD RED tests added (2 of 3 fail correctly).
Phase 9 plan 02 done — GET /pricing route (public) and GET /onboarding auth gate (getAuth inline → redirect to /) added to server.js. Wave 0 test 26 now GREEN.
Phase 9 plan 03 done — landing.html updated: nav with Pricing + Sign up free links, hero CTAs corrected to Clerk URLs, features section replaced with 3-step how-it-works + ML course sample preview, bottom CTA updated. No /app links remain.
Phase 9 plan 04 done — pricing.html created: two-tier Free vs Early Access pricing grid, Clerk client-side auth detection, window.__upgradeUrl Option B (empty string), max-width 800px. Wave 0 test 25 "GET /pricing returns 200" now GREEN. All 27 tests pass. Plan 05 (Wave 2: onboarding.html) is next.

## Performance Metrics

**v1.0 MVP:**
- 5 phases, 18 plans, ~2,776 LOC, 124+ tests
- Timeline: 2026-03-18 → 2026-04-12 (25 days)

**v2.0 SaaS (phases 6–8 complete):**
- Phase 6 (Auth): 3 plans, Clerk integration, protected routes, landing page, onboarding
- Phase 7 (Course Persistence): 6 plans, Supabase cache + courses tables, async cache rewrite, /api/courses route, API-backed history UI
- Phase 8 (Billing): 5 plans — migration + RPC function, db.js billing functions, server.js usage gate, webhooks.js subscription handlers, index.html fetch() preflight + upgrade prompt
- 183 tests passing

## Accumulated Context

### Decisions

All v1.0 decisions logged in PROJECT.md Key Decisions table.

Key v2.0 decisions:
- Clerk + Supabase + Railway stack confirmed
- Clerk Billing preferred over direct Stripe integration
- File-based cache (.cache/) replaced with Supabase cache table
- Course history persisted per-user in Supabase courses table
- Phase 8 tier names locked: free (1/month) / early_access (20/month, $10/month)
- Clerk billing webhook events: subscriptionItem.active / subscriptionItem.ended (NOT subscription.created/deleted)
- Atomic counter uses Postgres RPC function increment_generation_count (not app-level read-then-write) — D-07
- Migration uses LANGUAGE sql VOLATILE — matches Supabase community pattern for simple increment functions
- Vacuous-pass pattern accepted for negative-assertion stubs in TDD Wave 0 — correct behavior before implementation
- HTML route auth gate pattern: inline getAuth() + res.redirect('/') — NOT requireUser (returns 401 JSON, wrong for HTML routes)
- GET /pricing registered as fully public (no auth) per D-12 — pricing page accessible without login
- Marketing pages (landing.html) must not link to /app — all CTAs link to Clerk auth URLs or /pricing
- Nav pattern for landing.html: Pricing text link + Sign up free btn-primary on right side
- window.__upgradeUrl Option B: hardcoded empty string in pricing.html — no server injection, no XSS; falsy guard skips CTA swap when URL absent
- pricing.html max-width: 800px (exception to 640px default — two-column grid needs wider container)

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-04-26
Stopped at: Phase 9 plan 04 complete — 09-04-SUMMARY.md created, pricing.html created (182b8cf)
Resume: /gsd-execute-phase 9 (plan 05 next)
