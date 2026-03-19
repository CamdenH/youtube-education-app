# Requirements: YouTube Learning Curator

**Defined:** 2026-03-18
**Core Value:** Surface the best YouTube content for learning a subject with maximum curation precision — the scoring algorithm and Claude prompts are what separate this from a YouTube playlist.

## v1 Requirements

### Pipeline

- [ ] **PIPE-01**: User can submit a subject + skill level (beginner/intermediate/advanced/all) to trigger course generation
- [ ] **PIPE-02**: Server generates 6-8 targeted YouTube search queries via Claude, shaped by skill level (beginner → intro/overview queries, advanced → lecture/deep-dive queries)
- [ ] **PIPE-03**: YouTube Data API v3 search called per query (type: video, maxResults: 8, duration: medium/long, language: en, safeSearch: strict)
- [ ] **PIPE-04**: Full video stats fetched for each result (snippet, statistics, contentDetails, topicDetails)
- [x] **PIPE-05**: Dev caching layer (file-based) prevents quota exhaustion during development iteration
- [x] **PIPE-06**: GET /api/course-stream SSE endpoint streams named progress events to frontend as pipeline runs (query_generated, videos_fetched, scored, transcripts_fetched, course_assembled)
- [ ] **PIPE-07**: GET /api/transcript/:videoId returns raw transcript for a given video

### Scoring

- [ ] **SCOR-01**: Each video scored 0–100 using 5-component formula: like ratio (max 40), duration 8–45min (max 20), channel credibility (max 20), recency (max 10), description quality (max 10)
- [ ] **SCOR-02**: Skill level adjusts scoring weights (e.g., recency matters less for math/advanced; description depth weighted higher for beginner)
- [ ] **SCOR-03**: Channel credibility rated 0–20 by Claude using two signals: institutional affiliation + content depth/rigor
- [ ] **SCOR-04**: All unique channels from candidate videos sent to Claude in one batch call for credibility scores
- [ ] **SCOR-05**: Description quality rated 0–10 by Claude for educational depth

### Transcripts

- [ ] **TRAN-01**: Transcripts fetched via YouTube timedtext endpoint for top 12 scored videos
- [ ] **TRAN-02**: Video description used as fallback when transcript is unavailable
- [ ] **TRAN-03**: Videos with neither transcript nor description are skipped entirely

### Curation

- [ ] **CURA-01**: Top 12 scored videos + transcripts sent to Claude for course assembly
- [ ] **CURA-02**: Claude rejects duplicate/low-quality videos; if fewer than 5 remain, user sees a friendly message suggesting a broader search term
- [ ] **CURA-03**: Remaining videos organized into 3–4 thematic modules, ordered by logical learning progression
- [ ] **CURA-04**: Each module has title, 2–3 sentence description, and connecting question tying module videos together
- [ ] **CURA-05**: Each video has a 1–2 sentence "why this video" rationale written by Claude
- [ ] **CURA-06**: Videos with potentially stale content are flagged with an outdated warning
- [ ] **CURA-07**: Course includes overview (3–4 sentences), estimated total watch time, and prerequisite knowledge list

### Questions

- [ ] **QUES-01**: 3 comprehension questions generated per video from transcript content (one each: recall, conceptual, application)
- [ ] **QUES-02**: Questions are transcript-grounded, not generic topic questions; description-fallback questions are acceptable but noted as lower quality
- [ ] **QUES-03**: 1 connecting question generated per module that ties all module videos together

### Hints

- [ ] **HINT-01**: POST /api/hint accepts videoId + all 3 questions, returns all 3 hints in one Claude call
- [ ] **HINT-02**: Hints are generated lazily: triggered when user first expands a video's questions accordion, not at course generation time
- [ ] **HINT-03**: Hint prompts instruct Claude to give thoughtful direction without revealing the full answer

### Frontend

- [ ] **FRNT-01**: Search screen with subject text input and skill level selector (beginner/intermediate/advanced/all levels)
- [ ] **FRNT-02**: Animated SSE-driven loading state showing pipeline steps in real time ("Generating search queries...", "Searching YouTube...", "Scoring videos...", "Fetching transcripts...", "Building your course...")
- [ ] **FRNT-03**: Recent searches (last 5) shown below search form, loaded from localStorage
- [ ] **FRNT-04**: Course view shows title, overview, prerequisite badge row, and total estimated time
- [ ] **FRNT-05**: Modules displayed as expand/collapse cards
- [ ] **FRNT-06**: Each video card shows thumbnail (clickable → YouTube), title, channel, duration, score badge, "why this video" text, and outdated warning if flagged
- [ ] **FRNT-07**: Comprehension questions shown as an accordion (collapsed by default) with textarea for user answers
- [ ] **FRNT-08**: "Reveal thinking points" button per video triggers lazy hint generation for all 3 questions at once
- [ ] **FRNT-09**: Module connecting question displayed at bottom of each module card
- [ ] **FRNT-10**: Dark mode by default; mobile responsive at 375px minimum viewport width

### Persistence

