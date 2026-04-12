# Phase 6: Auth - Research

**Researched:** 2026-04-12
**Domain:** Clerk Express SDK, Supabase Postgres, svix webhook verification, Clerk JS (vanilla)
**Confidence:** HIGH (core patterns), MEDIUM (CDN script tag URL format)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Onboarding triggered via Clerk `afterSignUpUrl` pointing to `/onboarding`. First-time users land there automatically. Returning users skip it.
**D-02:** Onboarding is a separate static file `onboarding.html`.
**D-03:** Onboarding page contains: (1) how course generation works, (2) skill level option explanations, (3) static example of a finished course, (4) CTA to `/app`.
**D-04:** Unauthenticated requests to `/app` get a server-side redirect to Clerk's hosted sign-in page via `requireUser` middleware — no app HTML served to unauth users.
**D-05:** Landing page `/` is fully static, no session detection.
**D-06:** Sign-in/sign-out control lives in a header bar at the top of `index.html` (Clerk.js CDN + `<clerk-user-button>` or equivalent).
**D-07:** `requireUser` middleware does an optimistic `INSERT ... ON CONFLICT (clerk_id) DO NOTHING` on every protected request as a race condition safety net.
**D-08:** The upsert lives in `auth.js` → `requireUser` — one consistent place.
**D-09:** Phase 6 creates only the `users` table. Other tables deferred.
**D-10:** `db.js` exports: Supabase service-role client + `getOrCreateUser(clerkId, email)` + `getUserPlan(clerkId)`. No stub functions.
**D-11:** Webhook route (`POST /api/webhooks/clerk`) registered with `express.raw()` BEFORE `app.use(express.json())`.
**D-12:** Clerk user IDs are TEXT strings. `users.clerk_id` column type is `TEXT`.
**D-13:** Same-origin Railway deployment — Clerk `__session` cookie sent automatically by EventSource. No token-in-URL workaround.
**D-14:** `req.userId` attached in `server.js` by `requireUser` before delegating to `courseStreamHandler`. No signature change to `courseStreamHandler`.

### Claude's Discretion
- Exact Clerk SDK configuration (middleware init, `clerkMiddleware` placement in Express chain)
- Error message text for 401 responses
- Header bar styling and layout details
- Onboarding page visual design beyond the four required content items

### Deferred Ideas (OUT OF SCOPE)
- Per-user course history and watched state → Phase 7
- Free tier usage gate and upgrade prompt → Phase 8
- Usage counter display in app UI → Phase 9
- Account/subscription page → Phase 9
- Annual billing option → v2.1 backlog
- localStorage migration for recent searches → Phase 7
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | User can sign up for an account via Clerk-hosted UI | Clerk JS CDN `mountSignUp()` / `mountSignIn()` on landing.html; hosted Clerk UI pages via `clerkMiddleware` redirect |
| AUTH-02 | User can sign in and sign out from any page | Clerk JS `mountUserButton()` in index.html header; sign-in redirect from `requireUser` |
| AUTH-03 | Course generation requires authentication — unauthenticated POST /api/generate returns 401 | `getAuth(req)` → check `userId` → return 401 JSON; `requireUser` middleware |
| AUTH-04 | Clerk webhook syncs new user record to Supabase on account creation | `verifyWebhook()` from `@clerk/express/webhooks` + `user.created` handler + Supabase upsert |
| AUTH-05 | User sees post-signup onboarding page | `forceRedirectUrl: '/onboarding'` in `mountSignUp()` props; static `onboarding.html` |
</phase_requirements>

---

## Summary

Phase 6 introduces Clerk authentication into an existing Express/Node.js app. The integration requires three separate concerns: (1) server-side middleware to protect routes and attach user identity, (2) a webhook endpoint to sync new users to Supabase, and (3) a client-side Clerk JS CDN script to render sign-in/sign-up/user-button components in static HTML files.

The `@clerk/express` v2 SDK is the current standard package (replaces the EOL `@clerk/clerk-sdk-node`). It provides `clerkMiddleware()`, `requireAuth()`, and `getAuth()` for server-side route protection. For the API route (`/api/generate`), `requireAuth()` is not appropriate because it redirects rather than returning 401 JSON; use `getAuth()` manually instead. For the HTML route (`/app`), `requireAuth()` with a `signInUrl` option is the correct choice.

The Clerk webhook uses `verifyWebhook()` from `@clerk/express/webhooks` — this is a first-party Clerk helper that wraps svix internally. It reads `CLERK_WEBHOOK_SIGNING_SECRET` and requires `express.raw({ type: 'application/json' })` before `express.json()`. The `user.created` payload contains `evt.data.id` (the Clerk user ID as a TEXT string) and `evt.data.email_addresses[0].email_address` for the primary email.

