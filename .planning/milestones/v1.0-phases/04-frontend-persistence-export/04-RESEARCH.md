# Phase 4: Frontend + Persistence + Export - Research

**Researched:** 2026-04-09
**Domain:** Vanilla JS single-file frontend, localStorage, SSE event consumption, markdown download
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Watched state is global by videoId — a flat map `{ [videoId]: true }` stored in a single localStorage key. If the same video appears in multiple saved courses, checking it once marks it watched everywhere.
- **D-02:** The search form stays visible during pipeline generation. The "Generate course" button changes to "Generating..." (disabled). Pipeline loading section appears below the form when generation starts.
- **D-03:** When `course_assembled` fires and the course renders, the pipeline loading section is removed from the DOM. Course view takes its place cleanly.
- **D-04:** If a course is already displayed and the user submits a new search, the old course clears immediately when the user clicks "Generate course". No confirmation dialog.
- **D-05:** Pipeline errors replace the pipeline section in place. The form re-enables so the user can retry. Error copy from the UI-SPEC copywriting contract applies verbatim.
- **D-06:** Each course history entry stores the full course JSON plus metadata: subject, skillLevel, generatedAt (ISO timestamp), and the complete course object.
- **D-07:** PERS-03 eviction: when localStorage quota is exceeded on write, evict the oldest entry by generatedAt timestamp, then retry the write.
- **D-08:** localStorage key names are Claude's discretion — choose sensible, namespaced keys and document them inline.

### Claude's Discretion

- Exact localStorage key names and array/object structure (D-08)
- How the skill level selector renders (UI-SPEC specifies `<select>`, options: Beginner / Intermediate / Advanced / All Levels, default All Levels)
- Score badge tier color logic (UI-SPEC locked: 80-100 = green `#22c55e`, 60-79 = blue `#3b82f6`, 40-59 = amber `#f59e0b`, 0-39 = muted `#a0a0a0`)
- Exact CSS class naming and JS function structure for the rewritten index.html
- Reveal thinking points button (FRNT-08): Phase 4 renders the button and loading state wiring but the click handler is a no-op stub

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FRNT-01 | Search screen with subject text input and skill level selector | Existing CSS vars + form patterns; `<select>` confirmed in UI-SPEC |
| FRNT-02 | Animated SSE-driven loading state showing pipeline steps in real time | SSE event names locked in sse.js; step label map in UI-SPEC; dot + CSS pulse pattern |
| FRNT-03 | Recent searches (last 5) shown below search form, loaded from localStorage | localStorage pill pattern; update on form submit per CONTEXT.md specifics |
| FRNT-04 | Course view: title, overview, prerequisite badge row, total estimated time | Course JSON contract locked in Phase 3 CONTEXT.md |
| FRNT-05 | Modules displayed as expand/collapse cards | `<details>`/`<summary>` — no JS needed; first module open by default |
| FRNT-06 | Video card: thumbnail, title, channel, duration, score badge, blurb, outdated warning | All fields present in course JSON contract; thumbnail URL pattern from Phase 3 |
| FRNT-07 | Comprehension questions accordion with textarea per question | `<details>`/`<summary>` pattern; answers NOT persisted |
| FRNT-08 | "Reveal thinking points" button — Phase 4 renders as no-op stub | UI-SPEC defines all states; click handler left as no-op |
| FRNT-09 | Module connecting question at bottom of each module card | `connectingQuestion` field in course JSON |
| FRNT-10 | Dark mode by default; mobile responsive at 375px minimum | `<meta name="color-scheme" content="dark">` already in HTML; CSS custom properties already declared |
| PERS-01 | Courses saved to localStorage history (last 10); clicking restores exact saved course | Full JSON stored per D-06; no regeneration needed |
| PERS-02 | Per-video watched checkboxes in localStorage, persist across reloads | Global flat map by videoId per D-01 |
| PERS-03 | localStorage writes wrapped in try/catch with evict-oldest retry on quota overflow | Evict oldest by generatedAt per D-07 |
| EXPO-01 | "Export course" downloads a markdown file | Blob + anchor click pattern; filename from course title slug; format in UI-SPEC |
</phase_requirements>

---

## Summary

