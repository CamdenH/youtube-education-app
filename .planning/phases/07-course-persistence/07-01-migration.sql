-- Phase 7 migration: cache + courses tables (D-01, D-02)
-- Safe to run multiple times (CREATE ... IF NOT EXISTS, DROP POLICY IF EXISTS).

-- ─── cache table (D-01) ──────────────────────────────────────────────────────
-- Global cache shared across all users. Keyed by MD5 query hash or video ID.
-- Replaces the file-based .cache/ directory.

CREATE TABLE IF NOT EXISTS cache (
  key        TEXT         PRIMARY KEY,
  data       JSONB        NOT NULL,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cache_created_at_idx ON cache (created_at);

-- No RLS on cache — service-role key bypasses RLS and cache is intentionally global.

-- ─── courses table (D-02) ────────────────────────────────────────────────────
-- Per-user course history. Full JSONB blob + metadata.

CREATE TABLE IF NOT EXISTS courses (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT         NOT NULL,
  topic       TEXT         NOT NULL,
  skill_level TEXT         NOT NULL,
  course      JSONB        NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Required index for per-user history queries (Plan 02: getCourseHistory).
CREATE INDEX IF NOT EXISTS courses_user_id_created_at_idx
  ON courses (user_id, created_at DESC);

-- ─── RLS for courses (defense-in-depth) ──────────────────────────────────────
-- Server uses service-role key which bypasses RLS. These policies are
-- defensive — they only engage if an anon/authenticated key is ever used.

ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_courses_select" ON courses;
CREATE POLICY "users_own_courses_select"
  ON courses FOR SELECT
  USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "users_own_courses_insert" ON courses;
CREATE POLICY "users_own_courses_insert"
  ON courses FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);
