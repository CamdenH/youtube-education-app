---
title: Research Summary — v2.0 SaaS
type: synthesis
milestone: v2.0 SaaS
synthesized: 2026-04-12
source-files: STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md
---

# Research Summary: v2.0 SaaS

---

## Executive Summary

The v2.0 SaaS upgrade layers Clerk auth, Supabase persistence, and Clerk Billing on top of the working v1.0 Express/vanilla-JS MVP. The chosen stack is correct and consistent across all four research areas: `@clerk/express` (server middleware), `@clerk/clerk-js` (CDN, no npm install), `@supabase/supabase-js` (service role key, server-only), and `svix` (webhook verification). Three npm packages plus one CDN script tag cover the entire auth and persistence surface. No framework, no ORM, no build step — all constraints from CLAUDE.md hold.

The single biggest architectural insight is that same-origin deployment on Railway eliminates the hardest SSE+auth problem. Because Express serves both `index.html` and the API from the same domain, Clerk's `__session` cookie is sent automatically by `EventSource` — no token-in-URL workaround is needed. This is a load-bearing deployment constraint: if the frontend ever moves to a CDN on a separate domain, the SSE auth strategy must be revisited.

The recommended build order is Auth → Persistence → Billing → SaaS UI. Each phase has a hard dependency on the previous one (billing needs usage rows, which need auth). The one exception: the marketing landing page is independent and can be written in parallel with Phase 6 Auth. Research confidence is HIGH across all four areas; the only MEDIUM-confidence items are Clerk Billing event ordering behavior (billing webhooks announced July 2025, limited production history) and SaaS conversion rate estimates (product-category-specific, not independently verified for this app).

---

## 1. Stack Additions

Three packages to install (`npm install @clerk/express @supabase/supabase-js svix`), one CDN script tag for the frontend:

| Package | Version | Why |
|---------|---------|-----|
| `@clerk/express` | `^2.0.7` | Official Clerk SDK for Express 4.x. Provides `clerkMiddleware()` (global), `requireAuth()` (per-route), and `getAuth(req)` (reads auth state). Replaces the EOL `@clerk/clerk-sdk-node`. |
| `@supabase/supabase-js` | `^2.103.0` | Thin PostgREST wrapper for Postgres. Initialize with the service role key server-side only. No browser access, no RLS needed (user-scoping via `clerkId` param in every query). |
| `svix` | `^1.90.0` | Clerk's own recommended library for verifying webhook signatures. Handles replay attack prevention and timing attack resistance. Required for the billing webhook handler. |
| `@clerk/clerk-js` | CDN only | Loaded via script tag in `index.html`. Provides `window.Clerk`, prebuilt sign-in/sign-up UI, and `Clerk.session.getToken()`. No npm install, no build step. |

**Do not install:** `@clerk/clerk-sdk-node` (EOL Jan 2025), `stripe` (Clerk Billing handles it), any ORM, `express-session`, or `nodemailer`.

---

## 2. Feature Table Stakes

What must ship together for v2.0 to be a viable public SaaS product:

**Auth (Phase 6):**
- Email + Google sign-up via Clerk (zero code — Clerk hosted UI)
- Protected course generation and hints routes (`requireUser` middleware)
- Session persistence across page loads (automatic via Clerk)
- Route structure established from day one: `/` landing, `/app` app (prevents redirect loops)

**Persistence (Phase 7):**
- Per-user course history in Supabase `courses` table (replaces localStorage)
- Per-user watched state in Supabase (replaces localStorage)
- Global `cache` table replacing `.cache/` file cache (same MD5 key format — drop-in)
- `usage` table for monthly generation counting (required by billing gate)
- One-time localStorage migration on first login for existing early adopters

**Billing (Phase 8):**
- Three tiers: free / pro / power configured in Clerk Dashboard
- Free tier monthly generation cap enforced server-side (not client-side-only)
- Idempotent webhook handler for `subscription.*` events (Svix at-least-once delivery)
- Upgrade prompt modal triggered by 402 response at the usage gate

