# Phase 2: Scoring + Query Generation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-06
**Phase:** 02-scoring-query-generation
**Areas discussed:** Scoring weights by skill level, Duration scoring curve, Query generation strategy, Channel credibility calibration

---

## Scoring Weights by Skill Level

| Option | Description | Selected |
|--------|-------------|----------|
| Recency shrinks, depth grows | Beginners need current tutorials; advanced want rigorous lectures. Recency drops ~15→5pts; credibility absorbs the difference. | ✓ |
| Like ratio stays constant, everything else shifts | Engagement signal is skill-neutral; all adjustment across other 4 components. | |
| Skill level multiplies the whole formula | Level-specific multiplier set applied to all 5 components simultaneously. | |

**User's choice:** Recency shrinks, depth grows
**Notes:** Beginner ~15pts recency, Advanced ~5pts recency; freed points to credibility.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Balanced / intermediate weights | Use intermediate weight profile — neutral mix for unspecified level. | ✓ |
| Average of all four levels | Mathematical average of beginner, intermediate, advanced, all. | |
| Same as intermediate | "All levels" and "intermediate" use identical weights. | |

**User's choice:** Balanced / intermediate weights
**Notes:** "All levels" = intermediate profile.

---

| Option | Description | Selected |
|--------|-------------|----------|
| No — description quality stays flat across levels | General signal of content care; equally relevant at any level. Fixed 10pts cap. | ✓ |
| Yes — description quality is beginner-friendly signal | Boost for beginners who rely on clear written explanations; reduce for advanced. | |
| You decide | Claude's discretion on this detail. | |

**User's choice:** No — description quality stays flat
**Notes:** Fixed 10pts cap across all levels.

---

## Duration Scoring Curve

| Option | Description | Selected |
|--------|-------------|----------|
| Soft falloff outside range | 3–8min or 45–60min get partial credit (~10pts). Under 3min or over 60min = 0. | ✓ |
| Hard cutoff at range edges | Below 8min = 0, above 45min = 0. Strict sweet-spot only. | |
| Linear falloff from peak | Full 20pts at ~20–25min midpoint, linearly declining. No hard cutoff. | |

**User's choice:** Soft falloff outside range

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — extend upper limit for advanced | Advanced: 8–60min ideal range. Beginner/Intermediate: 8–45min. | ✓ |
| No — same 8–45min for all levels | Duration range fixed regardless of skill level. | |

**User's choice:** Yes — extend upper limit for advanced
**Notes:** Advanced learners tolerate full university-length lectures.

---

## Query Generation Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Angle diversity: concept + tutorial + application | Queries cover different angles: conceptual, tutorial, application, mistakes, deep-dive. | ✓ |
| Depth progression: overview → intermediate → advanced | Queries deliberately escalate in specificity. | |
| Subtopic coverage: break subject into components | 1 query per sub-area of the subject. | |

**User's choice:** Angle diversity

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — prompt includes diversity instruction | Ensure each query is meaningfully different (angle, format, intent). | ✓ |
| No — rely on YouTube's own dedup | YouTube search naturally returns varied results. | |

**User's choice:** Yes — include diversity instruction

---

| Option | Description | Selected |
|--------|-------------|----------|
| Plain list of strings only | JSON array of query strings. Simpler to parse. | ✓ |
| Structured: query + angle label | Each query with { query, angle, level } metadata object. | |
| You decide | Claude's discretion on response format. | |

**User's choice:** Plain list of strings only

---

## Channel Credibility Calibration

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — merit-based, indie can reach max | Top score achievable by any channel with depth/rigor. Institutional affiliation is a signal, not a requirement. | ✓ |
| Institutional channels have a ceiling advantage | Universities start from higher floor; indie can match but need more depth. | |
| Strict institutional bias | University/org channels only reach 18–20/20. Indie cap at 14–15. | |

**User's choice:** Merit-based, indie can reach max
**Notes:** 3Blue1Brown / Fireship can reach 20/20.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Include calibration examples | 3–4 anchor examples spanning the range (MIT OCW, 3Blue1Brown, mid-tier, low). | ✓ |
| Criteria only, no examples | Describe signals without anchoring to specific channels. | |
| You decide | Claude's discretion on whether to include examples. | |

**User's choice:** Include calibration examples
**Notes:** Ensures consistent scoring across batches; avoids score clustering.

---
