# Phase 9: SaaS UI / Landing Page - Pattern Map

**Mapped:** 2026-04-26
**Files analyzed:** 4 (landing.html, onboarding.html, pricing.html, server.js)
**Analogs found:** 4 / 4

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `landing.html` | page (marketing) | request-response | `landing.html` (existing, partial) | exact — same file, surgical edits |
| `onboarding.html` | page (onboarding) | request-response | `onboarding.html` (existing, partial) | exact — same file, body rebuild |
| `pricing.html` | page (marketing) | request-response | `landing.html` | role-match — same page structure, new content |
| `server.js` | route config | request-response | `server.js` lines 30, 42–51 | exact — two existing route patterns to copy |

---

## Pattern Assignments

### `landing.html` (marketing page, request-response)

**Analog:** `landing.html` (the file itself — surgical edits, not a rewrite)

**What stays unchanged** (executor must NOT touch these):
- `:root` block — lines 10–38 (all CSS variables)
- `*, *::before, *::after` reset — lines 40–42
- `body` rule — lines 44–52
- `.page-wrapper` — lines 54–58
- `header` / `.nav-brand` CSS — lines 60–70
- `.hero`, `.hero-headline`, `.hero-subheading`, `.hero-actions` CSS — lines 72–98
- `.btn-primary` + states — lines 100–120
- `.link-secondary` + states — lines 122–135
- `.cta-section`, `.cta-heading`, `.cta-actions` CSS — lines 177–197
- `footer`, `.footer-text` CSS — lines 199–211
- `@media (max-width: 480px)` rule — lines 213–217
- The entire `<body>` / `.page-wrapper` / `.hero` section HTML — lines 221–235
- The `<!-- CTA section -->` and `<!-- Footer -->` HTML blocks — lines 255–270

**What changes in the `<head>`** (lines 1–219):

HTML meta changes (lines 7–8):
```html
<meta name="description" content="Enter a topic. Get a structured course from the top-rated YouTube videos — scored, sequenced, and ready to watch.">
<title>Learn anything with the best YouTube has to offer — YouTube Learning Curator</title>
```

Nav — add flex layout + nav-links block. The current `<header>` is (lines 222–225):
```html
<header>
  <span class="nav-brand">YouTube Learning Curator</span>
</header>
```
Replace with the nav pattern (see Shared Patterns: Nav Header below).

CSS to ADD (insert after `.link-secondary:focus` block, before `/* ── Features ── */`):
```css
/* ── Nav ───────────────────────────────────────────────────────────────── */

.nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-lg) 0 var(--space-xl);
}

.nav-links {
  display: flex;
  gap: var(--space-md);
  align-items: center;
}

.nav-link {
  font-size: var(--font-size-body);
  color: var(--color-text-muted);
  text-decoration: none;
}

.nav-link:hover {
  color: var(--color-text);
}

.nav-link:focus {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
```

Hero CTA hrefs to update (lines 232–234):
```html
<!-- BEFORE -->
<a href="/app" class="btn-primary">Sign up free</a>
<a href="/app" class="link-secondary">Go to app</a>

<!-- AFTER -->
<a href="https://accounts.comoedu.com/sign-up" class="btn-primary">Sign up free</a>
<a href="https://accounts.comoedu.com/sign-in" class="link-secondary">Sign in</a>
```

**What changes in `<body>`** (lines 220–270):

Replace the entire `<!-- Features section -->` block (lines 237–253) with the how-it-works section. CSS classes to REPLACE (remove `.features`, `.features-list`, `.feature-item`, `.feature-heading`, `.feature-description` — lines 137–173 in current file):

