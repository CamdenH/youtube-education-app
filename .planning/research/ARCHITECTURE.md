---
title: SaaS Integration Architecture
type: integration-research
milestone: v2.0 SaaS
researched: 2026-04-12
confidence: HIGH
---

# SaaS Integration Architecture

**Project:** YouTube Learning Curator
**Milestone:** v2.0 SaaS — Clerk auth, Supabase persistence, Clerk Billing, marketing landing page
**Researched:** 2026-04-12

---

## Context

The v1.0 MVP is a flat-file Node.js/Express app. All modules live at root. The server serves `index.html` from root via `express.static(__dirname)`, so the frontend and backend are same-origin in all environments. This is the critical architectural fact that shapes how Clerk auth works with SSE.

---

## New Files

### `auth.js` — Clerk middleware + user helpers

Exports:
- `requireUser(req, res, next)` — middleware that calls `getAuth(req)` and returns 401 if no userId. Use on every protected route except the webhook route.
- `getUserId(req)` — helper that returns `getAuth(req).userId`. Zero-cost convenience wrapper, not an abstraction layer.

Why a separate file: `server.js` already has 136 lines; Clerk setup (env check, middleware registration) warrants a dedicated module. Mirrors the convention of `transcript.js` and `cache.js` as single-purpose modules.

Key implementation details:
- `clerkMiddleware()` is registered globally in `server.js` (before routes), not inside `auth.js`. `auth.js` only exports route-level helpers.
- The webhook route must be explicitly excluded from `requireUser` since Clerk's `verifyWebhook` does its own signature check and the route is called by Clerk's servers, not authenticated users.
- `getAuth(req)` is available after `clerkMiddleware()` runs. It reads the `__session` cookie (same-origin) or the `Authorization: Bearer <token>` header (cross-origin). Since this app serves frontend and API from the same origin on Railway, cookies work automatically with EventSource — no token-in-URL kludge needed.

### `db.js` — Supabase client + all queries

Exports a single `supabase` client (service role key) and named query functions:
- `upsertUser({ clerkId, email })` — called from webhook on `user.created` / `user.updated`
- `deleteUser(clerkId)` — called from webhook on `user.deleted`
- `saveCourse({ clerkId, subject, skillLevel, courseJson })` — persists a completed course
- `getCourseHistory(clerkId, limit)` — returns last N courses for a user
- `getCachedSearch(hash)` — replaces `cacheGet` for search results
- `setCachedSearch(hash, data)` — replaces `cacheSet` for search results
- `getCachedVideo(videoId)` — replaces `cacheGet` for video stats
- `setCachedVideo(videoId, data)` — replaces `cacheSet` for video stats
- `getMonthlyUsage(clerkId)` — returns course generation count for current calendar month
- `incrementUsage(clerkId)` — increments the monthly counter

The client uses `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`. The service role key bypasses RLS entirely, which is appropriate here: the server is the only writer, all user-scoping is enforced by passing `clerkId` explicitly in every query, and there is no Supabase client in the browser.

Do NOT create a second anon-key client. All database access goes through one service-role client in `db.js`.

### `webhooks.js` — Clerk webhook handler (extracted from server.js)

Exported as an Express router or a single handler function, mounted in `server.js` at `POST /api/webhooks/clerk`.

Responsibilities:
- Verify signature with `verifyWebhook(req)` from `@clerk/express/webhooks`
- Handle `user.created`, `user.updated`, `user.deleted` events (sync users table in Supabase)
- Handle `subscription.*` billing events (update subscription tier in users table)
- Return 200 on success, 400 on verification failure, 500 on DB write failure
- All event types must be idempotent: upsert not insert, ignore unknown event types

Why a separate file: the webhook route requires `express.raw({ type: 'application/json' })` applied locally, which conflicts with the global `express.json()` middleware in `server.js`. Isolating it in a separate module with its own local `express.raw()` makes the conflict explicit and contained.

### `landing.html` — Marketing landing page

Static HTML served at `GET /`. The current `index.html` (the app) moves to `GET /app` or is served at `/app.html`.

Alternatively: keep `index.html` as the app at `GET /app`, make `landing.html` the root, and update `express.static` to serve both. No build step, no framework. Vanilla HTML/CSS/JS only.

Contains: hero, feature highlights (scoring algorithm, Claude curation, module structure), pricing tier comparison, CTA (sign up with Clerk), and a footer.

---

## Modified Files (per file: what changes and why)

### `server.js`

