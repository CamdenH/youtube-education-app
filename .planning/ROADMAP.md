# Roadmap: YouTube Learning Curator

## Milestones

- ✅ **v1.0 MVP** — Phases 1–5 (shipped 2026-04-12)
- 📋 **v2.0 SaaS** — Phases 6–9 (planned)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1–5) — SHIPPED 2026-04-12</summary>

- [x] Phase 1: Foundation (4/4 plans) — completed 2026-03-19
- [x] Phase 2: Scoring + Query Generation (4/4 plans) — completed 2026-04-01
- [x] Phase 3: Transcript + Course Assembly (3/3 plans) — completed 2026-04-07
- [x] Phase 4: Frontend + Persistence + Export (4/4 plans) — completed 2026-04-11
- [x] Phase 5: Lazy Hints (3/3 plans) — completed 2026-04-12

Full details: `.planning/milestones/v1.0-ROADMAP.md`

</details>

### 📋 v2.0 SaaS (Planned)

**Goal:** Transform the local MVP into a public B2C SaaS with user accounts, persistent course history, and paid subscription tiers.

**Tech stack additions:** Clerk (auth + billing), Supabase (Postgres), Railway (hosting)

- [x] **Phase 6: Auth** — Clerk integration, protected routes, user identity — completed 2026-04-13
- [x] **Phase 7: Course Persistence** — Replace file cache with Supabase; per-user course history — completed 2026-04-17
- [x] **Phase 8: Billing** — Clerk Billing subscription tiers, usage gates, webhook handling — completed 2026-04-20
  - **Plans:** 5 plans
  - Plans:
    - [x] 08-01-PLAN.md — Migration SQL (blocking) + Wave 0 failing test stubs for db, webhooks, server
    - [x] 08-02-PLAN.md — db.js billing functions: checkUsage, incrementGenerationCount, updateUserPlan
    - [x] 08-03-PLAN.md — server.js usage gate in /api/course-stream + GET /api/usage-check route + counter increment
    - [x] 08-04-PLAN.md — webhooks.js subscriptionItem.active / subscriptionItem.ended handlers
    - [x] 08-05-PLAN.md — index.html fetch() preflight + showUpgradePrompt + .env.example
- [ ] **Phase 9: SaaS UI / Landing Page** — Marketing page, onboarding, pricing page, upgrade prompts
  - **Plans:** 5 plans
  - Plans:
    - [x] 09-01-PLAN.md — Wave 0: add 3 failing tests to server.test.js (pricing + onboarding auth gate)
    - [x] 09-02-PLAN.md — Wave 1: server.js — add GET /pricing route + /onboarding auth gate (getAuth inline)
    - [x] 09-03-PLAN.md — Wave 2: landing.html — nav links, hero CTAs, how-it-works section, sample preview
    - [ ] 09-04-PLAN.md — Wave 2: pricing.html — new file with two-tier card grid + Clerk CTA swap
    - [ ] 09-05-PLAN.md — Wave 3: onboarding.html — rebuild body with welcome content + tier notice

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 4/4 | Complete | 2026-03-19 |
| 2. Scoring + Query Generation | v1.0 | 4/4 | Complete | 2026-04-01 |
| 3. Transcript + Course Assembly | v1.0 | 3/3 | Complete | 2026-04-07 |
| 4. Frontend + Persistence + Export | v1.0 | 4/4 | Complete | 2026-04-11 |
| 5. Lazy Hints | v1.0 | 3/3 | Complete | 2026-04-12 |
| 6. Auth | v2.0 | 3/3 | Complete | 2026-04-13 |
| 7. Course Persistence | v2.0 | 6/6 | Complete | 2026-04-17 |
| 8. Billing | v2.0 | 5/5 | Complete | 2026-04-20 |
| 9. SaaS UI / Landing Page | v2.0 | 3/5 | In progress | - |
