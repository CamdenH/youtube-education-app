---
title: Feature Landscape — v2.0 SaaS
type: research
milestone: v2.0 SaaS
researched: 2026-04-12
confidence: MEDIUM-HIGH (WebSearch verified against Clerk docs, Supabase docs, and SaaS industry patterns)
---

# Feature Landscape: v2.0 SaaS

**Domain:** B2C SaaS layered onto an existing AI-powered YouTube learning course generator
**Researched:** 2026-04-12
**Scope:** ONLY new SaaS capabilities needed for v2.0. The v1.0 MVP features (SSE streaming, scoring, modules, hints, localStorage, dark mode, markdown export) are already shipped and are NOT re-researched here.

---

## Context: What's Already Built

The v1.0 MVP is a complete, working product. v2.0 layers accounts, billing, and persistence on top of it without changing the core generation pipeline. The four new capability areas are:

1. **Auth** — Clerk sign-up / sign-in, protected routes
2. **Persistence** — Supabase replacing localStorage + file cache
3. **Billing** — Clerk Billing subscription tiers (free/pro/power), usage gates
4. **SaaS UI** — Marketing landing page, onboarding flow, upgrade prompts

---

## Feature Category 1: Auth (Clerk)

### Table Stakes

| Feature | Why Expected | Complexity | Dependency on MVP |
|---------|--------------|------------|-------------------|
| Email + password sign-up | Minimum viable auth; users expect to own their account | Low — Clerk `<SignUp />` component handles it | None — replaces nothing, adds to top of request flow |
| Social login (Google) | Fastest signup path for B2C; friction reduction at signup is the highest-ROI auth investment | Low — Clerk config, zero code | None |
| Sign-in / sign-out | Session management, protected page return | Low — Clerk handles session + JWT | None |
| Protected course generation route | `POST /api/course` must require auth; anonymous generation is a cost liability | Low — `requireAuth()` middleware on server.js route | Wraps existing SSE endpoint |
| Session persistence across page loads | User closes tab and returns; expects to still be logged in | Low — Clerk handles token refresh automatically | None |
| Account page (basic profile) | Users expect to manage their email/password somewhere | Low — Clerk `<UserProfile />` component | None |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Magic link / passwordless option | Lowest friction signup for new users; no password to forget | Low — Clerk config toggle | Reduces signup abandonment; good for B2C |
| Post-signup onboarding redirect | Route new users to a short onboarding page before first use | Low-Med — Clerk `afterSignUp` redirect + custom `/welcome` page | See Onboarding section below |
| Email verification gate | Prevents throwaway accounts from burning free tier quota | Low — Clerk handles this natively | Set `emailVerification: required` in Clerk dashboard |

### Anti-Features (Skip for v1 SaaS)

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Custom session/JWT handling | Clerk manages tokens; rolling your own creates a security surface and duplicates work | Trust Clerk's session model entirely |
| Organization / team accounts | B2B multi-tenancy is a different product; adds org-switching UI, invitation flows, role management | Clerk Organizations exist but this is a solo B2C learner tool — skip entirely |
| SSO / SAML / enterprise federation | Enterprise auth is a v3+ problem; zero B2C users need it at launch | Keep auth to email + Google only |
| "Log in with GitHub" | Developer-focused signal; this is a general learner app, not a dev tool | Google covers the social login use case sufficiently |
| Two-factor auth prompt | Adds friction at signup; B2C learning tools do not require 2FA | Let Clerk offer it as optional in account settings, not enforced |

---

## Feature Category 2: Billing (Clerk Billing)

### Table Stakes

| Feature | Why Expected | Complexity | Dependency on MVP |
|---------|--------------|------------|-------------------|
| Three subscription tiers (free / pro / power) | Standard B2C SaaS tier structure; three tiers is optimal for anchoring psychology and self-selection | Med — plans configured in Clerk dashboard | None |
| Free tier with monthly course generation limit | Freemium is required for B2C at launch; zero free tier = no top-of-funnel | Low — enforce by counting generations in Supabase | Requires Supabase `usage` table |
| Usage gate enforcement on course generation | Free user hitting their limit must be blocked server-side; client-side-only gates are trivially bypassed | Med — middleware reads Supabase usage count + checks `has({ plan })` | Wraps existing SSE endpoint |
| Subscription management page | Users must be able to upgrade, downgrade, and cancel without emailing support | Low — Clerk `<PricingTable />` + `<UserProfile />` handles this | None |
| Idempotent billing webhooks | Subscription lifecycle events (created, updated, canceled) must not double-write on retry | Med — webhook handler checks for existing record before writing | Supabase `subscriptions` table with event_id deduplication |
| Annual/monthly billing toggle | Annual plan shown at discount drives higher LTV; toggle is expected on any pricing page | Low — Clerk Billing supports both billing cycles | None |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Upgrade prompt at usage gate | Users who hit the limit have demonstrated intent; surfacing upgrade at that exact moment doubles conversion vs. passive pricing page | Low-Med — modal or banner shown when 429 from usage check | See SaaS UI section |
| Soft limit warning (e.g., 80% of monthly quota used) | Reduces the surprise of hitting a hard wall; Spotify-style approach reduces churn at gate | Med — requires tracking remaining count and surfacing it in the UI | Requires usage count exposed via `/api/me` endpoint |
| "Courses remaining this month" counter in UI | Transparent usage builds trust; hidden limits feel punitive | Low — read from Supabase usage table, render in nav/sidebar | Differentiates from tools that hide quota |

