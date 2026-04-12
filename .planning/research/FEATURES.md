# Feature Landscape

**Domain:** AI-powered YouTube learning curator / structured course generator
**Researched:** 2026-03-18
**Confidence note:** WebSearch unavailable. Findings draw on training knowledge of tools in this
space (Coursera, Brilliant, Khan Academy, Perplexity learning flows, AI video summarizers like
Merlin, Glasp, and open-source YouTube course generators on GitHub). Confidence is noted per area.

---

## Table Stakes

Features users expect from any AI course generator. Missing = product feels broken or pointless.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Subject + skill level input | Entry point; no input form = no product | Low | Skill level is a first-class filter, not an afterthought |
| Loading / progress indicator | Generation takes 10-30s; blank screen = user abandons | Low-Med | SSE pipeline steps are better than a spinner; shows "searching... scoring... organizing..." |
| Structured output with modules | Users expect a course, not a flat list | Med | Modules with titles, descriptions, and video order signal a learning arc |
| Video titles, thumbnails, channel names | Minimum context to judge a video before clicking | Low | YouTube oEmbed or Data API v3 provides this |
| Direct links to YouTube | Users must be able to watch the videos | Low | Opens in new tab; no in-app playback needed |
| "Why this video" blurb per video | Distinguishes curation from a plain search result | Med | Claude-generated; 1-2 sentences explaining why this specific video was chosen |
| Comprehension questions per video | The core learning scaffold; without it the app is just a playlist | High | 3 questions minimum: recall, conceptual, application |
| localStorage course persistence | Users close tabs; losing a generated course is unacceptable | Low | Last 10 courses as a history list |
| Course reload from history | Re-generation is slow and costs API calls; user expects saved = reloadable | Low | Click history item → restore exact saved course |
| Dark mode | Learning apps used at night; dark mode is table stakes for developer tools | Low | Default dark, not optional |
| Mobile responsiveness | Many users will reference the course on a phone while watching on desktop | Low-Med | Readable at 375px viewport minimum |
| Error state handling | YouTube API quota, transcript unavailability, and Claude errors are common | Med | Graceful degradation: show partial results, explain what failed |

---

## Differentiators

Features that justify this tool's existence over "just searching YouTube." Not universally expected,
but what makes the tool genuinely valuable vs generic.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Multi-signal video scoring (0-100) | Surfaces high-quality educational content, not just high-viewcount videos | High | Like ratio + duration + channel credibility + recency + description quality; the algorithm is the core IP |
| Channel credibility via Claude | Catches great indie educators who have no institutional affiliation | High | Two-signal approach: institutional affiliation + content depth/rigor rated by Claude; neither alone is sufficient |
| Skill level propagates through all pipeline stages | Beginner and advanced users get structurally different courses, not just filtered videos | High | Affects query generation, scoring weights (recency matters less for advanced), and module progression logic |
| Transcript-grounded questions | Questions tied to actual video content, not generic topic questions | High | Transcript fetch required; description fallback acceptable but degrades question specificity |
| 3-tier question taxonomy | Recall / Conceptual / Application mirrors Bloom's taxonomy; tells users what kind of thinking is required | Med | Claude prompt must enforce the taxonomy explicitly; freeform questions drift toward recall-only |
| Lazy hint generation | Hints appear only when user engages with a question; eliminates upfront API cost | Med | One batch Claude call per video when expanded; not per-question |
| Outdated flag on videos | Learning content goes stale (AI field, tax law, software); flagging protects users | Med | Claude makes the call based on topic + upload date + transcript signals |
| Module connecting question | Bridges modules; turns a list of topics into a learning narrative | Med | Claude-generated; one question per module transition |
| Markdown export | Users want to share courses with study groups or import into Notion/Obsidian | Low | Course outline only (modules, titles, links, questions — no answers); clean and intentional |
| Progress tracking via checkboxes | Lets user track which videos they've watched without requiring auth | Low | Per-video boolean in localStorage; survives page reload |
| Animated SSE pipeline | Makes generation feel fast even when it isn't; users understand what's happening | Med | SSE with named events: query_generated, videos_fetched, scored, modules_organized, questions_generated |

---

## Anti-Features

