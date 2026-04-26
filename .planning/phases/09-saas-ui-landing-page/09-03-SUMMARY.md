---
phase: 09-saas-ui-landing-page
plan: 03
subsystem: ui
tags: [html, css, landing-page, marketing, clerk, how-it-works, sample-preview]

# Dependency graph
requires:
  - phase: 09-02
    provides: GET /pricing route and GET /onboarding auth gate registered in server.js

provides:
  - Updated landing.html with nav (Pricing + Sign up free), corrected hero CTAs, 3-step how-it-works section, sample course preview, bottom CTA
  - All href="/app" links removed from landing.html (marketing page has no /app links)
  - CSS classes: .nav, .nav-links, .nav-link, .how-it-works, .steps-list, .step-item, .step-number, .step-heading, .step-description, .sample-preview, .preview-card, .video-list, .video-item, .video-info, .video-title, .video-channel, .score-badge

affects: [09-04, 09-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Nav flex pattern: .nav with space-between, .nav-links flex row — shared across landing/pricing/onboarding"
    - "How-it-works 3-step section: ol.steps-list > li.step-item > p.step-number + h3.step-heading + p.step-description"
    - "Sample preview card: .preview-card > .video-list > .video-item (.video-info + .score-badge)"
    - "Landing page CTAs link to accounts.comoedu.com — no /app links on marketing pages"

key-files:
  created: []
  modified:
    - landing.html

key-decisions:
  - "Committed CSS changes (Task 1) and body changes (Task 2) as separate commits per plan spec"
  - "Old header { padding } CSS rule left in place — harmless since .nav now owns padding; PATTERNS.md instructs not to touch the header/nav-brand CSS block"
  - "Bottom CTA section: secondary 'Go to app' link removed per PATTERNS.md — CTA section has primary button only"
  - "CTA section aria-label updated from 'Get started' to 'Call to action' per plan CHANGE 6"

patterns-established:
  - "Marketing page nav pattern: Pricing text link + Sign up free btn-primary on right"
  - "No /app links on landing.html — marketing pages link only to Clerk auth URLs and /pricing"

requirements-completed:
  - D-05
  - D-06
  - D-07

# Metrics
duration: 12min
completed: 2026-04-26
---

# Phase 9 Plan 03: Landing Page Content Update Summary

**landing.html updated with nav (Pricing + Sign up free), 3-step how-it-works, ML course sample preview, and corrected Clerk auth CTAs — all /app links removed**

## Performance

- **Duration:** 12 min
- **Started:** 2026-04-26T19:10:00Z
- **Completed:** 2026-04-26T19:22:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Replaced old `<header>` bare span with `<nav class="nav">` containing Pricing text link and Sign up free btn-primary
- Added nav CSS block (.nav, .nav-links, .nav-link + hover/focus states)
- Replaced features CSS (.features, .features-list, .feature-item, .feature-heading, .feature-description) with how-it-works + sample-preview CSS blocks
- Replaced features section HTML with 3-step how-it-works `<ol>` (verbatim copy from UI-SPEC)
- Added sample course preview section: "Introduction to Machine Learning" with 3 videos (3Blue1Brown x2, freeCodeCamp.org)
- Updated hero CTAs: Sign up free → accounts.comoedu.com/sign-up, Go to app → Sign in at accounts.comoedu.com/sign-in
- Updated bottom CTA: removed secondary /app link, updated primary btn href to accounts.comoedu.com/sign-up
- Zero href="/app" occurrences remaining in landing.html
- 26 tests pass, 1 fail (GET /pricing — expected, pricing.html created in plan 09-04)

## Task Commits

1. **Task 1: Update landing.html head — title, nav CSS, how-it-works + sample-preview CSS** - `985a8f5` (feat)
2. **Task 2: Update landing.html body — nav HTML, hero CTAs, how-it-works section, sample preview, bottom CTA** - `0ed601e` (feat)

**Plan metadata:** (created in final commit below)

## Files Created/Modified

- `landing.html` — title corrected, nav CSS + how-it-works CSS + sample-preview CSS added, features CSS removed, body fully updated

## Decisions Made

Committed CSS changes and body HTML changes as separate atomic commits (Task 1 and Task 2) per the plan's two-task structure. This means the file was briefly in a state where the CSS had new classes but the old body HTML still referenced removed classes — this is safe for a static HTML file since the browser renders the final state.

Left the old `header { padding }` CSS rule untouched — PATTERNS.md explicitly marks `header / .nav-brand CSS` as "What stays unchanged." The `.nav` class now owns the header padding via its own rule, making the `header` rule effectively inert (padding is overridden by the child `.nav` flex container's own padding).

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. Both tasks completed cleanly. Test baseline maintained (26 pass, 1 expected fail).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- landing.html is complete: nav, hero, how-it-works, sample preview, bottom CTA all updated
- Plan 09-04 (pricing.html) can proceed — GET /pricing route already registered in server.js (plan 09-02)
- Plan 09-05 (onboarding.html) can proceed in parallel with 09-04

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes. landing.html is a static marketing page with hardcoded hrefs to known domains (accounts.comoedu.com, /pricing). T-09-03-01 (external hrefs) accepted per plan threat model. T-09-03-02 (sample preview content) accepted — static mockup data only.

## Self-Check

- landing.html title: `Learn anything with the best YouTube has to offer — YouTube Learning Curator` — FOUND
- landing.html contains `class="how-it-works"`: FOUND (1 occurrence)
- landing.html contains `class="steps-list"`: FOUND
- landing.html contains `class="sample-preview"`: FOUND (1 occurrence)
- landing.html contains `class="preview-card"`: FOUND
- landing.html does NOT contain `class="features-list"`: CONFIRMED (0 occurrences)
- landing.html does NOT contain `class="feature-item"`: CONFIRMED (0 occurrences)
- landing.html contains `href="/pricing"`: FOUND (1 occurrence)
- landing.html contains `href="https://accounts.comoedu.com/sign-up"`: FOUND (3 occurrences — nav, hero, bottom CTA)
- landing.html contains `href="https://accounts.comoedu.com/sign-in"`: FOUND (1 occurrence — hero secondary)
- landing.html contains `3Blue1Brown`: FOUND (2 occurrences)
- landing.html contains `freeCodeCamp.org`: FOUND
- landing.html contains `Ready to start learning?`: FOUND
- landing.html does NOT contain `href="/app"`: CONFIRMED (0 occurrences)
- node --test: 26 pass, 1 fail (expected) — PASS
- Commit 985a8f5: FOUND
- Commit 0ed601e: FOUND

## Self-Check: PASSED

---
*Phase: 09-saas-ui-landing-page*
*Completed: 2026-04-26*