**Primary recommendation:** Use `verifyWebhook` from `@clerk/express/webhooks` (not raw svix) for the webhook, `clerkMiddleware()` globally before static files, `requireAuth({ signInUrl })` for `/app` HTML route, and `getAuth()` with manual 401 for the API route. Use Supabase `.upsert({ onConflict: 'clerk_id', ignoreDuplicates: true })` for safe user insertion.

---

## Project Constraints (from CLAUDE.md)

- `'use strict'` at top of every JS file — `auth.js`, `db.js`, `webhooks.js` must comply
- `module.exports` only — no ESM (`import`/`export`)
- No ORMs, no abstraction layers — raw `@supabase/supabase-js` queries only
- Flat file structure — no subdirectories
- Tests use Node's built-in test runner with `--test-concurrency=1`
- Do not add dependencies without asking — packages `@clerk/express`, `@supabase/supabase-js`, `svix` are pre-approved per CONTEXT.md
- No TypeScript — all code is plain CommonJS `.js`
- No logging frameworks — `console.error` only

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@clerk/express` | 2.1.0 | Server middleware, route protection, `getAuth()` | Official Clerk Express SDK, replaces EOL `@clerk/clerk-sdk-node` |
| `@supabase/supabase-js` | 2.103.0 | Postgres client, user upsert | Official Supabase JS client, service-role key bypasses RLS |
| `svix` | 1.90.0 | Webhook signature verification (used internally by `verifyWebhook`) | Clerk sends all webhooks via Svix; `@clerk/express/webhooks` wraps it |
| `@clerk/clerk-js` | v6 (CDN) | Client-side sign-in/sign-up/user-button components | Official Clerk browser SDK; no npm install needed, loaded via script tag |

**Version verification:** [VERIFIED: npm registry — 2026-04-12]
- `@clerk/express`: 2.1.0
- `@supabase/supabase-js`: 2.103.0
- `svix`: 1.90.0
- Node.js runtime: v22.22.0 (confirmed compatible with supabase-js 2.103.0)

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `verifyWebhook()` from `@clerk/express/webhooks` | Raw `new Webhook(secret).verify()` from `svix` | `verifyWebhook` is cleaner, first-party, reads env var automatically; raw svix still works but is more boilerplate |
| `requireAuth()` for `/app` redirect | Custom middleware with `getAuth()` + manual redirect | `requireAuth()` is the idiomatic Clerk pattern for HTML routes; both work |
| Supabase `.upsert()` | Raw SQL via `.rpc()` | `.upsert()` with `ignoreDuplicates: true` maps directly to `INSERT ... ON CONFLICT DO NOTHING`; clean and idiomatic |

**Installation:**
```bash
npm install @clerk/express @supabase/supabase-js svix
```

(`svix` is needed even if using `verifyWebhook`, because `@clerk/express/webhooks` has it as a peer dependency and it may need to be present explicitly.)

---

## Architecture Patterns

### Recommended Project Structure

```
(project root — flat, no subdirectories)
├── server.js          # Updated: webhook route + clerkMiddleware + requireUser wiring
├── auth.js            # NEW: requireUser middleware + getUserId helper
├── db.js              # NEW: Supabase client + getOrCreateUser + getUserPlan
├── webhooks.js        # NEW: verifyWebhook handler, user.created → Supabase upsert
├── landing.html       # NEW: static marketing landing page at /
├── onboarding.html    # NEW: static onboarding page at /onboarding
├── index.html         # UPDATED: add header bar with Clerk user-button
├── sse.js             # UNCHANGED (courseStreamHandler accepts req.userId)
└── ... (all other files unchanged)
```

### Pattern 1: clerkMiddleware Placement

**What:** `clerkMiddleware()` must be registered before any other middleware that needs auth state. Per Clerk docs and confirmed by community: it reads cookies and headers and attaches the auth object to `req.auth`.

**When to use:** Apply globally at the top of middleware chain.

```javascript
// Source: https://clerk.com/docs/expressjs/getting-started/quickstart
'use strict';

const { clerkMiddleware } = require('@clerk/express');

// CORRECT ORDER in server.js:
// 1. Webhook route with express.raw() — FIRST, before anything else parses the body
app.post('/api/webhooks/clerk', express.raw({ type: 'application/json' }), webhookHandler);

// 2. clerkMiddleware — before static files and routes
app.use(clerkMiddleware());

// 3. Static files
app.use(express.static(__dirname));

// 4. express.json() for API routes
app.use(express.json());

// 5. Protected routes
app.get('/app', requireUser, serveApp);
app.get('/api/course-stream', requireUser, courseStreamRoute);
```

**Warning:** If `clerkMiddleware()` is placed after `express.static()`, static files will work fine, but any route that checks `getAuth(req)` must still have `clerkMiddleware` applied earlier. Per Clerk docs: "must be set before any other middleware."

### Pattern 2: Route Protection — HTML Route vs API Route

**What:** Two different protection approaches depending on whether the client expects a redirect or a JSON error.

**HTML route (`/app`) — redirect unauth users to Clerk sign-in:**
```javascript
// Source: https://clerk.com/docs/reference/express/require-auth
const { requireAuth } = require('@clerk/express');

