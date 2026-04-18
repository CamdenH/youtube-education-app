# Phase 8: Billing - Research

**Researched:** 2026-04-18
**Domain:** Clerk Billing (subscriptions, webhooks, plan gating), Supabase (atomic counter, migration)
**Confidence:** MEDIUM-HIGH — Clerk Billing is relatively new (billing webhooks GA'd July 2025); core patterns verified via Context7 and official docs; webhook payload structure partially ASSUMED.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Two tiers: `free` and `early_access`. Higher tiers deferred to production.
- **D-02:** Free tier: 1 course generation per month.
- **D-03:** Early access tier: 20 generations/month, $10/month.
- **D-04:** Clerk Billing product/plan slug: `early_access` (must match Clerk Dashboard exactly).
- **D-05:** Usage tracking on `users` table — add `generation_count` (int, default 0) and `period_start` (timestamp). No separate usage table.
- **D-06:** Period reset: if `now()` > 30 days past `period_start`, reset count to 0 and update `period_start` before checking limit.
- **D-07:** Counter incremented atomically after successful generation (after `saveCourse` completes in `server.js`).
- **D-08:** Gate check at top of `POST /api/course-stream` route, after `requireUser`, before SSE stream starts. Returns HTTP 429 if over limit.
- **D-09:** 429 response body: `{ error: 'usage_limit_reached', message: '...', upgradeUrl: '<Clerk billing portal URL>' }`.
- **D-10:** Frontend displays inline 429 message in existing error area when it receives a non-200 before SSE opens.
- **D-11:** Early access users go through same counter check — same path, higher limit.
- **D-12:** Handle `subscriptionItem.active` (→ set plan='early_access') and `subscriptionItem.ended` (→ set plan='free') in `webhooks.js`.
- **D-13:** Idempotency via plain Supabase `update` by `clerk_id` — naturally idempotent, no extra table.
- **D-14:** Existing `verifyWebhook` from `@clerk/express/webhooks` handles replay protection — no change.

### Claude's Discretion

- Exact Clerk billing portal URL to use for upgrade links.
- SQL migration for `generation_count` and `period_start` columns.
- Whether to use DB-level RPC or application-level read-then-write for counter increment (prefer atomic).
- Exact error message copy for 429 response and frontend inline message.

### Deferred Ideas (OUT OF SCOPE)

- Pro and power tiers beyond `early_access`.
- Custom /pricing page with plan comparison (Phase 9).
- Per-month usage history table.
- Metered billing via Clerk usage reporting API.

</user_constraints>

---

## Summary

Phase 8 adds three interconnected capabilities: a Supabase usage counter that gates `POST /api/course-stream`, Clerk Billing webhook handling that keeps `users.plan` in sync, and an inline 429 upgrade prompt in the frontend.

The core technical complexity is in three areas. First, Clerk Billing uses a two-level event hierarchy — `subscriptionItem` events (not `subscription` events) are what fire when a user's paid plan activates or ends. The context decisions D-12 reference `subscription.created`/`subscription.deleted` as names, but the correct event names are `subscriptionItem.active` and `subscriptionItem.ended`. The planner must use the correct names. Second, the usage gate must handle the EventSource 429 problem: `EventSource` does not expose HTTP status codes to JavaScript, so the gate must fire before the SSE headers are sent and the frontend must use a `fetch()` preflight call to detect the 429. Third, atomic counter increment must use a Postgres `UPDATE ... SET generation_count = generation_count + 1` (or RPC) to prevent double-counting on concurrent requests.

**Primary recommendation:** Use `getAuth(req).has({ plan: 'early_access' })` for server-side plan checking (reads from JWT session claims — no extra Clerk API call). Use `subscriptionItem.active` and `subscriptionItem.ended` webhooks with `evt.data.payerId` to identify the user. Use Supabase RPC for the atomic counter increment. Use a `fetch()` preflight on the frontend to detect 429 before opening `EventSource`.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Plan check / usage gate | API / Backend (`server.js`) | — | Session claims and DB counters live server-side |
| Counter increment | Database (Supabase Postgres via RPC) | API / Backend | Atomicity requires the increment to execute inside Postgres |
| Plan sync from webhooks | API / Backend (`webhooks.js`) | Database (Supabase `users.plan`) | Webhooks are HTTP POST to server; DB is the persistent store |
| Supabase schema migration | Database | — | DDL only; no application code |
| 429 inline upgrade prompt | Browser / Client (`index.html`) | — | UI rendering is frontend responsibility |
| Billing portal URL | API / Backend (env var in `server.js`) | Browser / Client (target of upgrade link) | Server injects URL into 429 JSON; browser navigates to it |

---

## Standard Stack

### Core (no new dependencies)

| Library | Version (installed) | Purpose | Why |
|---------|---------------------|---------|-----|
| `@clerk/express` | `^2.1.0` (latest: 2.1.5) | `getAuth`, `has()`, `verifyWebhook` | Already installed; `has({ plan })` confirmed in v2.x [VERIFIED: Context7] |
| `@supabase/supabase-js` | `^2.103.0` (latest: 2.103.3) | DB queries, RPC for atomic increment | Already installed [VERIFIED: npm registry] |

No new npm dependencies are required for this phase. [VERIFIED: codebase audit]

### Supporting SQL

| Artifact | Purpose |
|----------|---------|
| `08-01-migration.sql` | `ALTER TABLE users ADD COLUMN` for `generation_count` and `period_start` |
| `increment_generation_count` Postgres function | Atomic counter increment via `supabase.rpc()` |

---

## Architecture Patterns

### System Architecture Diagram

```
POST /api/course-stream request
  │
  ├─ requireUser (auth.js) → sets req.userId
  │
  ├─ GATE CHECK (server.js, new code)
  │    ├─ db.checkAndIncrementUsage(req.userId)  ──→  Supabase users table
  │    │    ├─ read: generation_count, period_start, plan
  │    │    ├─ reset if period expired (30-day window)
  │    │    ├─ compare count vs limit (1 or 20)
  │    │    └─ if over limit → return { allowed: false, upgradeUrl }
  │    │
  │    └─ if over limit → res.status(429).json(body)  ──→  Browser fetch() intercepts
  │                                                          └─ showUpgradePrompt()
  │
  ├─ (if allowed) SSE stream opens
  │    └─ courseStreamHandler → course assembled
  │
  └─ after saveCourse
       └─ db.incrementGenerationCount(req.userId)  ──→  Supabase RPC (atomic +1)


POST /api/webhooks/clerk (Clerk Billing events)
  │
  ├─ verifyWebhook()
  │
  ├─ evt.type === 'subscriptionItem.active'
  │    └─ evt.data.plan.slug === 'early_access'
  │         └─ db.updateUserPlan(evt.data.payerId, 'early_access')
  │
  └─ evt.type === 'subscriptionItem.ended'
       └─ evt.data.plan.slug === 'early_access'  (guard: don't downgrade on free plan end)
            └─ db.updateUserPlan(evt.data.payerId, 'free')
```

### Recommended Project Structure

No structural changes. All new code extends existing flat-file modules:

```
server.js          ← gate check inserted before SSE opens; incrementGenerationCount after saveCourse
db.js              ← add: checkAndIncrementUsage(), updateUserPlan(), incrementGenerationCount()
webhooks.js        ← add: subscriptionItem.active / subscriptionItem.ended handlers
index.html         ← change: fetch() preflight before EventSource; showUpgradePrompt on 429
08-01-migration.sql ← new file: ALTER TABLE + CREATE FUNCTION
```

### Pattern 1: Server-Side Plan Check via `has()`

**What:** `getAuth(req).has({ plan: 'early_access' })` reads plan membership from the JWT session claims — no extra Clerk API round-trip.
**When to use:** When you need to branch on plan membership inside a route handler.

```javascript
// Source: Context7 /clerk/clerk-docs — checking-plan-using-has-function.mdx
// CommonJS adaptation (project uses require, not import)
const { getAuth } = require('@clerk/express');

// Inside a route handler, after requireUser has run:
const { has } = getAuth(req);
const isEarlyAccess = has({ plan: 'early_access' });
```

**IMPORTANT CAVEAT:** `has()` reads from the JWT session token, which is refreshed on each page load but not in real-time. The freshness window is typically < 1 minute for active sessions. For the usage gate (D-08), the project decision is to use the Supabase `users.plan` column (kept in sync by webhooks) rather than `has()`. `has()` is available as a supplemental check if needed. [VERIFIED: Context7]

### Pattern 2: Correct Webhook Event Names

**What:** Clerk Billing fires `subscriptionItem` events (granular) and `subscription` events (top-level container). The events that signal paid plan activation/deactivation are on `subscriptionItem`.

```
subscriptionItem.active    — paid plan item becomes active (payment succeeded)
subscriptionItem.ended     — subscription item has ended (billing period closed, access revoked)
subscriptionItem.canceled  — user canceled (retains access until period end; does NOT mean access revoked yet)
```

**D-12 correction:** The context decisions name `subscription.created` / `subscription.deleted`, but those do not exist in Clerk's current event catalog. The correct names are `subscriptionItem.active` (subscribe) and `subscriptionItem.ended` (access fully revoked). `subscriptionItem.canceled` fires when the user cancels but still has time left — the plan should remain `early_access` until `subscriptionItem.ended` fires.

[VERIFIED: Context7 /clerk/clerk-docs billing.mdx]

### Pattern 3: Extracting userId from Billing Webhook Payload

The `subscriptionItem.*` events carry a `CommerceSubscriptionItem` object in `evt.data`. The Clerk user ID is `evt.data.payerId`. The plan is `evt.data.plan` (a `CommercePlan` object with a `slug` field).

```javascript
// Source: Context7 /clerk/clerk-docs — commerce-subscription-item.mdx
// Approximate payload shape for subscriptionItem.active:
{
  type: 'subscriptionItem.active',
  data: {
    id: 'si_abc123',
    object: 'commerce_subscription_item',
    status: 'active',
    payerId: 'user_abc123',      // ← Clerk user ID — use this to find the DB row
    planId: 'plan_xyz',
    plan: {
      id: 'plan_xyz',
      slug: 'early_access',      // ← matches D-04 slug
      name: 'Early Access',
      isDefault: false
    },
    planPeriod: 'month',
    periodStart: 1715644800000,  // unix ms
    periodEnd: 1718323200000,    // unix ms
    createdAt: 1715644800000,
    updatedAt: 1715644800000
  }
}
```

**Guard pattern in webhooks.js:** Only set `plan='early_access'` when `evt.data.plan.slug === 'early_access'`. Only set `plan='free'` on `subscriptionItem.ended` when `evt.data.plan.slug === 'early_access'`. This prevents the always-present free-plan subscription item from incorrectly downgrading users. [VERIFIED: Context7 + plan slug field confirmed on CommercePlan object]

**Note on payerId being `undefined`:** The `payerId` field can be `undefined` per the type definition (not always present). Add a guard: if `!evt.data.payerId` log and return 200 without a DB write. [VERIFIED: Context7 — payerId listed as `undefined | string`]

### Pattern 4: Atomic Counter Increment in Supabase

**What:** Using `UPDATE ... SET generation_count = generation_count + 1` directly in Postgres guarantees atomicity within a single transaction. The supabase-js client supports raw SQL expressions via the RPC approach.

**Recommended: Postgres function (RPC)**

```sql
-- In 08-01-migration.sql
CREATE OR REPLACE FUNCTION increment_generation_count(p_clerk_id TEXT)
RETURNS VOID AS $$
  UPDATE users
  SET generation_count = generation_count + 1
  WHERE clerk_id = p_clerk_id;
$$ LANGUAGE sql VOLATILE;
```

```javascript
// Source: Context7 /supabase/supabase — rpc method
// In db.js:
async function incrementGenerationCount(clerkId) {
  const { error } = await supabase.rpc('increment_generation_count', { p_clerk_id: clerkId });
  if (error) throw new Error(`[db] incrementGenerationCount failed: ${error.message}`);
}
```

**Why RPC over client-side read-then-write:** A client-side pattern of `SELECT count, then UPDATE count+1` has a TOCTOU race on concurrent requests from the same user (e.g., two tabs submitting at once). The RPC executes the increment as a single atomic statement in Postgres. [VERIFIED: Supabase docs + standard Postgres atomicity semantics]

### Pattern 5: 429 + EventSource — The Core Frontend Challenge

**The problem:** `EventSource` in the browser connects via a simple GET request. The browser's EventSource API does not expose the HTTP response status code to JavaScript before the connection is established. If the server returns 429, the browser fires `EventSource.onerror` — but `onerror` also fires for network errors, and there is no way to read the status code from within `onerror`.

**The solution: `fetch()` preflight before opening `EventSource`**

The frontend should first call the same endpoint with `fetch()` to check for gate errors, then open `EventSource` only if `fetch` returns 200 (or 204 for a gated check endpoint).

Two implementation options:

**Option A (recommended): Separate lightweight gate-check endpoint**

Add `GET /api/usage-check` — protected, returns 200 OK if under limit, 429 if over. The frontend calls this with `fetch()` before opening `EventSource`. No SSE headers involved.

```javascript
// index.html — before opening EventSource:
const gateRes = await fetch('/api/usage-check');
if (gateRes.status === 429) {
  const body = await gateRes.json();
  showUpgradePrompt(body.message, body.upgradeUrl);
  enableForm();
  return;
}
// Gate passed — open EventSource as before
```

**Option B: Wrap EventSource in fetch() preflight against the same SSE endpoint**

Call `fetch('/api/course-stream?...')` with `{ method: 'GET', headers: { Accept: 'application/json' } }`. The gate check in `server.js` detects non-SSE Accept headers and returns JSON 429 before setting SSE headers. If Accept is `text/event-stream`, fall through to SSE. This is more complex and brittle.

**Recommendation: Option A** — cleaner separation, no Accept header inspection, follows existing pattern of `POST /api/course-stream` being the SSE endpoint. The gate check is a pure read from Supabase (no SSE involvement). [ASSUMED — no Clerk/Supabase docs apply here; this is a standard SSE limitation workaround]

**CRITICAL NOTE for D-08:** D-08 says gate check runs at the top of `POST /api/course-stream`. But the current code uses `GET /api/course-stream` (SSE uses GET, not POST — review `server.js` line 57). The gate check therefore runs inside `GET /api/course-stream`. Since this is SSE, the 429 must fire before `res.writeHead` is called (before the SSE headers are sent). A `fetch()` preflight is still needed on the frontend. Option A (separate `/api/usage-check`) is cleanest.

### Pattern 6: Clerk Billing Portal URL

**What:** Clerk's billing management UI is embedded in the Account Portal user profile page (Billing tab). There is no standalone `CLERK_BILLING_PORTAL_URL` environment variable in Clerk's documented API.

**Verified pattern:** The Account Portal user-profile URL follows:
- Dev: `https://viable-llama-18.accounts.dev/user` (this project's specific dev domain, visible in index.html)
- Prod: `https://accounts.<your-domain>/user`

The billing tab is part of the UserProfile component, which renders a Billing tab automatically when Clerk Billing is enabled for the application.

**Recommended approach for `upgradeUrl` in the 429 response:**

```javascript
// In server.js or a config module:
// Use the Account Portal user-profile URL with a redirect back to /app
const UPGRADE_URL = process.env.CLERK_ACCOUNT_PORTAL_URL
  || 'https://accounts.clerk.dev/user';  // fallback, will be wrong in prod
```

Add `CLERK_ACCOUNT_PORTAL_URL` as a new env var. In Railway: set to the production account portal URL (found in Clerk Dashboard > Account Portal). In `.env`: set to dev account portal URL (e.g., `https://viable-llama-18.accounts.dev/user`).

**Alternative: Hard-code the dev URL in the env var.** The URL visible in `index.html` is `https://viable-llama-18.accounts.dev` — user profile is at `https://viable-llama-18.accounts.dev/user`. [VERIFIED: Account Portal direct-links pattern from Context7; specific URL inferred from index.html]

[ASSUMED: There is no `CLERK_BILLING_PORTAL_URL` env var in Clerk's documented API as of April 2026. The billing tab lives inside UserProfile. Confirm in Clerk Dashboard > Account Portal if a direct `/user/billing` path exists.]

### Anti-Patterns to Avoid

- **Checking plan only via `has()`:** `has()` reads a JWT claim that can be up to ~60s stale. For the usage gate, read `users.plan` from Supabase (kept fresh by webhooks). Using `has()` alone risks access leaking after cancellation.
- **Handling `subscriptionItem.canceled` as downgrade trigger:** `canceled` means the user opted out but still has access until period end. Downgrade should only fire on `subscriptionItem.ended`. Handling `canceled` as downgrade would cut off access prematurely.
- **Application-level counter increment (read-then-write):** `SELECT count` + `UPDATE count+1` in two separate supabase calls is not atomic. Use RPC.
- **Opening EventSource before checking for 429:** Native EventSource cannot read HTTP status codes. Always preflight with `fetch()`.
- **Missing plan.slug guard in webhooks:** If you don't check `evt.data.plan.slug === 'early_access'`, the always-present free-plan `subscriptionItem.ended` event will set every user to `plan='free'` when their first period ends.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Webhook signature verification | Custom HMAC check | `verifyWebhook` from `@clerk/express/webhooks` | Already in use; handles timing-safe comparison + replay protection |
| Plan membership check in JWT | Parse JWT manually | `getAuth(req).has({ plan })` | Clerk's SDK handles JWT parsing, expiry, and claim extraction |
| Atomic counter increment | Read + write in JS | Postgres `UPDATE ... SET x = x + 1` via `supabase.rpc()` | Postgres provides serializable atomicity; JS read-then-write has TOCTOU race |
| Billing UI / subscription checkout | Custom payment form | Clerk's hosted Account Portal (UserProfile Billing tab) | PCI compliance, subscription UI, and invoice history — not hand-rollable |

---

## Runtime State Inventory

> This is not a rename/refactor phase — no runtime string replacement involved. Standard inventory below confirms no hidden state.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | Supabase `users` table — missing `generation_count` and `period_start` columns | SQL migration (ALTER TABLE) |
| Live service config | Clerk Dashboard — billing products/plans must be configured manually (slug `early_access` must exist before webhooks fire) | Manual setup in Clerk Dashboard |
| OS-registered state | None — verified by codebase audit | None |
| Secrets/env vars | `CLERK_ACCOUNT_PORTAL_URL` — new env var needed for upgrade link URL | Add to `.env` and Railway env |
| Build artifacts | None — no compiled outputs | None |

---

## Common Pitfalls

### Pitfall 1: Wrong Webhook Event Names

**What goes wrong:** Registering handlers for `subscription.created` / `subscription.deleted` — these events do not exist (or fire at the wrong time). `subscription.created` fires when any subscription container is created (including at account creation with the free plan), not when a paid plan activates.
**Why it happens:** Context decisions D-12 used intuitive names that don't match Clerk's actual event taxonomy.
**How to avoid:** Use `subscriptionItem.active` (paid plan activated) and `subscriptionItem.ended` (paid plan revoked). Always guard on `evt.data.plan.slug === 'early_access'`.
**Warning signs:** Webhook handler fires on user signup (free plan creation triggers `subscription.created`).

[VERIFIED: Context7 /clerk/clerk-docs billing.mdx event catalog]

### Pitfall 2: EventSource Cannot Read 429 Status

**What goes wrong:** The server returns 429 before SSE headers are sent, but the frontend only sees `onerror` with no status code. The user sees a generic error message instead of the upgrade prompt.
**Why it happens:** Native `EventSource` API does not expose HTTP status codes. The spec closes the connection on non-200, but the status is inaccessible.
**How to avoid:** Use a `fetch()` preflight call (`GET /api/usage-check`) before opening `EventSource`. Check `response.status === 429` on the fetch response.
**Warning signs:** Testing the gate manually and seeing the generic "something went wrong" error instead of the upgrade message.

[VERIFIED: MDN EventSource spec behavior; Azure/fetch-event-source GitHub confirms limitation]

### Pitfall 3: Downgrading Too Early on Cancellation

**What goes wrong:** `subscriptionItem.canceled` fires when the user clicks "Cancel" — but they still have access until the end of the billing period. Setting `plan='free'` on `canceled` cuts off access immediately.
**Why it happens:** "Canceled" semantics differ between billing systems. In Clerk, `canceled` = "will end", `ended` = "has ended".
**How to avoid:** Only set `plan='free'` on `subscriptionItem.ended`. Ignore `subscriptionItem.canceled` (or log it, but take no action).
**Warning signs:** Users complaining about losing access immediately after cancellation.

[VERIFIED: Context7 /clerk/clerk-docs billing.mdx subscriptionItem event descriptions]

### Pitfall 4: Counter Not Atomic

**What goes wrong:** If two course-stream requests for the same user complete near-simultaneously (two browser tabs), both read `generation_count = 0`, both increment to 1, and only 1 generation is counted instead of 2.
**Why it happens:** Supabase client `select + update` is two separate HTTP calls, not a transaction.
**How to avoid:** Use `supabase.rpc('increment_generation_count', { p_clerk_id })` which executes a single SQL `UPDATE ... SET count = count + 1` atomically.
**Warning signs:** Generation counts below expected values in DB vs actual generations observed.

[VERIFIED: standard Postgres atomicity; Supabase rpc pattern verified via Context7]

### Pitfall 5: Billing Not Enabled in Clerk Dashboard

**What goes wrong:** Webhooks never fire; `has({ plan: 'early_access' })` always returns false.
**Why it happens:** Clerk Billing must be explicitly enabled in the Dashboard, and the plan with slug `early_access` must be created there before going live.
**How to avoid:** Before testing billing webhooks, confirm in Clerk Dashboard: Billing is enabled, the `early_access` plan exists with the correct slug, and the webhook endpoint is registered with billing event types checked.
**Warning signs:** No webhook deliveries appear in Clerk Dashboard > Webhooks > Attempts.

[ASSUMED — standard Clerk Billing setup requirement; not testable via research tools]

---

## Code Examples

### Usage gate in server.js (before SSE headers)

```javascript
// Source: Pattern derived from existing server.js requireUser pattern + Context7 Clerk docs
// Runs after requireUser sets req.userId, before SSE stream opens
app.get('/api/course-stream', requireUser, async (req, res) => {
  // ... input validation ...

  // USAGE GATE (D-08)
  let usageResult;
  try {
    usageResult = await checkUsage(req.userId);
  } catch (err) {
    console.error('[course-stream] usage check failed:', err.message);
    return res.status(500).json({ error: 'Usage check failed.' });
  }
  if (!usageResult.allowed) {
    return res.status(429).json({
      error: 'usage_limit_reached',
      message: `You've used your ${usageResult.limit} course generation${usageResult.limit === 1 ? '' : 's'} this month. Upgrade to Early Access for 20/month.`,
      upgradeUrl: process.env.CLERK_ACCOUNT_PORTAL_URL,
    });
  }

  // ... open SSE stream ...
});
```

### checkUsage function in db.js

```javascript
// Source: Pattern from existing db.js + D-05, D-06, D-11 decisions
async function checkUsage(clerkId) {
  const { data, error } = await supabase
    .from('users')
    .select('plan, generation_count, period_start')
    .eq('clerk_id', clerkId)
    .single();
  if (error) throw new Error(`[db] checkUsage failed: ${error.message}`);

  const plan = data.plan || 'free';
  const limit = plan === 'early_access' ? 20 : 1;
  const now = Date.now();
  const periodStart = data.period_start ? new Date(data.period_start).getTime() : 0;
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

  let count = data.generation_count || 0;

  // D-06: Reset if 30-day period expired
  if (now - periodStart > thirtyDaysMs) {
    const { error: resetErr } = await supabase
      .from('users')
      .update({ generation_count: 0, period_start: new Date().toISOString() })
      .eq('clerk_id', clerkId);
    if (resetErr) throw new Error(`[db] checkUsage reset failed: ${resetErr.message}`);
    count = 0;
  }

  return { allowed: count < limit, limit, count };
}
```

**Note:** The period reset above is two operations (read + update) not wrapped in a transaction. For this low-concurrency SaaS at launch scale, this is acceptable. A Postgres function could make it fully atomic if needed later.

### updateUserPlan function in db.js

```javascript
// Source: Pattern from existing db.js updateUser patterns
async function updateUserPlan(clerkId, plan) {
  const { error } = await supabase
    .from('users')
    .update({ plan })
    .eq('clerk_id', clerkId);
  if (error) throw new Error(`[db] updateUserPlan failed: ${error.message}`);
}
```

### subscriptionItem webhook handlers in webhooks.js

```javascript
// Source: Context7 /clerk/clerk-docs billing.mdx + CommerceSubscriptionItem type
// Extends existing clerkWebhookHandler switch-style pattern

