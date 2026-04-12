---
title: Technology Stack — v2.0 SaaS Additions
type: stack-research
milestone: v2.0 SaaS
researched: 2026-04-12
confidence: HIGH (versions verified via npm registry and official docs, April 2026)
---

# Technology Stack — v2.0 SaaS

This file covers ONLY the new libraries needed for v2.0. Existing v1.0 stack (Express 4.18, @anthropic-ai/sdk ^0.82.0, dotenv ^16, node:test) is validated and not re-researched here.

---

## New Libraries

### Auth — Server Side

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `@clerk/express` | `^2.0.7` | Clerk middleware + session verification for Express routes | The official Clerk SDK for Express. Replaces the deprecated `@clerk/clerk-sdk-node` (EOL January 10, 2025). Provides `clerkMiddleware()` (attaches auth to all routes), `requireAuth()` (blocks unauthenticated requests), and `getAuth(req)` (reads auth state in a route handler). `auth.has({ plan: 'pro' })` gates features by subscription plan. Drop-in into the flat Express structure — one `app.use(clerkMiddleware())` call before routes. |

**Integration point:** `server.js` — register `clerkMiddleware()` as the first `app.use()` call after body parsers. Add a `requireAuth()` middleware to the `/api/generate` and `/api/hints` routes. Gate usage limits using `getAuth(req).has({ plan: 'pro' })` inside route handlers.

**Do NOT install:** `@clerk/clerk-sdk-node` — deprecated, removed from Clerk docs as of 2025.

---

### Auth — Frontend (Vanilla JS)

| Library | How to load | Purpose | Why |
|---------|------------|---------|-----|
| `@clerk/clerk-js` (CDN) | Script tag via Clerk's own CDN | Sign-in/sign-up UI components, session token for API calls | No npm install needed. Clerk's CDN (`https://<FRONTEND_API_URL>/npm/@clerk/clerk-js@latest/dist/clerk.browser.js`) always serves the latest compatible build. Current npm version is `6.6.0`. Exposes `window.Clerk` after `await Clerk.load()`. Provides prebuilt `<SignIn>` / `<SignUp>` mount points and `Clerk.session.getToken()` for including the session JWT in fetch headers to the Express backend. |

**Integration point:** `index.html` — one script tag loads ClerkJS from CDN using the `data-clerk-publishable-key` attribute. No build step. Auth state drives UI gating (show/hide generate form, upgrade prompts) in vanilla JS.

**Pattern:**
```html
<script
  async
  crossorigin="anonymous"
  data-clerk-publishable-key="pk_live_..."
  src="https://<FRONTEND_API_URL>/npm/@clerk/clerk-js@latest/dist/clerk.browser.js"
  type="text/javascript"
></script>
<script>
  window.addEventListener('load', async () => {
    await Clerk.load();
    // Clerk.user, Clerk.session, Clerk.mountSignIn('#sign-in') etc.
  });
</script>
```

---

### Webhooks — Billing Lifecycle

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `svix` | `^1.90.0` | Verify Clerk webhook signatures on billing events | Clerk's webhook delivery is powered by Svix. The `svix` npm package is Clerk's own recommended method for verifying webhook signatures (`new Webhook(secret).verify(rawBody, headers)`). Required for idempotent billing webhook handler. Tiny package — no significant dependency footprint. Alternative is manual HMAC verification but Svix handles edge cases (replay attacks, timing attacks). |

**Integration point:** New `POST /api/webhooks/clerk` route in `server.js`. Must receive raw body (use `express.raw({ type: 'application/json' })` on that route specifically, not `express.json()`). Handles `subscription.created`, `subscription.updated`, `subscription.deleted` events to keep Supabase user plan state in sync.

**Critical:** Webhook handler must be idempotent — Svix retries on failure. Check if event has already been processed before writing to Supabase.

---