**SaaS UI (Phase 9):**
- Fully static `landing.html` (all content in HTML, not JS-rendered — SEO requirement)
- Pricing section with three tier cards and "Sign up free" CTA
- Post-signup welcome/onboarding screen (one example topic, one CTA)
- "N of M courses used this month" counter in the app header

**Defer to v1.1:**
- Soft limit warning at 80% quota usage
- Annual billing toggle (add after monthly is stable)
- Demo course on landing page
- LocalStorage-to-Supabase migration for recent searches (courses and watched state are required; searches are optional)

---

## 3. Architecture Decisions

The most consequential integration choices, in priority order:

| Decision | Detail |
|----------|--------|
| Same-origin SSE auth via `__session` cookie | `EventSource` cannot send `Authorization` headers (WHATWG spec constraint). Same-origin deployment on Railway means Clerk's `__session` cookie is sent automatically. No polyfill, no query-param token. This only holds if frontend and API stay on the same domain. |
| Webhook route registered before `express.json()` | The billing webhook route needs `express.raw({ type: 'application/json' })` to preserve the raw body for Svix signature verification. `express.json()` consumes the buffer first if it runs globally before the route. Register the webhook route immediately after `clerkMiddleware()`, before `app.use(express.json())`. |
| Service role key + explicit `clerkId` params (no RLS) | No browser-to-Supabase queries exist. The server is the only writer. Scoping is enforced by passing `clerkId` as an explicit parameter in every `db.js` query function — not by RLS policies. This is simpler and correct for this architecture. |
| `req.userId` attached in `server.js`, read in `sse.js` | Avoids changing `courseStreamHandler`'s function signature. Auth is a transport concern (HTTP layer), not a pipeline concern. `server.js` attaches `req.userId = getUserId(req)` before delegating to `courseStreamHandler`. |
| Course save and usage increment are fire-and-forget | The SSE stream has already closed successfully when these writes occur. DB failure should log but not retroactively error a completed generation. Non-critical write path. |
| Atomic conditional increment for usage gate | Read-then-write is not safe under concurrent requests. Use `UPDATE usage SET count = count + 1 WHERE user_id = $1 AND count < $2 AND month = $3 RETURNING id`. Zero rows returned = limit hit. One row = allowed. Single Postgres statement, no application-level locking. |
| Per-row usage log, not a mutable counter | Store one row per generation with `created_at`. The gate query counts rows in the current billing window. No reset job needed — the reset is implicit by date filter. Append-only, auditable. |
| New files: `auth.js`, `db.js`, `webhooks.js`, `landing.html` | Consistent with flat-file conventions of v1.0. No subdirectories. `auth.js` exports `requireUser` and `getUserId`. `db.js` exports the Supabase client and named query functions. `webhooks.js` extracted from `server.js` because it needs its own body parser middleware. |

**Database schema (4 tables):**
- `users` — `clerk_id TEXT UNIQUE`, `email`, `plan TEXT DEFAULT 'free'`, `tier_updated_at TIMESTAMPTZ`
- `courses` — `user_id UUID FK`, `subject`, `skill_level`, `course_json JSONB`, `created_at`
- `cache` — `key TEXT PK`, `data JSONB` (global, not per-user; same MD5 key format as file cache)
- `usage` — `(user_id, month DATE) PK`, `count INTEGER` (or per-row log pattern — preferred)

---

## 4. Watch Out For

Top 5 pitfalls with highest consequence or highest likelihood:

**1. `express.json()` breaks webhook signature verification (Phase 8)**
Global `express.json()` pre-parses the body buffer before the webhook route sees it. Svix signs raw bytes — it cannot re-verify a parsed JS object. Every billing event returns 400. Result: subscriptions never update in the DB. Fix: register `POST /api/webhooks/clerk` with `express.raw({ type: 'application/json' })` before `app.use(express.json())` in `server.js`. One-line ordering constraint with invisible billing failure as the consequence.

