---
phase: 1
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | none — Wave 0 installs (manual curl/node smoke tests) |
| **Config file** | none — Wave 0 installs |
| **Quick run command** | `node -e "require('./server.js')" && echo OK` |
| **Full suite command** | `node scripts/smoke-test.js` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node -e "require('./server.js')" && echo OK`
- **After every plan wave:** Run `node scripts/smoke-test.js`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | INFR-01 | smoke | `node server.js &; sleep 2; curl -s http://localhost:3000 | grep -q html && echo OK` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 1 | INFR-02 | smoke | `curl -s -N http://localhost:3000/api/course-stream | head -5 | grep -q event` | ❌ W0 | ⬜ pending |
| 1-02-01 | 02 | 1 | INFR-03 | unit | `node -e "const c=require('./cache'); c.set('k','v'); console.assert(c.get('k')==='v')"` | ❌ W0 | ⬜ pending |
| 1-02-02 | 02 | 1 | INFR-04 | smoke | `node -e "require('./youtube').search('node.js tutorial').then(r=>console.assert(r.length>0))"` | ❌ W0 | ⬜ pending |
| 1-02-03 | 02 | 1 | PIPE-05 | unit | `node -e "/* run same query twice, verify cache hit */"` | ❌ W0 | ⬜ pending |
| 1-03-01 | 03 | 2 | INFR-05 | smoke | `curl -s http://localhost:3000/api/transcript/dQw4w9WgXcQ | grep -v '"error"'` | ❌ W0 | ⬜ pending |
| 1-03-02 | 03 | 2 | INFR-06 | smoke | `node -e "/* force quota error, verify SSE event contains readable message */"` | manual | manual | ⬜ pending |
| 1-04-01 | 04 | 2 | PIPE-03 | smoke | `curl -s -N http://localhost:3000/api/course-stream?q=test | grep -q 'event: progress'` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/smoke-test.js` — end-to-end smoke test runner for all SSE + cache + transcript endpoints
- [ ] `scripts/check-server.sh` — quick server health check (start, hit root, kill)

*Wave 0 creates the smoke test scaffold before implementation tasks run.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| YouTube quota error → readable SSE event | INFR-06 | Cannot reliably trigger quota exhaustion in CI | Temporarily set API key to invalid value; start server; POST course request; verify SSE stream contains `event: error` with human-readable message |
| Transcript POT token fallback | INFR-05 | Requires live video with known token requirement | Test against 3 educational videos; verify transcript returns or falls back gracefully without 403 crash |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
