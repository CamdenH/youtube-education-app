---
phase: 4
slug: frontend-persistence-export
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-09
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node built-in test runner (`node --test`) |
| **Config file** | none — Wave 0 creates `frontend.test.js` |
| **Quick run command** | `node --test frontend.test.js` |
| **Full suite command** | `node --test --test-concurrency=1` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test frontend.test.js`
- **After every plan wave:** Run `node --test --test-concurrency=1`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 4-01-01 | 01 | 0 | FRNT-01 | — | N/A | unit | `node --test frontend.test.js` | ❌ W0 | ⬜ pending |
| 4-01-02 | 01 | 1 | FRNT-01,02 | — | N/A | manual | visual check: skill-level select renders | ✅ | ⬜ pending |
| 4-01-03 | 01 | 1 | FRNT-03 | — | N/A | unit | `node --test frontend.test.js` | ❌ W0 | ⬜ pending |
| 4-01-04 | 01 | 2 | FRNT-04,05 | — | N/A | manual | visual check: collapsible cards render | ✅ | ⬜ pending |
| 4-01-05 | 01 | 2 | FRNT-06 | — | score badge color fn | unit | `node --test frontend.test.js` | ❌ W0 | ⬜ pending |
| 4-01-06 | 01 | 2 | FRNT-07 | — | N/A | manual | visual check: questions hidden by default | ✅ | ⬜ pending |
| 4-01-07 | 01 | 2 | FRNT-08 | — | N/A | manual | visual check: outdated warning renders | ✅ | ⬜ pending |
| 4-01-08 | 01 | 3 | PERS-01,02 | — | localStorage XSS safe | unit | `node --test frontend.test.js` | ❌ W0 | ⬜ pending |
| 4-01-09 | 01 | 3 | PERS-03 | — | N/A | unit | `node --test frontend.test.js` | ❌ W0 | ⬜ pending |
| 4-01-10 | 01 | 4 | EXPO-01 | — | no user answers in export | unit | `node --test frontend.test.js` | ❌ W0 | ⬜ pending |
| 4-01-11 | 01 | 4 | FRNT-09,10 | — | N/A | manual | 375px viewport + dark mode check | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `frontend.test.js` — unit tests for: `slugify`, `buildMarkdown`, `formatDuration`, `scoreBadgeColor`, localStorage eviction (LRU cap at 10), recent searches deduplication, watched state read/write, `buildMarkdown` excludes user answers

*Existing infrastructure (`node --test`) covers all phase requirements — no new framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Pipeline steps animate in real time | FRNT-03 | SSE streaming visual — not automatable in unit tests | Open app, search a topic, observe labeled step badges appearing sequentially |
| Collapsible module cards | FRNT-05 | DOM interaction — `<details>` toggle | Click module header, verify content hides/shows |
| Comprehension questions hidden by default | FRNT-07 | DOM initial state | Load course, verify no textarea visible before clicking question |
| Outdated video warning renders | FRNT-08 | Requires video with `publishedAt > 2 years` | Search "python 2.7" or similar, verify warning badge appears |
| 375px viewport usable | FRNT-09 | Visual/layout check | DevTools responsive mode at 375px, verify no overflow |
| Dark mode renders correctly | FRNT-10 | Visual check | OS/browser dark mode enabled, verify colors use CSS vars |
| History restores exact saved course | PERS-03 | Full round-trip interaction | Generate course, reload page, click history item, verify course matches |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
