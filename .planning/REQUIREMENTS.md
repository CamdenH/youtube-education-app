# Requirements — v2.0 SaaS

*Last updated: 2026-04-12*

## Milestone v2.0 Requirements

### Auth

- [ ] **AUTH-01**: User can sign up for an account via Clerk-hosted UI
- [ ] **AUTH-02**: User can sign in and sign out from any page
- [ ] **AUTH-03**: Course generation requires authentication — unauthenticated requests to POST /api/generate return 401
- [ ] **AUTH-04**: Clerk webhook syncs new user record (clerk_id + default plan) to Supabase users table on account creation
- [ ] **AUTH-05**: User sees a post-signup onboarding page explaining how course generation works

### Persistence

- [ ] **PERSIST-01**: Per-user course history stored in Supabase (replaces localStorage 10-course history)
- [ ] **PERSIST-02**: Global MD5-keyed cache table in Supabase replaces file-based .cache/ directory
- [ ] **PERSIST-03**: Per-user watched checkbox state stored in Supabase (replaces localStorage watched state)
- [ ] **PERSIST-04**: On first authenticated page load, existing localStorage history and watched state are migrated to Supabase

### Billing

- [ ] **BILL-01**: Subscription tiers (free / pro / power) managed via Clerk Billing with hosted checkout flow
- [ ] **BILL-02**: Free tier is limited to 5 course generations per month, enforced via atomic Supabase usage counter (no race conditions)
- [ ] **BILL-03**: When a free user hits the monthly limit, an upgrade prompt is shown inline instead of a generic error
- [ ] **BILL-04**: Billing webhooks (subscription lifecycle events) sync plan changes to Supabase users table idempotently

### SaaS UI

- [ ] **UI-01**: Static HTML marketing landing page served at `/`; app served at `/app`
- [ ] **UI-02**: Logged-in users see their remaining generation count for the current month in the app UI
- [ ] **UI-03**: Account/subscription page shows current plan, monthly usage, and link to manage billing via Clerk

## Future Requirements

- Pro vs power tier feature differentiation beyond generation count (history retention, priority, etc.) — deferred post-launch
- Annual billing option — deferred to v2.1
- Email drip / onboarding sequence — deferred post-launch
- Social proof / testimonials on landing page — deferred until users exist
- Referral program — deferred post-launch

## Out of Scope

- **Stripe direct integration** — Clerk Billing handles the subscription UI, webhooks, and user linkage natively; no Stripe SDK needed
- **Supabase Auth / RLS** — All DB access goes server-side with the service role key; RLS adds complexity with no security benefit in this architecture
- **Custom JWT templates** — Clerk's JWT template for Supabase was deprecated April 2025; using native third-party auth integration instead
- **React / Vue / Svelte frontend** — Vanilla JS + single HTML file established in v1.0; no build step
- **ORM (Prisma, Drizzle)** — Raw `@supabase/supabase-js` queries only
- **Per-question hint generation** — Already batch (3 hints per video) from v1.0; no change
- **Metered/usage-based Clerk Billing** — Not supported by Clerk Billing as of 2026; usage counting done via Supabase

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| AUTH-01 | — | Pending |
| AUTH-02 | — | Pending |
| AUTH-03 | — | Pending |
| AUTH-04 | — | Pending |
| AUTH-05 | — | Pending |
| PERSIST-01 | — | Pending |
| PERSIST-02 | — | Pending |
| PERSIST-03 | — | Pending |
| PERSIST-04 | — | Pending |
| BILL-01 | — | Pending |
| BILL-02 | — | Pending |
| BILL-03 | — | Pending |
| BILL-04 | — | Pending |
| UI-01 | — | Pending |
| UI-02 | — | Pending |
| UI-03 | — | Pending |