Phase 4 is a complete rewrite of `index.html` from the Phase 1 SSE stub into the production UI. All backend contracts are locked — the course JSON shape, SSE event names and payloads, and error shapes are fixed by Phase 3. This phase is purely a frontend implementation problem with no new backend files.

The existing `index.html` is a 271-line Phase 1 stub. Its CSS custom properties block (colors, spacing, typography) already matches the UI-SPEC exactly and must be preserved as-is. The rewrite adds the full HTML structure and replaces the JS `<script>` block. All JavaScript lives inline in the single HTML file — no modules, no build step, no npm frontend dependencies.

The key implementation challenges are: (1) the SSE event consumption and DOM mutation pattern (5 named events, each updating a labeled step list and progress bar); (2) the localStorage schema and its eviction retry logic; (3) the markdown export Blob generation; and (4) the responsive layout for the video card's horizontal thumbnail + content layout at 375px.

**Primary recommendation:** Build the HTML structure first (all sections hidden/shown with CSS classes), then wire the JS state machine (form submit → SSE open → step updates → course render → history save), then implement the three localStorage stores, then export.

---

## Project Constraints (from CLAUDE.md)

The following directives from CLAUDE.md are binding for this phase:

- `'use strict'` at the top of every JS file — applies inside the inline `<script>` block too
- `module.exports` only / no ESM — not applicable to inline script, but no import/export syntax
- No npm frontend dependencies — all UI is hand-written CSS and JS in `index.html`
- No refactoring the flat file structure into subdirectories
- No TypeScript, no build step
- No logging frameworks, ORMs, or abstraction layers
- Before implementing anything non-trivial, explain approach and wait for approval
- Tests use Node's built-in test runner with `--test-concurrency=1`

---

## Standard Stack

### Core

| Component | Approach | Purpose | Why Standard |
|-----------|----------|---------|--------------|
| HTML/CSS/JS | Vanilla, inline in index.html | Complete UI | Project constraint — no build step, no framework |
| localStorage | Native browser API | History, watched state, recent searches | Project constraint — no database; single-user tool |
| EventSource | Native browser API | Consume SSE stream from `/api/course-stream` | Already established in Phase 1 stub |
| `<details>`/`<summary>` | Native HTML | Module collapse, question accordion | No JS toggle needed; built-in keyboard accessibility |
| Blob + anchor download | Native browser API | Markdown export | Standard pattern for in-browser file generation |

### No External Dependencies

Per project constraints and UI-SPEC registry safety table, there are zero npm frontend dependencies, no icon libraries, no CSS frameworks. All components are hand-written.

**Installation:** Nothing to install — this phase adds no new npm packages.

---

## Architecture Patterns

### Recommended File Structure

This phase modifies exactly one file:

```
index.html          ← complete rewrite (CSS preserved, HTML + JS replaced)
```

No new files. No new npm packages. No backend changes.

### HTML Document Structure

```html
<main>
  <!-- 1. Page title + subtitle (always visible) -->
  <h1>YouTube Learning Curator</h1>

  <!-- 2. Search form (always visible) -->
  <section id="search-form">
    <input id="subject-input" ...>
    <select id="skill-level">...</select>
    <button id="btn-generate">Generate course</button>
  </section>

  <!-- 3. Recent searches (visible when non-empty) -->
  <section id="recent-searches">...</section>

  <!-- 4. History panel (visible when non-empty) -->
  <section id="history-panel">...</section>

  <!-- 5. Pipeline loading state (visible during generation only) -->
  <section id="pipeline-section" hidden>...</section>

  <!-- 6. Error state (visible on pipeline error only) -->
  <section id="error-section" hidden>...</section>

  <!-- 7. Course view (visible after generation completes) -->
  <section id="course-section" hidden>...</section>

  <!-- 8. Empty state (visible on initial load, no course yet) -->
  <section id="empty-state">...</section>
</main>
```

### Pattern 1: JS State Machine via Section Visibility

**What:** The page has 5 mutually exclusive view states. Manage them by toggling the `hidden` attribute on sections (or a CSS class like `.hidden { display: none }`). A single `showSection(id)` helper hides all and reveals the target.

**When to use:** Any state transition — form submit, SSE event, error, history restore.

