---
title: "SaaS Migration Pitfalls — Clerk + Supabase + Billing + Landing Page"
type: pitfalls
milestone: v2.0 SaaS
researched: 2026-04-12
confidence: HIGH (Clerk/Supabase official docs verified; webhook behavior verified against Svix docs; SSE+auth interaction verified against Clerk Express SDK docs)
---

# SaaS Migration Pitfalls

**Context:** Adding Clerk auth, Supabase persistence, Clerk Billing webhooks, usage gates, and a marketing landing page to a working Node.js/Express MVP with SSE streaming and vanilla JS frontend.

**Biggest risk category:** Auth + SSE interaction. Standard Clerk middleware patterns work for normal request/response cycles; SSE is a long-lived GET request that requires specific handling to avoid token expiry mid-stream and body parser conflicts on the webhook route.

---

## Category 1: Clerk Auth + SSE Interaction

### Pitfall: EventSource Cannot Send Authorization Headers

**What goes wrong:** The browser's native `EventSource` API does not support custom headers. You cannot send `Authorization: Bearer <token>` with a standard `new EventSource('/api/course-stream')` call. Clerk's session token is normally passed in the `Authorization` header. On an SSE route protected with `requireAuth()`, every request from the frontend fails with 401 immediately.

**Why it happens:** The EventSource API is specified to send no custom headers — only cookies and the built-in browser credentials. This is a known browser API limitation (open GitHub issue in the WHATWG HTML spec since 2017). Developers familiar with `fetch()`-based auth assume headers work the same way.

**Consequences:** Either the SSE route cannot be protected with header-based auth at all, or the developer falls back to insecure patterns (token in query string, logged in server access logs and browser history).

**Warning signs:**
- `requireAuth()` returns 401 for the SSE route even when the user is signed in
- Token shows correctly in non-SSE fetch calls but not on the EventSource connection
- Access logs show the SSE GET request with no Authorization header

**Prevention strategy:**
- Do not use the native `EventSource` API for authenticated SSE. Replace it with the `@microsoft/fetch-event-source` package (or equivalent fetch-based SSE polyfill) — these polyfills use `fetch()` under the hood and support custom headers.
- Alternatively, configure Clerk's `clerkMiddleware()` to also accept session tokens from cookies (`withCredentials: true` on the EventSource + cookie-based session). Clerk sets a `__session` cookie by default when the frontend uses `@clerk/clerk-js`. If the cookie is present and the SSE request is same-origin, Clerk middleware reads it without a header.
- The cookie approach is simpler for this app (single-domain, no CDN separation) — the course-stream endpoint reads the session from the cookie, not a header.
- Whichever approach is chosen, the decision must be made before Phase 6 (auth) because it dictates how the frontend initiates SSE connections.

**Phase to address:** Phase 6 (Auth). Must be resolved before protecting `/api/course-stream`.

**Confidence:** HIGH — EventSource header limitation is a documented browser spec constraint confirmed in the WHATWG HTML spec issue tracker and widely reported in Clerk + SSE integration threads.

---

### Pitfall: Clerk Session Token Expires Mid-SSE Stream

**What goes wrong:** Clerk session JWTs are short-lived — they expire every 60 seconds and are refreshed client-side by the Clerk frontend SDK. For a course generation that takes 20-90 seconds (multiple YouTube API calls + Claude calls), the initial token validated at stream open may expire before the stream closes. If `requireAuth()` validates the token only at connection open, the stream continues without issue. But if auth is re-validated mid-stream (e.g., in a per-event check), it will fail.

**Why it happens:** Developers copy auth patterns from standard request/response endpoints and add per-call auth checks inside the SSE handler. A course generation pipeline that runs `await courseStreamHandler(req, res)` for 60+ seconds is a long-lived request — the initial auth check passes, but a manual re-check 90 seconds later will see an expired token.

**Consequences:** If re-validation is added mid-stream, the stream abruptly terminates with a 401 event halfway through course generation. The user sees a broken partial result.

