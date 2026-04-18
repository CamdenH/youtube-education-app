---
phase: 08-billing
plan: 02
subsystem: database
tags: [supabase, billing, usage-gate, clerk-billing, node-test, tdd]

# Dependency graph
requires:
  - phase: 08-billing
    plan: 01
    provides: users table with generation_count + period_start columns, increment_generation_count RPC, RED test stubs (Tests 15-23)
provides:
  - db.js checkUsage — reads plan/generation_count/period_start, resets if >30 days, returns { allowed, limit, count }
  - db.js incrementGenerationCount — atomic RPC increment via supabase.rpc('increment_generation_count', { p_clerk_id })
  - db.js updateUserPlan — plain UPDATE users.plan by clerk_id (idempotent)
affects: [08-03-server-gate, 08-04-webhooks]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Period reset: application-level two-query pattern (select then update) — acceptable at launch scale (T-8-02-03)"
    - "RPC call pattern: supabase.rpc('increment_generation_count', { p_clerk_id: clerkId }) for atomic counter"
    - "Limit map: plan === 'early_access' ? 20 : 1 — defaults unknown plans to free tier (safe fallback)"
    - "Error message prefix [db] <functionName> failed: <message> — consistent with all other db.js functions"

key-files:
  created: []
  modified:
    - db.js

# Key decisions
decisions:
  - "period_start=0 fallback: if period_start is null/undefined, treat as epoch 0 — always triggers reset on first use"
  - "generation_count||0 fallback: if column is null, treat as 0 — avoids NaN in comparison"
  - "module.exports expanded to multi-line object format for readability"

# Metrics
duration: ~10min
completed: 2026-04-18
---

# Phase 8 Plan 02: Billing db.js Functions Summary

**One-liner:** Three Supabase billing functions — checkUsage (30-day reset), incrementGenerationCount (RPC), updateUserPlan (idempotent UPDATE) — turning Tests 15-23 GREEN.

## What Was Built

Three new async functions added to `db.js`, extending the existing Supabase client module:

**`checkUsage(clerkId)`**
- Selects `plan, generation_count, period_start` from `users` table by `clerk_id`
- Computes limit: 20 for `early_access`, 1 for all other plans (including unknown/null)
- If `now - period_start > 30 days`: resets `generation_count=0` and `period_start=now()` before comparing
- Returns `{ allowed: boolean, limit: number, count: number }`
- Throws `[db] checkUsage failed: <message>` on select error

**`incrementGenerationCount(clerkId)`**
- Calls `supabase.rpc('increment_generation_count', { p_clerk_id: clerkId })` — delegates increment to Postgres-side atomic function (D-07)
- Throws `[db] incrementGenerationCount failed: <message>` on RPC error

**`updateUserPlan(clerkId, plan)`**
- Calls `supabase.from('users').update({ plan }).eq('clerk_id', clerkId)`
- Plain UPDATE — naturally idempotent for duplicate Clerk Billing webhook events (D-13)
- Throws `[db] updateUserPlan failed: <message>` on error

## Test Results

| Scope | Before | After |
|-------|--------|-------|
| Tests 15-23 (billing db functions) | 0/9 passing (RED) | 9/9 passing (GREEN) |
| Tests 1-14 (existing db functions) | 14/14 passing | 14/14 passing |
| Full db.test.js | 14/23 passing | 23/23 passing |
| Full npm test suite | 162 passing, 16 failing | 176 passing, 7 failing |

The remaining 7 failures are pre-existing RED stubs for Plans 03 (server.js gate) and 04 (webhooks.js billing events) — not regressions.

## Commits

| Hash | Message |
|------|---------|
| cc12e1f | feat(08-02): implement checkUsage in db.js |
| a40730d | feat(08-02): implement incrementGenerationCount and updateUserPlan in db.js |

## Deviations from Plan

None — plan executed exactly as written. Both tasks implemented the exact code specified in the plan actions with no modifications needed.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. All three functions operate on the existing `users` table using the service-role client already initialized. Security notes per threat model:

| Threat ID | Status |
|-----------|--------|
| T-8-02-01 (checkUsage clerkId source) | Enforced at call site in server.js (Plan 03) |
| T-8-02-02 (updateUserPlan clerkId source) | Enforced at call site in webhooks.js (Plan 04) |
| T-8-02-03 (non-atomic period reset) | Accepted — two concurrent resets both produce correct state |
| T-8-02-04 (RPC blast radius) | Accepted — increment-only RPC |

## Self-Check: PASSED

- db.js: FOUND
- Commit cc12e1f (checkUsage): FOUND
- Commit a40730d (incrementGenerationCount + updateUserPlan): FOUND
- All 23 db.test.js tests: GREEN
- Exports verified: checkUsage, incrementGenerationCount, updateUserPlan all typeof === 'function'