if (evt.type === 'subscriptionItem.active') {
  const payerId = evt.data.payerId;
  const planSlug = evt.data.plan && evt.data.plan.slug;
  if (!payerId) {
    console.warn('[webhook] subscriptionItem.active missing payerId — skipping');
    return res.status(200).send('OK');
  }
  if (planSlug === 'early_access') {
    try {
      await updateUserPlan(payerId, 'early_access');
    } catch (err) {
      console.error('[webhook] subscriptionItem.active DB write failed:', err.message);
      return res.status(500).send('DB write failed');
    }
  }
}

if (evt.type === 'subscriptionItem.ended') {
  const payerId = evt.data.payerId;
  const planSlug = evt.data.plan && evt.data.plan.slug;
  if (!payerId) {
    console.warn('[webhook] subscriptionItem.ended missing payerId — skipping');
    return res.status(200).send('OK');
  }
  // Only downgrade if the early_access plan item ended (not the free plan item)
  if (planSlug === 'early_access') {
    try {
      await updateUserPlan(payerId, 'free');
    } catch (err) {
      console.error('[webhook] subscriptionItem.ended DB write failed:', err.message);
      return res.status(500).send('DB write failed');
    }
  }
}
```

### Migration SQL

```sql
-- 08-01-migration.sql
-- Phase 8: add usage tracking columns to users table
-- Safe to run multiple times.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS generation_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS period_start TIMESTAMPTZ NOT NULL DEFAULT now();