Features to explicitly NOT build. Each one is a complexity trap that dilutes the core value
proposition or creates maintenance burden disproportionate to user benefit.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| In-app video playback | iframe embeds break for many videos (embedding disabled by channel); also splits attention from the course view | Open YouTube in new tab — users prefer full YouTube player |
| User authentication / accounts | Single-user personal tool; auth adds OAuth complexity, session management, and a security surface with zero benefit | localStorage is sufficient; noted explicitly as out of scope |
| Database persistence | Adds infra (Postgres, SQLite file management, migrations) with no meaningful gain over localStorage for one user | localStorage + JSON serialization; last 10 courses is plenty |
| Video answer storage | Storing user answers to comprehension questions creates privacy surface; users shouldn't feel graded | Questions are for self-testing; no answer capture, no scoring |
| Social/sharing features | Collaborative playlists, course ratings, comments — all require auth and backend; none of this serves the solo learner | Markdown export covers the sharing use case cleanly |
| Automatic re-generation on history load | Re-running the pipeline on a saved course burns API quota and returns different results; breaks the history contract | Restore exactly what was saved; allow manual regeneration as an explicit user action |
| Per-question hint generation | One API call per hint = 9+ Claude calls per video; cost explodes fast | Batch all 3 hints in one call when user first expands a video |
| Course editing / reordering | Drag-and-drop module editors are a UX project of their own; the value is curation, not editing | Generate a high-quality course; let users fork it via export |
| Pagination / infinite scroll on results | Not a search interface; a curated course is deliberately finite | Show the full course; no load-more needed |
| Multiple simultaneous course generation | No queue management, no background jobs needed | One generation at a time; disable the form during generation |
| Framework-based frontend | React/Vue/Svelte adds a build step, node_modules complexity, and component architecture decisions | Vanilla JS + single index.html is sufficient and faster to ship |
| Python backend | PyCharm created a .venv but the stack decision is Node.js + Express; mixing runtimes adds operational complexity | Node.js only; delete the .venv |

---

## Feature Dependencies

```
Subject + skill level input
    → query generation (Claude)
        → YouTube search (YouTube Data API v3)
            → video stats fetch (YouTube Data API v3)
                → scoring algorithm (0-100)
                    → top-N candidate selection
                        → transcript fetch (YouTube captions API)
                            → Claude module organization + quality rejection
                                → comprehension questions (transcript-grounded)
                                    → lazy hint generation (on user expand)
                                → "why this video" blurbs
                                → outdated flags
                    → channel credibility score (Claude + institutional signal)
                        → scoring algorithm (feeds back as a weight)

Completed course
    → localStorage save (history list)
        → history load (exact restore, no re-generation)
        → progress tracking (per-video checkbox, stored separately in localStorage)
        → markdown export (reads current course state)

SSE pipeline events
    → each stage above emits a named event to drive the animated loading state
```

Key dependency chains:
- Transcripts are required for high-quality comprehension questions. Description fallback degrades specificity noticeably — this is a known risk.
- Channel credibility scoring must complete before final video scoring; don't score without it.
- Hint generation is the only feature that can be fully deferred — it runs after the course is rendered, gated by user interaction.
- Outdated flagging requires both the upload date (from video stats) and topic context (from the subject input); neither alone is sufficient.

---

## MVP Recommendation

**Core loop that must ship together (can't go partial):**

1. Subject + skill level input form
2. SSE-driven loading state with pipeline steps
3. Claude query generation + YouTube search + video stats
4. Scoring algorithm (simplified acceptable — add channel credibility as v2)
5. Claude module organization + "why this video" blurbs
6. Comprehension questions (all 3 types) per video
7. localStorage save and course history

**Ship with MVP (low complexity, high polish):**

- Dark mode default
- Mobile responsive layout
- Markdown export
- Progress checkboxes

**Defer to v2 (adds quality but blocks nothing):**

- Lazy hint generation: Implement after core loop is stable; it requires the question UI to exist first
- Channel credibility via Claude: Start with simpler credibility signal (subscriber count + institutional keyword match); replace with Claude scoring in v2
- Outdated flagging: Requires stable transcript pipeline; add after transcripts are reliable
- Animated SSE pipeline: Implement basic loading state first; enhance with named step events in v2

**Never build:**

Everything in the Anti-Features table above.

---

## Competitive Context

Tools in adjacent space and what they get wrong (informs what this tool must get right):

| Tool Category | Common Pattern | Gap This App Fills |
|---------------|---------------|-------------------|
| YouTube playlist tools | Aggregate by popularity/views | Doesn't filter for educational quality; a million-view video can be wrong or shallow |
| AI video summarizers (Merlin, Glasp) | Per-video summaries, no cross-video structure | No course arc; user still has to figure out what to watch and in what order |
| Generic AI course generators (ChatGPT prompts) | Output is topic outlines with no actual videos | No verification that the suggested videos exist or are any good |
| LMS platforms (Coursera, Udemy) | Professionally produced content | No ability to learn from the long tail of YouTube; expensive; slow to update |
| YouTube's own playlists | Creator-curated, not learner-curated | Organized by creator logic, not learner progression; no comprehension layer |

**The gap:** No tool does multi-signal quality scoring of YouTube content + structured module organization + comprehension scaffolding in a single pipeline. That is the differentiating surface.

---

## Sources

- Training knowledge of AI learning tools ecosystem (Merlin, Glasp, Coursera, Khan Academy, open-source YouTube course generators)
- PROJECT.md requirements and key decisions
- Confidence: MEDIUM for feature categorization (patterns are stable across this domain); LOW for specific competitor feature claims (not verified against current product state)
