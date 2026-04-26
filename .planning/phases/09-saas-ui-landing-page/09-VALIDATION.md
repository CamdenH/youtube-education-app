---
phase: 9
slug: saas-ui-landing-page
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-26
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in test runner |
| **Config file** | package.json `"test"` script |
| **Quick run command** | `node --test --test-concurrency=1 tests/unit/server.test.js` |
| **Full suite command** | `node --test --test-concurrency=1 tests/unit/*.test.js` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test --test-concurrency=1 tests/unit/server.test.js`
- **After every plan wave:** Run `node --test --test-concurrency=1 tests/unit/*.test.js`
- **Before `/gsd-verify-work`:** Full suite must be green (183+ tests passing)
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 9-01-01 | 01 | 0 | D-03 | — | GET /onboarding unauthenticated → 302 to / | integration | `node --test --test-concurrency=1 tests/unit/server.test.js` | ❌ W0 | ⬜ pending |
| 9-01-02 | 01 | 0 | D-10 | — | GET /onboarding authenticated → 200 | integration | `node --test --test-concurrency=1 tests/unit/server.test.js` | ❌ W0 | ⬜ pending |
| 9-01-03 | 01 | 0 | D-01/D-12 | — | GET /pricing returns 200 with HTML | integration | `node --test --test-concurrency=1 tests/unit/server.test.js` | ❌ W0 | ⬜ pending |
| 9-02-01 | 02 | 1 | D-01 | — | GET / returns 200 (landing.html) | integration | `node --test --test-concurrency=1 tests/unit/server.test.js` | ✅ (accepts 200 or 404) | ⬜ pending |
| 9-03-01 | 03 | 1 | D-11 | — | pricing.html content: Free + Early Access cards | manual | open browser, inspect pricing grid | manual-only | ⬜ pending |
| 9-04-01 | 04 | 2 | D-08/D-09 | — | onboarding.html welcome + tier notice | manual | open browser, inspect onboarding content | manual-only | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/server.test.js` — add 3 new tests:
  - `GET /pricing returns 200 and HTML content` (asserts status 200, Content-Type text/html)
  - `GET /onboarding unauthenticated returns 302 to /` (mock `_clerkGetAuthImpl` → `{userId: null}`)
  - `GET /onboarding authenticated returns 200` (mock `_clerkGetAuthImpl` → `{userId: 'user_test123'}`)

These three tests follow the exact mock pattern already established in server.test.js (lines 104–134 and 151–178). No new mock infrastructure needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| landing.html nav has "Pricing" + "Sign up free" links | D-07, UI-SPEC | DOM testing not in project | Open browser → GET / → inspect nav links |
| landing.html How it works section has 3 numbered steps | D-05, UI-SPEC | DOM testing not in project | Open browser → GET / → verify 3-step section |
| landing.html sample preview shows ML course mockup | D-05, UI-SPEC | DOM testing not in project | Open browser → GET / → verify sample preview card |
| pricing.html CTA swap when authed | UI-SPEC Pitfall 2 | Requires live Clerk session in browser | Sign in → visit /pricing → inspect "Upgrade now" href |
| onboarding.html welcome bullets + tier notice | D-08, D-09, UI-SPEC | DOM testing not in project | Open browser → GET /onboarding (authed) → verify content |
| pricing.html responsive grid stacks at ≤480px | UI-SPEC Layout | Requires browser resize | Open browser → GET /pricing → resize to ≤480px → verify 1-column layout |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