```css
/* ── How it works ──────────────────────────────────────────────────────── */

.how-it-works {
  padding: var(--space-xl) 0;
  border-top: 1px solid var(--color-surface-raised);
}

.how-it-works-heading {
  font-size: var(--font-size-heading);
  font-weight: var(--font-weight-semibold);
  line-height: var(--line-height-heading);
  color: var(--color-text);
  margin: 0 0 var(--space-xl) 0;
}

.steps-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-xl);
}

.step-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.step-number {
  font-size: var(--font-size-label);
  font-weight: var(--font-weight-semibold);
  color: var(--color-accent);
  margin: 0;
  line-height: var(--line-height-label);
}

.step-heading {
  font-size: var(--font-size-heading);
  font-weight: var(--font-weight-semibold);
  line-height: var(--line-height-heading);
  color: var(--color-text);
  margin: 0;
}

.step-description {
  font-size: var(--font-size-body);
  color: var(--color-text-muted);
  line-height: var(--line-height-body);
  margin: 0;
}
```

HTML for the how-it-works section (replaces lines 237–253):
```html
<!-- How it works section -->
<section class="how-it-works" aria-label="How it works">
  <h2 class="how-it-works-heading">How it works</h2>
  <ol class="steps-list">
    <li class="step-item">
      <p class="step-number">Step 1</p>
      <h3 class="step-heading">Enter your topic</h3>
      <p class="step-description">Tell us what you want to learn and your skill level — beginner, intermediate, advanced, or all levels.</p>
    </li>
    <li class="step-item">
      <p class="step-number">Step 2</p>
      <h3 class="step-heading">AI curates the best videos</h3>
      <p class="step-description">We search YouTube and score every video on relevance, depth, channel credibility, and production quality. Only the top 12 make it in.</p>
    </li>
    <li class="step-item">
      <p class="step-number">Step 3</p>
      <h3 class="step-heading">Get a structured course</h3>
      <p class="step-description">Videos are organized into 3–4 thematic modules with sequenced learning, comprehension questions, and hints to help it stick.</p>
    </li>
  </ol>
</section>
```

Insert the sample-preview section AFTER the how-it-works section and BEFORE the existing `<!-- CTA section -->`. CSS to ADD for the preview (copy `.example-card`, `.video-list`, `.video-item`, `.video-info`, `.video-title`, `.video-channel`, `.score-badge` from `onboarding.html` lines 127–190, renaming `.example-card` to `.preview-card`):

```css
/* ── Sample course preview ──────────────────────────────────────────────── */

.sample-preview {
  padding: var(--space-xl) 0;
  border-top: 1px solid var(--color-surface-raised);
}

.sample-preview-heading {
  font-size: var(--font-size-heading);
  font-weight: var(--font-weight-semibold);
  line-height: var(--line-height-heading);
  color: var(--color-text);
  margin: 0 0 var(--space-md) 0;
}

.preview-card {
  background: var(--color-surface);
  border-radius: 8px;
  padding: var(--space-md);
  border: 1px solid var(--color-surface-raised);
}

.preview-course-title {
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
  margin: 0 0 var(--space-xs) 0;
}

.module-heading {
  font-size: var(--font-size-label);
  color: var(--color-text-muted);
  margin: 0 0 var(--space-md) 0;
}

.video-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.video-item {
  background: var(--color-surface-raised);
  border-radius: 6px;
  padding: var(--space-sm) var(--space-md);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
}

.video-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.video-title {
  font-size: var(--font-size-body);
  color: var(--color-text);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.video-channel {
  font-size: var(--font-size-label);
  color: var(--color-text-muted);
  margin: 0;
}

.score-badge {
  font-size: var(--font-size-label);
  font-weight: var(--font-weight-semibold);
  color: var(--color-accent);
  white-space: nowrap;
  flex-shrink: 0;
}
```