### Anti-Features (Skip for v1 SaaS)

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Usage-based / metered billing | Clerk Billing explicitly does NOT support metered billing as of 2026; implementing custom metered billing against Stripe directly adds weeks of work | Use seat-based / plan-based limits with a monthly generation cap |
| Per-module or per-hint micro-billing | Introduces payment anxiety on every interaction; kills UX | Include hints and all modules in the tier; gate only course generation count |
| Team/seat-based billing | Not relevant for solo B2C learner; adds org management overhead | Skip entirely until v3+ enterprise tier |
| Dunning management (retry failed payments) | Clerk/Stripe handles this; do not build custom | Trust Clerk + Stripe's built-in dunning |
| In-app invoice history | Low-value for B2C; users get receipts via email from Stripe | Link users to Stripe's self-serve billing portal instead |
| Free trial / reverse trial | Reverse trials (give pro features for 7 days) can double conversion rates BUT add complexity to the usage gate logic; skip for v1 SaaS launch | Start with a generous free tier (3-5 courses/month); add trial in v2 if conversion is low |

---

## Feature Category 3: Persistence (Supabase)

### Table Stakes

| Feature | Why Expected | Complexity | Dependency on MVP |
|---------|--------------|------------|-------------------|
| Per-user course history in Supabase | localStorage history is tied to one browser/device; logged-in users expect their history everywhere | Med — `courses` table with `user_id`, RLS policies | Replaces localStorage history (v1.0 feature) |
| Per-user watched state in Supabase | Watched checkboxes currently lost on different device; SaaS users expect cross-device progress | Med — `watched_videos` table or JSONB column on courses table | Replaces localStorage watched state (v1.0 feature) |
| Supabase cache table (replaces file cache) | File-based `.cache/` is unsuitable for production / multi-user deployment; same MD5-keyed lookup, just in Postgres | Med — `cache` table keyed by md5 hash; TTL column | Replaces `cache.js` file cache |
| RLS (Row Level Security) on all user tables | Users must never see each other's courses; Supabase RLS is the enforcement layer, not application-layer checks | Med — policy per table: `user_id = auth.uid()` equivalent with Clerk JWT | Non-negotiable security requirement |
| Clerk JWT verification in Supabase RLS | Supabase must validate the Clerk JWT to identify the user for RLS; requires configuring Supabase's JWT secret with Clerk's public key | Med — one-time configuration in Supabase dashboard + `db.js` client setup | Ties auth and persistence together |
| Usage tracking table | Free tier gate requires knowing how many courses a user generated this month | Low — `usage` table with `user_id`, `period` (YYYY-MM), `count` | Required by billing gate |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Shared cache across users (de-duped by query hash) | Two users generating a course on "machine learning for beginners" hit the same cache; reduces YouTube API quota consumption and Claude API costs significantly | Low — cache table is NOT per-user; md5 key lookup is global | High ROI: YouTube quota is the main scaling bottleneck |
| Soft-delete courses (archived, not hard-deleted) | Users accidentally delete and regret it; soft-delete protects them | Low — `deleted_at` column; filter in queries | Low effort, high satisfaction |
| Graceful localStorage migration | Existing v1 users with localStorage history get it imported to Supabase on first login | Med — migration script runs once on auth; reads localStorage, writes to Supabase | Good user experience for early adopters |