```javascript
// Sections that are mutually exclusive in the main content area
const CONTENT_SECTIONS = ['pipeline-section', 'error-section', 'course-section', 'empty-state'];

function showContentSection(id) {
  for (const sectionId of CONTENT_SECTIONS) {
    document.getElementById(sectionId).hidden = (sectionId !== id);
  }
}
```

Note: Search form, recent searches, and history panel are NOT in this set — they remain visible during generation.

### Pattern 2: SSE Consumption

**What:** Open EventSource with subject + level as query params. Register a handler per named event. Close EventSource on terminal events (`course_assembled`, `error`). Re-enable form on close.

```javascript
// Source: established in Phase 1 stub + sse.js event contract
const url = `/api/course-stream?subject=${encodeURIComponent(subject)}&skill_level=${encodeURIComponent(level)}`;
const es = new EventSource(url);

const STEPS = ['query_generated', 'videos_fetched', 'scored', 'transcripts_fetched', 'course_assembled'];
STEPS.forEach(eventName => {
  es.addEventListener(eventName, e => {
    const data = JSON.parse(e.data);
    updatePipelineStep(eventName, data);
    if (eventName === 'course_assembled') {
      es.close();
      if (data.error === 'TOO_FEW_VIDEOS') {
        showError(data.message);
      } else {
        renderCourse(data.course);
        saveCourseToHistory(data.course, subject, level);
      }
    }
  });
});

es.addEventListener('error', e => {
  es.close();
  const data = tryParseJSON(e.data);
  showError(resolveErrorMessage(data));
});
```

Note: `skill_level` is the query param name (matches server.js validation). The form uses value `'all levels'` to match `VALID_LEVELS` in server.js (lowercase, space-separated).

### Pattern 3: `<details>`/`<summary>` for Accordions

**What:** Native HTML collapsible — no JS, keyboard accessible by default, no ARIA needed.

```html
<!-- Module card — first one gets open attribute -->
<details class="module-card" open>
  <summary class="module-summary">
    <span class="module-title">Module 1: Title</span>
    <span class="module-count">3 videos</span>
  </summary>
  <!-- video cards + connecting question -->
</details>

<!-- Questions accordion — collapsed by default -->
<details class="questions-accordion">
  <summary>Comprehension questions (3)</summary>
  <!-- question list + textareas -->
</details>
```

### Pattern 4: localStorage Schema