// requireAuth() redirects to signInUrl when unauthenticated
app.get('/app', requireAuth({ signInUrl: process.env.CLERK_SIGN_IN_URL }), (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});
```

**API route (`/api/course-stream`) — return 401 JSON when unauthenticated:**
```javascript
// Source: https://clerk.com/docs/reference/express/get-auth + community confirmed pattern
const { getAuth } = require('@clerk/express');

// requireUser is the custom middleware in auth.js
function requireUser(req, res, next) {
  const { userId } = getAuth(req);
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  // D-07: optimistic upsert as safety net
  getOrCreateUser(userId, /* email from Clerk session — see note */).catch(err =>
    console.error('[auth] upsert failed:', err)
  );
  req.userId = userId;
  next();
}
```

**Critical note on `requireAuth()` for API routes:** Do NOT use `requireAuth()` for `/api/course-stream` — it redirects to the sign-in page instead of returning 401, which breaks SSE/fetch clients. [VERIFIED: Clerk official docs + multiple community sources]

### Pattern 3: Webhook Handler

**What:** `verifyWebhook()` from `@clerk/express/webhooks` is the canonical Express webhook verification function as of @clerk/express v2. It reads `CLERK_WEBHOOK_SIGNING_SECRET` automatically.

```javascript
// Source: https://clerk.com/docs/guides/development/webhooks — confirmed from npm search 2026-04-12
'use strict';

const { verifyWebhook } = require('@clerk/express/webhooks');

// webhooks.js — exported as a route handler
async function clerkWebhookHandler(req, res) {
  let evt;
  try {
    evt = await verifyWebhook(req);
  } catch (err) {
    console.error('[webhook] verification failed:', err.message);
    return res.status(400).send('Webhook verification failed');
  }

  if (evt.type === 'user.created') {
    const clerkId = evt.data.id;  // TEXT, e.g. "user_29w83sxmDNGwOuEthce5gg56FcC"
    const email = evt.data.email_addresses[0]?.email_address ?? null;
    await getOrCreateUser(clerkId, email);
  }

  return res.status(200).send('OK');
}

module.exports = { clerkWebhookHandler };
```

**Registration in server.js (MUST be before `express.json()`):**
```javascript
const { clerkWebhookHandler } = require('./webhooks');
// Before express.json():
app.post('/api/webhooks/clerk', express.raw({ type: 'application/json' }), clerkWebhookHandler);
```

**Critical:** `express.raw()` is applied per-route (not globally), so it only affects this endpoint. The global `express.json()` registered after does not interfere. [VERIFIED: confirmed behavior from Express docs + svix docs + community reports]

### Pattern 4: Supabase Client and User Upsert

```javascript
// Source: https://supabase.com/docs/reference/javascript/initializing [VERIFIED: npm registry + official docs]
'use strict';

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }
);

// getOrCreateUser — implements D-07's optimistic upsert
async function getOrCreateUser(clerkId, email) {
  // ignoreDuplicates: true → INSERT ... ON CONFLICT (clerk_id) DO NOTHING
  const { error } = await supabase
    .from('users')
    .upsert(
      { clerk_id: clerkId, email, plan: 'free' },
      { onConflict: 'clerk_id', ignoreDuplicates: true }
    );
  if (error) throw error;
}

async function getUserPlan(clerkId) {
  const { data, error } = await supabase
    .from('users')
    .select('plan')
    .eq('clerk_id', clerkId)
    .single();
  if (error) throw error;
  return data.plan;
}

module.exports = { supabase, getOrCreateUser, getUserPlan };
```

**Service role key behavior:** The service role key bypasses all RLS. Per project decision, no RLS is enabled. The three `auth` options (`persistSession: false`, etc.) are mandatory for server-side Node usage to prevent session state leaking between requests. [VERIFIED: Supabase troubleshooting docs + community discussions]

### Pattern 5: Clerk JS in Vanilla HTML (CDN)

**What:** Clerk provides a CDN-loadable `clerk-js` v6 bundle for browser environments. No build step, no npm install. Used in `index.html` and `landing.html`.

```html
<!-- Source: https://clerk.com/docs/js-frontend/getting-started/quickstart [CITED] -->
<!-- The {{fapi_url}} is derived from the publishable key — Clerk provides exact script tags
     from the Dashboard > API Keys > "JavaScript" Quick Copy section -->
<script
  defer
  crossorigin="anonymous"
  data-clerk-publishable-key="pk_test_YOUR_KEY_HERE"
  src="https://YOUR_FAPI_URL/npm/@clerk/clerk-js@6/dist/clerk.browser.js"
  type="text/javascript"
></script>

<script>
  window.addEventListener('load', async function () {
    await Clerk.load();

    if (Clerk.user) {
      // Signed in — show user button in header
      Clerk.mountUserButton(document.getElementById('clerk-user-button'));
    } else {
      // Signed out — optionally redirect or show sign-in prompt
    }
  });
