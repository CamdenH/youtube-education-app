# Phase 8: Billing - Context

**Gathered:** 2026-04-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Add Clerk Billing subscription tiers (free + early_access), enforce per-user monthly generation limits via a Supabase counter, handle Clerk Billing lifecycle webhooks to keep the `users.plan` column in sync, and show an inline upgrade prompt when free users hit their limit. No new frontend pages — upgrade links point to Clerk's hosted billing portal.

</domain>

<decisions>
## Implementation Decisions

### Subscription Tiers
- **D-01:** Two tiers for this phase — `free` and `early_access`. Higher tiers (pro, power) deferred to production.
- **D-02:** Free tier: 1 course generation per month.
- **D-03:** Early access tier: 20 course generations per month, $10/month.
- **D-04:** Clerk Billing product/plan slug: `early_access` (must match exactly what's configured in Clerk Dashboard).

### Usage Tracking
- **D-05:** Monthly generation count stored in Supabase on the `users` table — add two columns: `generation_count` (int, default 0) and `period_start` (timestamp). No separate usage table.
- **D-06:** Period reset logic: if `now()` is more than 30 days past `period_start`, reset `generation_count` to 0 and update `period_start` to `now()` before checking the limit.
- **D-07:** Counter is incremented atomically after a successful course generation (after the stream ends and `saveCourse` completes in `server.js`).

### Gate Enforcement
- **D-08:** Gate check runs at the top of the `POST /api/course` route handler, after `requireUser`, before SSE begins. Returns HTTP 429 with a structured JSON body if the user is over limit.
- **D-09:** Response body on limit hit: `{ error: 'usage_limit_reached', message: '...', upgradeUrl: '<Clerk billing portal URL>' }`.
- **D-10:** Frontend displays an inline message in the existing error area when it receives a 429: "You've used your 1 free course this month. Upgrade to Early Access for 20/month." with a link to Clerk's hosted billing portal.
- **D-11:** Early access users (20/month) go through the same counter check — they are NOT exempt from the counter, they just have a higher limit.

### Webhook Handling
- **D-12:** Handle two Clerk Billing events in `webhooks.js` (extends existing `user.created` handler):
  - `subscription.created` → set `users.plan = 'early_access'` for the associated `clerk_id`
  - `subscription.deleted` (or `subscription.ended`) → set `users.plan = 'free'`
- **D-13:** Idempotency: use Supabase `update` (plain UPDATE on `users` table by `clerk_id`). Duplicate events write the same plan value — naturally idempotent, no extra idempotency table needed.
- **D-14:** The existing webhook secret verification via `verifyWebhook` from `@clerk/express/webhooks` already handles replay protection — no change needed there.

### Claude's Discretion
- Exact Clerk billing portal URL to use for upgrade links (look up from Clerk Billing docs / `CLERK_BILLING_PORTAL_URL` env var pattern)
- SQL migration for adding `generation_count` and `period_start` columns
- Whether to use a DB-level transaction or application-level read-then-write for the counter increment (prefer atomic update where possible)
- Exact error message copy for the 429 response and frontend inline message

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing code to read
- `db.js` — Supabase client + `getOrCreateUser`, `getUserPlan`, `saveCourse` — billing queries extend this module
- `webhooks.js` — Existing `clerkWebhookHandler` for `user.created` — billing events added here
- `auth.js` — `requireUser` middleware — gate check runs after this
- `server.js` — `POST /api/course` route handler — gate check inserted here before SSE starts
- `index.html` — Error rendering area (search for existing error display logic) — upgrade message goes here

### Project context
- `.planning/PROJECT.md` — Tech stack constraints, tier names, billing decisions
- `.planning/phases/06-auth/` — Phase 6 summaries for Clerk setup context
- `.planning/phases/07-course-persistence/07-CONTEXT.md` — `users` table schema, `db.js` patterns

### No external specs
No external spec files — requirements fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `db.js` — Supabase service-role client already initialized; new functions (`checkAndIncrementUsage`, `updateUserPlan`) extend this module
- `webhooks.js` — `clerkWebhookHandler` already wired to `POST /api/webhooks/clerk` with `verifyWebhook` — billing events are additive
- `auth.js` — `requireUser` sets `req.userId`; gate check runs immediately after in the route handler

### Established Patterns
- CommonJS `module.exports` only — no ESM
- `'use strict'` at top of every JS file
- Raw Supabase client queries — no ORMs
- TDD: write failing tests first, then implement
- `--test-concurrency=1` (serial tests)
- HTTP error responses: `res.status(N).json({ error: '...' })`

### Integration Points
- `users` table in Supabase — needs two new columns: `generation_count`, `period_start`
- `server.js` `POST /api/course` — gate check inserted between `requireUser` and SSE stream start
- `server.js` course success path — increment counter after `saveCourse`
- `webhooks.js` — add billing event handling alongside existing `user.created`
- `index.html` — 429 response from course route triggers inline upgrade message in error area

</code_context>

<specifics>
## Specific Ideas

- Upgrade link target: Clerk's hosted billing portal (URL pattern to be looked up from Clerk Billing docs — likely an env var `CLERK_BILLING_PORTAL_URL` or a `clerk.js` helper)
- The inline upgrade message should mirror the existing error display pattern in index.html rather than introducing new UI components

</specifics>

<deferred>
## Deferred Ideas

- Pro and power tiers (beyond early_access) — deferred to production
- Custom /pricing page with plan comparison — Phase 9 (SaaS UI / Landing Page)
- Per-month usage history table — not needed for two-tier MVP
- Metered billing via Clerk's usage reporting API — not needed since counts are stored in Supabase

</deferred>

---

*Phase: 08-billing*
*Context gathered: 2026-04-18*