1. **Add `clerkMiddleware()`** as the first `app.use()` call, before `express.json()` and `express.static()`. This is required by Clerk — it must run before any route.
2. **Register webhook route before `express.json()`**: mount `POST /api/webhooks/clerk` with `express.raw({ type: 'application/json' })` immediately after `clerkMiddleware()`, before the global `app.use(express.json())`. Order matters: `express.json()` would pre-parse the body and break webhook signature verification.
3. **Protect `/api/course-stream`** by adding `requireUser` middleware: `app.get('/api/course-stream', requireUser, async (req, res) => ...)`. The user's `clerkId` is then available via `getUserId(req)` inside the handler.
4. **Protect `/api/hints`** the same way: `app.post('/api/hints', requireUser, async (req, res) => ...)`.
5. **Pass `clerkId` to `courseStreamHandler`**: the handler needs it to save the course and check/increment usage. Options: attach to `req` in the route handler before delegating, or thread `userId` as a parameter. Attach to `req` as `req.userId = getUserId(req)` before calling `courseStreamHandler(req, res)` — clean, no signature change to `sse.js`.
6. **Add usage gate** before calling `courseStreamHandler`: check `getMonthlyUsage(req.userId)` and compare against the tier limit derived from `getAuth(req).has({ plan: 'pro' })`. If exceeded, return 402 JSON before opening the SSE stream.
7. **Add static file route for landing page**: if landing.html is at root, no change needed since `express.static(__dirname)` already serves it. If routing `/` to landing and `/app` to the app UI requires a specific `sendFile` route, add it after `express.static`.

### `sse.js`

Minimal changes. `courseStreamHandler` needs `clerkId` to save the completed course. The cleanest approach is to read `req.userId` (attached by `server.js`) inside `courseStreamHandler` after the `assembleCourse` step and call `saveCourse(...)`. The function signature does not change.

What changes:
- After the `course_assembled` event fires successfully, call `db.saveCourse({ clerkId: req.userId, subject, skillLevel, courseJson: courseResult })`. This is a fire-and-forget write (non-awaited) with a caught error that logs but does not surface to the user. The SSE stream has already ended with a successful event.
- Import `db.js` at the top of `sse.js`.

### `cache.js`

In Phase 7, `cacheGet` and `cacheSet` calls in `youtube.js` and `transcript.js` are replaced with the corresponding `db.js` functions. `cache.js` itself is deleted or kept as a dev fallback.

In Phase 6 (auth), `cache.js` is unchanged. The file-based cache continues to work in dev and on Railway until Phase 7 replaces it. Do not mix migrations.

### `youtube.js`

No changes in Phase 6. In Phase 7: replace `cacheGet`/`cacheSet` calls with `db.getCachedSearch`/`db.setCachedSearch` and `db.getCachedVideo`/`db.setCachedVideo`.

### `transcript.js`

No changes in Phase 6. In Phase 7: replace file-based cache calls with db equivalents.

### `index.html`

Changes span multiple phases:

Phase 6 (auth):
- Add Clerk frontend JS (ClerkJS via CDN or `@clerk/clerk-js` script tag). Clerk recommends the CDN script tag for non-framework apps.
- Wire `SignIn`/`SignUp` components or redirect to Clerk Hosted Pages. Clerk's hosted pages are the simplest path for a vanilla JS app — no component mounting needed, just redirect to `https://accounts.<your-domain>.com/sign-in`.
- On page load: initialize Clerk, check `clerk.user`. If null, redirect to sign-in. If authenticated, proceed.
- Replace `localStorage` course history display with a call to `GET /api/courses` (new route serving Supabase history).
- Remove `localStorage` watched-state management in Phase 7.