HTML for the sample preview section (insert after how-it-works, before CTA):
```html
<!-- Sample course preview -->
<section class="sample-preview" aria-label="Sample course">
  <h2 class="sample-preview-heading">What you get</h2>
  <div class="preview-card">
    <p class="preview-course-title">Introduction to Machine Learning</p>
    <p class="module-heading">Module 1: Foundations</p>
    <ul class="video-list">
      <li class="video-item">
        <div class="video-info">
          <p class="video-title">But what is a neural network?</p>
          <p class="video-channel">3Blue1Brown</p>
        </div>
        <span class="score-badge">9.2</span>
      </li>
      <li class="video-item">
        <div class="video-info">
          <p class="video-title">Gradient descent, how neural networks learn</p>
          <p class="video-channel">3Blue1Brown</p>
        </div>
        <span class="score-badge">9.0</span>
      </li>
      <li class="video-item">
        <div class="video-info">
          <p class="video-title">Machine Learning for Everybody</p>
          <p class="video-channel">freeCodeCamp.org</p>
        </div>
        <span class="score-badge">8.7</span>
      </li>
    </ul>
  </div>
</section>
```

Bottom CTA href to update (line 259 in current file):
```html
<!-- BEFORE -->
<a href="/app" class="btn-primary">Sign up free</a>

<!-- AFTER -->
<a href="https://accounts.comoedu.com/sign-up" class="btn-primary">Sign up free</a>
```

Also remove the secondary link in the existing CTA section (line 260: `<a href="/app" class="link-secondary">Go to app</a>`) — the CTA section on the landing page only has the primary button per the UI-SPEC.

---

### `onboarding.html` (onboarding page, request-response)

**Analog:** `onboarding.html` (the file itself — body rebuild; keep `<head>` CSS variables)

**What stays unchanged:**
- `:root` block — lines 10–38 (all CSS variables — identical to landing.html)
- `*, *::before, *::after` reset — lines 40–42
- `body` rule — lines 44–52

**`<head>` meta changes:**
```html
<!-- BEFORE (lines 7–8) -->
<meta name="description" content="How YouTube Learning Curator works — structured courses from the best YouTube videos.">
<title>How it works — YouTube Learning Curator</title>

<!-- AFTER -->
<meta name="description" content="You're all set. Here's how to get the most out of YouTube Learning Curator.">
<title>Welcome — YouTube Learning Curator</title>
```

**CSS — remove all of these blocks** (they are not used in the new structure):
- `.page-header`, `.page-title` — lines 60–72
- `.content-section`, `.section-heading`, `.section-body` — lines 74–94
- `.skill-list`, `.skill-item`, `.skill-label`, `.skill-description` — lines 96–124
- `.example-card`, `.example-course-title`, `.video-list`, `.video-item`, `.video-info`, `.video-title`, `.video-channel`, `.score-badge` — lines 126–190

**CSS — add these new blocks** (after `body` rule, before `@media`):

```css
/* ── Page wrapper ───────────────────────────────────────────────────────── */

.page-wrapper {
  max-width: 640px;
  margin: 0 auto;
  padding: var(--space-lg);
}

/* ── Nav ───────────────────────────────────────────────────────────────── */

.nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-lg) 0 var(--space-xl);
}

.nav-brand {
  font-size: var(--font-size-label);
  color: var(--color-text-muted);
  line-height: var(--line-height-label);
}

.nav-links {
  display: flex;
  gap: var(--space-md);
  align-items: center;
}

.nav-link {
  font-size: var(--font-size-body);
  color: var(--color-text-muted);
  text-decoration: none;
}

.nav-link:hover {
  color: var(--color-text);
}

.nav-link:focus {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

/* ── Welcome heading ────────────────────────────────────────────────────── */

.hero-headline {
  font-size: var(--font-size-display);
  font-weight: var(--font-weight-semibold);
  line-height: var(--line-height-display);
  color: var(--color-text);
  margin: 0 0 var(--space-xl) 0;
}

/* ── Onboarding steps ───────────────────────────────────────────────────── */

.onboarding-steps {
  list-style: none;
  margin: 0 0 var(--space-xl) 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.step-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.step-heading {
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
  margin: 0;
}

.step-body {
  font-size: var(--font-size-body);
  color: var(--color-text-muted);
  line-height: var(--line-height-body);
  margin: 0;
}

/* ── Tier notice ────────────────────────────────────────────────────────── */

.tier-notice {
  font-size: var(--font-size-body);
  color: var(--color-text-muted);
  margin: 0 0 var(--space-xl) 0;
}

.tier-notice a {
  color: var(--color-accent);
  text-decoration: none;
}

.tier-notice a:hover {
  text-decoration: underline;
}

/* ── CTA section ────────────────────────────────────────────────────────── */

.cta-section {
  padding: var(--space-xl) 0 var(--space-2xl);
}

/* ── btn-primary ────────────────────────────────────────────────────────── */
/* Source: onboarding.html lines 199–219 (identical pattern to landing.html) */

.btn-primary {
  display: inline-block;
  background: var(--color-accent);
  color: white;
  text-decoration: none;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: var(--font-size-body);
  font-family: inherit;
  font-weight: var(--font-weight-semibold);
  line-height: var(--line-height-body);
}

.btn-primary:hover {
  opacity: 0.9;
}

.btn-primary:focus {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

/* ── Footer ─────────────────────────────────────────────────────────────── */

footer {
  padding: var(--space-xl) 0 var(--space-lg);
  border-top: 1px solid var(--color-surface-raised);
}

.footer-text {
  font-size: var(--font-size-label);
  color: var(--color-text-muted);
  margin: 0;
  line-height: var(--line-height-label);
}
```