Three namespaced keys (names are Claude's discretion per D-08 — these are recommended):

```javascript
// Key: 'ylc_history'
// Value: array of up to 10 objects, newest first
[
  {
    subject: "machine learning",
    skillLevel: "beginner",
    generatedAt: "2026-04-09T18:00:00.000Z",  // ISO string for sort/display
    course: { /* full CourseObject */ }
  }
]

// Key: 'ylc_watched'
// Value: flat object, keys are videoIds
{ "abc123": true, "def456": true }

// Key: 'ylc_searches'
// Value: array of up to 5 strings, most recent first, unique
["machine learning", "quantum physics", "javascript"]
```

### Pattern 5: localStorage Write with Evict-Oldest Retry (PERS-03)

```javascript
function saveHistory(entries) {
  try {
    localStorage.setItem('ylc_history', JSON.stringify(entries));
  } catch (e) {
    if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
      // Evict oldest entry by generatedAt (earliest date) and retry once
      const sorted = [...entries].sort((a, b) =>
        new Date(a.generatedAt) - new Date(b.generatedAt)
      );
      sorted.shift(); // remove oldest
      try {
        localStorage.setItem('ylc_history', JSON.stringify(sorted));
      } catch (_) {
        // Silent fail — persistence is best-effort
      }
    }
  }
}
```

Note: `QuotaExceededError` is the standard DOMException name. Firefox historically used `NS_ERROR_DOM_QUOTA_REACHED` — both should be caught. [VERIFIED: MDN Web Docs behavior]

### Pattern 6: Markdown Export via Blob Download

```javascript
function exportCourse(course, subject, skillLevel) {
  const md = buildMarkdown(course, subject, skillLevel);
  const blob = new Blob([md], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = slugify(course.title) + '.md';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function slugify(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
```

The markdown format is fully specified in the UI-SPEC. No user answers, no hint text, no score values. Outdated flag preserved as "Note: This video may contain outdated information."

### Pattern 7: Pipeline Step Dot State Machine

Five steps rendered as a vertical list. Each step has a dot whose color reflects state:

| Dot state | CSS color | When |
|-----------|-----------|------|
| pending | `--color-text-muted` (#a0a0a0) | Before corresponding SSE event fires |
| active | `--color-accent` (#3b82f6) with pulse animation | Current step in progress |
| complete | `--color-success` (#22c55e) | SSE event received |
| error | `--color-destructive` (#ef4444) | Error event received |

The SSE event → step label mapping (from UI-SPEC):

```javascript
const STEP_LABELS = {
  query_generated:   'Generating search queries',
  videos_fetched:    'Searching YouTube',
  scored:            'Scoring videos',
  transcripts_fetched: 'Fetching transcripts',
  course_assembled:  'Building your course',
};
```

Active step (the step AFTER the most recently completed one) shows a CSS pulse animation. When an event fires, the matching step goes to "complete" and the next step (if any) shows "active".

### Anti-Patterns to Avoid

- **Event name in step labels:** The UI-SPEC explicitly says don't show SSE event names in the loading UI — map them to human labels.
- **Timestamps in pipeline UI:** Timestamps appear in the dev stub but NOT in the production UI (UI-SPEC: "No timestamps shown during loading").
- **Persisting textarea answers:** REQUIREMENTS.md explicitly marks answer storage as out of scope.
- **Confirmation dialog on new search:** D-04 is explicit — old course clears immediately, no dialog.
- **Storing score values in markdown export:** UI-SPEC export rules forbid including scores.
- **Using `outline: none` on focus:** UI-SPEC accessibility requirement — never remove focus ring without visible alternative.
- **Animating module/question accordions with JS:** Use `<details>`/`<summary>` natively — no JS toggle.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Collapsible UI components | Custom toggle + ARIA | `<details>`/`<summary>` | Native keyboard accessibility, no JS, screen reader compatible |
| File download | Server route | Blob + anchor trick | No server round-trip needed for client-side data |
| Dark mode | JS color switcher | `<meta name="color-scheme" content="dark">` + CSS vars | Already in index.html; system-level, no flash |
| LocalStorage quota errors | Ignore exceptions | try/catch + QuotaExceededError name check | Quota error is a DOMException with a specific name |
| Score badge tiers | Switch/if chain | Lookup table or ternary chain | Color thresholds are fixed per UI-SPEC; simple conditional |

**Key insight:** Every UI problem in this phase has a native HTML/CSS/JS solution. Complexity comes from wiring state correctly, not from picking the right library.

---

## Common Pitfalls

### Pitfall 1: skill_level Query Param Mismatch

**What goes wrong:** The form collects skill level, but the server expects `skill_level` as the query param name (with underscore), and the value `'all levels'` must match exactly — the server's `VALID_LEVELS` set includes lowercase `'all levels'` with a space.

**Why it happens:** The UI-SPEC shows "All Levels" (title case) as the display label, and `<select>` options often use a different `value` attribute than their display text.

**How to avoid:** Set `value="all levels"` (lowercase, space) on the `<option>` element. Use the `name="skill_level"` attribute if using a form action, or read `skillLevelSelect.value` directly and pass it as the `skill_level` query param.

**Warning signs:** The server returns a 400 JSON error instead of starting the SSE stream.

### Pitfall 2: EventSource Auto-Reconnect on Terminal Event

**What goes wrong:** If `eventSource.close()` is not called explicitly after a terminal event (`course_assembled` or `error`), the browser auto-reconnects and the pipeline runs again.

**Why it happens:** EventSource auto-reconnects by default on close/error. The Phase 1 stub correctly calls `eventSource.close()` — this pattern must carry forward.

**How to avoid:** Always call `es.close()` as the first line in the `course_assembled` handler and in the named `error` handler. Also handle `es.onerror` (native EventSource network error, distinct from the named `error` event) with a close + form re-enable.

**Warning signs:** The pipeline fires twice for one form submit; the network tab shows a second SSE connection opening.

### Pitfall 3: course_assembled with error Shape

**What goes wrong:** The frontend assumes every `course_assembled` event carries `data.course`. If `TOO_FEW_VIDEOS` fires, `data.course` is undefined and rendering crashes.

**Why it happens:** The Phase 3 CONTEXT.md defines two shapes for `course_assembled`: success (has `course` key) and error (has `error: 'TOO_FEW_VIDEOS'`). Both arrive as the `course_assembled` SSE event.

**How to avoid:** Always check `if (data.error === 'TOO_FEW_VIDEOS')` before accessing `data.course`. Show the error message string from the copywriting contract: "Not enough high-quality videos found. Try a broader search term."

**Warning signs:** TypeError on `data.course.modules.forEach` when a narrow search term returns few videos.

### Pitfall 4: History Restore Renders Stale Watched State

**What goes wrong:** History entries store the full course JSON at save time. If the user watches a video after restoring history, the watched checkbox appears unchecked because it re-reads from the static course JSON instead of the live `ylc_watched` store.

**Why it happens:** Watched state is global by videoId (D-01), not embedded in the history entry. The render function must always read watched state from `ylc_watched` at render time, not from the course object.

**How to avoid:** Render function reads `const watched = JSON.parse(localStorage.getItem('ylc_watched') || '{}')` and applies `checked` attribute based on `watched[video.videoId]`. Checkbox `change` event updates `ylc_watched`, not the history entry.

**Warning signs:** Watched checkboxes reset when navigating between history entries.

### Pitfall 5: localStorage Quota Error Name Varies by Browser

**What goes wrong:** Catching `QuotaExceededError` by name misses Firefox's `NS_ERROR_DOM_QUOTA_REACHED`.

**Why it happens:** The DOMException `name` property is not consistently `QuotaExceededError` across all browsers.

**How to avoid:** Catch all errors from localStorage.setItem and treat any exception as a potential quota error (since setItem has few other failure modes). Or check `e.name` against both known names:

```javascript
const isQuota = e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED';
```

[VERIFIED: MDN documents both names] [ASSUMED: Safari behavior consistent with QuotaExceededError — training knowledge]

### Pitfall 6: Recent Searches Must Deduplicate and Update at Submit Time

**What goes wrong:** Submitting the same subject twice creates duplicate pills; or the list only updates on successful course generation (missing failed searches per CONTEXT.md specifics).

**Why it happens:** Forgetting the deduplication step, or placing the update call inside the `course_assembled` handler instead of the form submit handler.

**How to avoid:** In the form submit handler: normalize the subject (trim whitespace), read current searches array, remove any existing instance of the subject, unshift the new subject, slice to 5, save and re-render pills. All of this before opening the EventSource.

### Pitfall 7: Markdown Filename Slugification Edge Cases

**What goes wrong:** Course titles with special characters (colons, slashes, parentheses) produce invalid or ugly filenames.

**Why it happens:** The slugify function must strip all non-alphanumeric characters, not just spaces.

**How to avoid:** Use the pattern from CONTEXT.md specifics: `title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')`. This collapses all non-alphanumeric runs to a single hyphen and strips leading/trailing hyphens.

---

## Code Examples

### SSE URL Construction

```javascript
// Source: CONTEXT.md specifics + server.js VALID_LEVELS
const url = `/api/course-stream?subject=${encodeURIComponent(subject)}&skill_level=${encodeURIComponent(skillLevel)}`;
// skillLevel value must be one of: 'beginner', 'intermediate', 'advanced', 'all levels'
```

### Score Badge Color Selection

```javascript
// Source: UI-SPEC score badge tiers
function scoreBadgeColor(score) {
  if (score >= 80) return '#22c55e'; // success green
  if (score >= 60) return '#3b82f6'; // accent blue
  if (score >= 40) return '#f59e0b'; // amber
  return '#a0a0a0';                  // muted gray
}
```

### Relative Time Display (History Panel)

```javascript
// [ASSUMED] — common pattern, no library needed
function relativeTime(isoString) {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return 'just now';
}
```

### Video Duration Formatting

```javascript
// Source: Course JSON has durationSeconds as a number
function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}
```

### CSS Pulse Animation for Active Pipeline Step

```css
/* No JS required — CSS keyframe only */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
.dot-active {
  animation: pulse 1.2s ease-in-out infinite;
  background: var(--color-accent);
}
```

### Markdown Export Builder Skeleton

```javascript
// Source: UI-SPEC markdown export format section
function buildMarkdown(course, subject, skillLevel) {
  const lines = [];
  lines.push(`# ${course.title}`);
  lines.push('');
  lines.push(`**Subject:** ${subject} | **Level:** ${skillLevel} | **Watch time:** ${course.totalWatchTime}`);
  lines.push('');
  lines.push('## Prerequisites');
  for (const prereq of course.prerequisites) lines.push(`- ${prereq}`);
  lines.push('');
  lines.push('## Overview');
  lines.push(course.overview);
  lines.push('');
  lines.push('---');

  for (let mi = 0; mi < course.modules.length; mi++) {
    const mod = course.modules[mi];
    lines.push('');
    lines.push(`## Module ${mi + 1}: ${mod.title}`);
    lines.push('');
    lines.push(mod.description);

    for (const video of mod.videos) {
      lines.push('');
      lines.push(`### ${video.title}`);
      lines.push(`- **Channel:** ${video.channelTitle}`);
      lines.push(`- **Duration:** ${formatDuration(video.durationSeconds)}`);
      lines.push(`- **Link:** ${video.url}`);
      lines.push(`- **Why:** ${video.blurb}`);
      if (video.outdated) {
        lines.push('');
        lines.push('> Note: This video may contain outdated information.');
      }
      lines.push('');
      lines.push('**Questions:**');
      video.questions.forEach((q, i) => {
        const label = q.type.charAt(0).toUpperCase() + q.type.slice(1);
        lines.push(`${i + 1}. (${label}) ${q.text}`);
      });
    }

    lines.push('');
    lines.push(`**Module question:** ${mod.connectingQuestion}`);
    lines.push('');
    lines.push('---');
  }

  return lines.join('\n');
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom JS accordion toggle + ARIA | `<details>`/`<summary>` | HTML5 baseline | No JS needed; native keyboard/screen reader support |
| `window.URL.createObjectURL` | `URL.createObjectURL` (same object, just the global) | Evergreen | Same API — use `URL.createObjectURL` |
| `localStorage.setItem` synchronous blocking | Same (still synchronous in all browsers) | N/A | localStorage is synchronous; no async needed |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Safari throws `QuotaExceededError` (not a Safari-specific name) for localStorage quota | Common Pitfalls #5, Pattern 5 | Quota error not caught on Safari; history write silently fails instead of evicting. Low risk — best-effort persistence. |
| A2 | `relativeTime` function is sufficient without a library | Code Examples | N/A — this is a choice, not a factual claim |
| A3 | `URL.createObjectURL` + `URL.revokeObjectURL` work in all target browsers | Pattern 6 | Markdown download fails in very old browsers. Not a concern for personal tool. |

---

## Environment Availability

Step 2.6: SKIPPED — This phase involves no external tools, services, CLIs, or runtimes beyond what already exists (Node.js for `node server.js`, already verified running). All work is browser-side JS in a single HTML file.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node:test` |
| Config file | none — CLI flags only |
| Quick run command | `node --test --test-concurrency=1 tests/unit/*.test.js` |
| Full suite command | `node --test --test-concurrency=1 tests/unit/*.test.js` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FRNT-01 | Search form HTML structure present | manual-only | — | N/A |
| FRNT-02 | Pipeline step labels map correctly | unit | `node --test --test-concurrency=1 tests/unit/frontend.test.js` | Wave 0 |
| FRNT-03 | Recent searches deduplication + update-on-submit | unit | same | Wave 0 |
| FRNT-04 | Course header rendered from JSON | manual-only | — | N/A |
| FRNT-05 | Module accordion — first open, rest collapsed | manual-only | — | N/A |
| FRNT-06 | Video card renders all fields | manual-only | — | N/A |
| FRNT-07 | Questions accordion collapsed by default | manual-only | — | N/A |
| FRNT-08 | Reveal thinking points button renders; click is no-op | manual-only | — | N/A |
| FRNT-09 | Connecting question at bottom of module | manual-only | — | N/A |
| FRNT-10 | 375px viewport usable; dark mode by default | manual-only | — | N/A |
| PERS-01 | History capped at 10, restore works | unit | same | Wave 0 |
| PERS-02 | Watched state persists across renders | unit | same | Wave 0 |
| PERS-03 | Evict-oldest retry on quota overflow | unit | same | Wave 0 |
| EXPO-01 | Markdown output matches format spec | unit | same | Wave 0 |

**Manual-only justification:** DOM rendering tests require a browser environment (jsdom or real browser). The project uses Node's built-in test runner, not Jest/Vitest, so no jsdom support. Frontend HTML/rendering is verified manually. Pure logic functions (slugify, buildMarkdown, localStorage schema helpers, step label map) can be extracted and unit-tested.

### Sampling Rate

- **Per task commit:** `node --test --test-concurrency=1 tests/unit/*.test.js`
- **Per wave merge:** `node --test --test-concurrency=1 tests/unit/*.test.js`
- **Phase gate:** Full suite green before marking phase complete

### Wave 0 Gaps

- [ ] `tests/unit/frontend.test.js` — covers extractable logic: `slugify`, `buildMarkdown`, `formatDuration`, `relativeTime`, `scoreBadgeColor`, `saveHistory` eviction logic, recent searches dedup, watched state read/write, history schema
- [ ] No framework install needed — `node:test` already in use

---

## Security Domain

This phase is client-side only (single HTML file, no new server routes, no new API endpoints). Standard ASVS assessment:

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | N/A — no auth in this tool |
| V3 Session Management | no | N/A |
| V4 Access Control | no | N/A |
| V5 Input Validation | partial | Subject input already validated server-side (200 char limit, required) — frontend should match: disable submit if empty, max 200 chars |
| V6 Cryptography | no | N/A |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via course title/video title in innerHTML | Tampering | Use `textContent` for all user/API-sourced strings; only use innerHTML for static template structure |
| Stored XSS via localStorage | Tampering | Same — render localStorage data via textContent; treat as untrusted |

**Key security finding:** The course JSON comes from the server (which calls Claude). Video titles, blurbs, and question text must be inserted as `textContent` or properly escaped — never directly interpolated into innerHTML. This is the primary XSS surface in this phase.

---

## Open Questions

1. **Exact course JSON field for duration display**
   - What we know: The course JSON has `durationSeconds` (number) per video and `totalWatchTime` (string, e.g. "4h 20m") at the top level.
   - What's unclear: `totalWatchTime` is pre-formatted by the assembler. The video card shows individual video duration — use `formatDuration(video.durationSeconds)` in the frontend.
   - Recommendation: Use `course.totalWatchTime` verbatim in the course header; compute individual duration display from `video.durationSeconds`.

2. **Skill level select value for "all levels"**
   - What we know: server.js VALID_LEVELS has `'all levels'` (lowercase, space). UI-SPEC shows "All Levels" as display text.
   - What's unclear: Nothing — use `value="all levels"` on the `<option>` element.
   - Recommendation: Confirmed, no gap.

---

## Sources

### Primary (HIGH confidence)

- `04-CONTEXT.md` — All locked decisions (D-01 through D-08), scope, integration points
- `04-UI-SPEC.md` — Visual contract, copywriting contract, markdown export format, color system, spacing, typography, component interaction states
- `03-CONTEXT.md` — Course JSON contract (locked shape), TOO_FEW_VIDEOS error shape
- `server.js` — VALID_LEVELS set, query param names (`subject`, `skill_level`), error wiring
- `sse.js` — SSE event names, payload shapes (`step`, `total`, `message`, `course`, `error`)
- `index.html` — Existing CSS custom properties, SSE consumption pattern from Phase 1 stub
- `REQUIREMENTS.md` — Full requirement text for FRNT-01–10, PERS-01–03, EXPO-01

### Secondary (MEDIUM confidence)

- MDN Web Docs (training knowledge): `QuotaExceededError` and `NS_ERROR_DOM_QUOTA_REACHED` as localStorage quota exception names; `URL.createObjectURL` / `URL.revokeObjectURL` Blob download pattern; `<details>`/`<summary>` native keyboard behavior

### Tertiary (LOW confidence)

- Safari localStorage quota error naming (A1 in Assumptions Log) — cross-verified via training but not tested in session

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all from project constraints and existing code
- Architecture: HIGH — all decisions locked in CONTEXT.md; HTML/CSS/JS patterns are native browser APIs
- Pitfalls: HIGH for items derived from existing code contracts; MEDIUM for localStorage browser compat

**Research date:** 2026-04-09
**Valid until:** 2026-05-09 (stable — no external dependencies to version-drift)
