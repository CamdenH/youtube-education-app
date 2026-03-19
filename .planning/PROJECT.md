# YouTube Learning Curator

## What This Is

A personal local web app that turns any subject into a structured learning course from YouTube. Given a subject and skill level, it searches YouTube, scores and curates the genuinely best educational videos (not just the most popular), organizes them into thematic modules, and generates comprehension questions from each video's transcript. No auth, no database — runs entirely locally with API keys in a .env file.

## Core Value

Surface the best YouTube content for learning a subject with maximum curation precision — the scoring algorithm and Claude prompts are what separate this from a YouTube playlist.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] User can input a subject and skill level (beginner/intermediate/advanced/all) to generate a course
- [ ] Backend uses Claude to generate 6-8 targeted search queries designed to find educational content
- [ ] Backend searches YouTube Data API v3 and fetches full video stats for each result
- [ ] Videos are scored 0-100 using like ratio, duration, channel credibility, recency, and description quality
- [ ] Channel credibility uses a signal mix: institutional affiliation + content depth/rigor (rated by Claude)
- [ ] Skill level affects all three pipeline stages: search queries, scoring weights, and module organization
- [ ] Top 12 scored videos are sent to Claude; Claude rejects poor-quality ones and organizes the rest into 3-4 modules
- [ ] Each module has a title, description, learning progression, and connecting question
- [ ] Each video has a "why this video" blurb, 3 comprehension questions (recall/conceptual/application), and outdated flag
- [ ] Transcripts fetched via YouTube captions API; video description used as fallback
- [ ] Hint generation is lazy per-video: when a user expands a video's questions, all 3 hints are pre-fetched in one Claude call
- [ ] Courses saved to localStorage as a history list (last 10); clicking reloads the saved course without regenerating
- [ ] Export button generates a markdown course outline (modules, titles, YouTube links, questions — no answers)
- [ ] Progress tracked via per-video checkboxes stored in localStorage
- [ ] Animated loading state shows pipeline steps as they progress (SSE preferred)
- [ ] Dark mode by default, mobile responsive

### Out of Scope

- Authentication / user accounts — personal tool, single user
- Database persistence — localStorage is sufficient
- Video playback — links open YouTube in new tab
- Python/framework-based backend — Node.js + Express only
- OAuth login or any auth mechanism

## Context

- The existing repo has a `.venv` from PyCharm setup but no source code — greenfield for Node.js
- YouTube Data API v3 for search, video details, and captions; Anthropic Claude API for all AI tasks
- claude-sonnet-4-5 (or latest available) as the Claude model
- Single server.js + single index.html architecture — keep it simple

## Constraints

- **Tech Stack**: Node.js + Express (server.js) + vanilla JS (index.html) — no frontend framework, no build step
- **API Keys**: YOUTUBE_API_KEY and ANTHROPIC_API_KEY via .env file
- **No Database**: All persistence via localStorage
- **No Auth**: No login, sessions, or user management

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Skill level affects queries + scoring + module structure | Gives the most holistic result; level is a first-class input not a filter | — Pending |
| Claude decides quality threshold (not hardcoded score) | Claude can read transcript/description quality signals humans can't formula-encode | — Pending |
| Hints generated lazily per-video in one batch call | Balances API cost vs UX latency; zero extra calls until user engages with questions | — Pending |
| Channel credibility = institutional signal + depth/rigor | Pure institutional bias misses great indie educators; pure depth misses strong priors | — Pending |
| Saved courses = history list, no auto-regenerate | User wants to return to exactly what they built; regeneration available manually | — Pending |
| Export = course outline only (no user answers) | Clean shareable study guide; personal answers stay private in the browser | — Pending |

---
*Last updated: 2026-03-18 after initialization*
