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

**Shipped in v2.0 SaaS:**
- ✓ User authentication via Clerk (sign up, sign in, session management) — v2.0
- ✓ Protected routes — course generation requires authenticated user — v2.0
- ✓ Per-user course history stored in Supabase (replaces localStorage history) — v2.0
- ✓ File cache replaced by Supabase JSONB cache table (global, MD5-keyed — D-01) — v2.0
- ✓ Subscription tiers via Clerk Billing (free: 1/month, early_access: 20/month) — v2.0
- ✓ Usage gates: free tier limited to 1 course generation per month — v2.0
- ✓ Billing webhooks (idempotent) for subscriptionItem.active/ended events — v2.0
- ✓ Marketing landing page with how-it-works, sample preview, and CTA — v2.0
- ✓ Onboarding flow (post-signup) explaining course generation and tier limits — v2.0
- ✓ Upgrade prompts shown when free user hits usage gate — v2.0

### Active (v3.0)

- [ ] Per-user watched state and progress stored in Supabase (deferred from v2.0)
- [ ] Railway deployment — live production environment

### Out of Scope

- Video playback — links open YouTube in new tab
- Python/framework-based backend — Node.js + Express only
- OAuth login beyond Clerk — no custom auth
- Per-question hint generation (separate calls) — batch all 3 per video (already in HINT-01)
- Framework-based frontend (React/Vue/Svelte) — vanilla JS + single HTML per file

## Context

**Shipped v2.0:** ~4,200 LOC across server.js, youtube.js, sse.js, claude.js, cache.js, transcript.js, assembler.js, queries.js, scorer.js, db.js, auth.js, webhooks.js, index.html, landing.html, onboarding.html, pricing.html. 186 passing tests via node:test.

**Tech stack:** Node.js + Express + vanilla JS; YouTube Data API v3; Anthropic Claude API; Supabase (Postgres — cache + courses + users tables); Clerk (auth + billing); Railway (hosting target).

**Architecture:** Single-layer flat structure — no src/ subdirectory. All modules at root. Validated across v1.0 and v2.0.

**Known tech debt:**
- Watched checkbox state still in localStorage — not migrated to Supabase (deferred to v3.0)
- Clerk placeholder values in index.html CDN script require manual substitution before deploy
- Human verification items (phases 7–9) pending browser/live-service testing

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
| Clerk + Supabase + Railway for SaaS | Fastest path to production auth+billing+DB without infra ops | ✓ Good — clean integration, zero custom session code |
| Clerk Billing over Stripe directly | Clerk handles subscription UI + webhooks + user linkage natively | ✓ Good — subscriptionItem events map cleanly to plan column |
| Global cache (no user_id key) | Same query from any user hits same cache row — saves YouTube quota at scale | ✓ Good — intentional D-01 decision |
| courses.user_id as TEXT (Clerk ID), not FK | Avoids webhook timing race — no users row needed before course save | ✓ Good — eliminated a whole class of race conditions |
| Atomic counter via Postgres RPC | Prevents double-count under concurrent requests; no app-level read-then-write | ✓ Good — increment_generation_count RPC is clean |
| subscriptionItem.active/ended (not subscription.*) | Clerk Billing fires subscriptionItem events, not subscription events | ✓ Good — correct event names; common mistake avoided |
| HTML route auth gate: inline getAuth() + redirect | requireUser returns 401 JSON, wrong for HTML routes; inline getAuth gives redirect | ✓ Good — pattern locked for all HTML auth gates |
| window.__upgradeUrl Option B (empty string) | No server injection, no XSS; falsy guard skips CTA swap when URL absent | ✓ Good — simple and safe |
| fetch() preflight before EventSource | Native EventSource cannot read HTTP status; fetch() catches 429 before SSE opens | ✓ Good — clean UX pattern for gated SSE |
| Marketing pages never link to /app | Landing/pricing pages link to Clerk auth URLs only — no /app on unauthenticated pages | ✓ Good — clean separation of marketing vs. app |

---
*Last updated: 2026-05-04 after v2.0 milestone*
