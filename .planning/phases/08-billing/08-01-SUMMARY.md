---
phase: 08-billing
plan: 01
subsystem: database
tags: [postgres, supabase, sql, migration, tdd]

# Dependency graph
requires:
  - phase: 07-course-persistence
    provides: users table schema with clerk_id, plan columns
provides:
  - supabase/migrations/08_billing.sql — idempotent DDL adding generation_count and period_start columns plus increment_generation_count RPC function
affects: [08-02-db-functions, 08-03-server-gate, 08-04-webhooks, 08-05-upgrade-prompt]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Postgres RPC function for atomic counter increment (UPDATE ... SET x = x + 1 in single statement)"
    - "ADD COLUMN IF NOT EXISTS for idempotent migrations"
    - "CREATE OR REPLACE FUNCTION for idempotent function creation"

key-files:
  created:
    - supabase/migrations/08_billing.sql
  modified: []

key-decisions:
  - "generation_count and period_start stored on users table (no separate usage table) — D-05"
  - "Atomic counter uses Postgres RPC function (not application-level read-then-write) — D-07"
  - "Migration uses LANGUAGE sql VOLATILE (not plpgsql) — matches Supabase community pattern for simple increment functions"

patterns-established:
  - "RPC pattern: supabase.rpc('increment_generation_count', { p_clerk_id }) for atomic DB-side increment"

requirements-completed: [D-05, D-06, D-07, D-08, D-09, D-11, D-12, D-13]

# Metrics
duration: 10min
completed: 2026-04-18
---

# Phase 8 Plan 01: Billing Schema Migration and Failing Test Stubs Summary

**Postgres migration adds generation_count/period_start columns and atomic increment_generation_count RPC function to users table — PAUSED at checkpoint awaiting migration apply**

## Performance

- **Duration:** ~10 min (Task 1 only — paused at human-action checkpoint)
- **Started:** 2026-04-18T00:00:00Z
- **Completed:** PAUSED — awaiting human to apply migration to Supabase
- **Tasks:** 1 of 4 complete (Task 2 is human checkpoint; Tasks 3-5 to be resumed after checkpoint)
- **Files modified:** 1

## Accomplishments
- Created `supabase/migrations/08_billing.sql` with idempotent DDL (ADD COLUMN IF NOT EXISTS, CREATE OR REPLACE FUNCTION)
- Migration adds `generation_count INT NOT NULL DEFAULT 0` to users table
- Migration adds `period_start TIMESTAMPTZ NOT NULL DEFAULT now()` to users table
- Migration creates `increment_generation_count(p_clerk_id TEXT)` Postgres function for atomic counter increment
- Verified all required SQL tokens present via automated check

## Task Commits

1. **Task 1: Write 08_billing.sql migration** - `6bbe3da` (feat)
2. **Task 2: Human checkpoint** - PAUSED (awaiting migration apply)
3. **Task 3: db.test.js stubs** - NOT YET STARTED
4. **Task 4: webhooks.test.js stubs** - NOT YET STARTED
5. **Task 5: server.test.js stubs** - NOT YET STARTED

## Files Created/Modified
- `supabase/migrations/08_billing.sql` — DDL for generation_count, period_start columns and increment_generation_count RPC function

## Decisions Made
- Used `LANGUAGE sql VOLATILE` (not `plpgsql`) — matches Supabase community RPC pattern for simple increment functions
- `DEFAULT now()` on period_start for existing rows — gives all existing users a fresh 30-day period from migration time (intentional for MVP)

## Deviations from Plan

None — Task 1 executed exactly as written.

## Issues Encountered

None.

## User Setup Required

**Manual action required before Tasks 3–5 can be started.**

Apply the migration to Supabase:

**Option A — Supabase Dashboard (recommended):**
1. Open https://supabase.com/dashboard and navigate to your project
2. Go to SQL Editor (left sidebar)
3. Paste the full contents of `supabase/migrations/08_billing.sql`
4. Click "Run"
5. Confirm output shows "Success. No rows returned."
6. Verify: go to Table Editor → users → check `generation_count` (int, default 0) and `period_start` (timestamptz) columns appear
7. Verify function: run `SELECT proname FROM pg_proc WHERE proname = 'increment_generation_count';` — should return one row

**Option B — Supabase CLI:**
Run: `supabase db push`

## Next Phase Readiness

- Task 1 (migration SQL) complete and committed
- Migration must be applied to Supabase before Tasks 3–5 (test stubs) are started
- After checkpoint: resume at Task 3 to add failing db.test.js stubs (Tests 15–23)

---
*Phase: 08-billing*
*Plan 01 paused at checkpoint: 2026-04-18*
