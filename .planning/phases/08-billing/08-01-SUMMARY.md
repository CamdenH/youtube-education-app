---
phase: 08-billing
plan: 01
subsystem: testing
tags: [supabase, postgresql, tdd, node-test, clerk-billing]

# Dependency graph
requires:
  - phase: 07-course-persistence
    provides: db.js with supabase client, users table with plan column
provides:
  - supabase/migrations/08_billing.sql with generation_count, period_start columns and increment_generation_count RPC
  - Failing test stubs for checkUsage, incrementGenerationCount, updateUserPlan in db.test.js (Tests 15-23)
  - Failing test stubs for subscriptionItem.active/ended billing webhooks in webhooks.test.js (Tests 6-12)
  - Failing test stubs for usage-check route and course-stream gate in server.test.js (Tests A-E)
affects: [08-02-db-functions, 08-03-server-gate, 08-04-webhooks, 08-05-upgrade-prompt]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Postgres RPC function for atomic counter increment (UPDATE ... SET x = x + 1 in single statement)"
    - "ADD COLUMN IF NOT EXISTS for idempotent migrations"
    - "CREATE OR REPLACE FUNCTION for idempotent function creation"
    - "buildChain() extended with mockRpc for supabase.rpc() and mockUpdate/mockUpdateEq for .update().eq() path"
    - "mockSupabaseClient in server.test.js extended with rpc delegate; resetMockFrom() includes update path"
    - "Vacuous-pass pattern accepted for negative-assertion tests before implementation exists"

key-files:
  created:
    - supabase/migrations/08_billing.sql
    - .planning/phases/08-billing/08-01-SUMMARY.md
  modified:
    - tests/unit/db.test.js
    - tests/unit/webhooks.test.js
    - tests/unit/server.test.js

key-decisions:
  - "generation_count and period_start stored on users table (no separate usage table) — D-05"
  - "Atomic counter uses Postgres RPC function (not application-level read-then-write) — D-07"
  - "Migration uses LANGUAGE sql VOLATILE (not plpgsql) — matches Supabase community pattern for simple increment functions"
  - "Vacuous-pass pattern accepted for negative-assertion stubs — tests that assert NO call is made are trivially true before implementation, which is correct TDD behavior"
  - "mockRpc is top-level on buildChain() client object (not inside mockFrom result) — matches supabase.rpc() call pattern"

patterns-established:
  - "RPC pattern: supabase.rpc('increment_generation_count', { p_clerk_id }) for atomic DB-side increment"
  - "TDD Wave 0: all Phase 8 test stubs planted before any implementation code — every subsequent plan has a RED baseline to turn GREEN"
  - "buildChain() mock extended by adding new mock vars at describe-block scope and wiring into the chain — existing tests unaffected"

requirements-completed: [D-05, D-06, D-07, D-08, D-09, D-11, D-12, D-13]

# Metrics
duration: ~35min
completed: 2026-04-18
---

# Phase 8 Plan 01: Billing Schema Migration and Failing Test Stubs Summary

**Supabase billing migration (generation_count, period_start, increment_generation_count RPC) applied; 16 RED test stubs planted across db.test.js, webhooks.test.js, and server.test.js establishing the full TDD baseline for Phase 8 implementation plans**

## Performance

- **Duration:** ~35 min (Task 1 prior session, Tasks 3/4/5 this session)
- **Started:** 2026-04-18T00:00:00Z
- **Completed:** 2026-04-18
- **Tasks:** 4 auto tasks complete (Task 2 was human-action checkpoint)
- **Files modified:** 4 (1 SQL migration + 3 test files)

## Accomplishments