-- Atomic increment function (used by server after successful generation)
CREATE OR REPLACE FUNCTION increment_generation_count(p_clerk_id TEXT)
RETURNS VOID AS $$
  UPDATE users
  SET generation_count = generation_count + 1
  WHERE clerk_id = p_clerk_id;
$$ LANGUAGE sql VOLATILE;
```

**Notes:**
- `ADD COLUMN IF NOT EXISTS` requires Postgres 9.6+ (Supabase runs Postgres 15 — fine).
- `DEFAULT now()` on `period_start` means existing rows get the migration timestamp as their period start — effectively giving all existing users a fresh 30-day period from migration time. This is intentional for an MVP.
- The function uses `LANGUAGE sql` (not `plpgsql`) matching the Supabase community pattern for simple increment functions. [VERIFIED: Supabase discussions/909]

### Frontend 429 handling in index.html

```javascript
// Fetch preflight before EventSource — replaces current direct EventSource open
// Add GET /api/usage-check endpoint server-side; it reads Supabase and returns 200 or 429

async function checkUsageGate(subject, skillLevel) {
  const url = '/api/usage-check?subject=' + encodeURIComponent(subject)
    + '&skill_level=' + encodeURIComponent(skillLevel);
  try {
    const res = await fetch(url);
    if (res.status === 429) {
      const body = await res.json();
      return { allowed: false, message: body.message, upgradeUrl: body.upgradeUrl };
    }
    return { allowed: true };
  } catch (_) {
    return { allowed: true }; // network error — let SSE handle it
  }
}