**`@media` update** — change the selector from `.page-title` to `.hero-headline`:
```css
@media (max-width: 480px) {
  .hero-headline {
    font-size: 22px;
  }
}
```

**Full `<body>` replacement** (replace everything from line 228 `<body>` to line 303 `</body>`):
```html
<body>
  <div class="page-wrapper">
    <!-- Nav -->
    <header>
      <nav class="nav">
        <span class="nav-brand">YouTube Learning Curator</span>
        <div class="nav-links">
          <a href="/app" class="nav-link">Go to app</a>
        </div>
      </nav>
    </header>

    <!-- Welcome section -->
    <main>
      <section aria-label="Welcome">
        <h1 class="hero-headline">Welcome to YouTube Learning Curator</h1>
        <ul class="onboarding-steps">
          <li class="step-item">
            <p class="step-heading">Enter any topic</p>
            <p class="step-body">Type a subject you want to learn — anything from Python basics to music theory.</p>
          </li>
          <li class="step-item">
            <p class="step-heading">Choose your level</p>
            <p class="step-body">Pick beginner, intermediate, advanced, or all levels. The course adapts to where you are.</p>
          </li>
          <li class="step-item">
            <p class="step-heading">Get your structured course</p>
            <p class="step-body">AI curates the top YouTube videos, organizes them into modules, and generates comprehension questions.</p>
          </li>
        </ul>
        <p class="tier-notice">Your free plan includes 1 course per month. <a href="/pricing">Upgrade to Early Access</a> for 20 courses per month.</p>
        <div class="cta-section">
          <a href="/app" class="btn-primary">Start learning</a>
        </div>
      </section>
    </main>

    <!-- Footer -->
    <footer>
      <p class="footer-text">YouTube Learning Curator</p>
    </footer>
  </div>
</body>
```

---

### `pricing.html` (marketing page, request-response)

**Analog:** `landing.html` — copy the full document skeleton (DOCTYPE, head, CSS variables, body/page-wrapper/header/footer patterns). Pricing.html does not yet exist — create from scratch.

**Full document structure to follow from `landing.html`:**

Document skeleton (lines 1–219 of landing.html as template):
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="description" content="Start free with 1 course per month. Upgrade to Early Access for 20 courses per month.">
  <title>Pricing — YouTube Learning Curator</title>
  <style>
    /* --- copy :root block verbatim from landing.html lines 10–38 --- */
    /* --- copy *, body, .page-wrapper from landing.html lines 40–58 --- */
    /* --- copy header, .nav-brand, .nav, .nav-links, .nav-link CSS --- */
    /* --- copy .btn-primary + states --- */
    /* --- copy footer, .footer-text --- */
    /* --- copy @media (max-width: 480px) --- */
    /* --- ADD pricing-specific CSS below --- */
  </style>
