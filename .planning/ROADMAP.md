# Roadmap: YouTube Learning Curator

## Overview

Four phases deliver the complete pipeline in dependency order: infrastructure and SSE scaffolding first, then scoring and query generation, then the complex transcript-and-assembly layer, and finally the frontend built against a stable API contract. A fifth phase adds lazy hints — deferred until the course data structure is stable. This ordering prevents quota exhaustion during iteration and avoids churn from building UI against a moving backend.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - Express server, SSE infrastructure, YouTube API client, and dev caching layer
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
**Plans:** 2/4 plans executed

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
**Plans**: TBD

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
**Plans**: TBD

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
**Plans**: TBD

### Phase 5: Lazy Hints
**Goal**: A user who wants help with a video's questions can reveal thinking points, triggering a single Claude call that returns all 3 hints at once, without disturbing any other video's state
**Depends on**: Phase 4
**Requirements**: HINT-01, HINT-02, HINT-03
**Success Criteria** (what must be TRUE):
  1. Clicking "Reveal thinking points" on a video triggers a POST /api/hints call and shows a loading state only for that video
  2. All 3 hints appear together after the call completes; hints are directional but do not reveal the full answer
  3. Hints are not requested at course generation time — the call fires only when the user first expands that video's questions accordion
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 2/4 | In Progress|  |
| 2. Scoring + Query Generation | 0/TBD | Not started | - |
| 3. Transcript + Course Assembly | 0/TBD | Not started | - |
| 4. Frontend + Persistence + Export | 0/TBD | Not started | - |
| 5. Lazy Hints | 0/TBD | Not started | - |
