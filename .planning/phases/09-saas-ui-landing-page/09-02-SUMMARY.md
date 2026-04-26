---
phase: 09-saas-ui-landing-page
plan: 02
subsystem: api
tags: [express, routing, clerk, getAuth, auth-gate, redirect]

# Dependency graph
requires:
  - phase: 09-01
    provides: 3 Wave 0 RED TDD tests for /pricing and /onboarding auth gate

provides:
  - GET /pricing route registered in server.js (public, serves pricing.html)
  - GET /onboarding route with inline getAuth() auth gate — unauthenticated users redirected to /
  - Wave 0 test 26 "GET /onboarding unauthenticated redirects to /" now GREEN

affects: [09-03, 09-04, 09-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Inline getAuth() for HTML route auth gates — NOT requireUser (which returns 401 JSON)"
    - "Unauthenticated HTML route redirect pattern: const { userId } = getAuth(req); if (!userId) return res.redirect('/')"
    - "Route ordering: GET / → GET /onboarding (auth-gated) → GET /pricing (public) → express.static → GET /app"

key-files:
  created: []
  modified:
    - server.js

key-decisions:
  - "Used inline getAuth() + res.redirect('/') on /onboarding — requireUser returns 401 JSON which is wrong for HTML page routes"
  - "GET /pricing registered as fully public (no auth) per D-12 — pricing page must be accessible without login"
  - "Both new routes placed before express.static to ensure Express route matching takes precedence over static file serving"

patterns-established:
  - "HTML route auth gate pattern: inline getAuth() with redirect, NOT requireUser middleware"

requirements-completed:
  - D-01
  - D-02
  - D-03
  - D-10
  - D-12

# Metrics
duration: 5min
completed: 2026-04-26
---

# Phase 9 Plan 02: Wave 1 Server Routing Summary

**GET /pricing (public) and auth-gated GET /onboarding (getAuth + redirect to /) added to server.js — Wave 0 test 26 now GREEN**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-26T00:08:00Z
- **Completed:** 2026-04-26T19:07:07Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Replaced one-liner /onboarding route with multi-line handler that calls getAuth() inline — unauthenticated requests receive 302 redirect to / (D-03, D-10)
- Added GET /pricing as fully public route serving pricing.html (D-12) — route present before express.static
- requireUser NOT used on either route (returns 401 JSON, wrong for HTML page redirects)
- Wave 0 test 26 "GET /onboarding unauthenticated redirects to /" flipped from RED to GREEN
- All 24 previously passing tests remain green — no regressions

## Task Commits

1. **Task 1: Add GET /pricing route and auth-gate GET /onboarding** - `2e70274` (feat)

**Plan metadata:** (created below in final commit)

## Files Created/Modified

- `server.js` — /onboarding handler replaced with auth-gated version (lines 32-41); GET /pricing added (line 41)

## Decisions Made

Used `inline getAuth()` rather than `requireUser` on the /onboarding route because `requireUser` returns a 401 JSON response, which is incorrect for HTML page routes that should redirect the browser. The `/app` route already established this pattern (lines 42-51 of server.js). This distinction is important: API routes use `requireUser` (401 JSON), HTML routes use inline `getAuth()` + redirect.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Test 25 ("GET /pricing returns 200") remains RED as expected — pricing.html does not exist yet and will be created in plan 09-04. Test 27 ("GET /onboarding authenticated returns 200") remains GREEN because onboarding.html exists on disk.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Wave 1 routing complete — both /pricing and /onboarding routes are registered
- Plan 09-03 (landing.html) can proceed — routes are ready
- Plan 09-04 (pricing.html) will make test 25 GREEN when it creates the file
- Plan 09-05 (onboarding.html) — route auth gate is correct; file just needs to be created
- No blockers

## Threat Surface Scan

No new network endpoints or auth paths beyond those documented in plan threat model (T-09-02-01 through T-09-02-03). The /onboarding auth gate (T-09-02-01) is implemented as specified — server-side getAuth() check with 302 redirect for unauthenticated users.

## Self-Check

- server.js contains "app.get('/pricing'": FOUND (line 41)
- server.js contains "app.get('/onboarding', (req, res) => {": FOUND (line 34)
- server.js contains "if (!userId) return res.redirect('/')": FOUND (line 36)
- server.js does NOT contain requireUser on /onboarding: CONFIRMED
- /pricing appears before express.static: CONFIRMED (line 41 vs line 44)
- node --check server.js: PASSES
- Test 26 "GET /onboarding unauthenticated redirects to /": GREEN
- Commit 2e70274: FOUND

## Self-Check: PASSED

---
*Phase: 09-saas-ui-landing-page*
*Completed: 2026-04-26*