</head>
```

**max-width exception** — pricing page uses 800px, not 640px:
```css
/* Override .page-wrapper max-width for two-column grid */
.page-wrapper {
  max-width: 800px;
  margin: 0 auto;
  padding: var(--space-lg);
}
```

**Nav for pricing.html** (differs from landing — "Sign in" only on right, no "Sign up free"):
```html
<header>
  <nav class="nav">
    <span class="nav-brand">YouTube Learning Curator</span>
    <div class="nav-links">
      <a href="https://accounts.comoedu.com/sign-in" class="nav-link">Sign in</a>
    </div>
  </nav>
</header>
```

**Pricing-specific CSS** (add after shared classes):
```css
/* ── Pricing page heading ───────────────────────────────────────────────── */

.pricing-heading {
  font-size: var(--font-size-display);
  font-weight: var(--font-weight-semibold);
  line-height: var(--line-height-display);
  color: var(--color-text);
  margin: 0 0 var(--space-xl) 0;
}

/* ── Pricing grid ───────────────────────────────────────────────────────── */

.pricing-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-xl);
  margin-bottom: var(--space-xl);
}

.pricing-card {
  background: var(--color-surface);
  border-radius: 8px;
  padding: var(--space-xl);
  border: 1px solid var(--color-surface-raised);
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.pricing-card--featured {
  border-color: var(--color-accent);
}

.pricing-card-name {
  font-size: var(--font-size-heading);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
  margin: 0;
}

.pricing-card-price {
  font-size: var(--font-size-display);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
  margin: 0;
}

.pricing-card-period {
  font-size: var(--font-size-label);
  color: var(--color-text-muted);
  font-weight: var(--font-weight-regular);
}

.pricing-card-limit {
  font-size: var(--font-size-body);
  color: var(--color-text-muted);
  margin: 0;
}

.pricing-feature-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  flex: 1;
}

.pricing-feature-item {
  font-size: var(--font-size-body);
  color: var(--color-text-muted);
  display: flex;
  gap: var(--space-sm);
  align-items: flex-start;
}

.pricing-feature-check {
  color: var(--color-success);
  flex-shrink: 0;
}