**2. Duplicate webhook events cause double side-effects (Phase 8)**
Svix guarantees at-least-once delivery. A handler that sends a welcome email or inserts a billing log row will duplicate those side-effects on retry. Fix: store the `svix-id` header in a `processed_webhook_events` table. Check before processing any event; return 200 immediately if already processed. Make all DB state changes use `ON CONFLICT DO NOTHING` or `ON CONFLICT DO UPDATE`.

**3. Usage gate race condition allows limit bypass (Phase 8)**
Two concurrent requests both read `count = N-1`, both pass the gate, both increment. Fix: atomic conditional increment in a single Postgres statement (`UPDATE ... WHERE count < limit RETURNING id`). Do not implement as read-then-write in application code.

**4. Existing users lose course history on first login (Phase 7)**
v1.0 users have course history, watched state, and recent searches in `localStorage`. After v2.0 ships, the app reads from Supabase — which is empty for them. Fix: on first authenticated page load, detect non-null `localStorage` history and run a one-time migration (POST to `/api/courses/import`, then clear localStorage, then set `localStorage.migrated = true`). Design this before the course-history write path.

**5. Landing page JS-rendered content is invisible to search engines (Phase 9)**
If the landing page injects pricing copy, feature descriptions, or meta tags via JavaScript, search engines and AI crawlers see an empty shell. Fix: write `landing.html` as fully static HTML from the start. All content — pricing table, CTAs, feature list, `<meta>` tags, Open Graph tags — must be present in the HTML source.

**Also notable:** Landing page and app on the same route causes Clerk redirect loops. Establish `/` (landing) and `/app` (app) routing in Phase 6, not Phase 9. The `auth.uid()` Supabase RLS function returns UUID; Clerk IDs are TEXT strings — incompatible if RLS is ever introduced (not an issue in this architecture, but a trap if the DB design changes).

---

## 5. Build Order

**Phase 6 — Auth**
Root dependency. Nothing else ships without it. Establishes route structure, Clerk middleware, protected endpoints, and the webhook handler that syncs users to Supabase.

Delivers: Sign up/sign in (email + Google), protected `/api/course-stream` and `/api/hints`, basic `users` table in Supabase, `auth.js`, `db.js` (users queries), `webhooks.js` (user lifecycle events only).

Key constraint: Establish `/` vs `/app` routing here, not in Phase 9. Redirect loops are a Phase 6 problem.

**Phase 7 — Persistence**
Requires auth (clerkId available). Replaces localStorage and file cache with Supabase. Must ship the `usage` table here because billing (Phase 8) reads from it.

Delivers: `courses`, `cache`, `usage` tables; `GET /api/courses` history endpoint; localStorage migration for courses + watched state; file cache replaced (hard-cut, no fallback).

Key constraint: Audit all localStorage keys before writing migration code (`courses`, `watched`, `searches`). Hard-cut the cache layer — no dual file+DB fallback.

**Phase 8 — Billing**
Requires auth (plan claims in session JWT) and usage table (counting requires rows from Phase 7). Clerk Dashboard plan configuration must precede code changes.

Delivers: Free/pro/power gating, usage gate with 402 response, upgrade prompt modal, idempotent billing webhook handler for `subscription.*` events.

Key constraint: Register webhook route before `express.json()`. Add `tier_updated_at` to users table for out-of-order event protection. Use atomic conditional increment.

**Phase 9 — SaaS UI**
All backend systems must be in place before UI work. Landing page is the exception — can be written in parallel with Phase 6.

Delivers: `landing.html` (static HTML, SEO-ready), onboarding welcome screen, usage counter in app header, pricing section.

Key constraint: Landing page must be fully static HTML. No JS-dependent content for anything SEO-relevant.

