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

### 📋 v2.0 SaaS

**Goal:** Transform the local MVP into a public B2C SaaS with user accounts, persistent course history, and paid subscription tiers.

**Tech stack additions:** Clerk (auth + billing), Supabase (Postgres), Railway (hosting)

- [ ] **Phase 6: Auth** — Clerk middleware, protected routes, user identity, onboarding
- [ ] **Phase 7: Persistence** — Supabase replaces file cache and localStorage; usage tracking table
- [ ] **Phase 8: Billing** — Clerk Billing tiers, usage gates, idempotent webhooks
- [ ] **Phase 9: SaaS UI** — Landing page, upgrade prompts, usage counter, account page

## Phase Details

### Phase 6: Auth
**Goal**: Authenticated users can sign up, sign in, and access course generation; unauthenticated users are blocked
**Depends on**: Nothing (first v2.0 phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05
**Success Criteria** (what must be TRUE):
  1. A new visitor can create an account via Clerk-hosted sign-up UI and land on the app
  2. An existing user can sign in and sign out from any page without losing their session unexpectedly
  3. An unauthenticated POST to /api/generate returns 401 — the course generation route is protected
  4. When a new user signs up, a corresponding users row (clerk_id + default plan = 'free') is created in Supabase via Clerk webhook
  5. A newly signed-up user sees an onboarding page explaining how course generation works before reaching the main app
**Plans**: TBD
**UI hint**: yes

### Phase 7: Persistence
**Goal**: All user data — course history, watched state, and API cache — lives in Supabase, not the local filesystem or localStorage
**Depends on**: Phase 6 (requires clerk_id from auth)
**Requirements**: PERSIST-01, PERSIST-02, PERSIST-03, PERSIST-04
**Success Criteria** (what must be TRUE):
  1. A logged-in user's generated courses appear in their course history across devices and browser sessions (Supabase, not localStorage)
  2. A logged-in user's watched-video checkboxes persist across page refreshes and devices (Supabase, not localStorage)
  3. The .cache/ directory is no longer written to — all API cache hits and misses go through the Supabase cache table
  4. An existing user whose v1.0 localStorage history is non-empty sees that history in Supabase after their first authenticated page load, with localStorage cleared afterward
**Plans**: TBD

### Phase 8: Billing
**Goal**: Free users face a monthly generation limit enforced server-side; paid users can upgrade; all subscription state stays consistent via idempotent webhooks
**Depends on**: Phase 7 (usage counter requires the usage table and user rows from Persistence)
**Requirements**: BILL-01, BILL-02, BILL-03, BILL-04
**Success Criteria** (what must be TRUE):
  1. A user can view and select subscription tiers (free / pro / power) via Clerk Billing hosted checkout — no custom payment form
  2. A free user who has exhausted their monthly generation limit receives a 402 response and sees an upgrade prompt — not a generic error
  3. Two concurrent course generation requests from the same free user at the monthly boundary cannot both succeed — the usage gate is atomic
  4. A subscription change (upgrade, downgrade, cancellation) is reflected in the Supabase users table even if the webhook is delivered more than once
**Plans**: TBD

### Phase 9: SaaS UI
**Goal**: A public marketing page drives sign-ups; logged-in users can see their usage and manage their subscription; the app and landing page are cleanly separated routes
**Depends on**: Phase 8 (usage counter and billing state must exist before UI can display them)
**Requirements**: UI-01, UI-02, UI-03
**Success Criteria** (what must be TRUE):
  1. Visiting / serves a fully static landing page with pricing, feature highlights, and a sign-up CTA — all content is in the HTML source, not JS-rendered
  2. The app at /app shows a logged-in user their remaining course generations for the current month
  3. A logged-in user can navigate to an account page that shows their current plan, monthly usage count, and a link to Clerk's billing portal
**Plans**: TBD
**UI hint**: yes

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 4/4 | Complete | 2026-03-19 |
| 2. Scoring + Query Generation | v1.0 | 4/4 | Complete | 2026-04-01 |
| 3. Transcript + Course Assembly | v1.0 | 3/3 | Complete | 2026-04-07 |
| 4. Frontend + Persistence + Export | v1.0 | 4/4 | Complete | 2026-04-11 |
| 5. Lazy Hints | v1.0 | 3/3 | Complete | 2026-04-12 |
| 6. Auth | v2.0 | 0/TBD | Not started | - |
| 7. Persistence | v2.0 | 0/TBD | Not started | - |
| 8. Billing | v2.0 | 0/TBD | Not started | - |
| 9. SaaS UI | v2.0 | 0/TBD | Not started | - |