@media (max-width: 480px) {
  .pricing-grid {
    grid-template-columns: 1fr;
  }

  .pricing-heading {
    font-size: 22px;
  }
}
```

**Pricing page body HTML:**
```html
<body>
  <div class="page-wrapper">
    <!-- Nav -->
    <header>
      <nav class="nav">
        <span class="nav-brand">YouTube Learning Curator</span>
        <div class="nav-links">
          <a href="https://accounts.comoedu.com/sign-in" class="nav-link">Sign in</a>
        </div>
      </nav>
    </header>

    <!-- Pricing section -->
    <main>
      <section aria-label="Pricing">
        <h1 class="pricing-heading">Pricing</h1>
        <div class="pricing-grid">
          <!-- Free card -->
          <div class="pricing-card">
            <p class="pricing-card-name">Free</p>
            <p class="pricing-card-price">$0 <span class="pricing-card-period">per month</span></p>
            <p class="pricing-card-limit">1 course per month</p>
            <ul class="pricing-feature-list">
              <li class="pricing-feature-item"><span class="pricing-feature-check">&#10003;</span> AI-curated YouTube courses</li>
              <li class="pricing-feature-item"><span class="pricing-feature-check">&#10003;</span> Structured modules + comprehension questions</li>
              <li class="pricing-feature-item"><span class="pricing-feature-check">&#10003;</span> Hint generation</li>
            </ul>
            <a href="https://accounts.comoedu.com/sign-up" class="btn-primary">Get started</a>
          </div>
          <!-- Early Access card -->
          <div class="pricing-card pricing-card--featured">
            <p class="pricing-card-name">Early Access</p>
            <p class="pricing-card-price">$10 <span class="pricing-card-period">per month</span></p>
            <p class="pricing-card-limit">20 courses per month</p>
            <ul class="pricing-feature-list">
              <li class="pricing-feature-item"><span class="pricing-feature-check">&#10003;</span> AI-curated YouTube courses</li>
              <li class="pricing-feature-item"><span class="pricing-feature-check">&#10003;</span> Structured modules + comprehension questions</li>
              <li class="pricing-feature-item"><span class="pricing-feature-check">&#10003;</span> Hint generation</li>
              <li class="pricing-feature-item"><span class="pricing-feature-check">&#10003;</span> Priority support</li>
            </ul>
            <a id="upgrade-cta" href="https://accounts.comoedu.com/sign-up" class="btn-primary">Upgrade now</a>
          </div>
        </div>
      </section>
    </main>

    <!-- Footer -->
    <footer>
      <p class="footer-text">YouTube Learning Curator</p>
    </footer>
  </div>

  <!-- window.__upgradeUrl: Option B — hardcode empty string; falls back to sign-up URL -->
  <!-- Source: RESEARCH.md Pattern 3, Pitfall 2 — Option B chosen for flat-file consistency -->
  <script>window.__upgradeUrl = '';</script>

  <!-- Clerk JS — same script tag as index.html lines 1644–1650 -->
  <script
    defer
    crossorigin="anonymous"
    data-clerk-publishable-key="pk_live_Y2xlcmsuY29tb2VkdS5jb20k"
    src="https://clerk.comoedu.com/npm/@clerk/clerk-js@6/dist/clerk.browser.js"
    type="text/javascript"
  ></script>

  <!-- Client-side auth detection: swap "Upgrade now" CTA for authed users -->
  <!-- Source: index.html lines 1652–1663 — same Clerk.load() pattern -->
  <script>
    window.addEventListener('load', async function () {
      await Clerk.load({
        signInUrl: 'https://accounts.comoedu.com/sign-in',
        signUpUrl: 'https://accounts.comoedu.com/sign-up',
      });
      if (Clerk.user && window.__upgradeUrl) {
        var upgradeBtn = document.getElementById('upgrade-cta');
        if (upgradeBtn) upgradeBtn.href = window.__upgradeUrl;
      }
    });
  </script>
</body>
```

**Critical notes for executor:**
- `window.__upgradeUrl` is set to empty string (Option B). The `if (Clerk.user && window.__upgradeUrl)` guard means the swap only fires when the URL is truthy — an empty string is falsy, so unauthenticated users and missing env scenarios both fall back to sign-up URL gracefully.
- The Clerk script block is identical to index.html lines 1644–1650. Copy it exactly — same publishable key, same CDN URL.
- `GET /pricing` must be registered BEFORE `app.use(express.static(__dirname))` at server.js line 35 (see server.js pattern below).

---

### `server.js` (route config, request-response)

**Analog:** `server.js` itself — two existing patterns to extend.

**Pattern 1: Public static route** (analog: line 30, `GET /`):
```javascript
// Source: server.js line 30
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'landing.html')));

