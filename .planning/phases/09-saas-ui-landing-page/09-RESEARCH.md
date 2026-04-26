# Phase 9: SaaS UI / Landing Page - Research

**Researched:** 2026-04-26
**Domain:** Vanilla HTML/CSS/JS marketing pages + Express routing + Clerk client-side auth detection
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Four HTML files, each on its own Express route: `GET /` → `landing.html`, `GET /app` → `index.html` (auth-gated), `GET /pricing` → `pricing.html` (public), `GET /onboarding` → `onboarding.html` (auth-gated)
- **D-02:** `/app` without a Clerk session → 302 redirect to Clerk sign-in (`https://accounts.comoedu.com/sign-in`)
- **D-03:** `/onboarding` without a Clerk session → 302 redirect to `/` (landing page)
- **D-04:** `index.html` is NOT restructured — only its Express route changes (from `/` to `/app`)
- **D-05:** Landing page three sections: Hero + CTA, How it works (3-step), Sample course preview
- **D-06:** Dark color scheme and CSS variables shared across all pages from `index.html`
- **D-07:** Minimal nav header on landing, pricing, onboarding: site name left, links right
- **D-08:** Onboarding: welcome message, 2–3 bullets, "Start learning" CTA → `/app`
- **D-09:** Onboarding mentions free tier limit: "Your free plan includes 1 course per month..."
- **D-10:** Onboarding auth-gated server-side — no client-side-only check
- **D-11:** Pricing: two-column card layout — Free ($0, 1/month) and Early Access ($10, 20/month)
- **D-12:** Pricing page is public — no auth gate
- **D-13:** Shared minimal nav header on pricing (same as landing/onboarding)

### Claude's Discretion

- Hero headline and sub-headline copy on landing page
- Exact wording for the "How it works" 3-step section
- Sample course preview content
- Exact onboarding bullet point copy
- Which features (beyond course count) to list on pricing cards
- Whether to detect auth state client-side on pricing page to swap "Get started" CTA to "Go to app" for signed-in users

### Deferred Ideas (OUT OF SCOPE)

- Inline pricing section on landing page
- A/B testing landing page variants
- Social proof / testimonials section
- Email capture before sign-up (waitlist flow)

</user_constraints>

---

## Summary

Phase 9 is a pure HTML/CSS/routing phase — no new backend logic, no new npm packages, no framework changes. The work divides into three categories: (1) updating two existing partial HTML files (landing.html and onboarding.html), (2) creating one new HTML file (pricing.html) from scratch, and (3) adding one new Express route (GET /pricing) and adding a server-side auth gate to the existing /onboarding route.

The current codebase is in a good state: `server.js` already has `GET /` → `landing.html` and `GET /app` → `index.html` (with Clerk session check) wired correctly from Phase 6. The `GET /onboarding` route exists but lacks the D-03 redirect-to-`/` behavior for unauthenticated users. The biggest HTML work is landing.html, which must replace its features-list pattern with a 3-step how-it-works section plus a sample course preview, and update nav and CTA links.

The single meaningful JavaScript requirement is the pricing page's client-side auth detection for the "Upgrade now" CTA swap. This uses the same `Clerk.load()` + `Clerk.user` pattern already established in `index.html` — no new Clerk concepts required.

**Primary recommendation:** Four discrete file-scope plans — one per HTML file plus one routing plan for server.js — with no cross-plan dependencies except that server.js changes are safe to execute first (routes simply 404 until the HTML files exist, which matches existing test expectations).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Landing page content + conversion | Browser / Static HTML | — | Pure marketing page, no server state needed |
| Pricing page content | Browser / Static HTML | — | Public static page; CTA swap is client-side only |
| Pricing CTA auth swap | Browser / Client JS | — | Clerk.user check after Clerk.load(); no server round-trip needed |
| Upgrade URL injection | Frontend Server (Express) | — | CLERK_ACCOUNT_PORTAL_URL is a server env var; injected as inline `<script>window.__upgradeUrl</script>` rendered by Express before sending pricing.html, OR hardcoded at deploy time (see Pitfall 2) |
| Onboarding auth gate | API / Backend (Express middleware) | — | D-10 requires server-side gate; client-side alone is insufficient |
| /app auth gate | API / Backend (Express) | — | Already implemented in server.js via getAuth() + redirect |
| Static asset serving | CDN / Static (express.static) | — | Already in place — no change needed |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Express | 4.18 (already installed) | Route registration, `res.sendFile()` | Existing project framework |
| @clerk/express | 2.1.0 (already installed) | `getAuth()` for server-side session check on `/onboarding` | Already used for `/app` gate |
| Clerk JS (browser CDN) | 6.x (already loaded in index.html) | Client-side `Clerk.user` detection for pricing CTA swap | Same CDN script already in index.html |