**Warning signs:**
- Course generation fails consistently on long subjects (many videos, slow Claude responses) but not short ones
- Error event emitted ~60 seconds into generation, regardless of pipeline state
- Log shows token validation failure well after the initial successful auth check

**Prevention strategy:**
- Authenticate once at connection open. Do not re-validate the session token inside the SSE handler loop.
- `requireAuth()` runs before `courseStreamHandler` is called — this is the correct and sufficient auth gate. Trust it.
- The 60-second refresh window applies to the client-side token rotation. The session itself (user's actual login state) defaults to 7 days. The `requireAuth()` check at request entry reads the session state, not the 60-second JWT.
- If you need user identity inside the pipeline (e.g., to write to Supabase), extract `req.auth.userId` immediately at the start of the handler before any async work. Store it in a local variable. Do not re-read `req.auth` after awaits.

**Phase to address:** Phase 6 (Auth). Document the "authenticate at entry, extract userId immediately" pattern in `auth.js`.

**Confidence:** HIGH — Clerk session token lifecycle is documented; the pattern of extracting auth state before async work is standard.

---

### Pitfall: `@clerk/clerk-sdk-node` Is End-of-Life

**What goes wrong:** Older tutorials and Stack Overflow answers reference `@clerk/clerk-sdk-node`. As of January 10, 2025, Clerk officially ended support for this package. If installed, it may work initially but will not receive security patches.

**Warning signs:**
- `npm install @clerk/clerk-sdk-node` — deprecated warning in npm output
- Any guide written before 2025 referencing this package

**Prevention strategy:** Use `@clerk/express` exclusively. The `clerkMiddleware()` and `requireAuth()` exports from `@clerk/express` are the current API. Do not mix the two packages.

**Phase to address:** Phase 6 (Auth). Verify correct package at installation time.

**Confidence:** HIGH — Clerk official changelog confirms deprecation date of January 10, 2025.

---

## Category 2: Supabase Schema + RLS

### Pitfall: `auth.uid()` Does Not Work with Clerk User IDs

**What goes wrong:** The standard Supabase RLS tutorial tells you to write policies like `auth.uid() = user_id`. Supabase's `auth.uid()` function returns a UUID. Clerk user IDs are strings (e.g., `user_2abc123`). If you define `user_id` columns as `UUID` type and write policies using `auth.uid()`, every write from a Clerk-authenticated user throws `invalid input syntax for type uuid` — or silently returns 0 rows on SELECT because the UUID comparison always fails.

**Why it happens:** Supabase's native auth uses UUIDs throughout. Documentation written for Supabase Auth does not apply to third-party auth providers. Developers copy RLS policy examples without checking the Clerk integration notes.

**Consequences:** All RLS policies are silently broken. Every SELECT returns empty. Every INSERT fails. The bug may not appear in development if RLS is disabled on the dev project.

**Warning signs:**
- `invalid input syntax for type uuid` errors on Supabase inserts
- SELECT queries return 0 rows for authenticated users even when data exists
- RLS policies pass in the Supabase dashboard SQL editor (which runs as `service_role`, bypassing RLS) but fail from the app

**Prevention strategy:**
- Define all `user_id` columns as `TEXT`, not `UUID`.
- Write all RLS policies using `(select auth.jwt()->>'sub') = user_id` instead of `auth.uid() = user_id`.
- The `sub` claim in the Clerk JWT is the Clerk user ID string.
- As of April 1, 2025, the Clerk-Supabase JWT template is deprecated. Use the native Supabase third-party auth integration with Clerk instead. This allows Supabase to verify Clerk JWTs directly — no custom JWT template needed.
- Enable RLS on your dev project from day one, not just on production. RLS bugs are invisible when RLS is off.

**Phase to address:** Phase 7 (Persistence). Schema design must use `TEXT` user_id columns and `auth.jwt()->>'sub'` policies before writing any table definitions.

**Confidence:** HIGH — Clerk/Supabase official integration docs and multiple community discussions confirm the UUID vs string mismatch.

---

### Pitfall: Using `service_role` Key for User-Scoped Queries

**What goes wrong:** The Express backend creates a Supabase client with the `service_role` key because it "just works" — it bypasses RLS and avoids policy configuration. This means every user can read every other user's courses. There is no error thrown, no warning — the bug is invisible until a user reports seeing someone else's data.

**Why it happens:** The service role key is the path of least resistance during development. RLS policies require more setup. Developers intend to "add RLS later" and never do.

**Consequences:** Complete data isolation failure. All users share one namespace. User A can query User B's course history. Critical security defect for a public SaaS product.

**Warning signs:**
- `SUPABASE_SERVICE_ROLE_KEY` is the key used in the Supabase client constructor in application code
- No RLS policies defined on user-data tables
- Database queries do not include a `user_id` filter (because service role bypasses it)

**Prevention strategy:**
- For user-scoped queries (course history, watched state, cache), create the Supabase client with a per-request authenticated client that passes the user's Clerk JWT. This triggers RLS enforcement.
- Use the service role key only for admin operations (e.g., webhook handlers that need to write across users, schema migrations, billing sync).
- Pattern: `const userSupabase = createClient(url, anonKey, { global: { headers: { Authorization: 'Bearer <clerk_jwt>' } } })` — pass the Clerk JWT from `req.auth` to scope the Supabase client to that user.
- Define RLS policies before writing any data-access code — not after.

**Phase to address:** Phase 7 (Persistence). The `db.js` module must be designed with per-request scoped clients from the start.

**Confidence:** HIGH — Supabase official security docs explicitly state service role key bypasses RLS and must never be used for user-scoped data access.

---

### Pitfall: File Cache to DB Migration Creates a Silent Dual-State

**What goes wrong:** Phase 7 replaces the file-based `.cache/` with a Supabase cache table. If the migration is done incrementally (new requests go to DB, old cache files remain), the two sources diverge. A bug in the DB writes causes fallthrough to the old files, masking the error. Tests that previously passed against `.cache/` continue passing but are now testing the wrong layer.

**Why it happens:** Incremental migration seems safe but creates ambiguous read paths. `cache.js` checks the DB first and falls back to the file — a DB write error goes unnoticed because the fallback always succeeds in dev where the file cache is warm.

**Warning signs:**
- Cache reads always succeed even when DB writes are failing
- Tests pass but Supabase shows no rows written
- Deleting `.cache/` causes unexpected test failures post-migration

**Prevention strategy:**
- Hard-cut the cache layer: when migrating in Phase 7, remove the file fallback entirely in the same PR. Do not leave dual-read logic in `cache.js`.
- Before removing the file cache, ensure the DB cache is fully functional with its own test coverage.
- Keep a `CACHE_PROVIDER` env variable (`file` | `supabase`) during the transition sprint only — flip it at the start of Phase 7 and remove the flag at the end of the phase.
- Run the full test suite against both providers before removing the file layer.

**Phase to address:** Phase 7 (Persistence). Plan the migration as a single atomic switch, not a gradual rollout.

**Confidence:** MEDIUM — based on general cache migration patterns; this app's specific dual-state risk is higher because tests rely on `.cache/`.

---

## Category 3: Clerk Billing Webhooks

### Pitfall: `express.json()` Breaks Webhook Signature Verification

**What goes wrong:** The app already uses `app.use(express.json())` as global middleware. Clerk's webhook handler requires `express.raw({ type: 'application/json' })` on the webhook route to access the raw request body for signature verification. When `express.json()` runs first globally, it parses and consumes the body buffer before the webhook route sees it. The `verifyWebhook()` call throws "Expected payload to be of type string or Buffer" — signature verification fails and every webhook event returns 400.

**Why it happens:** Express parses the body once. Once `express.json()` runs, `req.body` is a parsed JS object, not a Buffer. Svix (Clerk's webhook delivery provider) signs the raw bytes — it cannot re-verify from a parsed object.

**Consequences:** All billing webhook events fail verification. Subscription upgrades, downgrades, and cancellations are never processed. Users get charged but their tier is never updated in the database.

**Warning signs:**
- Every webhook delivery in the Clerk dashboard shows a 400 response
- Log shows "Error verifying webhook" or "payload not a Buffer"
- Non-webhook routes work fine (the JSON parser is working correctly for them)

**Prevention strategy:**
- Register the webhook route with its own body parser **before** the global `express.json()` middleware, or exclude it:
  ```js
  // Register webhook route with raw body parser BEFORE global json middleware
  app.post('/api/webhooks/clerk',
    express.raw({ type: 'application/json' }),
    clerkWebhookHandler
  );
  // Then register global json middleware for all other routes
  app.use(express.json());
  ```
- Alternatively, use route-specific exclusion patterns, but registering before global middleware is simpler and more explicit.
- Verify this in a local test using `ngrok` or a Clerk dev webhook endpoint before shipping.
- Use `@clerk/express` >= 1.7.4 — a webhook verification vulnerability was patched in this version.

**Phase to address:** Phase 8 (Billing). The webhook route must be registered before `app.use(express.json())` in `server.js`. This is a one-line ordering constraint.

**Confidence:** HIGH — documented in both the Clerk official webhook guide and a tracked Express.js issue about raw body and body-parser conflicts.

---

### Pitfall: Non-Idempotent Webhook Handlers Cause Double-Credit and Duplicate State

**What goes wrong:** Svix (Clerk's delivery layer) guarantees at-least-once delivery. Network timeouts and retries mean your webhook handler will sometimes receive the same event twice. A naive handler that runs `UPDATE users SET tier = 'pro'` once per `subscription.created` event is technically idempotent — but a handler that also runs `INSERT INTO usage_log (event_type, user_id)` or sends a welcome email will duplicate those side effects on retry.

**Why it happens:** Developers treat webhooks like normal requests. They are not — they are queued, retried, and can arrive out of order. The handler for `subscription.created` may fire twice within seconds of each other if the first response timed out.

**Consequences:** Duplicate welcome emails. Double-counted billing records. Usage quota reset twice in the same billing cycle. Subscription downgrades applied twice (double-decrement).

**Warning signs:**
- Users report receiving two onboarding emails
- Usage logs show duplicate `subscription.created` entries with identical timestamps
- Webhook dashboard shows two "succeeded" deliveries for the same `svix-id`

**Prevention strategy:**
- Store the `svix-id` (from the `svix-id` request header) in a `processed_webhook_events` table on first receipt. Before processing any event, check if `svix-id` already exists. If yes, return 200 immediately without doing any work.
- Make all state changes idempotent at the DB level regardless: `INSERT ... ON CONFLICT DO NOTHING`, `UPDATE ... WHERE tier != 'pro'` (not unconditional updates).
- For emails, check if the welcome email was already sent (a boolean column on the user row) before sending.
- Replay protection: Svix includes `svix-timestamp`. Reject events older than 5 minutes to mitigate replay attacks. The `verifyWebhook()` helper handles this automatically — do not disable it.

**Phase to address:** Phase 8 (Billing). Add `processed_webhook_events` table to the schema plan in Phase 7 prep work.

**Confidence:** HIGH — Svix official documentation explicitly states at-least-once delivery and documents the `svix-id` deduplication pattern.

---

### Pitfall: Webhook Events Arrive Out of Order, Creating Stale Tier State

**What goes wrong:** A user upgrades from free → pro, then immediately downgrades back to free. Two events are queued: `subscription.updated` (pro) and `subscription.updated` (free/cancelled). Due to network conditions, they arrive reversed: the cancellation event arrives first, then the upgrade event. The final DB state shows `tier = 'pro'` even though the user cancelled.

**Why it happens:** Distributed webhook delivery has no ordering guarantees. Processing events in arrival order (not event creation order) is a systemic problem in at-least-once webhook systems.

**Consequences:** Users on the free tier see pro features. Users who upgraded are denied pro features. Billing state is incorrect.

**Warning signs:**
- User tier in DB does not match Clerk dashboard
- Subscription state flip-flops without user action
- `subscription.updated` events arrive with timestamps that are not monotonically increasing by arrival order

**Prevention strategy:**
- Every webhook event includes a timestamp. Before writing tier state, compare the event timestamp against the `updated_at` column in the users table. Only apply the update if `event_timestamp > users.tier_updated_at`.
- Schema: add `tier_updated_at TIMESTAMPTZ` to the users table. Update it with the event's `created` timestamp on every tier change.
- Do not rely on DB insertion order as a proxy for event order.

**Phase to address:** Phase 8 (Billing). Add `tier_updated_at` to the users table schema and enforce the timestamp comparison in the webhook handler.

**Confidence:** MEDIUM — out-of-order delivery is a known distributed systems property; the timestamp guard pattern is standard. Specific Clerk Billing event ordering behavior not independently confirmed (billing webhooks announced July 2025).

---

## Category 4: Usage Gates + Race Conditions

### Pitfall: Read-Then-Write Usage Check Creates a Race Condition

**What goes wrong:** The usage gate logic reads the user's monthly course count, checks if it's under the free tier limit, then (if allowed) increments the counter and starts the pipeline. Under concurrent requests, two requests can both read a count of `N-1` (one below the limit), both decide the user is under the limit, both increment, and both run the pipeline — delivering two generations when only one was allowed.

**Why it happens:** The check-then-act pattern is not atomic. Any async operation between the read and write creates a window for concurrent requests to interleave. In Node.js, this is common because `await` yields to the event loop.

**Consequences:** Users bypass usage limits by submitting the form quickly twice. Free tier users get unlimited generations by exploiting the race window.

**Warning signs:**
- Usage count in DB shows `N+2` or `N+3` after a single user session
- Two simultaneous SSE streams open for the same user
- No error was thrown, but the limit was exceeded

**Prevention strategy:**
- Use a PostgreSQL function or stored procedure that does the check and increment atomically in a single query. A Postgres function with `SERIALIZABLE` isolation or a conditional `UPDATE ... WHERE usage_count < limit RETURNING *` handles this without application-level locking.
- Pattern: `UPDATE usage SET count = count + 1 WHERE user_id = $1 AND count < $2 AND billing_period = $3 RETURNING id` — if this returns 0 rows, the limit was hit. If it returns 1 row, the increment succeeded. This is atomic because Postgres executes it as a single statement.
- Do not implement the check in application code followed by a separate increment query. Atomic DB operations only.
- Alternatively, a Supabase DB function (RPC) that wraps the conditional increment is clean and testable.

**Phase to address:** Phase 8 (Billing) — or Phase 6 if usage tracking is introduced alongside auth. Design the atomic pattern before the first line of usage-gate code.

**Confidence:** HIGH — atomic conditional increment is a well-understood pattern; Postgres `UPDATE ... RETURNING` is documented behavior.

---

### Pitfall: Usage Counter Does Not Reset Per Billing Period

**What goes wrong:** Free tier users get N generations per month. The usage counter is a simple `INTEGER` that increments. Nothing resets it. Month 2 begins and users who used all their months in month 1 are permanently blocked. Or alternatively: a cron job resets all counters at midnight on the 1st, but users who signed up mid-month get fewer than N generations before the reset.

**Why it happens:** Billing period boundaries are non-trivial. Developers implement the increment but defer "reset logic" to a later task that never happens.

**Consequences:** Free tier becomes unusable after the first month. Support burden from confused users. Churn before the user experiences enough value to upgrade.

**Warning signs:**
- Usage count column never decreases
- No `billing_period_start` or `reset_at` column in the usage table
- Month-boundary test case missing from test suite

**Prevention strategy:**
- Design the usage table with a `billing_period_start DATE` column, not a raw integer. The check is: count rows WHERE `user_id = $1 AND created_at >= billing_period_start`. The count "resets" automatically because you are counting rows in the current period, not maintaining a mutable counter.
- Monthly reset = just update `billing_period_start` to the first of the current month (or calculate it from signup date for anniversary-based billing).
- Alternatively, store a row per generation with a `created_at` timestamp. The usage gate query counts rows in the current billing window. This is append-only and never requires a reset — simpler and more auditable.

**Phase to address:** Phase 8 (Billing). Schema for usage tracking must be designed before implementation — the per-row approach is strongly preferred over a mutable counter.

**Confidence:** HIGH — billing period boundary management is a well-known SaaS infrastructure pattern.

---

## Category 5: localStorage to Supabase Migration

### Pitfall: Existing Users Lose Their Course History on First Login

**What goes wrong:** v1.0 users have course history in `localStorage`. After v2.0 ships, these users log in for the first time. The frontend now reads course history from Supabase — which has none for this user. Their history appears empty. The localStorage data still exists in their browser but is now orphaned.

**Why it happens:** No migration path from localStorage to Supabase is planned. Developers assume new users start fresh and forget that existing users (testers, early adopters) have valuable state in localStorage.

**Consequences:** Early adopters feel their data was deleted. Trust loss at a critical early growth stage. Negative reviews or churn from the users most likely to give word-of-mouth referrals.

**Warning signs:**
- `localStorage.getItem('courses')` returns non-null data after login
- Supabase shows zero courses for a user who has used the app
- No migration prompt or import flow exists

**Prevention strategy:**
- On first authenticated page load, check `localStorage` for existing course history. If found, offer a one-time "Import your saved courses" prompt before clearing localStorage.
- Migrate the data client-side: read from localStorage, POST to a `/api/courses/import` endpoint that writes to Supabase, then clear localStorage.
- The migration endpoint must be idempotent (use `INSERT ... ON CONFLICT DO NOTHING` keyed on a stable course identifier to prevent duplicate imports on retry).
- Flag the migration as complete in localStorage (`migrated: true`) so it does not re-trigger on subsequent loads.
- Test this flow explicitly: create courses in localStorage, log in for the first time, verify migration runs exactly once.

**Phase to address:** Phase 7 (Persistence). Design the migration flow before the course-history write path, not after.

**Confidence:** HIGH — this is a standard "existing state migration" problem for any app moving from client-side to server-side storage.

---

### Pitfall: Watched State and Recent Searches Are Also in localStorage

**What goes wrong:** The migration plan focuses on course history (the most visible data) but misses per-video watched checkboxes and the recent searches list — also stored in localStorage. Post-migration, watched state is gone. Users who had tracked their progress see all checkboxes unchecked.

**Why it happens:** Course history is the primary data. Watched state and recent searches feel secondary, so they are overlooked in migration planning.

**Consequences:** Progress tracking is lost for existing users. The "recent searches" UI shows nothing. The app feels reset even though the main courses were migrated.

**Prevention strategy:**
- Audit all localStorage keys before writing any migration code:
  ```js
  // From v1.0 index.html, localStorage keys in use:
  // 'courses'     — course history (array of course objects)
  // 'watched'     — per-video watched state (object keyed by videoId)
  // 'searches'    — recent search strings (array of up to 5)
  ```
- Include all three in the migration flow. Watched state maps to the `watched_videos` table in Phase 7. Recent searches can be stored as a simple JSON column on the user profile row.
- Do not migrate recent searches if they are low-value — consider just clearing them. Only migrate course history and watched state.

**Phase to address:** Phase 7 (Persistence). Discovery of all localStorage keys must happen before the migration design, not during implementation.

**Confidence:** HIGH — the v1.0 codebase explicitly uses these keys (confirmed in PROJECT.md requirements for v1.0).

---

## Category 6: Marketing Landing Page

### Pitfall: Serving the Landing Page from the Same Express App Breaks SEO

**What goes wrong:** The landing page is served as a static HTML file from Express (same as `index.html`). It is a client-side-rendered page where content is dynamically injected via JavaScript. Search engines crawling the page see an empty HTML shell. The pricing section, feature descriptions, and CTAs are invisible to Googlebot. The page does not rank for any search terms.

**Why it happens:** The existing architecture serves `index.html` from `app.use(express.static(__dirname))`. Adding a landing page as another static HTML file feels consistent. The developer defers "SEO stuff" to later and never returns to it.

**Consequences:** Zero organic traffic. The marketing investment is invisible to search engines and AI crawlers (GPTBot, ClaudeBot, PerplexityBot do not execute JavaScript). Social previews (Open Graph) are empty because OG tags are set by JavaScript after load.

**Warning signs:**
- Page source (`view-source:`) shows empty `<body>` or a loading spinner
- No `<meta name="description">` or Open Graph tags in the initial HTML
- Google Search Console shows "Crawled - currently not indexed" for the landing page

**Prevention strategy:**
- Write the landing page as a **fully static HTML file** with all content (pricing table, feature list, CTA copy) hardcoded in the HTML. No JavaScript required to render any SEO-relevant content.
- All `<meta>` and Open Graph tags must be in the `<head>` of the static HTML, not set by JavaScript.
- The landing page does not need to be a SPA. Vanilla HTML with minimal JS (for interactive elements like a pricing toggle) is ideal and loads faster than a JS-rendered page.
- Keep the landing page (`/`) separate from the app page (`/app` or `/dashboard`). The app can be a JS-heavy SPA. The landing page cannot.
- Add a separate Express route: `app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'landing.html')))` and serve the app from `/app`.

**Phase to address:** Phase 9 (SaaS UI). Landing page must be written as static HTML from the start, not refactored to static after discovery of SEO issues.

**Confidence:** HIGH — SPA SEO limitations are well-documented; the static HTML approach for landing pages is the standard solution confirmed by multiple SEO guides.

---

### Pitfall: No Separate Route for the App vs Landing Page Causes Auth Redirect Loops

**What goes wrong:** Both the landing page and the app UI are served from `index.html` on the root path `/`. When Clerk redirects unauthenticated users to the sign-in page, the redirect destination is `/`. The user signs in and is returned to `/` — which is still the landing page, not the app. Or the app's auth guard redirects to `/`, which loads the landing page, which redirects to sign-in, which redirects to `/`... loop.

**Why it happens:** v1.0 serves one file on one route. v2.0 needs two separate experiences at different paths. The separation is deferred until auth causes unexpected redirect behavior.

**Prevention strategy:**
- Establish the route structure in Phase 6 (Auth), not Phase 9 (UI):
  - `/` — landing page (`landing.html`) — public, no auth required
  - `/app` — application (`index.html`) — requires auth, redirects to `/sign-in` if unauthenticated
  - `/sign-in` — Clerk-hosted sign-in or a page that redirects to Clerk's hosted UI
- Set `CLERK_SIGN_IN_URL=/sign-in` and `CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/app` in environment variables.
- When `requireAuth()` is applied to `/app`, failed auth redirects to `/sign-in`, not `/`.

**Phase to address:** Phase 6 (Auth). Route structure must be defined at auth implementation time.

**Confidence:** HIGH — redirect loop is a predictable consequence of co-locating landing page and app on the same route with auth.

---

## Phase-Specific Warnings Summary

| Phase | Topic | Pitfall | Mitigation |
|-------|-------|---------|------------|
| 6 (Auth) | SSE authentication | EventSource cannot send Authorization headers | Use fetch-based SSE polyfill or cookie-based session |
| 6 (Auth) | SSE authentication | Token expiry mid-stream | Auth once at entry; extract `userId` before any `await` |
| 6 (Auth) | SDK version | `@clerk/clerk-sdk-node` is EOL | Use `@clerk/express` exclusively |
| 6 (Auth) | Route structure | Landing page and app on same route causes redirect loops | Separate `/` (landing) and `/app` (app) from day one |
| 7 (Persistence) | RLS policies | `auth.uid()` returns UUID; Clerk IDs are strings | Use `TEXT` user_id columns; use `auth.jwt()->>'sub'` in policies |
| 7 (Persistence) | DB key usage | `service_role` key bypasses RLS | Per-request Supabase client scoped with user JWT |
| 7 (Persistence) | Cache migration | Dual-state (file + DB) masks DB write errors | Hard-cut cache layer; no fallback in the migration PR |
| 7 (Persistence) | localStorage migration | Existing users lose course history on first login | One-time migration flow on first authenticated load |
| 7 (Persistence) | localStorage migration | Watched state + recent searches overlooked | Audit all localStorage keys before migration design |
| 8 (Billing) | Webhook setup | `express.json()` consumes body before webhook verification | Register webhook route with `express.raw()` before global JSON middleware |
| 8 (Billing) | Webhook reliability | Duplicate events cause double side-effects | Store processed `svix-id`; idempotent state writes |
| 8 (Billing) | Webhook ordering | Out-of-order events set stale tier | Timestamp guard: only apply if `event_ts > tier_updated_at` |
| 8 (Billing) | Usage gates | Read-then-write race condition bypasses limits | Atomic conditional increment in single Postgres statement |
| 8 (Billing) | Usage counters | Counter never resets → permanent free tier lockout | Per-row generation log with `created_at`; count rows in billing window |
| 9 (SaaS UI) | Landing page | JS-rendered content invisible to search engines | Fully static HTML for landing page; no JS-dependent content |

---

## Sources

- Clerk Express SDK (`@clerk/express`): https://clerk.com/docs/reference/express/overview — HIGH confidence
- Clerk `requireAuth()`: https://clerk.com/docs/reference/express/require-auth — HIGH confidence
- Clerk session token lifecycle (60s JWT, 7-day session): https://clerk.com/docs/guides/sessions/session-tokens — HIGH confidence
- Clerk `@clerk/clerk-sdk-node` deprecation (Jan 10, 2025): Clerk official changelog — HIGH confidence
- EventSource header limitation: WHATWG HTML spec issue tracker #2177 (open since 2017) — HIGH confidence
- Svix at-least-once delivery and `svix-id` deduplication: https://docs.svix.com/idempotency — HIGH confidence
- Clerk webhook verification and `express.raw()` conflict: https://github.com/svix/svix-webhooks/issues/1463 and https://github.com/expressjs/express/issues/6025 — HIGH confidence
- Clerk `verifyWebhook()` security patch (>= 1.7.4): https://github.com/clerk/javascript/security/advisories/GHSA-9mp4-77wg-rwx9 — HIGH confidence
- Clerk Billing webhooks (announced July 2, 2025): https://clerk.com/changelog/2025-07-02-billing-webhooks — MEDIUM confidence (post-training; referenced from search result)
- Clerk + Supabase native integration (deprecated JWT template as of April 1, 2025): https://clerk.com/changelog/2025-03-31-supabase-integration — HIGH confidence
- Supabase `auth.uid()` UUID type and third-party auth incompatibility: https://clerk.com/docs/guides/development/integrations/databases/supabase — HIGH confidence
- Supabase service role key bypasses RLS: https://supabase.com/docs/guides/database/secure-data — HIGH confidence
- Supabase RLS performance best practices: https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv — HIGH confidence
- Postgres atomic conditional increment (SERIALIZABLE isolation + UPDATE RETURNING): https://github.com/orgs/supabase/discussions/30334 — MEDIUM confidence
- SPA SEO limitations and static HTML solution: https://dev.to/arkhan/why-spas-still-struggle-with-seo-and-what-developers-can-actually-do-in-2025-237b — HIGH confidence (well-established, multi-source corroboration)