// New route to add — same one-liner pattern:
app.get('/pricing', (req, res) => res.sendFile(path.join(__dirname, 'pricing.html')));
```

**Pattern 2: Auth-gated HTML route with redirect** (analog: lines 42–51, `GET /app`):
```javascript
// Source: server.js lines 42–51 — canonical model for /onboarding gate
app.get('/app', (req, res, next) => {
  const { userId } = getAuth(req);
  if (userId) return next();
  const signInUrl = new URL(process.env.CLERK_SIGN_IN_URL);
  const appBase = process.env.APP_URL || `${req.protocol}://${req.hostname}`;
  signInUrl.searchParams.set('redirect_url', `${appBase}/app`);
  return res.redirect(signInUrl.toString());
}, (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// /onboarding gate — simpler: redirect to / (not Clerk sign-in), no redirect_url param
// Replace the existing line 33:
//   app.get('/onboarding', (req, res) => res.sendFile(path.join(__dirname, 'onboarding.html')));
// With:
app.get('/onboarding', (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'onboarding.html'));
});
```

**Placement rule** (source: server.js line 35 context):
Both the new `GET /pricing` route and the updated `GET /onboarding` route must be registered BEFORE `app.use(express.static(__dirname))` at line 35. Current `GET /onboarding` at line 33 is already before static — keep it there. Insert `GET /pricing` between lines 33 and 35 (after `/onboarding`, before static middleware).

**CRITICAL — do NOT use `requireUser`** (source: `auth.js` lines 6–18):
```javascript
// auth.js lines 6–9 — requireUser returns 401 JSON, NOT a redirect
async function requireUser(req, res, next) {
  const { userId } = getAuth(req);
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  // ...
}
// Using requireUser on /onboarding would show raw JSON in browser — wrong behavior.
// Use inline getAuth() + res.redirect('/') as shown above.
```

**New tests needed in `tests/unit/server.test.js`** — follow the mock pattern from lines 51–67 and 136–138:
```javascript
// Source: server.test.js lines 51–67 — _clerkGetAuthImpl mock pattern

// Test 1: GET /pricing returns 200
test('GET /pricing returns 200 and HTML content', async () => {
  const server = app.listen(0);
  const port = server.address().port;
  try {
    const res = await fetch(`http://localhost:${port}/pricing`);
    assert.strictEqual(res.status, 200);
  } finally {
    server.close();
  }
});

// Test 2: GET /onboarding unauthenticated → 302 to /
test('GET /onboarding unauthenticated redirects to /', async () => {
  _clerkGetAuthImpl = () => ({ userId: null });
  const server = app.listen(0);
  const port = server.address().port;
  try {
    const res = await fetch(`http://localhost:${port}/onboarding`, { redirect: 'manual' });
    assert.strictEqual(res.status, 302);
    assert.strictEqual(res.headers.get('location'), '/');
  } finally {
    _clerkGetAuthImpl = () => ({ userId: null });
    server.close();
  }
});

// Test 3: GET /onboarding authenticated → 200
test('GET /onboarding authenticated returns 200', async () => {
  _clerkGetAuthImpl = () => ({ userId: 'user_test123' });
  const server = app.listen(0);
  const port = server.address().port;
  try {
    const res = await fetch(`http://localhost:${port}/onboarding`);
    assert.strictEqual(res.status, 200);
  } finally {
    _clerkGetAuthImpl = () => ({ userId: null });
    server.close();
  }
});
```

---

## Shared Patterns

### CSS Variables Block (`:root`)
**Source:** `landing.html` lines 10–38 / `onboarding.html` lines 10–38 (identical in both)
**Apply to:** All new HTML files — copy verbatim into each file's `<style>` block

```css
:root {
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
  --space-2xl: 48px;
  --space-3xl: 64px;

  --font-size-label: 14px;
  --font-size-body: 16px;
  --font-size-heading: 20px;
  --font-size-display: 28px;
  --font-weight-regular: 400;
  --font-weight-semibold: 600;
  --line-height-body: 1.5;
  --line-height-label: 1.4;
  --line-height-heading: 1.2;
  --line-height-display: 1.15;

  --color-bg: #0f0f0f;
  --color-surface: #1a1a1a;
  --color-surface-raised: #242424;
  --color-text: #f0f0f0;
  --color-text-muted: #a0a0a0;
  --color-accent: #3b82f6;
  --color-success: #22c55e;
  --color-destructive: #ef4444;
}
```

### CSS Reset + Body
**Source:** `landing.html` lines 40–58
**Apply to:** All new HTML files

```css
*, *::before, *::after {
  box-sizing: border-box;
}

body {
  background: var(--color-bg);
  color: var(--color-text);
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: var(--font-size-body);
  line-height: var(--line-height-body);
  margin: 0;
  padding: 0;
}
```

### Primary Button
**Source:** `landing.html` lines 100–120 (identical in `onboarding.html` lines 199–219)
**Apply to:** All new HTML files

```css
.btn-primary {
  display: inline-block;
  background: var(--color-accent);
  color: white;
  text-decoration: none;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: var(--font-size-body);
  font-family: inherit;
  font-weight: var(--font-weight-semibold);
  line-height: var(--line-height-body);
}

