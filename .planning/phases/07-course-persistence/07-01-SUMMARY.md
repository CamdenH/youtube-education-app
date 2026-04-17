---
phase: 07-course-persistence
plan: 01
subsystem: database
tags: [supabase, postgres, sql, rls, migration]

# Dependency graph
requires:
  - phase: 06-auth
    provides: Clerk user_id (TEXT) used as foreign key in courses.user_id
provides:
  - Supabase `cache` table (TEXT PK, JSONB data, timestamps) — replaces .cache/ filesystem
  - Supabase `courses` table (UUID PK, user_id TEXT, topic, skill_level, JSONB course, created_at)
  - Index courses_user_id_created_at_idx on (user_id, created_at DESC)
  - RLS policies on courses enforcing auth.uid()::text = user_id
affects: [07-02, 07-03, 07-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Idempotent SQL migration: CREATE TABLE IF NOT EXISTS + DROP POLICY IF EXISTS"
    - "RLS as defense-in-depth when service-role key is primary access method"

key-files:
  created:
    - .planning/phases/07-course-persistence/07-01-migration.sql
  modified: []

key-decisions:
  - "Global cache (D-01): no user_id in cache key — same query from any user hits same cache row"
  - "courses.user_id is TEXT (Clerk ID), not FK to users table — avoids webhook timing race"
  - "No RLS on cache table — service-role key bypasses RLS, cache is intentionally global"
  - "RLS on courses is defense-in-depth only — service-role key bypasses it in normal operation"

patterns-established:
  - "Migration files: idempotent SQL in .planning/phases/{phase}/{phase}-{plan}-migration.sql"

requirements-completed: [D-01, D-02]

# Metrics
duration: 5min
completed: 2026-04-17
---

# Phase 7 Plan 01: Course Persistence Schema Summary

**Idempotent SQL migration creating `cache` (global MD5-keyed JSONB store) and `courses` (per-user history with RLS defense-in-depth) tables in Supabase**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-17T19:39:00Z
- **Completed:** 2026-04-17T19:39:14Z
- **Tasks:** 1 of 2 completed (Task 2 is human-action checkpoint)
- **Files modified:** 1

## Accomplishments

- SQL migration file written at `.planning/phases/07-course-persistence/07-01-migration.sql`
- Covers `cache` table (D-01): TEXT PK, JSONB data, created_at/updated_at, created_at index
- Covers `courses` table (D-02): UUID PK, user_id TEXT, topic, skill_level, course JSONB, created_at
- Composite index `courses_user_id_created_at_idx` on `(user_id, created_at DESC)` for history queries
- RLS enabled on `courses` with select/insert policies using `auth.uid()::text = user_id`
- Migration is idempotent (safe to re-run): uses `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `DROP POLICY IF EXISTS`

## Task Commits

1. **Task 1: Write idempotent SQL migration file** - `491aa81` (feat)

**Plan metadata:** pending (awaiting human checkpoint completion)

## Files Created/Modified

- `.planning/phases/07-course-persistence/07-01-migration.sql` — Full DDL for cache + courses tables, index, and RLS policies

## Decisions Made

- Global cache (D-01): no user_id scoping — MD5 hash of query/video ID is cache key; cross-user cache hit saves YouTube API quota at scale
- `courses.user_id` is TEXT (Clerk ID) not a FK — avoids timing race with webhook upsert creating the `users` row
- No RLS on `cache` — service-role key is the only access path; global cache has no per-user semantics to protect
- Defense-in-depth RLS on `courses` — inactive under service-role key but guards against accidental anon-key exposure

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `.planning/` is listed in `.gitignore` but planning files ARE tracked in git (force-added historically). Used `git add -f` to stage the new migration file. This matches how prior planning files (e.g., phase 06 summaries) were committed.

## User Setup Required

**Human action required before Plan 02 can execute.**

Run the migration in the Supabase Dashboard:

1. Open `.planning/phases/07-course-persistence/07-01-migration.sql` and review the DDL.
2. Open Supabase Dashboard for this project (the URL in `SUPABASE_URL`).
3. Navigate to **SQL Editor** → **New query**.
4. Paste the full contents of `07-01-migration.sql` into the editor.
5. Click **Run**. Expected: "Success. No rows returned" (no errors).
6. Navigate to **Table Editor** — verify two new tables: `cache` and `courses`.
7. Click `cache` — confirm columns: `key`, `data`, `created_at`, `updated_at`.
8. Click `courses` — confirm columns: `id`, `user_id`, `topic`, `skill_level`, `course`, `created_at`.
9. Run to verify empty and queryable:
   ```sql
   SELECT count(*) FROM cache;
   SELECT count(*) FROM courses;
   ```
   Both must return `0`.
10. Confirm the index exists:
    ```sql
    SELECT indexname FROM pg_indexes WHERE tablename = 'courses';
    ```
    Expected: a row named `courses_user_id_created_at_idx`.

Reply **"migration-run"** once both tables are visible and both SELECT counts return 0.

## Next Phase Readiness

- Plan 02 (`db.js` query functions) is blocked until the Supabase tables exist — needs human to run migration first
- Once tables are live, Plan 02 can add `cacheGet`, `cacheSet`, `saveCourse`, `getCourseHistory` to `db.js`

---
*Phase: 07-course-persistence*
*Completed: 2026-04-17*
