# Phase 8: Billing - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-18
**Phase:** 08-billing
**Areas discussed:** Tier limits, Usage tracking, Gate enforcement, Webhook events

---

## Tier Limits

| Option | Description | Selected |
|--------|-------------|----------|
| 3/month | Enough to try seriously without giving it away | |
| 1/month | Very tight — strong upgrade pressure | ✓ |
| 5/month | More generous — good for early growth | |

**User's choice:** 1 generation/month on free tier.

| Option | Description | Selected |
|--------|-------------|----------|
| Unlimited generations | No cap for paid tier | |
| 20/month | High cap, still metered | ✓ |
| You decide the cap | Leave limits to Claude | |

**User's choice:** Early access tier gets 20 generations/month at $10/month.

**Clarification from user:** Only two tiers for now — `free` and `early_access`. Higher tiers (pro, power) deferred to production.

| Option | Description | Selected |
|--------|-------------|----------|
| early_access | Matches marketing name, snake_case for code | ✓ |
| pro | Generic tier name | |
| I'll set in Clerk Dashboard | Configure slug externally | |

**User's choice:** Clerk Billing plan slug: `early_access`.

---

## Usage Tracking

| Option | Description | Selected |
|--------|-------------|----------|
| Supabase counter | Columns on users table, reset monthly | ✓ |
| Clerk Billing metered usage | Report usage to Clerk API | |
| Count from courses table | Query courses rows per month | |

**User's choice:** Supabase counter.

| Option | Description | Selected |
|--------|-------------|----------|
| Column on users table | generation_count + period_start on users | ✓ |
| Separate usage table | usage_counters table per month | |
| You decide | Leave schema to Claude | |

**User's choice:** Add `generation_count` and `period_start` columns to existing `users` table.

---

## Gate Enforcement

| Option | Description | Selected |
|--------|-------------|----------|
| Route handler, before stream starts | 429 before SSE begins | ✓ |
| New requirePlan() middleware | Reusable middleware | |
| Inside courseStreamHandler | SSE error event | |

**User's choice:** Gate check at the top of the POST /api/course route handler, returns HTTP 429.

| Option | Description | Selected |
|--------|-------------|----------|
| Inline message with upgrade CTA | Error area below form with upgrade link | ✓ |
| Modal dialog | Popup with upgrade link | |
| Redirect to pricing page | Navigate away | |

**User's choice:** Inline message in existing error area.

| Option | Description | Selected |
|--------|-------------|----------|
| Clerk's hosted billing portal | Zero custom UI needed | ✓ |
| /pricing page in the app | Custom page (Phase 9) | |
| You decide | Leave URL to Claude | |

**User's choice:** Upgrade link points to Clerk's hosted billing portal.

---

## Webhook Events

| Option | Description | Selected |
|--------|-------------|----------|
| subscription.created + deleted | Subscribe → early_access; cancel → free | ✓ |
| created + updated + deleted | Also handle plan changes | |
| You decide | Leave event selection to Claude | |

**User's choice:** Handle `subscription.created` and `subscription.deleted` only.

| Option | Description | Selected |
|--------|-------------|----------|
| Upsert by subscription ID | Plain upsert, naturally idempotent | ✓ |
| Idempotency key table | Separate table for processed event IDs | |
| Accept duplicates (last-write-wins) | Plain UPDATE | |

**User's choice:** Plain Supabase UPDATE — naturally idempotent since same event writes same plan value.

---

## Claude's Discretion

- Exact Clerk billing portal URL / env var pattern
- SQL migration for new `generation_count` and `period_start` columns
- Atomic counter increment implementation (DB-level preferred)
- Exact error message copy for 429 response and frontend inline message

## Deferred Ideas

- Pro and power tiers — deferred to production
- Custom /pricing page — Phase 9
- Per-month usage history table — not needed for MVP
- Clerk metered billing API — not needed (Supabase counter chosen)
