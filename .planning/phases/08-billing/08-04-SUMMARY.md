---
phase: "08-billing"
plan: "04"
subsystem: "webhooks"
tags: ["billing", "webhooks", "clerk", "supabase", "subscription"]
dependency_graph:
  requires:
    - "08-02"  # updateUserPlan function in db.js
    - "08-03"  # usage gate in server.js (establishes users.plan as source of truth)
  provides:
    - "webhooks.js subscriptionItem handlers — keeps users.plan in sync with Clerk Billing"
  affects:
    - "webhooks.js"
tech_stack:
  added: []
  patterns:
    - "Clerk webhook payload extraction with camelCase/snake_case defensive fallback"
    - "plan.slug guard prevents free-plan subscriptionItem.ended from triggering downgrade"
    - "Idempotent UPDATE — duplicate webhook deliveries write the same value safely"
key_files:
  created: []
  modified:
    - "webhooks.js"
decisions:
  - "subscriptionItem.canceled is intentionally NOT handled — user retains access until subscriptionItem.ended fires"
  - "Double payerId extraction (payerId ?? payer_id) defends against Clerk serialization differences"
  - "Non-early_access slug events are silent no-ops in both active and ended handlers"
metrics:
  duration_minutes: 5
  completed_date: "2026-04-18"
  tasks_completed: 1
  files_modified: 1
---

# Phase 8 Plan 04: Billing Webhook Handlers Summary

**One-liner:** Added `subscriptionItem.active` and `subscriptionItem.ended` handlers to `webhooks.js` that keep `users.plan` in sync with Clerk Billing using `updateUserPlan`, guarded by plan slug and payerId checks.

## What Was Built

Two new event handlers added to `clerkWebhookHandler` in `webhooks.js`:

**`subscriptionItem.active` handler:**
- Extracts `payerId` from `evt.data.payerId ?? evt.data.payer_id` (defensive fallback)
- Guards: if `payerId` is missing, logs warning and returns 200 without DB write
- Guards: only acts when `evt.data.plan.slug === 'early_access'`
- Calls `updateUserPlan(payerId, 'early_access')` on match
- Returns 500 on DB failure (Clerk will retry — retries are idempotent)

**`subscriptionItem.ended` handler:**
- Same payerId extraction and missing-payerId guard
- Critical guard: only calls `updateUserPlan(payerId, 'free')` when slug is `'early_access'`
- The free plan also generates `subscriptionItem.ended` at period boundaries — this guard prevents that event from incorrectly downgrading paid users
- Returns 500 on DB failure

`updateUserPlan` added to the `require('./db')` destructure.

## Verification Results

```
node --test --test-concurrency=1 tests/unit/webhooks.test.js
# tests 12
# pass 12
# fail 0

npm test (full suite)
# tests 183
# pass 183
# fail 0
```

## Deviations from Plan

None — plan executed exactly as written.

## Threat Flags

None. All security-relevant surface was covered by the plan's threat model:
- `verifyWebhook()` HMAC-SHA256 signature validation already in place (T-8-04-01)
- Free-plan guard prevents downgrade on `subscriptionItem.ended` for non-early_access slugs (T-8-04-02)
- `subscriptionItem.canceled` intentionally absent — no false downgrade path (T-8-04-05)

## Known Stubs

None.

## Self-Check: PASSED

- `webhooks.js` exists and contains both handlers: FOUND
- Commit `3adb2ba` exists: FOUND
- Tests 1–12 GREEN: VERIFIED
- Full suite 183 passing: VERIFIED
- `subscriptionItem.canceled` not handled: CONFIRMED
