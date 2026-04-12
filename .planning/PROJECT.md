# YouTube Learning Curator

## What This Is

A B2C SaaS web app that turns any subject into a structured YouTube learning course. Given a subject and skill level, it searches YouTube, scores and curates the best educational videos using a multi-component algorithm, organizes them into thematic modules, generates comprehension questions from transcripts, and offers lazy hint generation. The v1.0 MVP runs locally; v2.0 adds user accounts, cloud persistence, and paid subscription tiers.

## Core Value

Surface the best YouTube content for learning a subject with maximum curation precision — the scoring algorithm and Claude prompts are what separate this from a YouTube playlist.

## Requirements

### Validated

**Shipped in v1.0 MVP:**
- ✓ File-based dev cache (MD5-keyed, .cache/ directory) — v1.0
- ✓ SSE streaming infrastructure (sendEvent, sendHeartbeat, courseStreamHandler) — v1.0
- ✓ Claude API utility (retry wrapper, JSON fence-stripping, exponential backoff) — v1.0
- ✓ YouTube Data API v3 client (searchVideos, fetchVideoStats, quota error discrimination) — v1.0
- ✓ Transcript fetching (timedtext XML parsing, cache-first, description fallback) — v1.0
- ✓ Express server wiring all modules into SSE endpoint — v1.0
- ✓ Claude generates 6–8 targeted search queries shaped by skill level — v1.0
- ✓ Videos scored 0–100 (like ratio, duration, channel credibility, recency, description quality) — v1.0
- ✓ Channel credibility + description quality rated by Claude in one batch call per scoreVideos invocation — v1.0
- ✓ Skill level adjusts scoring weights — v1.0
- ✓ Top 12 videos sent to Claude for course assembly into 3–4 modules — v1.0
- ✓ Module titles, descriptions, connecting questions, and learning progression — v1.0
- ✓ Per-video "why this video" blurb, 3 comprehension questions (recall/conceptual/application), outdated flag — v1.0
- ✓ TOO_FEW_VIDEOS gate: <5 videos returns friendly message instead of broken course — v1.0
- ✓ Course overview, total watch time estimate, prerequisite list — v1.0
- ✓ POST /api/hints: lazy per-video hint generation (all 3 hints in one Claude call) — v1.0
- ✓ Full index.html: SSE-driven loading state, course rendering, module cards, video cards — v1.0
- ✓ Recent searches (last 5) from localStorage shown below search form — v1.0
- ✓ localStorage history (last 10 courses), watched checkboxes, evict-oldest on quota overflow — v1.0
- ✓ Markdown export (modules, titles, YouTube links, questions — no user answers) — v1.0
- ✓ Dark mode by default, mobile responsive at 375px — v1.0

### Active (v2.0 SaaS)

- [ ] User authentication via Clerk (sign up, sign in, session management)
- [ ] Protected routes — course generation requires authenticated user
- [ ] Per-user course history stored in Supabase (replaces localStorage history)
- [ ] File cache replaced by Supabase cache table per user
- [ ] Subscription tiers via Clerk Billing (free / pro / power)
- [ ] Usage gates: free tier limited to N course generations per month
- [ ] Billing webhooks (idempotent) for subscription lifecycle events
- [ ] Marketing landing page with pricing, feature highlights, and CTA
- [ ] Onboarding flow (post-signup) explaining course generation
- [ ] Upgrade prompts shown when free user hits usage gate
- [ ] Per-user watched state and progress stored in Supabase

### Out of Scope

- Video playback — links open YouTube in new tab
- Python/framework-based backend — Node.js + Express only
- OAuth login beyond Clerk — no custom auth
- Per-question hint generation (separate calls) — batch all 3 per video (already in HINT-01)
- Framework-based frontend (React/Vue/Svelte) — vanilla JS + single HTML per file

## Context

**Shipped v1.0:** ~2,776 LOC across server.js, youtube.js, sse.js, claude.js, cache.js, transcript.js, assembler.js, queries.js, scorer.js, and index.html. 124+ passing tests via node:test.

**Tech stack v1.0:** Node.js + Express + vanilla JS; YouTube Data API v3; Anthropic Claude API; file-based MD5 cache.

**Tech stack additions for v2.0:** Clerk (auth + billing), Supabase (Postgres), Railway (hosting).

**Architecture:** Single-layer flat structure — no src/ subdirectory. All modules at root. Pattern established and validated in v1.0; continue in v2.0.

**Known tech debt:**
- File cache (.cache/) is a dev shortcut — must be replaced by Supabase cache table in Phase 7
- localStorage history/watched state must migrate to Supabase in Phase 7
- REQUIREMENTS.md traceability table was not updated as phases 2–5 completed (documentation gap)

## Constraints

- **Tech Stack:** Node.js + Express (server.js) + vanilla JS (index.html) — no frontend framework, no build step
- **API Keys:** YOUTUBE_API_KEY, ANTHROPIC_API_KEY, CLERK_SECRET_KEY, SUPABASE_URL, SUPABASE_ANON_KEY via .env
- **Auth:** Clerk only — no custom sessions or JWTs
- **Database:** Supabase (Postgres) for v2.0 persistence — no ORMs
- **Hosting:** Railway

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Skill level affects queries + scoring + module structure | First-class input gives holistic result; not a filter | ✓ Good — Claude query generation adapts well |
| Claude decides quality threshold (not hardcoded score) | Transcript/description quality signals can't be formula-encoded | ✓ Good — TOO_FEW_VIDEOS gate works cleanly |
| Hints generated lazily per-video in one batch call | Zero extra API calls until user engages with questions | ✓ Good — UX feels right, no upfront latency |
| Channel credibility = institutional signal + depth/rigor | Pure institutional bias misses great indie educators | ✓ Good — balanced scoring |
| Saved courses = history list, no auto-regenerate | User returns to exactly what was built | ✓ Good — localStorage eviction handled gracefully |
| Export = course outline only (no user answers) | Clean shareable study guide; answers stay private | ✓ Good |
| Express ^4.18 pinned (not npm latest ^5) | Express 5 has breaking routing/res.send() changes | ✓ Good — no migration pain |
| Raw fetch() for YouTube API (not googleapis package) | googleapis is overkill for simple REST + API key | ✓ Good — 0 dependency overhead |
| MD5 hash cache keys | Deterministic, reproducible, human-debuggable filenames | ✓ Good |
| node:test built-in as test runner | Zero install cost, async support, sufficient for pure functions | ✓ Good — 124+ tests |
| videoDuration: 'any' in searchVideos | Duration filtering deferred to Phase 2 scoring to save quota | ✓ Good — Phase 2 scoring handles it |
| Clerk + Supabase + Railway for SaaS | Fastest path to production auth+billing+DB without infra ops | — Pending (v2.0) |
| Clerk Billing over Stripe directly | Clerk handles subscription UI + webhooks + user linkage natively | — Pending (v2.0) |

---
*Last updated: 2026-04-12 after v1.0 milestone*