// In the btn-generate click handler, before EventSource:
const gate = await checkUsageGate(subject, skillLevel);
if (!gate.allowed) {
  showUpgradePrompt(gate.message, gate.upgradeUrl);
  enableForm();
  return;
}
// ... open EventSource as before
```

The `showUpgradePrompt` function sets `error-message` innerHTML (with a link) instead of plain `textContent`. Since the upgrade URL is server-controlled (from `CLERK_ACCOUNT_PORTAL_URL` env var), it is not user-controlled input — using `innerHTML` is safe here, but a DOM-construction approach is cleaner:

```javascript
function showUpgradePrompt(message, upgradeUrl) {
  showContentSection('error-section');
  const el = document.getElementById('error-message');
  el.textContent = '';
  const text = document.createTextNode(message + ' ');
  const link = document.createElement('a');
  link.href = upgradeUrl;
  link.textContent = 'Upgrade now';
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  el.appendChild(text);
  el.appendChild(link);
}
```

---

## State of the Art

| Old Assumption (from D-12 in CONTEXT.md) | Correct Current Behavior | Impact |
|------------------------------------------|--------------------------|--------|
| `subscription.created` fires on paid subscribe | Does not exist as a lifecycle event; fires on account creation | Must use `subscriptionItem.active` instead |
| `subscription.deleted` fires on cancellation | Does not exist; `subscriptionItem.ended` is the revocation event | Must use `subscriptionItem.ended` |
| `subscription.created`/`deleted` carry `userId` directly | `subscriptionItem.*` events carry `payerId` (the Clerk user ID) in `evt.data.payerId` | Extraction path differs |

**Billing webhooks were GA'd July 2025** (Clerk changelog). The API is current as of April 2026. [VERIFIED: clerk.com/changelog/2025-07-02-billing-webhooks]

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Billing portal URL for this app is `https://viable-llama-18.accounts.dev/user` (dev) / `https://accounts.<domain>/user` (prod) | Code Examples, Pattern 6 | Upgrade link 404s; user can't upgrade. Fix: check Clerk Dashboard > Account Portal for exact URL. |
| A2 | `evt.data.payerId` is the Clerk user ID in `subscriptionItem.*` events | Pattern 3, Code Examples | DB update targets wrong user or fails. Fix: log raw webhook payload in dev and inspect. |
| A3 | `evt.data.plan.slug` matches the slug configured in Clerk Dashboard (`early_access`) | Pattern 3, Code Examples | Guard condition fails; plan never set to `early_access`. Fix: log `evt.data.plan` in dev. |
| A4 | Separate `GET /api/usage-check` endpoint is the best approach for the 429 preflight | Pattern 5, Code Examples | Adds an extra endpoint; alternative (Accept header inspection) may be cleaner. Medium risk. |
| A5 | `ADD COLUMN IF NOT EXISTS` works for both new columns in a single ALTER TABLE statement in Postgres 15 | Migration SQL | Migration fails if syntax unsupported. Fix: split into two ALTER TABLE statements. Low risk. |
| A6 | No `CLERK_BILLING_PORTAL_URL` built-in env var exists in Clerk's platform as of April 2026 | Pattern 6 | If Clerk adds this variable, using a custom env var creates duplication. Low risk. |