</script>
```

**Sign-in mount with post-signin redirect to `/app`:**
```javascript
// For landing.html — mount a sign-in component pointing to the app
Clerk.mountSignIn(document.getElementById('sign-in'), {
  afterSignInUrl: '/app',
  afterSignUpUrl: '/onboarding',  // D-01
});

// Or use forceRedirectUrl to override any redirect_url querystring:
Clerk.mountSignUp(document.getElementById('sign-up'), {
  forceRedirectUrl: '/onboarding',  // always go to onboarding after signup
});
```

**User button (for `index.html` header — AUTH-02):**
```javascript
Clerk.mountUserButton(document.getElementById('clerk-user-button'));
// The UserButton component includes a built-in sign-out button
```

**FAPI URL note:** The actual CDN `src` URL pattern uses your Frontend API URL, which is embedded in the publishable key (base64-decodable). The Clerk Dashboard provides the exact copy-pasteable script tags under API Keys. [ASSUMED: exact URL format not independently verified from docs — use Dashboard copy]

### Anti-Patterns to Avoid

- **Using `requireAuth()` for the SSE/API route:** It redirects to sign-in instead of returning 401, breaking SSE streams and fetch clients.
- **Parsing webhook body with `express.json()` before verification:** Silently corrupts the signature — Svix verifies against the raw bytes. Always use `express.raw()` per-route for the webhook endpoint.
- **Initializing Supabase client without `persistSession: false`:** In Node.js, the default browser-oriented options cause session state bleed between requests.
- **Using `@clerk/clerk-sdk-node`:** This is EOL — `@clerk/express` is the replacement. [VERIFIED: STATE.md + Clerk upgrade guide]
- **Accessing `req.auth.userId` directly without `getAuth()`:** The `@clerk/express` v2 docs recommend `getAuth(req)` as the official accessor, which is defensive against null `req.auth`.
- **Placing the webhook route after `app.use(express.json())`:** Body will be parsed as a JS object, not a raw Buffer — Svix signature check will fail.
- **Using `CLERK_WEBHOOK_SECRET` as the env var name:** The correct env var for `verifyWebhook()` is `CLERK_WEBHOOK_SIGNING_SECRET`. [VERIFIED: Clerk verifyWebhook() reference docs]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Webhook signature verification | Custom HMAC logic | `verifyWebhook()` from `@clerk/express/webhooks` | Timing-safe comparison, svix header parsing, replay attack prevention — all handled |
| Session token validation | JWT decode + JWKS fetch | `clerkMiddleware()` + `getAuth()` | Clerk handles JWKS rotation, clock skew, token type validation |
| User upsert on conflict | Application-level "check then insert" | Supabase `.upsert({ onConflict, ignoreDuplicates: true })` | Read-then-write is not atomic; DB-level ON CONFLICT is |
| Sign-in/sign-up UI | Custom HTML auth forms | Clerk hosted UI or Clerk JS components | Security (password hashing, MFA, OAuth) is not hand-rollable safely |
| Sign-out | Custom session clearing | Clerk JS `Clerk.signOut()` / UserButton component | Clerk manages cookie invalidation and session revocation |

---

## Common Pitfalls

### Pitfall 1: Webhook Body Parser Ordering

**What goes wrong:** `express.json()` is registered globally before the webhook route. The JSON parser consumes the raw Buffer and re-stringifies it (potentially reordering keys), breaking the Svix HMAC signature check. The verification throws an error or silently returns false.

**Why it happens:** `express.json()` is typically placed at the top of middleware setup. The webhook route needs the unparsed raw bytes.

**How to avoid:** Register the webhook route with an inline `express.raw({ type: 'application/json' })` before `app.use(express.json())` in server.js. Per-route body parsers take precedence over global ones.

**Warning signs:** `verifyWebhook()` throws "Webhook verification failed" even though the secret is correct.

### Pitfall 2: Using `requireAuth()` for API Routes

**What goes wrong:** `requireAuth()` on `/api/course-stream` sends an HTTP redirect (302 to sign-in URL) instead of a 401 JSON response. SSE clients (`EventSource`) and `fetch()` callers get an unexpected redirect.

**Why it happens:** `requireAuth()` is designed for full-page HTML routes where a redirect is appropriate UX.

**How to avoid:** Use `getAuth(req)` with manual `res.status(401).json(...)` in the `requireUser` middleware for API routes.

**Warning signs:** SSE stream never opens; browser console shows "Failed to open EventSource to /api/course-stream".

### Pitfall 3: Clerk Publishable Key in CDN Script Tag

**What goes wrong:** The CDN script tag `src` URL contains the Frontend API URL, which is derived from the publishable key. If you use a wrong URL format or wrong key, Clerk initializes silently but `Clerk.user` is always null.

**Why it happens:** The FAPI URL is not the same as the publishable key itself — it's encoded inside it. The correct script tag must be copied from the Clerk Dashboard.

**How to avoid:** Copy the script tag directly from Clerk Dashboard > API Keys > JavaScript Quick Copy. Do not construct the URL manually.

**Warning signs:** `Clerk.load()` resolves but `Clerk.user` is null even when logged in; no network requests to Clerk appear in browser DevTools.

### Pitfall 4: Supabase Service Role Client with Default Auth Options

**What goes wrong:** `createClient()` without the server-side auth options stores a session in memory. In Node.js, this session can persist across requests if the module is cached (which it is). Subsequent requests by different users may inherit the previous user's session, bypassing service-role-only queries.

**Why it happens:** `@supabase/supabase-js` was originally designed for browser use; defaults include session persistence.

**How to avoid:** Always pass `{ auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }` when creating a server-side Supabase client.

### Pitfall 5: Email Extraction from user.created Payload

**What goes wrong:** Accessing `evt.data.email_addresses.email_address` directly — this is `undefined` because `email_addresses` is an array.

**Why it happens:** The Clerk User object has `email_addresses: [{ id, email_address, verification }]`.

**How to avoid:** Use `evt.data.email_addresses[0]?.email_address`.

### Pitfall 6: clerkMiddleware Before Static Files — Performance Note

**What goes wrong:** Placing `clerkMiddleware()` before `express.static()` means every static asset request (JS, CSS, images) hits the Clerk middleware first. In production on Railway (same server), this is a network call to Clerk's API to validate the session.

**Why it happens:** Clerk docs say middleware must be first. But static file requests don't need auth.

**How to avoid:** `clerkMiddleware()` is actually lightweight — it reads cookies/headers locally and only makes a network request for token verification when needed. Per Clerk architecture, if no session token is present (e.g., unauthenticated static asset request), `clerkMiddleware` is a no-op. This pitfall is lower severity than it appears but worth knowing. The session cookie being present is what triggers verification.

---

## Code Examples

### auth.js — requireUser middleware

```javascript
// Source pattern from: https://clerk.com/docs/reference/express/get-auth [CITED]
'use strict';