.btn-primary:hover {
  opacity: 0.9;
}

.btn-primary:focus {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
```

### Nav Header HTML + CSS
**Source:** `landing.html` (current `header` + `.nav-brand` CSS, extended with nav flex pattern)
**Apply to:** `landing.html`, `pricing.html`, `onboarding.html` — links differ per page (see per-file assignments)

```css
.nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-lg) 0 var(--space-xl);
}

.nav-brand {
  font-size: var(--font-size-label);
  color: var(--color-text-muted);
  line-height: var(--line-height-label);
}

.nav-links {
  display: flex;
  gap: var(--space-md);
  align-items: center;
}

.nav-link {
  font-size: var(--font-size-body);
  color: var(--color-text-muted);
  text-decoration: none;
}

.nav-link:hover {
  color: var(--color-text);
}

.nav-link:focus {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
```

Nav right-link configuration per page:
- `landing.html`: `<a href="/pricing" class="nav-link">Pricing</a>` + `<a href="https://accounts.comoedu.com/sign-up" class="btn-primary">Sign up free</a>`
- `pricing.html`: `<a href="https://accounts.comoedu.com/sign-in" class="nav-link">Sign in</a>`
- `onboarding.html`: `<a href="/app" class="nav-link">Go to app</a>`

### Footer
**Source:** `landing.html` lines 200–211
**Apply to:** All new HTML files

```css
footer {
  padding: var(--space-xl) 0 var(--space-lg);
  border-top: 1px solid var(--color-surface-raised);
}

.footer-text {
  font-size: var(--font-size-label);
  color: var(--color-text-muted);
  margin: 0;
  line-height: var(--line-height-label);
}
```

```html
<footer>
  <p class="footer-text">YouTube Learning Curator</p>
</footer>
```

### Clerk JS Script Block
**Source:** `index.html` lines 1644–1650
**Apply to:** `pricing.html` only (only page with client-side auth detection in this phase)

```html
<script
  defer
  crossorigin="anonymous"
  data-clerk-publishable-key="pk_live_Y2xlcmsuY29tb2VkdS5jb20k"
  src="https://clerk.comoedu.com/npm/@clerk/clerk-js@6/dist/clerk.browser.js"
  type="text/javascript"
></script>
```

### getAuth() Server-Side Auth Gate
**Source:** `server.js` lines 7, 42–51
**Apply to:** `GET /onboarding` route in server.js

```javascript
// Pattern: getAuth(req) returns { userId } — null when unauthenticated
const { userId } = getAuth(req);
if (!userId) return res.redirect('/');
res.sendFile(path.join(__dirname, 'onboarding.html'));
```

`getAuth` is already imported at server.js line 7: `const { clerkMiddleware, requireAuth, getAuth } = require('@clerk/express');` — no new import needed.

### Section Divider
**Source:** `landing.html` lines 141, 178 — every section that follows another gets `border-top`
**Apply to:** All `<section>` elements that follow another section (how-it-works, sample-preview, cta-section, footer)

```css
border-top: 1px solid var(--color-surface-raised);
```

---

## No Analog Found

All four files have close analogs in the existing codebase. No files require falling back to RESEARCH.md patterns exclusively.

The one design decision with no direct codebase analog is the `window.__upgradeUrl` Option B pattern on pricing.html (hardcoded empty string). RESEARCH.md Pattern 3 / Pitfall 2 documents this fully — the executor should use Option B (empty string placeholder) per the research recommendation.

---

## Metadata

**Analog search scope:** project root (`landing.html`, `onboarding.html`, `index.html`, `server.js`, `auth.js`, `tests/unit/server.test.js`)
**Files scanned:** 7
**Pattern extraction date:** 2026-04-26