---

## Open Questions (RESOLVED via defensive fallback)

1. **Exact webhook payload structure (payerId field name)** — RESOLVED
   - What we know: Context7 `CommerceSubscriptionItem` type documents `payerId` as `undefined | string`.
   - What was unclear: Whether the actual JSON delivered to webhooks uses camelCase (`payerId`) or snake_case (`payer_id`). Clerk's webhook payloads for `user.created` use snake_case (`email_addresses`, not `emailAddresses`).
   - Resolution: Checker revision identified this as a live risk. Rather than requiring a Clerk Dashboard test event to confirm, the implementation now uses a defensive fallback: `const payerId = evt.data.payerId ?? evt.data.payer_id`. This handles both casing forms without any behaviour change if the actual delivery is camelCase. Applied in Plan 04 Task 1 (both `subscriptionItem.active` and `subscriptionItem.ended` handlers). Test stubs in Plan 01 Task 4 use `payerId` (TypeScript type) and include a comment noting the snake_case fallback is handled defensively in the implementation.

2. **Should `/api/usage-check` be GET or POST?**
   - What we know: It's a read-only operation; GET is correct REST semantics.
   - What's unclear: Whether the same query params as the course-stream endpoint should be passed (the gate is user-level, not query-level, so no params are strictly needed).
   - Recommendation: `GET /api/usage-check` with no params. Just reads `generation_count` + `period_start` for `req.userId` and returns 200 or 429.