[VERIFIED: server.js lines 7–8, package.json] All dependencies are already installed. No new npm packages required for this phase.

### Supporting

None. No new packages.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Clerk.user (client-side) on pricing page | Server-side auth check on /pricing | Would require making pricing auth-gated (contradicts D-12); client-side is correct here |
| window.__upgradeUrl injected by server | Hard-coded value in HTML | Hard-coding works only if URL never changes; env var injection is safer but requires Express to template the HTML |

**Installation:** None required.

---

## Architecture Patterns

### System Architecture Diagram

```
Browser
  |
  |-- GET /          --> server.js route --> res.sendFile(landing.html)    [public]
  |-- GET /pricing   --> server.js route --> res.sendFile(pricing.html)    [public]
  |                                          + inline <script>window.__upgradeUrl</script>
  |-- GET /onboarding --> server.js route --> getAuth() check
  |                       |-- no userId --> 302 redirect to /
  |                       |-- userId    --> res.sendFile(onboarding.html)
  |-- GET /app        --> server.js route --> getAuth() check (already implemented)
                          |-- no userId --> 302 redirect to Clerk sign-in
                          |-- userId    --> res.sendFile(index.html)
```

Pricing page client-side CTA swap:
```
pricing.html loads in browser
  |-- Clerk JS CDN script loads
  |-- Clerk.load() resolves
  |-- if Clerk.user: swap "Upgrade now" href from sign-up URL to window.__upgradeUrl
  |-- else: leave href as sign-up URL (graceful default)
```

### Recommended Project Structure

All files at root (per CLAUDE.md flat structure constraint):

```
/ (project root)
├── landing.html       # GET / — updated (features-list → how-it-works + sample preview)
├── pricing.html       # GET /pricing — new file
├── onboarding.html    # GET /onboarding — rebuilt body content
├── index.html         # GET /app — no changes (D-04)
└── server.js          # add GET /pricing route + /onboarding auth gate
```

### Pattern 1: Express Static Route Pattern (existing)

**What:** `res.sendFile(path.join(__dirname, 'filename.html'))` — the established pattern for all HTML routes in this project.

**When to use:** All four page routes.

```javascript
// Source: server.js lines 30–33 (verified in codebase)
// Public route — no middleware
app.get('/pricing', (req, res) => res.sendFile(path.join(__dirname, 'pricing.html')));

// Auth-gated with redirect-to-landing (D-03)
app.get('/onboarding', (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'onboarding.html'));
});
```

[VERIFIED: server.js — existing /app route uses identical getAuth(req) + redirect pattern, lines 42–51]

### Pattern 2: Clerk Client-Side User Detection (vanilla JS)

**What:** After `await Clerk.load()`, check `Clerk.user` to detect signed-in state. `Clerk.user` is `null` when not signed in, an object with `.id` when signed in.

**When to use:** Pricing page "Upgrade now" CTA swap. Same pattern already used in index.html for mounting UserButton.

```javascript
// Source: Clerk JS vanilla playground — verified via Context7 /clerk/javascript
// Also: index.html lines 1652–1663 (same project, same CDN version)
window.addEventListener('load', async function () {
  await Clerk.load({
    signInUrl: 'https://accounts.comoedu.com/sign-in',
    signUpUrl: 'https://accounts.comoedu.com/sign-up',
  });
  if (Clerk.user) {
    const upgradeBtn = document.getElementById('upgrade-cta');
    if (upgradeBtn && window.__upgradeUrl) {
      upgradeBtn.href = window.__upgradeUrl;
    }
  }
});
```

### Pattern 3: window.__upgradeUrl Server Injection

**What:** Express injects `CLERK_ACCOUNT_PORTAL_URL` as an inline script before sending pricing.html, so the client-side swap can use it without exposing a server endpoint.

**Two implementation options** (see Pitfall 2 for tradeoffs):