const { getAuth } = require('@clerk/express');
const { getOrCreateUser } = require('./db');

/**
 * Express middleware that enforces authentication on API and HTML routes.
 * - API usage: returns 401 JSON when unauthenticated
 * - HTML route usage: caller uses requireAuth() instead (see server.js for /app)
 * Attaches req.userId for downstream handlers.
 * Also performs an optimistic upsert to handle the webhook race window (D-07).
 */
async function requireUser(req, res, next) {
  const { userId } = getAuth(req);
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  // Optimistic safety net — webhook is primary path; this handles the race window
  // Email not available from getAuth() — pass null; webhook will have the real email
  getOrCreateUser(userId, null).catch(err =>
    console.error('[auth] optimistic upsert failed:', err.message)
  );
  req.userId = userId;
  next();
}

function getUserId(req) {
  return getAuth(req).userId;
}

module.exports = { requireUser, getUserId };
```

**Note on email in optimistic upsert:** `getAuth(req)` returns the JWT claims — it does not include the user's email. Email is only available via `clerkClient.users.getUser(userId)` (a network call) or from the webhook payload. The upsert with `null` email is safe because `users.email` is nullable, and the webhook fires quickly after signup and patches the real email. Alternatively, `email` can be retrieved lazily from `clerkClient` if the product requires it at auth time — but per D-10, `requireUser` is a safety net, not the primary creation path.

### db.js

```javascript
// Source: https://supabase.com/docs/reference/javascript/initializing [CITED]
'use strict';

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }
);

async function getOrCreateUser(clerkId, email) {
  const row = { clerk_id: clerkId, plan: 'free' };
  if (email) row.email = email;
  const { error } = await supabase
    .from('users')
    .upsert(row, { onConflict: 'clerk_id', ignoreDuplicates: true });
  if (error) throw new Error(`[db] getOrCreateUser failed: ${error.message}`);
}

async function getUserPlan(clerkId) {
  const { data, error } = await supabase
    .from('users')
    .select('plan')
    .eq('clerk_id', clerkId)
    .single();
  if (error) throw new Error(`[db] getUserPlan failed: ${error.message}`);
  return data.plan;
}

module.exports = { supabase, getOrCreateUser, getUserPlan };
```

### webhooks.js

```javascript
// Source: https://clerk.com/docs/reference/backend/verify-webhook [CITED]
'use strict';

const { verifyWebhook } = require('@clerk/express/webhooks');
const { getOrCreateUser } = require('./db');

async function clerkWebhookHandler(req, res) {
  let evt;
  try {
    evt = await verifyWebhook(req);
  } catch (err) {
    console.error('[webhook] verification failed:', err.message);
    return res.status(400).send('Webhook verification failed');
  }

  if (evt.type === 'user.created') {
    const clerkId = evt.data.id;
    const email = evt.data.email_addresses[0]?.email_address ?? null;
    try {
      await getOrCreateUser(clerkId, email);
    } catch (err) {
      console.error('[webhook] user.created DB write failed:', err.message);
      // Return 500 so Clerk retries the webhook
      return res.status(500).send('DB write failed');
    }
  }

  return res.status(200).send('OK');
}

