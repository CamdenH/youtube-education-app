---
phase: 06-auth
plan: "01"
subsystem: backend
tags: [auth, database, webhooks, supabase, clerk]
dependency_graph:
  requires: []
  provides: [db.js, webhooks.js]
  affects: [server.js, auth.js]
tech_stack:
  added: ["@supabase/supabase-js@^2.103.0", "@clerk/express@^2.1.0", "svix@^1.90.0"]
  patterns: ["CommonJS module.exports", "TDD red-green", "Supabase service-role upsert", "Clerk webhook signature verification via svix"]
key_files:
  created:
    - db.js
    - webhooks.js
    - tests/unit/db.test.js
    - tests/unit/webhooks.test.js
  modified:
    - package.json
    - package-lock.json
decisions:
  - "Used require cache injection for mocking @supabase/supabase-js and @clerk/express/webhooks in unit tests — no external mock library needed"
  - "verifyWebhook from @clerk/express/webhooks wraps svix internally; webhooks.js does not call svix directly"
  - "Returns 500 (not 200) on DB write failure so Clerk retries the webhook automatically"
metrics:
  duration_minutes: 15
  completed_date: "2026-04-12"
  tasks_completed: 2
  tasks_total: 2
  files_created: 4
  files_modified: 2
  tests_added: 10
  tests_passing: 10
---

# Phase 6 Plan 1: Supabase data layer and Clerk webhook handler Summary

**One-liner:** Supabase service-role client with idempotent user upsert plus Clerk webhook handler with svix signature verification, fully unit-tested via require-cache mock injection.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Create db.js — Supabase client and user query functions | dca2891 | db.js, tests/unit/db.test.js |
| 2 | Create webhooks.js — Clerk webhook handler | bf5a25e | webhooks.js, tests/unit/webhooks.test.js |

## What Was Built

### db.js

Supabase service-role client initialized at module load with `persistSession: false`, `autoRefreshToken: false`, `detectSessionInUrl: false` — appropriate for server-side only use. Exports:

- `supabase` — the raw client for downstream use
- `getOrCreateUser(clerkId, email)` — upserts with `onConflict: 'clerk_id', ignoreDuplicates: true`; omits email key entirely when null
- `getUserPlan(clerkId)` — queries single row by clerk_id, returns plan string

### webhooks.js

Express handler that:
1. Calls `verifyWebhook(req)` from `@clerk/express/webhooks` (wraps svix HMAC-SHA256)
2. Returns 400 on signature failure (rejects spoofed/tampered payloads — T-06-01, T-06-02)
3. On `user.created` event: extracts clerkId and email (nullable via `?. ?? null`) and calls `getOrCreateUser`
4. Returns 500 on DB write failure so Clerk retries delivery
5. Returns 200 for all other event types without calling DB

## Test Coverage

10 unit tests across 2 files — all passing:

- db.test.js (5 tests): upsert args, null email omission, error propagation for both functions
- webhooks.test.js (5 tests): 400 on bad signature, 200+getOrCreateUser call on user.created, 200 no-op on other events, 500 on DB failure, null email when empty array

## Deviations from Plan

None — plan executed exactly as written.

## Threat Coverage

| Threat ID | Status |
|-----------|--------|
| T-06-01 | Mitigated — verifyWebhook validates HMAC-SHA256 before any data is consumed |
| T-06-02 | Mitigated — raw body required by verifyWebhook; JSON parsing happens after verification |
| T-06-03 | Mitigated — SUPABASE_SERVICE_ROLE_KEY loaded from env var only, never hardcoded |
| T-06-04 | Accepted — ignoreDuplicates: true prevents duplicate rows from concurrent upserts |

## Known Stubs

None — both modules are fully wired. webhooks.js requires the CLERK_WEBHOOK_SIGNING_SECRET env var at runtime (set in Clerk Dashboard). No placeholder values.

## Self-Check: PASSED

- db.js exists: FOUND
- webhooks.js exists: FOUND
- tests/unit/db.test.js exists: FOUND
- tests/unit/webhooks.test.js exists: FOUND
- Commit dca2891: FOUND
- Commit bf5a25e: FOUND
- All 10 tests passing: CONFIRMED