**Option A — Express reads file + patches response:**
```javascript
// server.js
app.get('/pricing', (req, res) => {
  const upgradeUrl = process.env.CLERK_ACCOUNT_PORTAL_URL || '';
  const html = require('fs').readFileSync(path.join(__dirname, 'pricing.html'), 'utf8');
  const patched = html.replace('</head>', `<script>window.__upgradeUrl=${JSON.stringify(upgradeUrl)};</script></head>`);
  res.setHeader('Content-Type', 'text/html');
  res.send(patched);
});
```

**Option B — Bake into HTML at deploy time (simpler):**
Place `<script>window.__upgradeUrl = '';</script>` in pricing.html at the hardcoded position, and accept that the value is empty for local dev (users fall back to sign-up URL). The URL is a public Clerk Account Portal URL — not a secret.

[ASSUMED] Option B is simpler and consistent with the project's "no abstraction layers" philosophy. The URL is not a secret. The planner should choose between A and B and document the decision.

### Pattern 4: CSS Variable Reuse Across Pages

**What:** Copy the full `:root` block from index.html / landing.html verbatim into each new HTML file's `<style>` block. No shared CSS file (per CLAUDE.md flat-structure constraint).

[VERIFIED: landing.html lines 10–38 and onboarding.html lines 10–38 — both already have identical `:root` blocks. UI-SPEC Section "Spacing Scale" and "Color" confirm all values.]

### Anti-Patterns to Avoid

- **Shared CSS file:** Project constraint (CLAUDE.md) requires inline `<style>` per file. Do not create `styles.css`.
- **ESM or import statements:** Any `<script type="module">` or ES `import` breaks the project's CommonJS-only, no-build-step constraint.
- **Template engine (EJS, Handlebars):** Not in the stack. If pricing.html needs `window.__upgradeUrl`, use Option A (string replace) or Option B (hardcode empty).
- **requireUser middleware on /onboarding:** `requireUser` (in auth.js) returns `401 JSON` — it is designed for API routes, not HTML routes. The `/onboarding` gate must be a custom inline handler that calls `getAuth()` and does `res.redirect('/')` (same pattern as the `/app` gate in server.js lines 42–51).
- **Calling requireUser on /pricing:** D-12 locks pricing as public. No auth gate.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Server-side session check | Custom session parsing | `getAuth(req)` from @clerk/express | Already installed, battle-tested, returns userId or null |
| Client-side auth detection | Fetch /api/me | `Clerk.user` after `Clerk.load()` | Synchronous after load, no network round-trip, already used in index.html |
| CSS reset | Custom normalize | `*, *::before, *::after { box-sizing: border-box; }` + body reset | Already established pattern across landing.html and onboarding.html |

**Key insight:** Everything this phase needs is already in the codebase. The only "new" capability is the /pricing route and the /onboarding redirect — both are two-line additions to server.js using existing patterns.

---

## Existing File Delta Analysis

This is the most critical section for the planner. Each file's exact current state and required changes are documented here.

### landing.html — Current State vs. Required

**Currently exists at project root. File is 271 lines.**

| Element | Current State | Required State | Change Type |
|---------|--------------|----------------|-------------|
| `<title>` | `YouTube Learning Curator — Learn anything...` (order reversed) | `Learn anything with the best YouTube has to offer — YouTube Learning Curator` | Update |
| Nav | Brand only (`<span class="nav-brand">`) — no links | Brand + "Pricing" link + "Sign up free" link | Add nav-links |
| Nav container | No flex layout on header | `display: flex; justify-content: space-between; align-items: center` | Add CSS + HTML structure |
| Hero primary CTA | `href="/app"` | `href="https://accounts.comoedu.com/sign-up"` | Update href |
| Hero secondary link | `Go to app` → `/app` | `Sign in` → `https://accounts.comoedu.com/sign-in` | Update text + href |
| Features section | `.features` with `.features-list` (3 bullet items) | Replace with `.how-it-works` (3 numbered steps with heading + description) | Replace section |
| Sample preview | Absent | Add `.sample-preview` section with static ML course mockup | Add section |
| Bottom CTA | `Sign up free` → `/app` | `Sign up free` → `https://accounts.comoedu.com/sign-up` | Update href |
| CSS for features | `.features`, `.features-list`, `.feature-item`, `.feature-heading`, `.feature-description` | Replace with `.how-it-works`, `.steps-list`, `.step-item`, `.step-number`, `.step-heading`, `.step-description` | Replace CSS |
| CSS for sample preview | Absent | Add `.sample-preview`, `.preview-card`, `.module-heading`, `.video-list`, `.video-item`, `.video-info`, `.video-title`, `.video-channel`, `.score-badge` | Add CSS |
| `aria-label` on hero | Absent | Each `<section>` needs `aria-label` | Add |

