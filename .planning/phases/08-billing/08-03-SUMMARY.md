---
phase: 08-billing
plan: "03"
subsystem: server
tags: [usage-gate, billing, sse, express, rate-limiting]
dependency_graph:
  requires: ["08-01", "08-02"]
  provides: ["GET /api/usage-check", "usage gate in GET /api/course-stream", "counter increment after saveCourse"]
  affects: ["server.js", "tests/unit/server.test.js"]
tech_stack:
  added: []
  patterns: ["usage gate before SSE headers", "fetch() preflight pattern", "nested try/catch for non-fatal counter increment"]
key_files:
  modified:
    - server.js
    - tests/unit/server.test.js
decisions:
  - "Default test mock resetMockFrom() updated to return valid free-user row from single() so authenticated tests that don't override the mock pass checkUsage cleanly"
  - "incrementGenerationCount nested in inner try/catch — errors logged but do not fail the request since course was already delivered"
  - "Usage gate uses separate GET /api/usage-check endpoint (Option A from research) rather than Accept-header inspection on the SSE route"
metrics:
  duration: "~20 minutes (execution time)"
  completed_date: "2026-04-18"
  tasks_completed: 2
  files_modified: 2
requirements_satisfied: [D-07, D-08, D-09]
---

# Phase 8 Plan 03: Server.js Usage Gate Summary

Server-side usage gate enforcing per-user monthly generation limits via `checkUsage` before SSE opens, plus `GET /api/usage-check` preflight endpoint and atomic counter increment after `saveCourse`.

## What Was Built

Two changes to `server.js` and one fix to the test mock:

1. **Updated db import** — added `checkUsage` and `incrementGenerationCount` to the destructured require on line 12.

2. **`GET /api/usage-check` route** (STEP 8c) — lightweight read-only endpoint registered after `/api/courses` and before `/api/transcript/:videoId`. Returns 401 if unauthenticated (via `requireUser`), 200 JSON when under limit, 429 JSON with `{ error, message, upgradeUrl }` when over limit, 500 JSON when `checkUsage` throws.

3. **Usage gate in `GET /api/course-stream`** (D-08) — inserted after input validation, before `courseStreamHandler`. Calls `checkUsage(req.userId)` and returns 429 JSON before any SSE headers are sent. Gate fires before `res.writeHead` — a plain HTTP JSON response, not an SSE event.

4. **Counter increment** (D-07) — `incrementGenerationCount(req.userId)` called inside a nested try/catch immediately after `saveCourse` succeeds. Errors are logged with `console.error` but do not fail the request (course was already delivered to the user). Atomic RPC prevents TOCTOU race on concurrent requests.

## Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add GET /api/usage-check route and import | d3095d0 | server.js |
| 2 | Insert usage gate and counter increment into course-stream | 1ce5e96 | server.js, tests/unit/server.test.js |

## Test Results

All 24 server tests GREEN. Full suite: 180 pass, 3 fail (pre-existing webhooks RED stubs from Plan 04, not introduced by this plan).

Tests A–E confirmed GREEN:
- Test A (20): `GET /api/usage-check` unauthenticated returns 401
- Test B (21): `GET /api/usage-check` authenticated under limit returns 200
- Test C (22): `GET /api/usage-check` authenticated over limit returns 429 with correct JSON shape
- Test D (23): `GET /api/course-stream` returns 429 JSON (not SSE) when usage gate fires
- Test E (24): `GET /api/course-stream` passes gate and opens SSE when usage is within limit

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Default test mock returned null user data, breaking previously-passing SSE tests**

- **Found during:** Task 2 verification — tests 4 and 12 regressed after usage gate insertion
- **Issue:** `resetMockFrom()` default `single()` returned `{ data: null, error: null }`. Once `checkUsage` was called in the course-stream handler, it crashed on `data.plan` (TypeError on null), returning 500 instead of passing through to SSE.
- **Fix:** Updated `resetMockFrom()` to return a valid free-user row `{ plan: 'free', generation_count: 0, period_start: <5 days ago> }` from `single()`. Tests that need over-limit or error scenarios continue to override `_mockFromResult` directly.
- **Files modified:** `tests/unit/server.test.js`
- **Commit:** 1ce5e96

## Known Stubs

None. All wired paths are functional within the test harness.

## Threat Surface Scan

All security-relevant surfaces are covered by the plan's threat model:

| Boundary | Control |
|----------|---------|
| `GET /api/usage-check` | `requireUser` enforces Clerk JWT auth before `checkUsage` runs |
| `GET /api/course-stream` gate | `requireUser` + gate both server-side; 429 fires before any SSE data |
| `upgradeUrl` in 429 body | Comes from `process.env.CLERK_ACCOUNT_PORTAL_URL` — server-controlled, not user input |

No new threat surfaces introduced beyond what is documented in the plan's STRIDE register.

## Self-Check: PASSED

- server.js: FOUND
- tests/unit/server.test.js: FOUND
- 08-03-SUMMARY.md: FOUND
- commit d3095d0: FOUND
- commit 1ce5e96: FOUND