---

## 6. Open Questions

Decisions that need the user to weigh in before or during planning:

1. **Free tier generation limit** — How many courses per month does the free tier allow? This is a product call. Research suggests 3–5 is standard for freemium learning tools; the number affects conversion urgency and how the gate feels.

2. **Pro/power tier differentiation** — What does power offer that pro does not? Three tiers were defined structurally but the feature split between pro and power was not specified. Must be decided before Clerk Dashboard configuration in Phase 8.

3. **LocalStorage migration scope for recent searches** — Migrate `courses` and `watched` (required). Migrate recent search strings? They are low-value; a case can be made to clear them rather than migrate. Needs a call before Phase 7 migration design.

4. **Annual billing at launch or v1.1?** — Research recommends annual billing as a high-LTV lever, but it adds Clerk Dashboard setup complexity. Is annual billing in scope for the initial v2.0 launch, or deferred to v1.1 once monthly billing is stable?

5. **Permanent same-origin architecture?** — Research confirms same-origin cookie auth on Railway is the correct SSE solution. Worth deciding now whether Railway same-origin is the permanent architecture or a stepping stone (e.g., CDN-hosted frontend later), because a domain split would require a full SSE auth strategy change.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack (packages, versions) | HIGH | Versions verified on npm registry April 2026; official docs consulted |
| Auth patterns (clerkMiddleware, cookie SSE) | HIGH | Official Clerk Express SDK docs; same-origin behavior confirmed |
| Supabase schema and query patterns | HIGH | Official Supabase docs; service role key pattern well-documented |
| Billing webhook mechanics | HIGH / MEDIUM | Svix delivery docs HIGH; Clerk Billing event ordering MEDIUM (announced July 2025) |
| Usage gate atomic increment | HIGH | Standard Postgres pattern; well-documented |
| SaaS feature prioritization | MEDIUM-HIGH | Industry patterns well-supported; freemium conversion rates not verified for this product category |
| LocalStorage migration scope | HIGH | All localStorage keys identified from v1.0 codebase review |

**Overall: HIGH.** No gaps require blocking research before planning. Open questions above are product decisions, not research gaps.

---

## Sources (Aggregated)

- Clerk Express SDK: https://clerk.com/docs/reference/express/overview
- Clerk `clerkMiddleware()`: https://clerk.com/docs/reference/express/clerk-middleware
- Clerk same-origin cookie auth: https://clerk.com/docs/backend-requests/making/same-origin
- Clerk session token lifecycle: https://clerk.com/docs/guides/sessions/session-tokens
- Clerk Billing `has()`: https://clerk.com/docs/guides/billing/overview
- Clerk webhook verification: https://clerk.com/docs/reference/backend/verify-webhook
- Clerk Billing webhooks (July 2025): https://clerk.com/changelog/2025-07-02-billing-webhooks
- Clerk + Supabase native integration: https://clerk.com/docs/integrations/databases/supabase
- `@clerk/express` npm: https://www.npmjs.com/package/@clerk/express (v2.0.7, April 2026)
- `@supabase/supabase-js` npm: https://www.npmjs.com/package/@supabase/supabase-js (v2.103.0, April 2026)
- `svix` npm: https://www.npmjs.com/package/svix (v1.90.0, April 2026)
- Supabase service role key: https://supabase.com/docs/guides/troubleshooting/performing-administration-tasks-on-the-server-side-with-the-servicerole-secret-BYM4Fa
- Svix at-least-once delivery + svix-id deduplication: https://docs.svix.com/idempotency
- EventSource header limitation: WHATWG HTML spec issue #2177
- Postgres atomic conditional increment: https://github.com/orgs/supabase/discussions/30334
- SPA SEO limitations: https://dev.to/arkhan/why-spas-still-struggle-with-seo-and-what-developers-can-actually-do-in-2025-237b
- Railway Express deployment: https://docs.railway.com/guides/express
