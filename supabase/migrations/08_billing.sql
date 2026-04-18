-- Phase 8: Billing — add usage tracking columns and atomic increment function
-- Safe to run multiple times (CREATE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS, CREATE OR REPLACE FUNCTION).

-- Create users table if it doesn't already exist (idempotent — safe if Phase 6 created it manually).
CREATE TABLE IF NOT EXISTS users (
  clerk_id   TEXT        PRIMARY KEY,
  email      TEXT,
  plan       TEXT        NOT NULL DEFAULT 'free',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS generation_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS period_start TIMESTAMPTZ NOT NULL DEFAULT now();

-- Atomic increment function — called via supabase.rpc('increment_generation_count', { p_clerk_id })
-- Uses a single SQL UPDATE statement; Postgres atomicity prevents double-counting on concurrent requests.
CREATE OR REPLACE FUNCTION increment_generation_count(p_clerk_id TEXT)
RETURNS VOID AS $$
  UPDATE users
  SET generation_count = generation_count + 1
  WHERE clerk_id = p_clerk_id;
$$ LANGUAGE sql VOLATILE;
