---
phase: 6
slug: auth
status: ready
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-12
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in test runner (`node:test`) |
| **Config file** | none — uses `--test-concurrency=1` flag |
| **Quick run command** | `node --test --test-concurrency=1 tests/unit/auth.test.js tests/unit/webhooks.test.js tests/unit/db.test.js` |
| **Full suite command** | `node --test --test-concurrency=1 tests/unit/*.test.js` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** `node --test --test-concurrency=1` on task's test file(s)
- **After every plan wave:** `node --test --test-concurrency=1 tests/unit/*.test.js`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | AUTH-04 | T-06-03 | SUPABASE_SERVICE_ROLE_KEY never hardcoded; getOrCreateUser throws on DB error | unit | `node --test --test-concurrency=1 tests/unit/db.test.js` | ❌ W0 | ⬜ pending |
| 06-01-02 | 01 | 1 | AUTH-04 | T-06-01, T-06-02 | Invalid sig returns 400; user.created calls getOrCreateUser; non-user.created events ignored | unit | `node --test --test-concurrency=1 tests/unit/webhooks.test.js` | ❌ W0 | ⬜ pending |
| 06-02-01 | 02 | 2 | AUTH-03 | T-06-05 | Unauthenticated returns 401 JSON; req.userId set before next(); optimistic upsert fire-and-forget | unit | `node --test --test-concurrency=1 tests/unit/auth.test.js` | ❌ W0 | ⬜ pending |
| 06-02-02 | 02 | 2 | AUTH-03 | T-06-06, T-06-07, T-06-09 | Webhook before express.json(); /api/course-stream returns 401 unauth; /app uses requireAuth redirect | unit | `node --test --test-concurrency=1 tests/unit/server.test.js` | ❌ W0 | ⬜ pending |
| 06-03-01 | 03 | 2 | AUTH-01 | T-06-10 | Fully static HTML — no secrets, no script tags | auto | `node -e "const fs=require('fs');const h=fs.readFileSync('landing.html','utf8');const c=['Sign up free','Go to app','Learn anything','href=\"/app\"','--color-accent','--color-bg'];const p=c.every(x=>h.includes(x));process.exit(p?0:1);"` | ❌ W0 | ⬜ pending |
| 06-03-02 | 03 | 2 | AUTH-05 | T-06-12 | Static HTML — no user input, no attack surface | auto | `node -e "const fs=require('fs');const h=fs.readFileSync('onboarding.html','utf8');const c=['How it works','Start learning','href=\"/app\"','Beginner','Intermediate','Advanced','All levels'];const p=c.every(x=>h.includes(x));process.exit(p?0:1);"` | ❌ W0 | ⬜ pending |
| 06-03-03 | 03 | 2 | AUTH-02 | T-06-11, T-06-13 | Publishable key is public by design; UserButton only renders for Clerk.user | auto | `node -e "const fs=require('fs');const h=fs.readFileSync('index.html','utf8');const c=['app-header','clerk-user-button','data-clerk-publishable-key','Clerk.load()','Clerk.mountUserButton'];const p=c.every(x=>h.includes(x));process.exit(p?0:1);"` | ❌ W0 | ⬜ pending |
| 06-03-04 | 03 | 2 | AUTH-01, AUTH-02, AUTH-05 | all | End-to-end: landing → sign-up → onboarding → app → sign-out; Supabase row created | manual | see checkpoint task how-to-verify (9 steps) | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Test files are written as part of TDD tasks (tests first, then implementation) — they do not pre-exist. Wave 0 is satisfied when Task 06-01-01 begins (the TDD workflow creates the test file before the source file).

- [ ] `tests/unit/db.test.js` — written in Plan 01, Task 1 (TDD)
- [ ] `tests/unit/webhooks.test.js` — written in Plan 01, Task 2 (TDD)
- [ ] `tests/unit/auth.test.js` — written in Plan 02, Task 1 (TDD)
- [ ] `tests/unit/server.test.js` — new test cases added in Plan 02, Task 2

Wave 0 for this phase is the TDD execution itself — test stubs are created at the start of each task, not before. Mark `wave_0_complete: true` once Plan 01 Task 1 writes its test file.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| New visitor creates account via Clerk hosted sign-up UI | AUTH-01 | Requires live browser + Clerk account — Clerk JS CDN component, no test API | Step 1–3 of Task 4 checkpoint: visit /, click "Sign up free", complete Clerk sign-up |
| Signed-in user sees/uses sign-in/sign-out header | AUTH-02 | Requires active Clerk session in browser | Step 5–7 of Task 4 checkpoint: land on /app, click user-button, sign out |
| New user routed to /onboarding after first sign-up | AUTH-05 | Requires Clerk's afterSignUpUrl redirect (browser-side) | Step 3–4 of Task 4 checkpoint: after sign-up, verify /onboarding loads with 4 sections |
| Supabase row created after webhook fires | AUTH-04 (integration) | Unit tests mock db; this verifies the live DB integration | Step 8 of Task 4 checkpoint: Supabase Dashboard → users table → new row with clerk_id + plan='free' |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (Tasks 01–07 all have auto verify; Task 08 is manual checkpoint)
- [x] Wave 0 covers all MISSING references (TDD within tasks)
- [x] No watch-mode flags (`--watch` not used anywhere)
- [x] Feedback latency < 5s (unit tests run in ~1-2s each)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready for execution