- [ ] **PERS-01**: Completed courses saved to localStorage history (last 10 entries); clicking a history item restores the exact saved course without regeneration
- [ ] **PERS-02**: Per-video watched checkboxes stored in localStorage, persisting across page reloads
- [ ] **PERS-03**: localStorage writes wrapped in try/catch with evict-oldest retry on quota overflow

### Export

- [ ] **EXPO-01**: "Export course" button generates and downloads a markdown file containing modules, video titles, YouTube links, and comprehension questions (no user answers)

### Infrastructure

- [ ] **INFR-01**: Node.js + Express server (server.js) serves static index.html and API routes; API keys loaded from .env via dotenv
- [x] **INFR-02**: Claude API calls include retry logic (max 2 retries) with exponential backoff
- [x] **INFR-03**: Claude JSON responses stripped and validated before use; malformed responses trigger a retry
- [ ] **INFR-04**: YouTube API quota errors surface as a friendly user-facing message (not a raw 403)
- [x] **INFR-05**: SSE connection sends a heartbeat comment every 15 seconds; frontend closes EventSource on terminal events to prevent auto-reconnect restarts
- [x] **INFR-06**: .env.example and README.md with setup instructions (npm install, key acquisition URLs, node server.js, open localhost:3000)

## v2 Requirements

### Scoring Enhancements

- **SCOR-V2-01**: Scoring weight calibration tool — offline mode to test algorithm against cached real YouTube data before production
- **SCOR-V2-02**: Per-subject scoring profiles — different default weights for math vs software vs history

### UX Enhancements

- **UX-V2-01**: Manual course regeneration from history (explicit button on saved course, not automatic)
- **UX-V2-02**: Outdated video banner with one-click "find a newer video on this topic"

## Out of Scope

| Feature | Reason |
|---------|--------|
| User authentication / accounts | Single-user personal tool; zero benefit over localStorage |
| Database (Postgres, SQLite, etc.) | localStorage is sufficient for one user, one device |
| In-app video playback | iframe embeds break for many channels; YouTube's player is better |
| Python backend | Stack decision is Node.js; mixing runtimes adds operational complexity |
| Video answer storage / grading | Privacy surface, no benefit for self-directed learner |
| Social / sharing / collaborative playlists | Requires auth + backend; markdown export covers sharing |
| Course editing / drag-and-drop reordering | UX complexity with no clear value over trusting the curation |
| Per-question hint generation (separate calls) | Cost explodes; batch all 3 per video in one call (already in HINT-01) |
| Framework-based frontend (React/Vue/Svelte) | Build step complexity; vanilla JS + single HTML is sufficient |
| Multiple simultaneous course generations | No queue management needed; disable form during generation |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PIPE-01 | Phase 2 | Pending |
| PIPE-02 | Phase 2 | Pending |
| PIPE-03 | Phase 1 | Pending |
| PIPE-04 | Phase 1 | Pending |
| PIPE-05 | Phase 1 | Complete |
| PIPE-06 | Phase 1 | Complete |
| PIPE-07 | Phase 1 | Pending |
| SCOR-01 | Phase 2 | Pending |
| SCOR-02 | Phase 2 | Pending |
| SCOR-03 | Phase 2 | Pending |
| SCOR-04 | Phase 2 | Pending |
| SCOR-05 | Phase 2 | Pending |
| TRAN-01 | Phase 3 | Pending |
| TRAN-02 | Phase 3 | Pending |
| TRAN-03 | Phase 3 | Pending |
| CURA-01 | Phase 3 | Pending |
| CURA-02 | Phase 3 | Pending |
| CURA-03 | Phase 3 | Pending |
| CURA-04 | Phase 3 | Pending |
| CURA-05 | Phase 3 | Pending |
| CURA-06 | Phase 3 | Pending |
| CURA-07 | Phase 3 | Pending |
| QUES-01 | Phase 3 | Pending |
| QUES-02 | Phase 3 | Pending |
| QUES-03 | Phase 3 | Pending |
| HINT-01 | Phase 5 | Pending |
| HINT-02 | Phase 5 | Pending |
| HINT-03 | Phase 5 | Pending |
| FRNT-01 | Phase 4 | Pending |
| FRNT-02 | Phase 4 | Pending |
| FRNT-03 | Phase 4 | Pending |
| FRNT-04 | Phase 4 | Pending |
| FRNT-05 | Phase 4 | Pending |
| FRNT-06 | Phase 4 | Pending |
| FRNT-07 | Phase 4 | Pending |
| FRNT-08 | Phase 4 | Pending |
| FRNT-09 | Phase 4 | Pending |
| FRNT-10 | Phase 4 | Pending |
| PERS-01 | Phase 4 | Pending |
| PERS-02 | Phase 4 | Pending |
| PERS-03 | Phase 4 | Pending |
| EXPO-01 | Phase 4 | Pending |
| INFR-01 | Phase 1 | Pending |
| INFR-02 | Phase 1 | Complete |
| INFR-03 | Phase 1 | Complete |
| INFR-04 | Phase 1 | Pending |
| INFR-05 | Phase 1 | Complete |
| INFR-06 | Phase 1 | Complete |

**Coverage:**
- v1 requirements: 48 total
- Mapped to phases: 48
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-18*
*Last updated: 2026-03-18 after roadmap creation*
