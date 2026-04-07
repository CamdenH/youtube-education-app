---
phase: 2
slug: scoring-query-generation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-06
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in `node:test` (v22.22.0) |
| **Config file** | None — invoked via npm test script |
| **Quick run command** | `node --test --test-concurrency=1 tests/unit/scorer.test.js tests/unit/queries.test.js` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test --test-concurrency=1 tests/unit/scorer.test.js tests/unit/queries.test.js`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 0 | PIPE-02 | — | N/A | unit | `node --test --test-concurrency=1 tests/unit/queries.test.js` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 0 | SCOR-01, SCOR-02, SCOR-03, SCOR-04, SCOR-05 | — | N/A | unit | `node --test --test-concurrency=1 tests/unit/scorer.test.js` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 1 | PIPE-02 | T-02-01 | subject/skill_level validated before use in prompts | unit | `node --test --test-concurrency=1 tests/unit/queries.test.js` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 1 | SCOR-01, SCOR-02 | — | N/A | unit | `node --test --test-concurrency=1 tests/unit/scorer.test.js` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 1 | SCOR-03, SCOR-04 | — | N/A | unit | `node --test --test-concurrency=1 tests/unit/scorer.test.js` | ❌ W0 | ⬜ pending |
| 02-03-02 | 03 | 1 | SCOR-05 | — | N/A | unit | `node --test --test-concurrency=1 tests/unit/scorer.test.js` | ❌ W0 | ⬜ pending |
| 02-04-01 | 04 | 2 | PIPE-01 | T-02-01 | subject/skill_level validated before pipeline | integration | `node --test --test-concurrency=1 tests/unit/server.test.js` | ✅ extend | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/queries.test.js` — stubs covering PIPE-02 (query count 6–8, beginner vs advanced differ)
- [ ] `tests/unit/scorer.test.js` — stubs covering SCOR-01 (0–100 range), SCOR-02 (weight differentiation by level), SCOR-03 (credibility prompt anchors), SCOR-04 (single Claude call per batch), SCOR-05 (description score in [0,10])

*Existing `tests/unit/server.test.js` covers PIPE-01 integration — extend, don't create.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Scores span meaningful distribution against cached data | SCOR-01 | Requires real cached YouTube data | Run `node server.js`, search a real topic, inspect SSE output for score spread |
| Skill-level query differences are semantically meaningful | PIPE-02 | Semantic judgment required | Compare generated queries for "beginner" vs "advanced" same subject |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