Phase 8 (billing):
- Add plan-gated UI: show upgrade prompt when free-tier 402 response is received from `/api/course-stream`.
- Add billing management link (Clerk's hosted billing portal via `clerk.openPlanSelection()` or a redirect to Clerk Billing portal URL).

Phase 9 (SaaS UI):
- The marketing landing page (`landing.html`) replaces or precedes the app UI.
- Onboarding flow (post-signup modal or dedicated page).

---

## Data Flow Changes

### Before (v1.0)

```
Browser (index.html)
  --> GET /api/course-stream?subject=X&skill_level=Y  (no auth)
  --> SSE events stream back
  --> Course stored in localStorage
```

### After (v2.0)

```
Browser (index.html, ClerkJS loaded)
  --> Clerk session cookie __session sent automatically (same-origin)

  --> GET /api/course-stream?subject=X&skill_level=Y
        clerkMiddleware() reads __session cookie
        requireUser() checks userId, returns 401 if missing
        usage gate checks monthly count vs tier limit, returns 402 if exceeded
        courseStreamHandler runs pipeline
        after course_assembled: db.saveCourse() fire-and-forget
        db.incrementUsage() fire-and-forget
  --> SSE events stream back (unchanged format)
  --> Course displayed (unchanged rendering)
  --> Course history loaded from GET /api/courses (new route, Supabase)

  --> POST /api/hints  (same auth flow, requireUser middleware)
  --> POST /api/webhooks/clerk  (Clerk servers only, verifyWebhook signature check)
```

### SSE + Auth: The Same-Origin Solution

The browser's native `EventSource` API cannot send custom headers (Authorization: Bearer). This is a known W3C spec limitation, not a bug.

This app avoids the problem entirely: Express serves `index.html` from the same origin as the API. Clerk's `clerkMiddleware()` reads the `__session` cookie automatically on same-origin requests. EventSource sends cookies by default for same-origin URLs. No token-in-query-param workaround is needed.

If the app ever moves to a CDN-hosted frontend on a different domain, this changes — the SSE endpoint would need a short-lived token passed as a query param (acceptable for same-origin but logged; not acceptable cross-origin) or a pre-flight handshake.

For v2.0 on Railway (frontend and API same domain), same-origin cookies are the correct and secure approach.

### Webhook Data Flow

```
Clerk servers
  --> POST /api/webhooks/clerk
        express.raw() preserves body for signature verification
        verifyWebhook(req) checks svix-signature, svix-id, svix-timestamp headers
        switch on evt.type:
          user.created  --> db.upsertUser({ clerkId, email })
          user.updated  --> db.upsertUser({ clerkId, email })
          user.deleted  --> db.deleteUser(clerkId)
          subscription.* --> db.updateSubscription({ clerkId, plan, status })
        return 200
```

---

## Database Schema

Two tables are sufficient for v2.0. No ORM. Raw SQL via Supabase client's `.from().select()` / `.rpc()` or direct Postgres queries via `pg`.

### `users`
```sql
CREATE TABLE users (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id     TEXT NOT NULL UNIQUE,
  email        TEXT,
  plan         TEXT NOT NULL DEFAULT 'free',  -- 'free' | 'pro' | 'power'
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
```

### `courses`
```sql
CREATE TABLE courses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject      TEXT NOT NULL,
  skill_level  TEXT NOT NULL,
  course_json  JSONB NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX courses_user_id_created_at ON courses(user_id, created_at DESC);
```

### `cache`
```sql
CREATE TABLE cache (
  key          TEXT PRIMARY KEY,   -- MD5 hash, same as current file cache keys
  data         JSONB NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
```

### `usage`
```sql
CREATE TABLE usage (
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month        DATE NOT NULL,      -- first day of month: DATE_TRUNC('month', NOW())
  count        INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, month)
);
```

RLS is disabled on all tables. The service role client bypasses RLS regardless, and user-scoping is handled in application code via `clerkId` parameters in every query function in `db.js`. This is the correct tradeoff for a Node-only backend with no browser-to-Supabase queries.

---

## Build Order

Dependencies drive the order. Each phase must be fully complete before the next starts.

**Phase 6 — Auth**
1. Add `CLERK_SECRET_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CLERK_WEBHOOK_SECRET` to `.env`
2. `npm install @clerk/express @supabase/supabase-js`
3. Create Supabase tables: `users`, `courses`, `usage` (run SQL in Supabase dashboard)
4. Write `db.js`: client init + `upsertUser`, `deleteUser`, `saveCourse`, `getCourseHistory`, `getMonthlyUsage`, `incrementUsage`
5. Write `auth.js`: export `requireUser` middleware and `getUserId` helper
6. Write `webhooks.js`: `verifyWebhook` + event dispatch + db writes
7. Modify `server.js`: register `clerkMiddleware()`, mount webhook route (with `express.raw()`), add `requireUser` to `/api/course-stream` and `/api/hints`, attach `req.userId`, add usage gate
8. Modify `sse.js`: import `db`, call `db.saveCourse()` and `db.incrementUsage()` after `course_assembled`
9. Modify `index.html`: add ClerkJS via CDN, auth check on load, redirect unauthenticated users, load course history from API
10. Test: unauthenticated request to `/api/course-stream` returns 401; authenticated request succeeds; course appears in Supabase after generation; webhook events sync users table

**Phase 7 — Persistence (cache migration)**
1. Add `getCachedSearch`, `setCachedSearch`, `getCachedVideo`, `setCachedVideo` to `db.js`
2. Modify `youtube.js`: swap `cacheGet`/`cacheSet` calls for db equivalents
3. Modify `transcript.js`: swap `cacheGet`/`cacheSet` calls for db equivalents
4. Add `GET /api/courses` route to `server.js` (returns `getCourseHistory` for authenticated user)
5. Modify `index.html`: replace localStorage history with API call; remove localStorage watched-state; add per-course watched state to Supabase
6. Delete or retire `cache.js` (keep if tests depend on it)

**Phase 8 — Billing**
1. Define plans in Clerk Dashboard (free / pro / power), assign feature flags
2. Add `db.updateSubscription()` to handle `subscription.*` webhook events
3. Add `plan` update to `webhooks.js` event switch
4. Modify usage gate in `server.js` to use `getAuth(req).has({ plan: 'pro' })` for tier limits
5. Modify `index.html`: handle 402 response from SSE endpoint (show upgrade prompt); add billing portal link via Clerk JS `clerk.openPlanSelection()`

**Phase 9 — SaaS UI**
1. Write `landing.html`: hero, features, pricing table, CTA
2. Configure `server.js` routing: `GET /` serves `landing.html`, `GET /app` serves `index.html` (or keep root as app and add landing as a separate route)
3. Add onboarding flow to `index.html` (post-signup state detection via Clerk `clerk.user.createdAt` recency check)

---

## Key Integration Decisions

| Decision | Rationale |
|----------|-----------|
| `clerkMiddleware()` global, `requireUser` per-route | Clerk docs require `clerkMiddleware()` before all routes. Per-route `requireUser` gives explicit control over which routes are protected vs public (webhook, landing page, transcript). |
| Same-origin cookie auth for SSE | Native `EventSource` cannot send Authorization headers. Same-origin deployment on Railway means `__session` cookie is sent automatically. No query-param token kludge needed. |
| Webhook route uses `express.raw()` locally | Global `express.json()` pre-parses the body, breaking svix signature verification. Mount webhook handler before `express.json()` with a local `express.raw()` middleware. |
| Service role key only (no anon key) | No browser-to-Supabase queries exist. Service role key in server env only. RLS would add complexity with no security benefit in this architecture. |
| `req.userId` set in `server.js`, read in `sse.js` | Avoids changing `courseStreamHandler` signature. Clerk auth is a transport concern (HTTP layer), not a pipeline concern. |
| Course save is fire-and-forget after `course_assembled` | SSE stream has already ended successfully. A DB write failure should log but not retroactively error a completed course for the user. |
| Supabase `cache` table uses same MD5 key format | Preserves `queryHash()` from `cache.js`. No key format migration. Drop-in replacement for the file cache. |
| Clerk Billing `has()` for plan gate | Plan claims are embedded in the session JWT by Clerk. No DB lookup needed for tier checks. `getAuth(req).has({ plan: 'pro' })` is synchronous after `clerkMiddleware()` runs. |
| Users table synced via webhook, not on first request | Webhooks are the canonical sync pattern for Clerk + custom DB. Avoids race conditions and ensures the user row exists before any course is saved. |
| `landing.html` as a separate file | Keeps `index.html` (the app) unchanged. No routing complexity. Express static serving handles both. |

---

## Sources

- Clerk Express SDK overview: https://clerk.com/docs/reference/express/overview
- Clerk `clerkMiddleware()`: https://clerk.com/docs/reference/express/clerk-middleware
- Clerk `requireAuth()` vs `getAuth()` for API routes: https://clerk.com/docs/reference/express/require-auth
- Clerk same-origin cookie auth: https://clerk.com/docs/backend-requests/making/same-origin
- Clerk webhook verification with `verifyWebhook`: https://clerk.com/docs/reference/backend/verify-webhook
- Clerk webhook sync guide: https://clerk.com/docs/guides/development/webhooks/syncing
- Clerk Billing `has()` for plan checks: https://clerk.com/docs/guides/billing/overview
- Clerk + Supabase integration guide: https://clerk.com/docs/integrations/databases/supabase
- Supabase service role key (server-side): https://supabase.com/docs/guides/troubleshooting/performing-administration-tasks-on-the-server-side-with-the-servicerole-secret-BYM4Fa
- Billing webhooks (Clerk, July 2025): https://clerk.com/changelog/2025-07-02-billing-webhooks
- EventSource cannot send Authorization headers (W3C spec limitation): https://github.com/whatwg/html/issues/2177