3. **Billing plan configuration in Clerk Dashboard**
   - What we know: The plan slug must be `early_access` and it must be created in Clerk Dashboard before webhooks work.
   - What's unclear: Whether Railway's Clerk environment already has billing enabled, and whether the test plan exists.
   - Recommendation: Flag as a Wave 0 pre-flight check. The planner should include a manual verification task: "Confirm Clerk Billing is enabled and `early_access` plan exists in Clerk Dashboard."

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@clerk/express` | `has()`, `verifyWebhook` | Yes | 2.1.0 (latest 2.1.5) | — |
| `@supabase/supabase-js` | DB queries, RPC | Yes | 2.103.0 (latest 2.103.3) | — |
| Clerk Dashboard (billing enabled) | Webhook delivery, `has()` plan claims | Unknown | — | Cannot proceed without |
| Supabase Postgres 15 (production) | `ADD COLUMN IF NOT EXISTS` syntax | Unknown | — | Split ALTER TABLE |
| `CLERK_ACCOUNT_PORTAL_URL` env var | 429 upgradeUrl | Not yet set | — | Hard-code dev URL in .env |

**Missing dependencies with no fallback:**
- Clerk Billing must be enabled in the Dashboard and `early_access` plan must exist before any billing code is testable end-to-end.

**Missing dependencies with fallback:**
- `CLERK_ACCOUNT_PORTAL_URL` — can temporarily hard-code the dev account portal URL for initial testing.

---

## Validation Architecture

> `workflow.nyquist_validation: true` in `.planning/config.json` — section required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node:test` (no external runner) |
| Config file | None — tests discovered via `node --test --test-concurrency=1 tests/unit/*.test.js` |
| Quick run command | `node --test --test-concurrency=1 tests/unit/webhooks.test.js tests/unit/db.test.js tests/unit/server.test.js` |
| Full suite command | `npm test` (runs all `tests/unit/*.test.js` serially) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| D-05 | `users` table has `generation_count` and `period_start` columns | manual (SQL migration) | verify via Supabase Dashboard | N/A |
| D-06 | Period reset: count resets to 0 when `period_start` is > 30 days ago | unit | `node --test --test-concurrency=1 tests/unit/db.test.js` | Wave 0 gap |
| D-07 | Counter increments after successful generation (not before, not on failure) | unit | `node --test --test-concurrency=1 tests/unit/server.test.js` | Partial (server.test.js exists) |
| D-08 | Gate check returns 429 JSON when over limit, before SSE opens | unit + integration | `node --test --test-concurrency=1 tests/unit/server.test.js` | Partial |
| D-09 | 429 response body contains `error`, `message`, `upgradeUrl` fields | unit | `node --test --test-concurrency=1 tests/unit/server.test.js` | Wave 0 gap |
| D-11 | early_access users use limit=20; free users use limit=1 | unit | `node --test --test-concurrency=1 tests/unit/db.test.js` | Wave 0 gap |
| D-12 | `subscriptionItem.active` with `plan.slug=early_access` → sets plan='early_access' | unit | `node --test --test-concurrency=1 tests/unit/webhooks.test.js` | Partial (webhooks.test.js exists) |
| D-12 | `subscriptionItem.ended` with `plan.slug=early_access` → sets plan='free' | unit | `node --test --test-concurrency=1 tests/unit/webhooks.test.js` | Wave 0 gap |
| D-12 | `subscriptionItem.ended` for free plan (slug != early_access) → NO DB write | unit | `node --test --test-concurrency=1 tests/unit/webhooks.test.js` | Wave 0 gap |
| D-13 | Duplicate webhook events are idempotent (second update writes same plan value) | unit | `node --test --test-concurrency=1 tests/unit/webhooks.test.js` | Wave 0 gap |