[VERIFIED: landing.html — read in full, 271 lines. All changes confirmed by diff against UI-SPEC.]

**CSS classes to keep unchanged:** `.page-wrapper`, `.hero`, `.hero-headline`, `.hero-subheading`, `.hero-actions`, `.btn-primary`, `.link-secondary`, `.cta-section`, `.cta-heading`, `.cta-actions`, `.footer-text`, all `:root` variables, `@media (max-width: 480px)` rule.

**Note:** The existing `.example-card`, `.video-list`, `.video-item`, `.video-info`, `.video-title`, `.video-channel`, `.score-badge` CSS classes in onboarding.html are a perfect reference for the sample preview card in landing.html.

---

### onboarding.html — Current State vs. Required

**Currently exists at project root. File is 304 lines. Title: "How it works".**

The current file is an app documentation page (how course generation works, skill level options, example course card, CTA to /app). The entire `<body>` content must be replaced with the welcome/onboarding structure.

| Element | Current State | Required State | Change Type |
|---------|--------------|----------------|-------------|
| `<title>` | `How it works — YouTube Learning Curator` | `Welcome — YouTube Learning Curator` | Update |
| `<meta description>` | How it works description | `You're all set. Here's how to get the most out of YouTube Learning Curator.` | Update |
| Nav | `<header class="page-header">` with h1 only — no brand, no links | Nav with brand left + "Go to app" → `/app` right | Rebuild |
| Welcome heading | None (current h1 is "How it works" in header) | `<h1>Welcome to YouTube Learning Curator</h1>` (display size) | Replace |
| Content | "How course generation works" + skill levels + example card | 3 bullet items + tier notice + "Start learning" CTA | Replace body |
| CTA | `href="/app"` (correct) | `href="/app"` (same) | No change |
| `.page-header` / `.page-title` CSS | Present | Remove (replaced by nav pattern) | Remove |
| `.content-section`, `.section-heading`, `.section-body` CSS | Present | Remove (not used in new structure) | Remove |
| `.skill-list`, `.skill-item`, `.skill-label`, `.skill-description` CSS | Present | Remove | Remove |
| `.example-card`, `.video-list` etc. CSS | Present (can be kept as reference for landing.html) | Remove from onboarding (not in spec) | Remove |
| `@media` rule | `font-size: 22px` on `.page-title` | `font-size: 22px` on `.hero-headline` (or equivalent h1 class) | Update selector |

CSS classes to add: `.nav` (flex, space-between), `.nav-brand`, `.nav-links`, `.nav-link`, `.welcome-section`, `.onboarding-steps`, `.step-item`, `.step-heading`, `.step-body`, `.tier-notice`, `.cta-section`.

[VERIFIED: onboarding.html — read in full, 304 lines]

---

### pricing.html — Does Not Exist

**Must be created from scratch.** No file exists. [VERIFIED: `ls *.html` shows only index.html, landing.html, onboarding.html]

Required structure (from UI-SPEC):
1. `:root` CSS variables block (copy from landing.html)
2. Nav header (same pattern as landing.html with nav-links updated: "Sign in" link right)
3. `<h1>Pricing</h1>` (display size)
4. Two-column pricing grid: Free card (left), Early Access card (right)
5. Client-side Clerk.load() script for CTA swap
6. `window.__upgradeUrl` injection (see Pattern 3 / Pitfall 2)
7. Footer

**Max-width exception:** `max-width: 800px` for pricing page (vs. 640px standard) to accommodate two-column grid.

**CSS grid:** `grid-template-columns: 1fr 1fr; gap: var(--space-xl)`. At `@media (max-width: 480px)`: `grid-template-columns: 1fr`.

---

### server.js — Current State vs. Required

[VERIFIED: server.js read in full, 235 lines]

