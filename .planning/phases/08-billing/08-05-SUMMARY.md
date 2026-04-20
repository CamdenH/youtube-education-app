---
phase: 08-billing
plan: 05
subsystem: ui
tags: [fetch, sse, upgrade-prompt, clerk-billing, env]

requires:
  - phase: 08-billing plan 03
    provides: GET /api/usage-check route returning 429 with message + upgradeUrl on limit

provides:
  - fetch() preflight in index.html gating EventSource behind /api/usage-check
  - showUpgradePrompt() function using DOM construction (no innerHTML)
  - checkUsageGate() async helper that fails open on network error
  - .env.example documenting all project env vars including CLERK_ACCOUNT_PORTAL_URL

affects: [09-saas-ui]

tech-stack:
  added: []
  patterns: [fetch-before-sse preflight pattern for SSE rate-gate UX]

key-files:
  created: [.env.example]
  modified: [index.html]

key-decisions:
  - "DOM construction (createElement) used for upgrade link — not innerHTML — safe against server-controlled URL"
  - "checkUsageGate() fails open on network error (returns allowed:true) — avoids blocking users on transient fetch failures"
  - "btn-generate click handler made async — safe for browser event handlers; disableForm() still runs synchronously before await"

patterns-established:
  - "Fetch preflight before EventSource: call /api/usage-check via fetch() first; native EventSource cannot read HTTP status codes"

requirements-completed: [D-09, D-10]

duration: multi-session
completed: 2026-04-20
---

# Plan 08-05: index.html fetch() Preflight + Upgrade Prompt Summary

**fetch() preflight gate wired into btn-generate: 429 response shows inline upgrade link via DOM construction; .env.example documents all project env vars**

## Performance

- **Duration:** multi-session (auto tasks committed 2026-04-18, checkpoint verified 2026-04-20)
- **Tasks:** 3 (2 auto + 1 human checkpoint)
- **Files modified:** 2

## Accomplishments
- `checkUsageGate()` async function calls `GET /api/usage-check` before `EventSource` opens — catches 429 that native SSE cannot read
- `showUpgradePrompt()` uses `document.createElement` (not innerHTML) to safely insert an "Upgrade now" link with `rel="noopener noreferrer"`
- `btn-generate` click handler converted to `async`; gate check inserted before `new EventSource(...)` with early return on 429
- `.env.example` created with all project env vars including `CLERK_ACCOUNT_PORTAL_URL`
- Human checkpoint verified: 429 triggers inline upgrade message + working link; normal generation unaffected; 183 tests pass

## Task Commits

1. **Task 1: Create .env.example** — `b273fb9` (chore)
2. **Task 2: Add fetch() preflight and showUpgradePrompt to index.html** — `780b8b6` (feat)
3. **Task 3: Human checkpoint** — verified 2026-04-20

## Files Created/Modified
- `.env.example` — documents all project env vars; CLERK_ACCOUNT_PORTAL_URL with Clerk Dashboard instructions
- `index.html` — added `checkUsageGate()`, `showUpgradePrompt()`, made click handler async, inserted preflight gate

## Decisions Made
- `checkUsageGate()` fails open (`{ allowed: true }`) on network error — UX tradeoff: prefer not blocking users over enforcing gate on transient errors; server gate remains authoritative
- Used DOM construction for upgrade link (not `innerHTML`) — upgradeUrl is server-controlled (not user input), but DOM construction is still cleaner practice
- `disableForm()` called synchronously before `await checkUsageGate()` — form disabled immediately, no visible delay gap

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

`CLERK_ACCOUNT_PORTAL_URL` must be set in `.env`:
- Dev: `https://viable-llama-18.accounts.dev/user`
- Prod: `https://accounts.<your-clerk-domain>/user`
- Find in: Clerk Dashboard → Account Portal

## Next Phase Readiness

Phase 8 (Billing) complete. All 5 plans delivered:
- Migration + Wave 0 stubs (08-01)
- db.js billing functions: checkUsage, incrementGenerationCount, updateUserPlan (08-02)
- server.js usage gate + /api/usage-check route (08-03)
- webhooks.js subscriptionItem handlers (08-04)
- index.html preflight + upgrade prompt + .env.example (08-05)

Ready for Phase 9: SaaS UI / Landing Page.

---
*Phase: 08-billing*
*Completed: 2026-04-20*