### Database

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `@supabase/supabase-js` | `^2.103.0` | Supabase Postgres client for user data, course history, cache, and subscription state | Official JS client. Works in Node.js server-side with the service role key (`SUPABASE_SERVICE_ROLE_KEY`) to bypass Row Level Security for server-controlled writes. Initialize with `createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })`. Provides `.from('table').select()/.insert()/.update()/.upsert()/.delete()` — no ORM, no query builder abstraction, just a thin wrapper over PostgREST. Current version 2.103.0 (April 2026). |

**Integration point:** New `db.js` module at project root. Exports a single initialized Supabase client. Imported by `server.js`, `sse.js`, and any module that reads/writes user data. The `cache.js` file-based cache is replaced in Phase 7 by queries in `db.js`.

**Tables to create (in Supabase dashboard or migration SQL):**
- `users` — clerk_user_id (PK), email, plan, created_at
- `courses` — id, clerk_user_id (FK), subject, level, data (jsonb), created_at
- `cache` — key (PK, md5 hash), data (jsonb), created_at (replaces .cache/ files)
- `user_progress` — clerk_user_id, course_id, watched (jsonb), created_at

**Do NOT use:** Supabase Auth — Clerk is handling auth. Use Supabase purely as a Postgres client. Do not call `supabase.auth.*` methods.

---

## Environment Variables Added in v2.0

```
# Clerk
CLERK_SECRET_KEY=sk_live_...
CLERK_PUBLISHABLE_KEY=pk_live_...        # served to frontend via Express (safe to expose)
CLERK_WEBHOOK_SECRET=whsec_...           # from Clerk dashboard > Webhooks

# Supabase
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...         # NEVER expose to frontend
```

**Pattern for serving publishable key to frontend:** Express route `GET /api/config` returns `{ publishableKey: process.env.CLERK_PUBLISHABLE_KEY }`. The frontend fetches this at load time and passes it to `Clerk.load({ publishableKey })`. This avoids hardcoding in index.html and keeps the build step-free vanilla JS architecture intact.

---

## Integration Points With Existing Architecture

| Existing File | v2.0 Change |
|---------------|-------------|
| `server.js` | Add `clerkMiddleware()` as first middleware; add `requireAuth()` to protected routes; add `POST /api/webhooks/clerk`; add `GET /api/config`; import `db.js` |
| `cache.js` | Unchanged in Phase 6 auth phase; replaced in Phase 7 when Supabase cache table is built |
| `sse.js` | `courseStreamHandler` receives `clerkUserId` to save completed course to Supabase |
| `index.html` | Add Clerk CDN script tag; fetch `/api/config` for publishable key; gate generate form on `Clerk.user`; include `Authorization: Bearer <token>` in EventSource workaround (see pitfalls) |
| **New: `db.js`** | Supabase client + query helpers (getCourse, saveCourse, getCache, setCache, getUser, upsertUser) |
| **New: `auth.js`** | Clerk middleware export + `requireAuth` + `requirePlan(planSlug)` helper |

---

## What NOT to Add

| Category | Do Not Add | Reason |
|----------|-----------|--------|
| Payment | `stripe` npm package | Clerk Billing handles Stripe integration natively. Adding stripe directly creates duplicate webhook surfaces and split ownership of subscription state. |
| ORM | `prisma`, `drizzle`, `typeorm`, `knex` | PROJECT.md explicitly forbids ORMs. `@supabase/supabase-js` is sufficient — it wraps PostgREST which handles SQL safely. |
| Frontend framework | React, Vue, Svelte | PROJECT.md forbids. Clerk's vanilla JS CDN bundle provides all needed auth UI. |
| Session store | `express-session`, `connect-pg-simple` | Clerk handles sessions via JWT. No server-side session storage needed. |
| Email | `nodemailer`, `resend`, `sendgrid` | Clerk handles transactional auth emails (sign up, password reset) natively. |
| Auth | `passport`, `jsonwebtoken`, custom JWT | Clerk replaces all of this. Manual JWT verification is unnecessary — `clerkMiddleware()` does it. |
| Migration tool | `db-migrate`, `flyway` | Supabase dashboard or single SQL files are sufficient for this project's schema complexity. No migration framework needed. |
| HTTP client | `axios`, `node-fetch` | Node 18+ native fetch is already used throughout v1.0. Do not add HTTP client libraries. |