| Route | Current State | Required State | Change |
|-------|--------------|----------------|--------|
| `GET /` | `res.sendFile(landing.html)` ✓ (line 30) | Same | No change |
| `GET /app` | `getAuth()` check → redirect or `res.sendFile(index.html)` ✓ (lines 42–51) | Same | No change |
| `GET /onboarding` | `res.sendFile(onboarding.html)` — no auth check (line 33) | Add `getAuth()` check → `res.redirect('/')` if no userId | Add auth gate |
| `GET /pricing` | Absent | Add: `res.sendFile(pricing.html)` + optional `window.__upgradeUrl` injection | Add route |

**Critical ordering note:** The new `GET /pricing` and updated `GET /onboarding` must be registered BEFORE `app.use(express.static(__dirname))` (line 35). Currently `GET /onboarding` is at line 33 (before static), which is correct. The new `/pricing` route must also go before static middleware, otherwise `pricing.html` would be served directly as a static file without the `window.__upgradeUrl` injection.

**However**, if Option B (hardcode empty string in HTML) is chosen for `window.__upgradeUrl`, then placement relative to static middleware does not matter — but explicit routes registered before static is still cleaner and consistent with the existing pattern.

---

## Common Pitfalls

### Pitfall 1: requireUser on HTML Routes Returns 401 JSON Instead of Redirect

**What goes wrong:** A developer reuses `requireUser` from auth.js for the `/onboarding` gate. The middleware returns `res.status(401).json(...)` — a JSON response — which browsers display as raw JSON, not a redirect.

**Why it happens:** `requireUser` is designed for API routes (see auth.js lines 6–18). It has no redirect logic.

**How to avoid:** The `/onboarding` route must use an inline handler calling `getAuth(req)` directly and `res.redirect('/')` — the same pattern as the `/app` route in server.js lines 42–51. Do NOT use `requireUser` on HTML page routes.

**Warning signs:** Visiting `/onboarding` unauthenticated shows `{"error":"Authentication required"}` in the browser instead of redirecting.

[VERIFIED: auth.js lines 6–18 — requireUser returns 401 JSON]

---

### Pitfall 2: window.__upgradeUrl Injection Approach

**What goes wrong:** If pricing.html is served with `res.sendFile()` as-is, and the pricing page JS tries to read `window.__upgradeUrl`, it will be `undefined`. The CTA swap silently fails — "Upgrade now" keeps pointing to sign-up URL even for signed-in users.

**Why it happens:** `CLERK_ACCOUNT_PORTAL_URL` is a server-side env var, not visible to the browser unless explicitly injected.

**Two valid approaches:**

**Option A (Server patches HTML string):** Express reads pricing.html, injects `<script>window.__upgradeUrl = "...";</script>` before `</head>`, sends the patched string. Works, but adds `fs.readFileSync` to the route and introduces a file read on every request.

**Option B (Hardcode placeholder in HTML):** pricing.html contains `<script>window.__upgradeUrl = '';</script>` as a hardcoded empty string. The client-side code falls back to the sign-up URL when `window.__upgradeUrl` is falsy. CLERK_ACCOUNT_PORTAL_URL is a non-secret URL, so it can optionally be substituted at deploy time via `sed` or ENV replacement in the Railway build step. For local dev, the fallback to sign-up URL is acceptable.

**Recommendation:** [ASSUMED] Option B is simpler and consistent with the flat-file, no-template-engine constraint. The upgrade URL is not sensitive. Planner should confirm with user if Option A is required.

**How to detect Option B failure:** Test: sign in to the app, visit /pricing, inspect "Upgrade now" href — if it still points to sign-up URL when logged in, the Clerk.load() script is not running or `window.__upgradeUrl` is empty.

---

### Pitfall 3: express.static Serving pricing.html Before Route Handler

**What goes wrong:** If `GET /pricing` route is added AFTER `app.use(express.static(__dirname))` in server.js, the static middleware will serve `pricing.html` directly (bypassing the Express route handler). This means `window.__upgradeUrl` injection (Option A) never fires.

**Why it happens:** `express.static` intercepts requests for files it can find before route handlers registered after it.

**How to avoid:** Register all page routes (including GET /pricing) BEFORE line 35 (`app.use(express.static(__dirname))`). The existing routes follow this pattern correctly.

**Warning signs:** Only matters if Option A is chosen. With Option B, static serving of pricing.html is fine.

[VERIFIED: server.js line 35 — express.static position confirmed]

