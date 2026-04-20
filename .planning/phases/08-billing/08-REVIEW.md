---
phase: 08-billing
reviewed: 2026-04-20T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - db.js
  - server.js
  - webhooks.js
  - index.html
  - .env.example
  - tests/unit/db.test.js
  - tests/unit/webhooks.test.js
  - tests/unit/server.test.js
findings:
  critical: 1
  warning: 3
  info: 1
  total: 5
status: issues_found
---

# Phase 08: Code Review Report

**Reviewed:** 2026-04-20
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Phase 8 adds Clerk Billing subscription tiers, a usage gate on `/api/course-stream`, a `/api/usage-check` preflight endpoint, webhook handlers for `subscriptionItem.active` / `subscriptionItem.ended`, and a frontend fetch-before-EventSource flow to surface the 429. The architecture is sound and the security-sensitive paths (webhook signature verification, `req.userId` from session only, DOM-construction upgrade prompt) are correctly handled. Four issues were found, one of which is a hardcoded live publishable key in `index.html`.

---

## Critical Issues

### CR-01: Live Clerk publishable key hardcoded in index.html

**File:** `index.html:1647`
**Issue:** The Clerk publishable key `pk_live_Y2xlcmsuY29tb2VkdS5jb20k` is committed directly in the HTML. Publishable keys are not secret (they are safe to expose to browsers by design), but hardcoding a live key in source creates a maintenance problem: rotating or switching environments requires a code change and redeploy, and the key is permanently in git history. More importantly, the `.env.example` file already has `CLERK_SECRET_KEY` as the pattern for env-injected values, and Clerk's own recommended approach is to template the publishable key from an environment variable at build/deploy time (or use a separate file that is not committed).

**Fix:** Move the publishable key to an environment variable (e.g. `CLERK_PUBLISHABLE_KEY`) and inject it at deploy time via a template placeholder, a build step, or server-side rendering into the HTML. Add `CLERK_PUBLISHABLE_KEY=` to `.env.example`. At minimum, add a comment noting the key must be replaced per environment and document the rotation procedure.

---

## Warnings

### WR-01: checkUsage has a TOCTOU window between the reset-write and the count read

**File:** `db.js:60-69`
**Issue:** `checkUsage` does a read-then-conditional-write: if the period has expired it calls `UPDATE ... SET generation_count=0, period_start=now()`, then returns `count = 0`. However, two concurrent requests for the same user can both read the expired period, both fire the reset `UPDATE`, and both see `count = 0`, allowing two courses to pass the gate when only one should. The atomic RPC (`increment_generation_count`) protects the increment step, but the reset path is not atomic relative to the gate check.

**Fix:** Move the period-reset logic into the `increment_generation_count` Postgres function, or into a new RPC (e.g. `check_and_maybe_reset_usage`) that performs the read, conditional reset, and gate check in a single transaction. Alternatively, use `UPDATE ... WHERE period_start < now() - interval '30 days' RETURNING generation_count` so only one concurrent call can win the reset race.

---

### WR-02: saveCourse failure silently skips incrementGenerationCount — user consumes a slot without it being recorded

**File:** `server.js:88-100`
**Issue:** When `saveCourse` throws, the outer `catch (saveErr)` only logs and swallows the error. The `incrementGenerationCount` call is nested inside the `saveCourse` try block, so if `saveCourse` fails, the counter is never incremented. This means the user successfully receives a generated course (the SSE stream already completed) but their usage count stays at zero, effectively giving them a free bypass on every DB outage. The design comment at line 91 ("Increment counter after successful save") treats this as intentional, but for a paid usage gate it creates a meaningful revenue leak if Supabase has transient errors.

**Fix:** Decouple `incrementGenerationCount` from the `saveCourse` success path. Increment the counter whenever the course was delivered to the user (i.e., whenever `course` is truthy), regardless of whether `saveCourse` succeeds. Move the increment outside the inner try/catch or add it to both the success and the `saveErr` catch branches:

```js
if (course) {
  // Best-effort save — failure is logged but does not block increment
  try {
    await saveCourse(req.userId, subject, skill_level, course);
  } catch (saveErr) {
    console.error('[course-stream] saveCourse failed:', saveErr.message);
  }
  // Always increment — counter tracks generation, not persistence
  try {
    await incrementGenerationCount(req.userId);
  } catch (incErr) {
    console.error('[course-stream] incrementGenerationCount failed:', incErr.message);
  }
}
```

---

### WR-03: /api/hints is unauthenticated — any unauthenticated caller can trigger paid Claude API calls

**File:** `server.js:205`
**Issue:** `POST /api/hints` has no `requireUser` middleware. Any unauthenticated request (or any authenticated user, including free users) can call this endpoint and trigger a Claude API call. This is a cost-abuse vector: an attacker can flood the endpoint and drive up your Anthropic bill. All other API routes in this file that invoke external paid services are protected by `requireUser`.

**Fix:** Add `requireUser` middleware to the hints route, consistent with the other protected routes:

```js
app.post('/api/hints', requireUser, async (req, res) => {
```

If the intent is to allow unauthenticated access (e.g., hints are a "teaser" feature), at minimum add rate limiting per IP. But given that every other paid-API route is auth-gated, the omission here appears unintentional.

---

## Info

### IN-01: video thumbnail links missing rel="noreferrer" (only has rel="noopener")

**File:** `index.html:1367`
**Issue:** `thumbLink.rel = 'noopener'` is set but `noreferrer` is omitted. For `target="_blank"` links, `noopener` prevents the opened page from accessing `window.opener`, but without `noreferrer` the browser still sends a `Referer` header that reveals the app URL to YouTube. This is low-severity (YouTube already knows the origin), but the `showUpgradePrompt` function (line 1002) correctly sets both `rel="noopener noreferrer"` — the thumbnail link should be consistent.

**Fix:**
```js
thumbLink.rel = 'noopener noreferrer';
```

---

_Reviewed: 2026-04-20_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