### Anti-Features (Skip for v1 SaaS)

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| ORM (Sequelize, Prisma, Knex) | PROJECT.md explicitly forbids ORMs; adds abstraction layer and migration complexity | Raw SQL via Supabase client (`supabase.from(...).select(...)`) |
| Real-time subscriptions (Supabase Realtime) | Course generation already uses SSE; adding Supabase Realtime listeners for course updates creates two streaming systems for no benefit | Keep SSE for generation; use standard fetch for history reads |
| Full-text search across course history | Complex to implement correctly; low v1 user need | Simple list + filter by topic string; defer search to v2 |
| Export/import of course history | Markdown export already ships in v1.0; full history export is low priority | Markdown export already solves the "take my data" use case |
| Postgres migrations tooling (Flyway, Liquibase) | Overkill for small schema; adds operational complexity | Manage schema via Supabase dashboard + SQL editor for v1 |

---

## Feature Category 4: SaaS UI (Marketing + Onboarding + Upgrade Prompts)

### Table Stakes

| Feature | Why Expected | Complexity | Dependency on MVP |
|---------|--------------|------------|-------------------|
| Marketing landing page | Required for any public SaaS; unauthenticated users hit this before the app | Med — separate HTML section or page; hero + features + pricing + CTA | None — new page |
| Pricing section on landing page | B2C buyers expect pricing upfront; hiding it creates distrust and wastes conversions | Low — three tier cards with feature list; use Clerk `<PricingTable />` or build static | Requires billing tiers defined |
| "Sign up free" CTA | Primary conversion action on every page; missing it means visitors bounce without converting | Low — link to Clerk sign-up | Requires auth |
| Post-signup onboarding screen | New users don't know what to type; they need to see one example or one 10-second explainer to reach the "aha moment" | Low-Med — `/welcome` page with one example topic and a "Generate your first course" CTA | Requires auth redirect |
| Upgrade prompt modal/banner when free limit hit | Users who hit the gate have highest purchase intent; surfacing upgrade here is the most important billing conversion touchpoint | Med — triggered by 429 response from usage gate; shows remaining count + upgrade CTA | Requires billing gate |
| "You're on the Free plan" indicator | Transparent plan status reduces confusion; users should always know where they stand | Low — small badge or line in nav/header area | Requires auth + billing |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Demo / "try before sign-up" on landing page | Letting users see a pre-generated example course on the landing page (not a live generation) before signing up reduces commitment anxiety and shows value instantly | Low — static pre-rendered course JSON rendered by the same frontend rendering code | High conversion impact: value-first onboarding |
| Annual billing "save 20%" callout on pricing page | Annual plan default + visible savings amount increases LTV by 19% per industry data | Low — toggle on pricing section, default to annual | Requires Clerk Billing annual plans |
| Usage counter in app header ("3 of 5 courses used") | Transparency builds trust and creates subtle urgency without being predatory | Low — read from `/api/me` usage endpoint | Requires usage tracking |
| Onboarding with a single skill-level pre-selection | Routing question during first use ("what level are you?") pre-fills skill level in the form; reduces time-to-first-course | Low — store preference in Supabase user metadata | Reduces friction for first generation |

### Anti-Features (Skip for v1 SaaS)

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Long product tour / walkthrough overlay | Product tours with 7+ steps have 30-50% drop-off; users want to use the product, not be taught it | One-sentence example topic on the form placeholder is sufficient ("Try: 'machine learning for beginners'") |
| Email drip onboarding sequence | Requires email marketing platform integration (Mailchimp, Postmark); high effort for uncertain v1 return | Use in-app prompts only; add email drip in v2 if activation is low |
| Social proof section with testimonials | No users yet at launch; fake testimonials are deceptive; empty section looks worse than no section | Launch without testimonials; add after first 10 paying customers provide genuine feedback |
| Blog / content marketing | Content SEO is a long-term play; takes months to rank; zero v1 value | Ship product first; blog is a v3+ consideration |
| In-app product changelog / "What's new" | Adds UI maintenance burden; B2C users don't read changelogs | Post changes on the landing page; link to GitHub releases |
| Interactive pricing calculator | Adds UI complexity; no usage-based billing to calculate anyway | Simple three-tier pricing cards; no calculator needed |
| NPS / in-app feedback survey (Intercom, Hotjar) | Third-party scripts add page weight and privacy surface; v1 user base is too small for statistically meaningful NPS | Add a simple mailto: feedback link; add analytics tools in v2 |
| Referral / affiliate program | Complex to implement correctly (tracking links, payout logic); no meaningful user base to refer at v1 | Add in v2 once you have paying users |
| Animated hero video or screencap | High production effort; often autoplay, which is annoying on mobile | Use a static screenshot of a generated course; clean and honest |

---

## Feature Dependencies (v2.0 additions)