---

### Pitfall 4: Clerk.load() on Pricing Page Without signInUrl/signUpUrl Config

**What goes wrong:** If Clerk.load() is called without config options on pricing.html, Clerk uses its defaults for sign-in/sign-up redirects. These may not match the project's custom domain (`accounts.comoedu.com`).

**How to avoid:** Include the same config block as index.html:
```javascript
await Clerk.load({
  signInUrl: 'https://accounts.comoedu.com/sign-in',
  signUpUrl: 'https://accounts.comoedu.com/sign-up',
});
```

[VERIFIED: index.html lines 1654–1659 — Clerk.load config]

---

### Pitfall 5: Server.test.js Tests for GET / and GET /onboarding

**What goes wrong:** The existing `server.test.js` has two tests that accept 200 OR 404 for `GET /` and `GET /onboarding` (lines 104–134), with comments saying "file does not exist yet." After Phase 9 creates these files, both routes will return 200. The tests will still pass (200 is in the accepted set), so no test update is required.

**However**, if new tests are written for the `/pricing` route, they should assert 200 (file exists from the start of the plan, not deferred).

[VERIFIED: tests/unit/server.test.js lines 104–134]

---

### Pitfall 6: Nav header on Pricing Page Differs from Landing/Onboarding

**What goes wrong:** The UI-SPEC specifies that pricing.html nav shows "Sign in" link on the right (not "Sign up free"). Landing shows "Sign up free". The wrong link is copied between pages.

**Nav right links by page (from UI-SPEC):**
- landing.html: "Pricing" link + "Sign up free" link
- pricing.html: "Sign in" link (only one right link per UI-SPEC table, line 348–349)
- onboarding.html: "Go to app" link

[VERIFIED: UI-SPEC Copywriting Contract sections for each page]

---

## Code Examples

Verified patterns from existing codebase and official sources:

### /onboarding Auth Gate (inline handler, DO NOT use requireUser)

```javascript
// Source: server.js lines 42–51 — /app route is the canonical model
// Pattern: same, adapted for /onboarding
app.get('/onboarding', (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'onboarding.html'));
});
```

### /pricing Route (public, Option B)

```javascript
// Source: server.js lines 30–31 — landing route is the canonical model
app.get('/pricing', (req, res) => res.sendFile(path.join(__dirname, 'pricing.html')));
```

### Clerk Client-Side Auth Detection (pricing.html script block)

```javascript
// Source: index.html lines 1652–1663 (verified) + Context7 /clerk/javascript vanilla example
<script
  defer
  crossorigin="anonymous"
  data-clerk-publishable-key="pk_live_Y2xlcmsuY29tb2VkdS5jb20k"
  src="https://clerk.comoedu.com/npm/@clerk/clerk-js@6/dist/clerk.browser.js"
  type="text/javascript"
></script>
<script>
  window.addEventListener('load', async function () {
    await Clerk.load({
      signInUrl: 'https://accounts.comoedu.com/sign-in',
      signUpUrl: 'https://accounts.comoedu.com/sign-up',
    });
    if (Clerk.user && window.__upgradeUrl) {
      var upgradeBtn = document.getElementById('upgrade-cta');
      if (upgradeBtn) upgradeBtn.href = window.__upgradeUrl;
    }
  });
</script>
```

### Nav Header HTML (reused across landing, pricing, onboarding)

```html
<!-- Source: UI-SPEC Component Patterns — Nav Header -->
<header>
  <nav class="nav">
    <span class="nav-brand">YouTube Learning Curator</span>
    <div class="nav-links">
      <!-- links vary by page — see UI-SPEC Copywriting Contract -->
      <a href="/pricing" class="nav-link">Pricing</a>
      <a href="https://accounts.comoedu.com/sign-up" class="nav-link-cta btn-primary">Sign up free</a>
    </div>
  </nav>
</header>
```

### Pricing Card HTML Structure

