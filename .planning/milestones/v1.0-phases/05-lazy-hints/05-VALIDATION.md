---
phase: 5
slug: lazy-hints
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-10
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in test runner (`node --test`) |
| **Config file** | none — existing runner in package.json |
| **Quick run command** | `node --test --test-concurrency=1 server.test.js` |
| **Full suite command** | `node --test --test-concurrency=1` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test --test-concurrency=1 server.test.js`
- **After every plan wave:** Run `node --test --test-concurrency=1`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | HINT-01 | — | N/A | unit | `node --test --test-concurrency=1 server.test.js` | ✅ | ⬜ pending |
| 05-01-02 | 01 | 1 | HINT-01 | — | Input validation: videoId/question sanitized | unit | `node --test --test-concurrency=1 server.test.js` | ✅ | ⬜ pending |
| 05-01-03 | 01 | 2 | HINT-02 | — | N/A | unit | `node --test --test-concurrency=1 server.test.js` | ✅ | ⬜ pending |
| 05-01-04 | 01 | 2 | HINT-03 | — | N/A | integration | `node --test --test-concurrency=1 frontend.test.js` | ✅ | ⬜ pending |
| 05-01-05 | 01 | 3 | HINT-03 | — | N/A | integration | `node --test --test-concurrency=1 frontend.test.js` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- Existing infrastructure covers all phase requirements — no new test framework needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Loading state only on clicked video | HINT-01 | DOM state isolation requires browser interaction | Click "Reveal thinking points" on video 2 while video 1 is untouched — only video 2 should show spinner |
| Hints are directional, not answers | HINT-02 | Content quality judgment | Review returned hints — they should point toward the answer without stating it |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