```
Clerk auth (Phase 6)
    → Protected course generation route
        → Usage gate check (requires usage table)
            → Upgrade prompt modal
    → Per-user Supabase history (replaces localStorage)
    → Per-user watched state (replaces localStorage)
    → Onboarding redirect (post-signup)

Supabase persistence (Phase 7)
    → courses table (user_id, RLS)
    → watched_videos table or JSONB (user_id, RLS)
    → cache table (global, no user_id)
    → usage table (user_id, period, count)
    → Clerk JWT verification in Supabase RLS

Clerk Billing tiers (Phase 8)
    → Requires: auth (Phase 6) + usage table (Phase 7)
    → Plans: free / pro / power configured in Clerk dashboard
    → has({ plan: 'pro' }) checks in server.js middleware
    → Idempotent webhook handler (subscriptions table)
    → Upgrade prompt (requires usage gate)

SaaS UI (Phase 9)
    → Requires: auth, billing, persistence all in place to be testable
    → Marketing landing page (independent, can ship earlier)
    → Onboarding page (requires auth redirect)
    → Upgrade prompt (requires billing gate)
    → Usage counter in UI (requires usage table + /api/me endpoint)
```

Key dependency observations:
- Auth (Phase 6) is the root dependency. Nothing else in v2.0 ships without it.
- The Supabase cache table (Phase 7) can be decoupled from user history — it's global and doesn't need auth. Could ship earlier as a pure infrastructure improvement.
- Billing (Phase 8) requires both auth AND the usage table. It cannot ship before Phase 7 writes usage rows.
- The marketing landing page is independent of all other v2.0 phases and can be built in parallel with Phase 6.

---

## MVP Recommendation for v1 SaaS Launch

**Must ship together (auth + persistence minimum viable SaaS):**
1. Clerk sign-up / sign-in (email + Google)
2. Protected course generation route
3. Supabase course history (per user, RLS)
4. Basic marketing landing page with pricing section

**Ship with v1 SaaS (high ROI, low complexity):**
- Post-signup welcome/onboarding screen (one example, one CTA)
- Free tier usage gate with upgrade prompt modal
- "N of M courses used" counter in UI
- Supabase cache table (reduces API costs immediately)

**Defer to v1.1 / v2 SaaS iteration:**
- Soft limit warning at 80% usage (good UX; not blocking)
- LocalStorage-to-Supabase migration for early adopters (only relevant if you have v1.0 users)
- Annual billing toggle (add after monthly billing is stable)
- Demo course on landing page (good conversion play; requires effort to curate a good example)

**Never build (for this product):**
- Organization/team accounts
- Usage-based metered billing
- Long product tours or drip email sequences
- Social features of any kind

---

## Confidence Assessment

| Area | Confidence | Source Basis |
|------|------------|--------------|
| Clerk auth patterns for Express | HIGH | Official Clerk docs confirmed `@clerk/express` SDK, `requireAuth()`, `getAuth(req)` |
| Clerk Billing `has()` entitlement check | HIGH | Clerk official docs confirmed `has({ plan: 'pro' })` and `has({ feature: 'x' })` work server-side |
| Clerk Billing metered billing limitation | HIGH | Clerk docs explicitly state metered billing not supported; usage-based billing on roadmap |
| Supabase RLS pattern for per-user data | HIGH | Supabase official docs; standard pattern well-documented |
| Clerk JWT in Supabase RLS | MEDIUM | Requires one-time JWT secret configuration in Supabase; known pattern but config-sensitive |
| Three-tier pricing structure | HIGH | Industry-wide standard; multiple sources agree |
| Freemium conversion rates (2-5%) | MEDIUM | WebSearch aggregate; not independently verified against this product category |
| Upgrade prompt at usage gate conversion impact | MEDIUM | Multiple SaaS case studies agree on pattern; exact lift figures are product-specific |
| Onboarding time-to-value targets (<5 min) | MEDIUM | WebSearch consensus across multiple 2025/2026 sources |

---

## Sources

- Clerk Express SDK docs: https://clerk.com/docs/reference/express/overview
- Clerk Billing overview: https://clerk.com/docs/guides/billing/overview
- Clerk Billing B2C guide: https://clerk.com/docs/nextjs/guides/billing/for-b2c
- Clerk `has()` authorization: https://clerk.com/blog/introducing-authorization
- Supabase Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- SaaS pricing best practices 2026: https://influenceflow.io/resources/saas-pricing-page-best-practices-complete-guide-for-2026/
- Freemium model best practices: https://www.maxio.com/blog/freemium-model
- Upgrade prompt patterns: https://www.appcues.com/blog/best-freemium-upgrade-prompts
- SaaS onboarding 2025: https://www.flowjam.com/blog/saas-onboarding-best-practices-2025-guide-checklist
- Reverse trial research: https://knowledge.gtmstrategist.com/p/reverse-trials-best-practices-for-saas-companies