```html
<!-- Source: UI-SPEC Component Patterns — Pricing Card -->
<div class="pricing-grid">
  <div class="pricing-card">
    <p class="pricing-card-name">Free</p>
    <p class="pricing-card-price">$0 <span class="pricing-card-period">per month</span></p>
    <p class="pricing-card-limit">1 course per month</p>
    <ul class="pricing-feature-list">
      <li class="pricing-feature-item"><span class="pricing-feature-check">&#10003;</span> AI-curated YouTube courses</li>
    </ul>
    <a href="https://accounts.comoedu.com/sign-up" class="btn-primary">Get started</a>
  </div>
  <div class="pricing-card pricing-card--featured">
    <p class="pricing-card-name">Early Access</p>
    <p class="pricing-card-price">$10 <span class="pricing-card-period">per month</span></p>
    <p class="pricing-card-limit">20 courses per month</p>
    <ul class="pricing-feature-list">
      <li class="pricing-feature-item"><span class="pricing-feature-check">&#10003;</span> AI-curated YouTube courses</li>
    </ul>
    <a id="upgrade-cta" href="https://accounts.comoedu.com/sign-up" class="btn-primary">Upgrade now</a>
  </div>
</div>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `GET /` serving index.html (app) | `GET /` → landing.html; `GET /app` → index.html | Phase 6 (already done in server.js) | No action needed — routing already correct |
| /onboarding with no auth gate | /onboarding with server-side redirect to / | Phase 9 (this phase) | Add 3 lines to server.js |

**Already done from Phase 6:**
- `GET /` → `landing.html` (line 30 of server.js) [VERIFIED]
- `GET /app` → `index.html` with Clerk session check (lines 42–51 of server.js) [VERIFIED]
- `CLERK_ACCOUNT_PORTAL_URL` env var documented in .env.example [VERIFIED]
- `afterSignUpUrl: '/onboarding'` and `afterSignInUrl: '/app'` in index.html Clerk config [VERIFIED]

---

## Environment Availability

Step 2.6: SKIPPED — This phase is purely code/config/HTML changes. No external tools, runtimes, or services beyond what is already installed (Node.js, Express, Clerk — all verified operational from Phase 8 completion).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in test runner |
| Config file | package.json `"test"` script |
| Quick run command | `node --test --test-concurrency=1 tests/unit/server.test.js` |
| Full suite command | `node --test --test-concurrency=1 tests/unit/*.test.js` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| D-01 | GET /pricing returns 200 with HTML | integration | `node --test --test-concurrency=1 tests/unit/server.test.js` | ❌ Wave 0 — add test |
| D-01 | GET / returns 200 (landing.html) | integration | `node --test --test-concurrency=1 tests/unit/server.test.js` | ✅ (accepts 200 or 404 — will pass 200 after file exists) |
| D-02 | GET /app unauthenticated → 302 to Clerk sign-in | integration | `node --test --test-concurrency=1 tests/unit/server.test.js` | ✅ (existing redirect test via mock) |
| D-03 | GET /onboarding unauthenticated → 302 to / | integration | `node --test --test-concurrency=1 tests/unit/server.test.js` | ❌ Wave 0 — add test |
| D-10 | GET /onboarding authenticated → 200 | integration | `node --test --test-concurrency=1 tests/unit/server.test.js` | ❌ Wave 0 — add test |
| D-12 | GET /pricing requires no auth | integration | `node --test --test-concurrency=1 tests/unit/server.test.js` | ❌ Wave 0 — add test |
| UI-SPEC | landing.html nav has Pricing + Sign up free links | manual | open browser, inspect nav | manual-only — no DOM testing in this project |
| UI-SPEC | pricing.html CTA swap when authed | manual | sign in, visit /pricing, check Upgrade now href | manual-only — requires browser Clerk context |

### Sampling Rate

- **Per task commit:** `node --test --test-concurrency=1 tests/unit/server.test.js`
- **Per wave merge:** `node --test --test-concurrency=1 tests/unit/*.test.js`
- **Phase gate:** Full suite green (183+ tests passing) before `/gsd-verify-work`

### Wave 0 Gaps

New tests needed in `tests/unit/server.test.js`:

- [ ] `GET /pricing returns 200 and HTML content` — asserts status 200, Content-Type text/html
- [ ] `GET /onboarding unauthenticated returns 302 to /` — mocks `_clerkGetAuthImpl` to return `{userId: null}`, asserts redirect to `/`
- [ ] `GET /onboarding authenticated returns 200` — mocks `_clerkGetAuthImpl` to return `{userId: 'user_test123'}`, asserts 200

These three tests follow the exact same mock pattern already established in server.test.js (lines 104–134 and 151–178). No new mock infrastructure needed.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (for /app and /onboarding gates) | getAuth() from @clerk/express — already implemented |
| V3 Session Management | partial | Clerk handles sessions; Express reads session via getAuth() |
| V4 Access Control | yes | /onboarding and /app server-side gate via getAuth(); /pricing and / are intentionally public |
| V5 Input Validation | no | No user input on marketing pages |
| V6 Cryptography | no | No crypto operations in this phase |

### Known Threat Patterns for This Phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Bypassing /onboarding auth gate | Elevation of Privilege | Server-side getAuth() check — client-side-only check is insufficient (D-10 explicitly requires server-side) |
| Open redirect on /app gate | Tampering | redirect_url is constructed from process.env.APP_URL + '/app' — not from user input; already implemented correctly in server.js line 46–47 |
| XSS via window.__upgradeUrl injection | Tampering | Use JSON.stringify() when injecting the URL value into inline script (Option A) — prevents injection if URL contains quotes |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Option B (hardcode empty string for window.__upgradeUrl in pricing.html) is preferred over Option A (Express string-patch) because it avoids adding fs.readFileSync to a route handler | Pattern 3 / Pitfall 2 | If user requires the URL to be injected server-side (e.g., Railway deploy can't substitute env vars into HTML), Option A must be used instead, adding ~5 lines to server.js |
| A2 | The Clerk JS CDN tag to use in pricing.html is identical to the one in index.html (same publishable key, same FAPI URL) | Code Examples | If a different Clerk environment is needed for marketing pages (e.g., a separate Clerk instance), a different key would be required — unlikely given the project uses one Clerk app |

---

## Open Questions

1. **window.__upgradeUrl injection method**
   - What we know: CLERK_ACCOUNT_PORTAL_URL is available as env var; landing page doesn't need it; pricing.html does for the CTA swap
   - What's unclear: Whether the planner prefers Option A (Express patches HTML) or Option B (hardcoded empty string with fallback to sign-up URL)
   - Recommendation: Default to Option B (simpler, consistent with flat-file constraint). Flag in plan for user review before implementation.

2. **Nav auth state detection on pricing page**
   - What we know: UI-SPEC shows pricing nav as "Sign in" link only (static), not swapping to "Go to app" when signed in
   - What's unclear: CONTEXT.md "Claude's Discretion" mentions "whether to detect auth state client-side on pricing page to swap CTA" — the UI-SPEC chose not to swap the nav, only the "Upgrade now" CTA. This appears resolved by the approved UI-SPEC.
   - Recommendation: Follow UI-SPEC exactly — nav stays static ("Sign in"), only "Upgrade now" CTA swaps.

---

## Sources

### Primary (HIGH confidence)

- Project codebase (verified by direct file reads):
  - `server.js` — all existing route registrations, getAuth() usage, express.static position
  - `auth.js` — requireUser behavior (returns 401 JSON, not redirect)
  - `landing.html` — full current content (271 lines)
  - `onboarding.html` — full current content (304 lines)
  - `index.html` lines 1–50, 1640–1666 — CSS variables and Clerk.load() config
  - `tests/unit/server.test.js` — existing test coverage (675 lines)
  - `.env.example` — CLERK_ACCOUNT_PORTAL_URL confirmed present
  - `package.json` — test command, no new dependencies needed
  - `.planning/config.json` — nyquist_validation: true
- `/clerk/javascript` via Context7 — vanilla JS `Clerk.user` detection pattern after `Clerk.load()`
- `09-UI-SPEC.md` — approved 2026-04-26, all copy, CSS, component patterns verified

### Secondary (MEDIUM confidence)

- Context7 `/clerk/javascript` — `Clerk.user` and `Clerk.load()` vanilla patterns

### Tertiary (LOW confidence)

None.

---

## Metadata

**Confidence breakdown:**
- Routing changes: HIGH — server.js read in full; patterns directly observable
- HTML deltas: HIGH — both existing HTML files read in full; diff against UI-SPEC is precise
- Clerk client-side detection: HIGH — pattern verified in Context7 and in index.html
- window.__upgradeUrl injection method: MEDIUM — Option B vs A is a design choice, not a technical uncertainty
- Test additions needed: HIGH — server.test.js patterns directly observable

**Research date:** 2026-04-26
**Valid until:** 2026-05-26 (stable stack — Express, Clerk, vanilla HTML)