---

## Key Version Constraints

| Constraint | Detail |
|-----------|--------|
| Express pinned at `^4.18` | Express 5 has breaking routing changes. Do not upgrade. `clerkMiddleware()` is tested and documented for Express 4.x. |
| `@clerk/clerk-sdk-node` is EOL | If it appears in any examples, ignore it. The correct package is `@clerk/express`. |
| Raw body for webhooks | The Clerk webhook route (`POST /api/webhooks/clerk`) must NOT go through `express.json()`. Register `express.raw({ type: 'application/json' })` on that specific route only, before the handler. Otherwise Svix signature verification fails. |
| Supabase service role key server-only | `SUPABASE_SERVICE_ROLE_KEY` must never be sent to the browser or returned in any API response. The frontend has no direct Supabase access. |
| Clerk session JWT for API auth | `EventSource` (used for SSE) does not support custom headers, so the session token cannot be passed as `Authorization: Bearer`. Workaround: pass a short-lived token as a query param, or switch the generate endpoint to a two-step flow (POST to initiate → GET stream with a one-time token). This is a known pitfall — Phase 6 needs to decide the approach explicitly. |

---

## Installation

```bash
# v2.0 additions only
npm install @clerk/express @supabase/supabase-js svix
```

No dev-only additions needed for these libraries.

**Updated package.json dependencies after v2.0:**
```json
{
  "dependencies": {
    "@anthropic-ai/sdk": "^0.82.0",
    "@clerk/express": "^2.0.7",
    "@supabase/supabase-js": "^2.103.0",
    "dotenv": "^16",
    "express": "^4.18",
    "svix": "^1.90.0"
  }
}
```

---

## Sources

- [@clerk/express on npm](https://www.npmjs.com/package/@clerk/express) — version 2.0.7, confirmed April 2026
- [Clerk Express SDK docs](https://clerk.com/docs/reference/express/overview)
- [Clerk Express Quickstart](https://clerk.com/docs/expressjs/getting-started/quickstart)
- [Clerk clerkMiddleware() reference](https://clerk.com/docs/reference/express/clerk-middleware)
- [Clerk requireAuth() reference](https://clerk.com/docs/reference/express/require-auth)
- [Clerk getAuth() reference](https://clerk.com/docs/reference/express/get-auth)
- [Clerk Billing for B2C](https://clerk.com/docs/nextjs/guides/billing/for-b2c) — has() pattern
- [Clerk webhook docs](https://clerk.com/docs/guides/development/webhooks/overview)
- [Clerk Billing webhook events](https://clerk.com/docs/guides/development/webhooks/billing)
- [@clerk/clerk-js on npm](https://www.npmjs.com/package/@clerk/clerk-js) — version 6.6.0
- [Clerk JavaScript Quickstart (vanilla)](https://clerk.com/docs/quickstarts/javascript)
- [@supabase/supabase-js on npm](https://www.npmjs.com/package/@supabase/supabase-js) — version 2.103.0, confirmed April 2026
- [Supabase JavaScript reference — initializing](https://supabase.com/docs/reference/javascript/initializing)
- [Supabase server-side admin client pattern](https://github.com/orgs/supabase/discussions/1284)
- [svix on npm](https://www.npmjs.com/package/svix) — version 1.90.0, confirmed April 2026
- [Svix webhook verification docs](https://docs.svix.com/receiving/verifying-payloads/how)
- [Railway Express deployment guide](https://docs.railway.com/guides/express)
