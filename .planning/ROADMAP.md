# Roadmap: YouTube Learning Curator

## Overview

Four phases deliver the complete pipeline in dependency order: infrastructure and SSE scaffolding first, then scoring and query generation, then the complex transcript-and-assembly layer, and finally the frontend built against a stable API contract. A fifth phase adds lazy hints — deferred until the course data structure is stable. This ordering prevents quota exhaustion during iteration and avoids churn from building UI against a moving backend.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Express server, SSE infrastructure, YouTube API client, and dev caching layer (completed 2026-03-19)
- [ ] **Phase 2: Scoring + Query Generation** - Full scoring engine, channel credibility via Claude, and Claude query generation
- [ ] **Phase 3: Transcript + Course Assembly** - Timedtext transcript fetch, Claude course assembly, module structure, and comprehension questions
- [ ] **Phase 4: Frontend + Persistence + Export** - Complete index.html, SSE-driven loading state, localStorage, progress tracking, and markdown export
- [ ] **Phase 5: Lazy Hints** - POST /api/hints endpoint and per-video lazy hint generation

## Phase Details

### Phase 1: Foundation
**Goal**: The server is running, the SSE connection is verified, YouTube search and video stats are fetched with quota-safe caching, and the pipeline skeleton streams fake progress events to the browser
**Depends on**: Nothing (first phase)
**Requirements**: INFR-01, INFR-02, INFR-03, INFR-04, INFR-05, INFR-06, PIPE-03, PIPE-04, PIPE-05, PIPE-06, PIPE-07
**Success Criteria** (what must be TRUE):
  1. Running `node server.js` starts the server and serves index.html at localhost:3000
  2. A browser connecting to GET /api/course-stream receives named SSE events (including heartbeat) and the EventSource closes cleanly on a terminal event
  3. YouTube search queries return video results and full stats; identical queries hit the .cache/ file rather than the API
  4. GET /api/transcript/:videoId returns a raw transcript or a meaningful error without a 403
  5. YouTube quota errors produce a user-readable SSE event, not a raw 403 crash
**Plans:** 4/4 plans complete

Plans:
- [ ] 01-01-PLAN.md — Project scaffolding and file-based dev cache
- [ ] 01-02-PLAN.md — SSE streaming infrastructure and Claude API utilities
- [ ] 01-03-PLAN.md — YouTube API client and transcript fetching
- [ ] 01-04-PLAN.md — Server assembly and SSE stub frontend

### Phase 2: Scoring + Query Generation
**Goal**: Given a subject and skill level, Claude generates targeted search queries, each candidate video receives a 0-100 score with correct weighting for the given level, and channel credibility scores are retrieved in a single Claude batch call
**Depends on**: Phase 1
**Requirements**: PIPE-01, PIPE-02, SCOR-01, SCOR-02, SCOR-03, SCOR-04, SCOR-05
**Success Criteria** (what must be TRUE):
  1. Submitting "quantum mechanics / advanced" produces demonstrably different search queries than "quantum mechanics / beginner"
  2. Video scores span a meaningful distribution (not all clustered near the same value) when run against cached Phase 1 YouTube data
  3. Skill level changes the scoring weights: an advanced query deprioritizes recency relative to a beginner query
  4. All unique channels from a candidate set are scored by Claude in exactly one API call, and those scores appear in the final video scores
**Plans:** 4 plans

Plans:
- [ ] 02-01-PLAN.md — Wave 0: install @anthropic-ai/sdk, create test stubs for queries.js and scorer.js
- [ ] 02-02-PLAN.md — queries.js: generateQueries with angle-diverse Claude prompting
- [ ] 02-03-PLAN.md — scorer.js: scoreVideos with deterministic + Claude-powered components
- [ ] 02-04-PLAN.md — Wire pipeline into sse.js + input validation in server.js

### Phase 3: Transcript + Course Assembly
**Goal**: Transcripts are fetched for the top 12 scored videos, Claude assembles them into a structured course with modules, per-video blurbs, comprehension questions, and outdated flags, and the pipeline produces a complete course JSON object
**Depends on**: Phase 2
**Requirements**: TRAN-01, TRAN-02, TRAN-03, CURA-01, CURA-02, CURA-03, CURA-04, CURA-05, CURA-06, CURA-07, QUES-01, QUES-02, QUES-03
**Success Criteria** (what must be TRUE):
  1. For a real subject, the pipeline returns a valid course JSON with 3-4 modules, each containing a title, description, and connecting question
  2. Each video in the course has a "why this video" blurb and exactly 3 questions (one recall, one conceptual, one application)
  3. A video with no available transcript falls back to its description; a video with neither is excluded from the course
  4. If fewer than 5 videos survive Claude curation, the API returns a structured message prompting the user to broaden their search instead of an empty course
  5. The course JSON includes overview text, estimated total watch time, and a prerequisite knowledge list
**Plans:** 3 plans

Plans:
- [x] 03-01-PLAN.md — assembler.js skeleton + failing test stubs (TDD wave 0)
- [x] 03-02-PLAN.md — assembleCourse implementation (parseDurationSeconds, buildAssemblyPrompt, mergeClaudeOutput)
- [x] 03-03-PLAN.md — Wire steps 4 and 5 in sse.js (transcript fetch + description fallback + course assembly)