- Created `supabase/migrations/08_billing.sql` with idempotent DDL — `ADD COLUMN IF NOT EXISTS generation_count INT NOT NULL DEFAULT 0`, `ADD COLUMN IF NOT EXISTS period_start TIMESTAMPTZ NOT NULL DEFAULT now()`, and `CREATE OR REPLACE FUNCTION increment_generation_count` using atomic SQL UPDATE
- Migration applied to Supabase (confirmed by human at checkpoint)
- `db.test.js` extended: `buildChain()` gains `mockRpc` (top-level client), `mockUpdate`, `mockUpdateEq` — Tests 15–23 cover checkUsage (free/early_access/period-reset/error), incrementGenerationCount (rpc args/error), updateUserPlan (update args/error), all RED
- `webhooks.test.js` extended: `mockUpdateUserPlan` injected into db cache mock in `beforeEach` — Tests 6–12 cover subscriptionItem.active/ended guard conditions and idempotency, Tests 6/9/12 RED, Tests 7/8/10/11 vacuously GREEN (negative assertions)
- `server.test.js` extended: `mockSupabaseClient` gains `rpc` delegate, `resetMockFrom()` gains `update` path — Tests A–D RED (usage-check 401/200/429, course-stream gate 429), Test E vacuously GREEN (no gate yet = stream proceeds)

## Task Commits

1. **Task 1: Write 08_billing.sql migration** — `6bbe3da` (chore, prior session)
2. **Task 2: Apply migration to Supabase** — human-action checkpoint (confirmed by user)
3. **Task 3: Add failing test stubs for db.js Phase 8 functions** — `5ab71e7` (test)
4. **Task 4: Add failing test stubs for webhooks.js Phase 8 billing events** — `1139a86` (test)
5. **Task 5: Add failing test stubs for server.js Phase 8 gate and usage-check** — `13099f4` (test)

**Plan metadata:** (this commit)

## Files Created/Modified

- `supabase/migrations/08_billing.sql` — DDL for generation_count, period_start columns and increment_generation_count RPC function
- `tests/unit/db.test.js` — Extended buildChain() with mockRpc/mockUpdate/mockUpdateEq; Tests 15–23 appended
- `tests/unit/webhooks.test.js` — mockUpdateUserPlan declared and injected into db mock; Tests 6–12 appended
- `tests/unit/server.test.js` — rpc mock added to mockSupabaseClient, update path added to resetMockFrom(), Tests A–E appended

## Decisions Made

- Used `LANGUAGE sql VOLATILE` (not `plpgsql`) — matches Supabase community RPC pattern for simple increment functions
- `DEFAULT now()` on period_start — gives all existing users a fresh 30-day period from migration time (intentional for MVP)
- Vacuous-pass pattern accepted for negative-assertion stubs (Tests 7/8/10/11 in webhooks, Test E in server) — these tests assert that certain calls do NOT happen, which is trivially true before the handler/gate is implemented. Correct TDD behavior.
- `mockRpc` placed as top-level property on buildChain() client (not inside mockFrom result) to match `supabase.rpc()` call pattern

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## Known Stubs

None — this plan only writes test stubs, not production stubs. Test stubs are intentionally RED pending implementation in Plans 02–04.

## Threat Flags

None — test files never contain real credentials; SUPABASE_URL and keys set to dummy values in test setup. Migration is a controlled internal artifact.

## Self-Check: PASSED

- `supabase/migrations/08_billing.sql` — exists and contains required tokens
- `tests/unit/db.test.js` — Tests 15–23 appended, confirmed RED
- `tests/unit/webhooks.test.js` — Tests 6–12 appended, Tests 6/9/12 confirmed RED
- `tests/unit/server.test.js` — Tests A–E appended, Tests A–D confirmed RED
- Commits verified: `5ab71e7`, `1139a86`, `13099f4`
- Tests 1–14 in db.test.js: 14 passing (GREEN)
- Tests 1–5 in webhooks.test.js: 5 passing (GREEN)
- Pre-existing server tests 1–19: all passing (GREEN)

## Next Phase Readiness

- Plan 02 (db.js implementation): Tests 15–23 RED and ready — implement `checkUsage`, `incrementGenerationCount`, `updateUserPlan` in `db.js`
- Plan 03 (server.js gate + usage-check route): Tests A–D RED and ready — implement `GET /api/usage-check` and usage gate middleware
- Plan 04 (webhooks.js billing events): Tests 6/9/12 RED and ready — implement `subscriptionItem.active/ended` handlers in `clerkWebhookHandler`

---
*Phase: 08-billing*
*Completed: 2026-04-18*