### Sampling Rate

- **Per task commit:** `node --test --test-concurrency=1 tests/unit/db.test.js tests/unit/webhooks.test.js tests/unit/server.test.js`
- **Per wave merge:** `npm test` (full suite, all 162+ existing tests must remain green)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/unit/db.test.js` — add tests for `checkUsage()`, `incrementGenerationCount()`, `updateUserPlan()` (new functions); extend mock chain to support `.update()` terminator
- [ ] `tests/unit/webhooks.test.js` — add tests for `subscriptionItem.active`, `subscriptionItem.ended`, plan slug guard, missing `payerId` guard
- [ ] `tests/unit/server.test.js` — add tests for 429 response shape, gate check ordering (before SSE headers), `GET /api/usage-check` endpoint
- [ ] Migration SQL: manually verify `08-01-migration.sql` runs cleanly on Supabase before Wave 1 implementation begins

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No — Clerk handles all auth | `requireUser` middleware (existing) |
| V3 Session Management | No — session handled by Clerk | Clerk JWT (existing) |
| V4 Access Control | Yes — usage gate prevents over-limit access | `checkUsage()` gate before SSE; `has({ plan })` as supplemental |
| V5 Input Validation | Yes — `upgradeUrl` in 429 response | URL must come from server env var, never from user input |
| V6 Cryptography | No — no new crypto | `verifyWebhook` HMAC (existing, unchanged) |

### Known Threat Patterns for this Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Billing bypass via direct SSE call | Spoofing / EoP | Gate check runs server-side after `requireUser`; not bypassable client-side |
| Replay webhook attacks (inflate plan) | Tampering | `verifyWebhook` from `@clerk/express/webhooks` handles (existing, D-14) |
| Open redirect via `upgradeUrl` | Tampering | `upgradeUrl` set from `process.env.CLERK_ACCOUNT_PORTAL_URL` — server-controlled, not user input |
| Counter double-counting (tab race) | Tampering | Atomic RPC increment prevents TOCTOU race |
| Webhook events for other users' plans | Spoofing | Guard `evt.data.plan.slug === 'early_access'` prevents free-plan events from triggering downgrade |

---

## Sources

### Primary (HIGH confidence)
- Context7 `/clerk/clerk-docs` — billing.mdx (webhook event names, subscriptionItem lifecycle)
- Context7 `/clerk/clerk-docs` — commerce-subscription-item.mdx (payload shape, payerId field, plan.slug)
- Context7 `/clerk/clerk-docs` — checking-plan-using-has-function.mdx (Express getAuth + has() pattern)
- Context7 `/clerk/clerk-docs` — commerce-plan.mdx (CommercePlan object — confirms `slug` field)
- Context7 `/clerk/clerk-docs` — account-portal/direct-links.mdx (account portal URL pattern)
- Context7 `/supabase/supabase` — rpc method pattern (atomic counter via Postgres function)
- [Clerk Billing Webhooks Changelog](https://clerk.com/changelog/2025-07-02-billing-webhooks) — confirms billing webhooks GA'd July 2025

### Secondary (MEDIUM confidence)
- [Supabase GitHub Discussion #909](https://github.com/orgs/supabase/discussions/909) — community-verified RPC increment pattern
- [Azure/fetch-event-source GitHub](https://github.com/Azure/fetch-event-source) — confirms native EventSource cannot read HTTP status codes
- [MDN EventSource docs](https://developer.mozilla.org/en-US/docs/Web/API/EventSource) — confirmed onerror fires on non-200 but status inaccessible

### Tertiary (LOW confidence — flagged in Assumptions Log)
- A1: Account portal URL pattern (`/user` path for billing tab) — inferred from account portal docs + index.html; not explicitly documented
- A2/A3: `payerId` camelCase in webhook JSON — inferred from TypeScript type; actual JSON key case unverified

---

## Metadata

**Confidence breakdown:**

| Area | Level | Reason |
|------|-------|--------|
| Webhook event names | HIGH | Verified via Context7 official Clerk docs billing.mdx |
| Webhook payload shape (`payerId`, `plan.slug`) | MEDIUM | TypeScript types verified; JSON key case (camelCase vs snake_case) ASSUMED |
| `has({ plan })` via `getAuth(req)` | HIGH | Verified via Context7 official Clerk Express docs |
| Atomic counter via Supabase RPC | HIGH | Verified via Context7 + standard Postgres semantics |
| Migration SQL syntax | HIGH | Standard Postgres 15 DDL |
| Billing portal URL | LOW | No explicit env var documented; URL inferred from Account Portal patterns |
| 429 + EventSource preflight workaround | MEDIUM | Standard SSE limitation well-documented; specific implementation pattern is ASSUMED |

**Research date:** 2026-04-18
**Valid until:** 2026-05-18 (Clerk Billing is relatively new — re-verify webhook payload shape if >30 days old)