module.exports = { clerkWebhookHandler };
```

### server.js changes (key lines)

```javascript
// Source: synthesis from Clerk Express docs + project patterns [CITED/ASSUMED]
'use strict';

const { clerkMiddleware, requireAuth } = require('@clerk/express');
const { clerkWebhookHandler } = require('./webhooks');
const { requireUser } = require('./auth');
const path = require('path');

// STEP 1: Webhook route with raw body parser — BEFORE express.json()
app.post('/api/webhooks/clerk', express.raw({ type: 'application/json' }), clerkWebhookHandler);

// STEP 2: Clerk middleware — before static files and API routes
app.use(clerkMiddleware());

// STEP 3: Static routes
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'landing.html')));
app.get('/onboarding', (req, res) => res.sendFile(path.join(__dirname, 'onboarding.html')));

// STEP 4: Protected HTML route — redirect unauth to Clerk sign-in
app.get('/app', requireAuth({ signInUrl: process.env.CLERK_SIGN_IN_URL }), (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// STEP 5: Global JSON parser (AFTER webhook route)
app.use(express.json());

// STEP 6: Protected API routes — return 401 JSON for unauth
app.get('/api/course-stream', requireUser, async (req, res) => {
  // req.userId set by requireUser
  // ... existing courseStreamHandler delegation
});
```

### Supabase users table DDL

```sql
-- Phase 6 only — other tables deferred (D-09)
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id      TEXT UNIQUE NOT NULL,   -- D-12: TEXT not UUID
  email         TEXT,
  plan          TEXT NOT NULL DEFAULT 'free',
  tier_updated_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### index.html header bar (Clerk JS CDN pattern)

```html
<!-- Copy exact script tags from Clerk Dashboard > API Keys > JavaScript -->
<!-- Placeholder format shown — actual fapi_url derived from publishable key -->
<script
  defer
  crossorigin="anonymous"
  data-clerk-publishable-key="pk_test_..."
  src="https://clerk.your-app.accounts.dev/npm/@clerk/clerk-js@6/dist/clerk.browser.js"
  type="text/javascript"
></script>

<header id="app-header">
  <span id="clerk-user-button"></span>
</header>

<script>
  window.addEventListener('load', async function () {
    await Clerk.load();
    if (Clerk.user) {
      Clerk.mountUserButton(document.getElementById('clerk-user-button'));
    }
  });
</script>
```

---

## Environment Variables

| Variable | Required By | Source |
|----------|-------------|--------|
| `CLERK_PUBLISHABLE_KEY` | `clerkMiddleware()` auto-reads; also needed in HTML script tag | Clerk Dashboard > API Keys |
| `CLERK_SECRET_KEY` | `clerkMiddleware()` backend verification | Clerk Dashboard > API Keys |
| `CLERK_WEBHOOK_SIGNING_SECRET` | `verifyWebhook()` | Clerk Dashboard > Webhooks > endpoint |
| `CLERK_SIGN_IN_URL` | `requireAuth({ signInUrl })` | Clerk Dashboard (hosted sign-in URL, e.g. `https://accounts.your-app.com/sign-in`) |
| `SUPABASE_URL` | `createClient()` | Supabase Dashboard > Settings > API |
| `SUPABASE_SERVICE_ROLE_KEY` | `createClient()` (server-side only, never expose to browser) | Supabase Dashboard > Settings > API |

**Critical:** `CLERK_WEBHOOK_SIGNING_SECRET` is NOT `CLERK_WEBHOOK_SECRET`. The `verifyWebhook()` function from `@clerk/express/webhooks` reads `CLERK_WEBHOOK_SIGNING_SECRET`. [VERIFIED: Clerk verifyWebhook reference docs]

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@clerk/clerk-sdk-node` (`ClerkExpressRequireAuth`) | `@clerk/express` v2 (`clerkMiddleware` + `getAuth`) | 2024 | Old package is EOL; new package is the standard |
| `new Webhook(secret).verify()` from `svix` directly | `verifyWebhook()` from `@clerk/express/webhooks` | 2024-2025 | First-party wrapper, cleaner API, reads env var automatically |
| Clerk JWT template for Supabase | No JWT template — service role key server-side | April 2025 (deprecated) | Simpler architecture; no Supabase JWT configuration needed |
| `afterSignInUrl` / `afterSignUpUrl` in `Clerk.load()` | `forceRedirectUrl` / `fallbackRedirectUrl` in component props | Clerk Core 2 (2024) | Old props deprecated; new props are explicit per-component |

**Deprecated/outdated:**
- `@clerk/clerk-sdk-node`: EOL — do not use. [VERIFIED: STATE.md + Clerk docs]
- Clerk JWT template for Supabase: deprecated April 2025. [VERIFIED: REQUIREMENTS.md out-of-scope section]
- `afterSignUpUrl` prop on `Clerk.load()`: deprecated in Core 2. Use `forceRedirectUrl` or `signUpForceRedirectUrl` on component mount options. [CITED: Clerk Core 2 upgrade guide]

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | CDN script tag `src` URL pattern uses `https://{fapi_url}/npm/@clerk/clerk-js@6/dist/clerk.browser.js` | Code Examples — index.html | If URL format changes, Clerk JS won't load; fix: copy from Dashboard |
| A2 | `getOrCreateUser` with `null` email in `requireUser` doesn't cause a DB NOT NULL constraint error | Code Examples — auth.js | If `email` column has NOT NULL, upsert fails; fix: make email nullable in DDL |
| A3 | `requireAuth({ signInUrl })` redirects to Clerk's hosted sign-in at the given URL (not the in-app mountSignIn) | Architecture Patterns | If it redirects incorrectly, /app users get a bad redirect loop; verify in smoke test |
| A4 | `@clerk/express/webhooks` exports `verifyWebhook` as a CommonJS-compatible require | Code Examples | If the package only has ESM exports, `require('@clerk/express/webhooks')` fails; fix: check package.json exports field |

---

## Open Questions (RESOLVED)

1. **Email nullable in users table?** (RESOLVED)
   - Decision: Keep `email TEXT` nullable — the `requireUser` optimistic upsert may not have the email; the webhook fills it in within seconds of signup.

2. **CLERK_SIGN_IN_URL value for `requireAuth()`** (RESOLVED)
   - Decision: Use Clerk's hosted sign-in URL from the Dashboard — no custom `/sign-in` page needed given the project architecture.

3. **`@clerk/express/webhooks` CommonJS compatibility** (RESOLVED)
   - Decision: Fall back to raw svix `new Webhook(secret).verify()` for webhook signature verification (used in plans). Avoids any ESM subpath compatibility risk. Both approaches are equivalent.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime | ✓ | v22.22.0 | — |
| npm | Package install | ✓ | (system) | — |
| `@clerk/express` | Auth middleware | ✗ (not installed yet) | — | Install: `npm install @clerk/express` |
| `@supabase/supabase-js` | DB client | ✗ (not installed yet) | — | Install: `npm install @supabase/supabase-js` |
| `svix` | Webhook peer dep | ✗ (not installed yet) | — | Install: `npm install svix` |
| Clerk account + app | Auth provider | [ASSUMED] created | — | Create at clerk.com |
| Supabase project | DB | [ASSUMED] created | — | Create at supabase.com |

**Missing dependencies with no fallback:**
- Clerk account and app must be created before env vars can be populated (CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY, CLERK_WEBHOOK_SIGNING_SECRET).
- Supabase project must be created before env vars can be populated (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).

**Missing dependencies with fallback:**
- npm packages: all three have no fallbacks, but are a single `npm install` command away.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in test runner (`node:test`) |
| Config file | `package.json` scripts.test |
| Quick run command | `node --test --test-concurrency=1 tests/unit/auth.test.js tests/unit/webhooks.test.js tests/unit/db.test.js` |
| Full suite command | `node --test --test-concurrency=1 tests/unit/*.test.js` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | Clerk sign-up UI loads on landing page | manual | — (CDN component, requires browser) | N/A |
| AUTH-02 | Sign-in/sign-out header appears for authed users | manual | — (requires Clerk session) | N/A |
| AUTH-03 | Unauthenticated POST /api/course-stream returns 401 | unit | `node --test --test-concurrency=1 tests/unit/server.test.js` | ❌ Wave 0 — add test case |
| AUTH-04 | user.created webhook creates Supabase row | unit | `node --test --test-concurrency=1 tests/unit/webhooks.test.js` | ❌ Wave 0 |
| AUTH-04 | Webhook with invalid signature returns 400 | unit | same | ❌ Wave 0 |
| AUTH-05 | POST /api/webhooks/clerk registers correctly; /onboarding serves HTML | smoke | `node --test --test-concurrency=1 tests/unit/server.test.js` | ❌ Wave 0 — add test case |

### Sampling Rate

- **Per task commit:** `node --test --test-concurrency=1 tests/unit/auth.test.js tests/unit/webhooks.test.js tests/unit/db.test.js`
- **Per wave merge:** `node --test --test-concurrency=1 tests/unit/*.test.js`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/unit/auth.test.js` — tests for `requireUser` middleware: unauthenticated returns 401, authenticated calls next, sets `req.userId`
- [ ] `tests/unit/webhooks.test.js` — tests for `clerkWebhookHandler`: invalid sig returns 400, `user.created` calls `getOrCreateUser`, non-`user.created` events return 200 and do nothing
- [ ] `tests/unit/db.test.js` — tests for `getOrCreateUser` and `getUserPlan` (mocked Supabase client)
- [ ] `tests/unit/server.test.js` — add: unauthenticated GET /api/course-stream returns 401; /onboarding serves HTML

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Clerk hosted UI — password hashing, MFA, OAuth all handled by Clerk |
| V3 Session Management | yes | Clerk session cookies (`__session`) — managed by Clerk, httpOnly, secure in production |
| V4 Access Control | yes | `requireUser` middleware on `/api/course-stream`; `requireAuth()` on `/app` |
| V5 Input Validation | yes | Webhook payload validated by `verifyWebhook()` signature check before any data is consumed |
| V6 Cryptography | yes (webhook) | Svix HMAC-SHA256 via `verifyWebhook()` — never hand-rolled |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unauthenticated course generation | Elevation of privilege | `requireUser` middleware → 401 on missing `userId` |
| Fake webhook events (spoofed user.created) | Spoofing | `verifyWebhook()` HMAC-SHA256 signature check |
| Webhook replay attack | Repudiation | Svix includes timestamp in signature; `verifyWebhook()` rejects stale webhooks |
| Service role key exposure in client code | Information disclosure | `SUPABASE_SERVICE_ROLE_KEY` server-side only, never in HTML/JS served to browser |
| CLERK_PUBLISHABLE_KEY in HTML | Information disclosure | Publishable key is intentionally public; no risk |
| Concurrent user creation race (webhook + optimistic upsert) | Denial of service | `ON CONFLICT (clerk_id) DO NOTHING` prevents duplicate rows |

---

## Sources

### Primary (HIGH confidence)
- [Clerk Express Quickstart](https://clerk.com/docs/expressjs/getting-started/quickstart) — middleware setup, env vars, route protection patterns
- [Clerk `requireAuth()` reference](https://clerk.com/docs/reference/express/require-auth) — redirect vs 401 behavior
- [Clerk `clerkMiddleware()` reference](https://clerk.com/docs/reference/express/clerk-middleware) — options, auth attachment
- [Clerk `getAuth()` reference](https://clerk.com/docs/reference/express/get-auth) — return type, userId/isAuthenticated
- [Clerk `verifyWebhook()` reference](https://clerk.com/docs/reference/backend/verify-webhook) — signature, env var name `CLERK_WEBHOOK_SIGNING_SECRET`
- [Svix webhook verification docs](https://docs.svix.com/receiving/verifying-payloads/how) — raw body requirement, Webhook class
- [Supabase JS reference — upsert](https://supabase.com/docs/reference/javascript/upsert) — `onConflict`, `ignoreDuplicates`
- [Clerk JS frontend — SignUp component](https://clerk.com/docs/js-frontend/reference/components/authentication/sign-up) — `forceRedirectUrl`, `fallbackRedirectUrl`, `mountSignUp()`
- npm registry — version verification for `@clerk/express` (2.1.0), `@supabase/supabase-js` (2.103.0), `svix` (1.90.0) — confirmed 2026-04-12

### Secondary (MEDIUM confidence)
- [Clerk blog: How to Authenticate API Requests with Clerk & Express](https://clerk.com/blog/how-to-authenticate-api-requests-with-clerk-express) — getAuth pattern for API routes
- [Clerk webhooks overview](https://clerk.com/docs/guides/development/webhooks/overview) — `user.created` event, payload structure, `CLERK_WEBHOOK_SECRET` env var
- [DEV.to: Sync Clerk users to your database using Webhooks](https://dev.to/devlawrence/sync-clerk-users-to-your-database-using-webhooks-a-step-by-step-guide-263i) — Express webhook handler pattern
- [Supabase troubleshooting: service role key](https://supabase.com/docs/guides/troubleshooting/performing-administration-tasks-on-the-server-side-with-the-servicerole-secret-BYM4Fa) — `persistSession: false` server pattern
- [Clerk backend requests — same-origin](https://clerk.com/docs/backend-requests/making/same-origin) — `__session` cookie sent automatically

### Tertiary (LOW confidence)
- WebSearch results on middleware ordering: "clerkMiddleware must be set before any other middleware" — flagged A3 as assumed
- WebSearch on CDN script tag URL format — flagged A1 as assumed; use Dashboard copy

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — npm registry version confirmation + Clerk official docs
- Architecture patterns: HIGH — direct from Clerk Express reference docs
- Webhook handler: HIGH — verified `verifyWebhook` from `@clerk/express/webhooks` is the canonical pattern; env var name confirmed
- CDN/client-side: MEDIUM — Clerk JS CDN pattern documented but exact script URL format should be copied from Dashboard
- Pitfalls: HIGH — body parser ordering confirmed by multiple independent sources (Svix docs, Express issue tracker, community reports)

**Research date:** 2026-04-12
**Valid until:** 2026-05-12 (30 days — Clerk API is relatively stable; check for @clerk/express minor version bumps before implementing)
