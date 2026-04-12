# Phase 6: Auth - Context

**Gathered:** 2026-04-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Authenticated users can sign up, sign in, and access course generation. Unauthenticated users are blocked. A Clerk webhook syncs new user records to Supabase. A post-signup onboarding page explains how course generation works.

Route structure established here: `/` → `landing.html` (static), `/app` → `index.html` (protected), `/onboarding` → `onboarding.html` (post-signup).

Persistence (course history, watched state, cache table) is Phase 7. Billing gates and subscription tiers are Phase 8.

</domain>

<decisions>
## Implementation Decisions

### Onboarding page (AUTH-05)
- **D-01:** Triggered via Clerk `afterSignUpUrl` pointing to `/onboarding`. First-time users land there automatically after sign-up. Returning users skip it entirely (not forced on re-login).
- **D-02:** Separate static file `onboarding.html` — consistent with the `landing.html` / `index.html` pattern. No server-side logic needed.
- **D-03:** Page contains four things: (1) how course generation works (enter topic → Claude + YouTube → structured course), (2) what the skill level options mean (beginner/intermediate/advanced/all levels), (3) a static example of a finished course, (4) a CTA button taking the user to `/app`.

### App auth gate (AUTH-02, AUTH-03)
- **D-04:** Unauthenticated requests to `/app` get a **server-side redirect** to Clerk's hosted sign-in page via `requireUser` middleware — no app HTML is served to unauth users.
- **D-05:** The landing page `/` is fully static — no session detection, no server-side redirect for signed-in users. The hero CTA says "Sign up free"; a secondary link says "Go to app". Signed-in users who land on `/` can click through themselves.
- **D-06:** Sign-in/sign-out control lives in a **header bar** at the top of the app (`index.html`), showing the signed-in user's name/avatar and a sign-out link.

### Webhook race condition (AUTH-04)
- **D-07:** `requireUser` middleware does an optimistic `INSERT INTO users (clerk_id, email, plan) VALUES ($1, $2, 'free') ON CONFLICT (clerk_id) DO NOTHING` on every protected request. The Clerk webhook remains the primary creation path; middleware is a safety net for the window before the webhook fires.
- **D-08:** The upsert lives in `auth.js` → `requireUser` — one consistent place, not duplicated per route.

### Supabase schema scope
- **D-09:** Phase 6 creates **only** the `users` table. The `courses`, `cache`, and `usage` tables are deferred to Phases 7–8 when they are actually exercised.
- **D-10:** `db.js` exports: the Supabase service-role client + `getOrCreateUser(clerkId, email)` + `getUserPlan(clerkId)`. No stub functions for future phases — those are added when needed.

### Architectural constraints (carry-forward from STATE.md)
- **D-11:** Webhook route (`POST /api/webhooks/clerk`) registered with `express.raw()` **before** `app.use(express.json())` in `server.js`. Svix signature verification breaks silently if `express.json()` parses the body first.
- **D-12:** Clerk user IDs are `TEXT` strings, not UUIDs. `users.clerk_id` column type is `TEXT`.
- **D-13:** Same-origin Railway deployment — Clerk `__session` cookie is sent automatically by `EventSource`. No token-in-URL workaround needed for the SSE course stream endpoint.
- **D-14:** `req.userId` is attached in `server.js` by `requireUser` before delegating to `courseStreamHandler` — `courseStreamHandler`'s function signature is not changed.

### Claude's Discretion
- Exact Clerk SDK configuration (middleware init, `clerkMiddleware` placement in Express chain)
- Error message text for 401 responses
- Header bar styling and layout details
- Onboarding page visual design beyond the four required content items

</decisions>

<specifics>
## Specific Ideas

- Onboarding should include a static example of a finished course — not a live generation, just a screenshot or collapsed HTML example showing what users are about to get
- The app header bar is new — `index.html` currently has no persistent header, so this is an additive change to the existing UI

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — AUTH-01 through AUTH-05 acceptance criteria (the five success conditions for Phase 6)
- `.planning/ROADMAP.md` §"Phase 6: Auth" — Success criteria and phase goal statement

### Project constraints
- `.planning/PROJECT.md` §"Constraints" — Tech stack rules (no ESM, no TypeScript, no ORMs, flat file structure)
- `.planning/PROJECT.md` §"Architecture" — File-naming conventions, `module.exports` only, `'use strict'` requirement

### Accumulated decisions
- `.planning/STATE.md` §"Decisions" — Full set of architectural decisions from SaaS research (Clerk package versions, Supabase schema, same-origin cookie strategy, webhook body parser ordering)

### No external specs
No Clerk or Supabase ADRs in this repo — all constraints are captured in STATE.md and decisions above. Researcher should verify current `@clerk/express` v2 API against Clerk docs directly.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `server.js` — Entry point that needs: (1) webhook route registered before `express.json()`, (2) `requireUser` applied to `/app` and `/api/generate`, (3) static routes updated from single `express.static(__dirname)` to separate `/`, `/app`, `/onboarding` handlers
- `sse.js` → `courseStreamHandler` — Currently receives `(req, res)`. Must accept `req.userId` being present on the request object without any signature change
- `index.html` — Current app UI; needs a header bar added for sign-in state + sign-out link

### Established Patterns
- `'use strict'` + `module.exports` — Every new file (`auth.js`, `db.js`, `webhooks.js`) must follow this
- Error handling: YouTube/quota errors throw typed errors caught in `server.js`. Auth errors (401) should be handled the same way — throw in middleware, catch in server.js error handler
- `.env` for all secrets: `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` added here

### Integration Points
- `server.js`: Three new registrations — (1) `express.raw()` + webhook route at top, (2) `clerkMiddleware()` after static files, (3) `requireUser` on `/app` GET and `/api/generate` POST
- `index.html`: Header bar injection (Clerk.js CDN script + `<clerk-user-button>` or equivalent)
- `package.json`: `@clerk/express`, `@supabase/supabase-js`, `svix` to be added

</code_context>

<deferred>
## Deferred Ideas

- Per-user course history and watched state → Phase 7
- Free tier usage gate and upgrade prompt → Phase 8
- Usage counter display in app UI → Phase 9
- Account/subscription page → Phase 9
- Annual billing option → v2.1 backlog
- localStorage migration for recent searches → decided in Phase 7 planning

</deferred>

---

*Phase: 06-auth*
*Context gathered: 2026-04-12*