### Phase 4: Frontend + Persistence + Export
**Goal**: The full index.html is usable end-to-end: a user can search, watch the pipeline progress in real time, view a rendered course, check off watched videos, revisit saved courses from history, and export a markdown outline
**Depends on**: Phase 3
**Requirements**: FRNT-01, FRNT-02, FRNT-03, FRNT-04, FRNT-05, FRNT-06, FRNT-07, FRNT-08, FRNT-09, FRNT-10, PERS-01, PERS-02, PERS-03, EXPO-01
**Success Criteria** (what must be TRUE):
  1. A user can type a subject, select a skill level, and watch labeled pipeline steps animate in real time before the course appears
  2. The course renders with collapsible module cards, video thumbnails linking to YouTube, score badges, and outdated warnings where flagged
  3. Comprehension questions are hidden by default; expanding them shows a textarea for the user's answer
  4. Checking a video as watched persists across page reloads; last 10 courses appear in history and clicking one restores the exact saved course
  5. Clicking "Export course" downloads a markdown file with modules, titles, YouTube links, and questions — containing no user answers or hint text
  6. The UI is usable on a 375px viewport and renders correctly in dark mode by default
**Plans:** 4 plans

Plans:
- [ ] 04-01-PLAN.md — Unit test stubs (Wave 0) + HTML skeleton and all CSS
- [ ] 04-02-PLAN.md — Form submission, SSE pipeline, course rendering, recent searches, export
- [ ] 04-03-PLAN.md — localStorage persistence: history, watched state, eviction
- [ ] 04-04-PLAN.md — Full test suite run + visual/functional verification checkpoint

### Phase 5: Lazy Hints
**Goal**: A user who wants help with a video's questions can reveal thinking points, triggering a single Claude call that returns all 3 hints at once, without disturbing any other video's state
**Depends on**: Phase 4
**Requirements**: HINT-01, HINT-02, HINT-03
**Success Criteria** (what must be TRUE):
  1. Clicking "Reveal thinking points" on a video triggers a POST /api/hints call and shows a loading state only for that video
  2. All 3 hints appear together after the call completes; hints are directional but do not reveal the full answer
  3. Hints are not requested at course generation time — the call fires only when the user first expands that video's questions accordion
**Plans:** 3 plans

Plans:
- [ ] 05-01-PLAN.md — Wave 0: failing test stubs for server and frontend hint cases
- [ ] 05-02-PLAN.md — assembler.js transcriptSnippet + server.js POST /api/hints route
- [ ] 05-03-PLAN.md — index.html fetchHints, localStorage helpers, renderCourse restore, human-verify checkpoint

### Phase 6: Auth + User Model
**Goal**: Every request is authenticated via Clerk; a `users` table in Supabase is created and synced on sign-up via Clerk webhook; protected routes return 401 for unauthenticated requests
**Depends on**: Phase 5
**Requirements**: AUTH-01, AUTH-02, AUTH-03
**Success Criteria** (what must be TRUE):
  1. Unauthenticated requests to `/api/course-stream` and `/api/hints` return 401
  2. A new Clerk sign-up triggers a webhook that inserts a row into `users` (clerk_id, email, created_at)
  3. `auth.js` middleware attaches `req.user` (clerk_id + subscription tier) to every authenticated request
**Plans**: TBD

### Phase 7: Course Persistence
**Goal**: Generated courses are saved to Supabase per user; users can retrieve their course history; file-based cache is replaced with a Supabase-backed cache that survives deploys
**Depends on**: Phase 6
**Requirements**: PERS-04, PERS-05, PERS-06
**Success Criteria** (what must be TRUE):
  1. Every completed course stream is saved to a `courses` table (user_id, topic, skill_level, course_json, created_at)
  2. `GET /api/courses` returns the authenticated user's course history (newest first, limit 50)
  3. Cache lookups hit Supabase instead of `.cache/` — repeated identical queries do not re-hit YouTube or Claude APIs
**Plans**: TBD

### Phase 8: Billing + Tier Enforcement
**Goal**: Clerk Billing subscriptions are wired up with at least two tiers; tier limits are enforced at the API layer before the SSE stream starts
**Depends on**: Phase 7
**Requirements**: BILL-01, BILL-02, BILL-03, BILL-04
**Success Criteria** (what must be TRUE):
  1. Users can subscribe and manage their plan via Clerk's hosted billing portal
  2. Free-tier users are blocked from `/api/course-stream` after hitting their monthly generation limit; the error is a clear SSE `error` event, not a crash
  3. Pro-tier users have a higher (or unlimited) generation limit
  4. Billing webhook handlers are idempotent — replayed events do not double-count usage
**Plans**: TBD

### Phase 9: SaaS UI + Landing Page
**Goal**: The app has a public landing page, a sign-in/sign-up flow, an account page showing subscription status, and course history rendered from the server-side API instead of localStorage
**Depends on**: Phase 8
**Requirements**: SAAS-UI-01, SAAS-UI-02, SAAS-UI-03, SAAS-UI-04
**Success Criteria** (what must be TRUE):
  1. A public landing page exists at `/` for unauthenticated visitors; authenticated users are redirected to the app
  2. Clerk's hosted sign-in/sign-up UI is reachable and functional
  3. An account page shows the user's current plan, usage this month, and a link to manage billing
  4. Course history is loaded from `GET /api/courses` — localStorage history from Phase 4 is replaced or supplemented
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 4/4 | Complete   | 2026-03-19 |
| 2. Scoring + Query Generation | 4/4 | Complete | - |
| 3. Transcript + Course Assembly | 3/3 | Complete | - |
| 4. Frontend + Persistence + Export | 4/4 | Complete | 2026-04-09 |
| 5. Lazy Hints | 0/3 | Not started | - |
| 6. Auth + User Model | 0/TBD | Not started | - |
| 7. Course Persistence | 0/TBD | Not started | - |
| 8. Billing + Tier Enforcement | 0/TBD | Not started | - |
| 9. SaaS UI + Landing Page | 0/TBD | Not started | - |
