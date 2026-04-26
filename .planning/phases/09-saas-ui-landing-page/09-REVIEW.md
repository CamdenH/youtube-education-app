---
phase: 09-saas-ui-landing-page
reviewed: 2026-04-26T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - tests/unit/server.test.js
  - server.js
  - landing.html
  - pricing.html
  - onboarding.html
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
status: issues_found
---

# Phase 9: Code Review Report

**Reviewed:** 2026-04-26
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Phase 9 adds three new HTML routes (`/`, `/pricing`, `/onboarding`), three corresponding TDD tests, and the static HTML files for each page. The server-side routing logic is clean and correctly follows the project convention of using inline `getAuth()` for HTML routes rather than `requireUser`. The test file is well-structured with thorough mock isolation.

One critical issue was found: `server.js` constructs a `URL` object from `process.env.CLERK_SIGN_IN_URL` on the `/app` route without a null-guard, which throws a runtime `TypeError` that crashes the request when the env var is unset (including in local dev or CI without a `.env` file). Three warnings cover: a hardcoded Clerk publishable key in `pricing.html`, a missing auth gate test for `GET /pricing` (it asserts 200 but the test for Phase 9 that was meant to confirm public access has a stale comment implying the file might not exist), and a user-facing currency formatting issue in `server.js` where the upgrade message omits a `$` sign before the `10` price. Two info items flag dead CSS variables and a minor structural comment artifact.

---

## Critical Issues

### CR-01: `URL` constructor called on potentially-undefined `CLERK_SIGN_IN_URL` — crashes the `/app` route

**File:** `server.js:53`

**Issue:** `new URL(process.env.CLERK_SIGN_IN_URL)` throws `TypeError: Failed to construct 'URL': Invalid URL` when `CLERK_SIGN_IN_URL` is missing or empty. This is not caught anywhere in the `/app` route handler, so the exception propagates to Express's default error handler and returns a 500 HTML response instead of a redirect. Every unauthenticated visit to `/app` in an environment without this env var (fresh dev clone, CI without full `.env`, misconfigured prod deploy) will crash the route.

**Fix:**
```js
// server.js — /app route, around line 53
app.get('/app', (req, res, next) => {
  const { userId } = getAuth(req);
  if (userId) return next();
  const signInBase = process.env.CLERK_SIGN_IN_URL;
  if (!signInBase) {
    console.error('[/app] CLERK_SIGN_IN_URL is not set');
    return res.status(500).json({ error: 'Server misconfiguration' });
  }
  const signInUrl = new URL(signInBase);
  const appBase = process.env.APP_URL || `${req.protocol}://${req.hostname}`;
  signInUrl.searchParams.set('redirect_url', `${appBase}/app`);
  return res.redirect(signInUrl.toString());
}, (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});
```

---

## Warnings

### WR-01: Clerk publishable key hardcoded in `pricing.html`

**File:** `pricing.html:287`

**Issue:** The `data-clerk-publishable-key` attribute contains a literal `pk_live_*` key. While Clerk publishable keys are designed to be client-visible (they are not secret), hardcoding a live key into a checked-in HTML file means:

1. Rotating the key requires a code deploy, not just an env change.
2. It diverges from the pattern in `index.html` (which should be templated or use a build-time injection), creating an inconsistency that will cause subtle breakage if the key is rotated.

Consistent with how `index.html` presumably handles this, the key should come from a server-rendered template variable or a `<meta>` tag injected at serve time. If `index.html` also hardcodes the key, this is an existing pattern to flag holistically — but adding a second hardcoded location makes rotation harder.

**Fix:** Serve `pricing.html` through an Express template (e.g., a minimal `res.render` with a single variable), or inject the key via a `<meta>` tag set by the route handler, consistent with however `index.html` resolves it.

### WR-02: Upgrade price copy in `server.js` missing `$` sign — user-facing bug

**File:** `server.js:89` and `server.js:153`

**Issue:** Both 429 response bodies produce the message:

```
"You've used your 1 free course this month. Upgrade to Early Access for 20/month."
```

The price is missing a `$` character — it should read `$10/month`, not `20/month`. The `20` refers to the course count, not the price, making the sentence grammatically broken and misleading.

**Fix:**
```js
// Line 89 and line 153 — both occurrences
message: `You've used your ${usageResult.limit} free ${limitWord} this month. Upgrade to Early Access for $10/month.`,
```

### WR-03: Phase 9 test for `GET /pricing` does not test the auth-gating contract

**File:** `tests/unit/server.test.js:678-687`

**Issue:** The `GET /pricing returns 200 and HTML content` test at line 678 only asserts `res.status === 200`. This is correct for Phase 9's intent (pricing is public), but there is no corresponding test that confirms an unauthenticated request to `/pricing` does **not** redirect — i.e., that the route stays public. If someone later accidentally adds a `requireUser` or `getAuth` guard to `/pricing` (as was done to `/onboarding`), no test will catch the regression. Given Phase 9 explicitly distinguishes public vs. auth-gated routes, the test coverage asymmetry is a reliability risk.

**Fix:** Add a test that sends an unauthenticated request (`_clerkGetAuthImpl = () => ({ userId: null })`) to `/pricing` and asserts `res.status === 200` (not a redirect). This mirrors the `/onboarding` test pair and locks in the public contract.

---

## Info

### IN-01: Stale comment in `server.test.js` test for `GET /onboarding`

**File:** `tests/unit/server.test.js:125-126`

**Issue:** The test at line 120 (`GET /onboarding returns 200 or 404 (route is registered)`) has a comment reading "onboarding.html does not exist yet — Express returns 404 via sendFile." `onboarding.html` now exists as part of Phase 9. The test itself asserts `200 || 404`, which is fine as a broad acceptance test, but the comment is now inaccurate and could mislead future readers into thinking the file is still missing.

**Fix:** Update the comment to reflect that the file now exists and the expected status is 200. No code change needed.

### IN-02: `--color-success` and `--color-destructive` CSS variables defined but never used in `pricing.html` and `onboarding.html`

**File:** `pricing.html:36-37`, `onboarding.html:36-37`

**Issue:** Both pages declare `--color-success: #22c55e` and `--color-destructive: #ef4444` in their `:root` block, but neither variable is referenced anywhere in those files' stylesheets or markup. `--color-destructive` is unused in all three HTML files reviewed. This is cosmetic dead code copied from the shared design token block, but it adds minor noise.

**Fix:** Either remove the unused variables from each page's local `:root` block, or (better) move the full design token set to a shared `styles.css` file that all pages import — consistent with the CLAUDE.md note about avoiding duplication without over-engineering. If a shared CSS file already exists or is planned, this resolves naturally.

---

_Reviewed: 2026-04-26_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
