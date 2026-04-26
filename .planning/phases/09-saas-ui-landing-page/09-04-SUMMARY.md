---
phase: 09-saas-ui-landing-page
plan: 04
subsystem: frontend
tags: [html, pricing, clerk, auth-detection, two-tier, css-grid]

# Dependency graph
requires:
  - phase: 09-02
    provides: GET /pricing route registered in server.js (public, serves pricing.html)

provides:
  - pricing.html at project root — public two-tier pricing comparison page
  - Wave 0 test 25 "GET /pricing returns 200 and HTML content" now GREEN

affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "window.__upgradeUrl Option B: hardcoded empty string in HTML — no server injection, no XSS vector; falsy guard skips CTA swap when URL absent"
    - "Clerk client-side auth detection pattern: Clerk.load() in window load event, check Clerk.user before DOM mutation"
    - "CSS Grid two-column pricing layout: grid-template-columns: 1fr 1fr, stacks to 1fr at 480px"
    - "Pricing page max-width exception: 800px instead of 640px to accommodate two-column card grid"

key-files:
  created:
    - pricing.html
  modified: []

key-decisions:
  - "Used window.__upgradeUrl Option B (hardcoded empty string) — no server injection needed; empty string is falsy so CTA swap guard (Clerk.user && window.__upgradeUrl) skips the swap, naturally falling back to sign-up URL"
  - "max-width: 800px on .page-wrapper override (not 640px) — two-column card grid requires wider container"
  - "Nav has Sign in link only (no Sign up CTA) — pricing page visitor is evaluating; sign-in is the relevant action for returning users"

patterns-established:
  - "Option B pattern for window.__upgradeUrl: hardcoded empty string eliminates XSS risk of server injection; upgrade flow handled by Clerk Billing portal once onboarding.html wires it in"

requirements-completed:
  - D-11
  - D-12
  - D-13

# Metrics
duration: 2min
completed: 2026-04-26
---

# Phase 9 Plan 04: Pricing Page Summary

**Pricing.html created with two-tier Free vs Early Access pricing grid, Clerk client-side auth detection, and window.__upgradeUrl Option B — GET /pricing Wave 0 test now GREEN**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-26T19:15:28Z
- **Completed:** 2026-04-26T19:17:18Z
- **Tasks:** 1
- **Files created:** 1

## Accomplishments

- Created pricing.html at project root (307 lines) as a new file from scratch
- Two-column CSS Grid pricing layout: Free card ($0/mo, 1 course/mo) on left, Early Access card ($10/mo, 20 courses/mo) on right
- Free card: 3 feature checklist items, "Get started" CTA → Clerk sign-up
- Early Access card: 4 feature items (adds "Priority support"), id="upgrade-cta" CTA → Clerk sign-up by default, swapped to window.__upgradeUrl when authed
- window.__upgradeUrl set to empty string (Option B) — no server injection; falsy guard prevents CTA swap when URL absent
- Clerk JS script block copied exactly from index.html (publishable key pk_live_Y2xlcmsuY29tb2VkdS5jb20k, CDN URL identical)
- CTA swap guard: `if (Clerk.user && window.__upgradeUrl)` — both conditions must be true; empty string is falsy so unauthenticated users fall back gracefully
- :root CSS variables block copied verbatim from landing.html lines 10-38
- .page-wrapper max-width overridden to 800px (pricing page exception per plan spec)
- Nav: "Sign in" link only on right (no sign-up CTA — pricing is evaluation, not conversion)
- Responsive: grid stacks to single column at ≤480px; pricing-heading drops to 22px
- Wave 0 test 25 "GET /pricing returns 200 and HTML content" flipped from RED to GREEN
- All 27 tests pass — no regressions

## Task Commits

1. **Task 1: Create pricing.html from scratch** - `182b8cf` (feat)

## Files Created/Modified

- `pricing.html` — new file, 307 lines; two-tier pricing grid, Clerk auth detection, Option B upgrade URL

## Decisions Made

Used `window.__upgradeUrl = ''` (Option B) rather than server injection — the plan explicitly chose this for flat-file consistency. The Clerk.load() CTA swap guard uses `if (Clerk.user && window.__upgradeUrl)` which means: (1) unauthenticated users never trigger the swap, (2) authenticated users with an empty __upgradeUrl also never trigger the swap (empty string is falsy), falling back to the sign-up URL in the href attribute. This is the correct behavior for the current phase — the actual upgrade URL will be wired in a future plan when Clerk Billing portal is configured.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

- `window.__upgradeUrl = ''` — intentional placeholder per plan Option B. The upgrade CTA defaults to Clerk sign-up URL when __upgradeUrl is empty. The billing portal URL will be populated in a future plan when Clerk Billing is configured and the server injects it via inline script. This is not a broken stub — the fallback behavior (sign-up URL) is correct for the current phase.

## Threat Surface Scan

No new threat surface beyond what is documented in the plan threat model (T-09-04-01 through T-09-04-04):
- T-09-04-01 (Tampering — CTA swap): Guard `if (Clerk.user && window.__upgradeUrl)` implemented as specified
- T-09-04-02 (XSS — __upgradeUrl): Option B eliminates vector entirely (hardcoded empty string, no server injection)
- T-09-04-03 (Info Disclosure — publishable key): Accepted — pk_live_ keys are designed to be public
- T-09-04-04 (EoP — public access): Accepted — pricing page is intentionally unauthenticated

## Self-Check

- pricing.html exists at project root: FOUND
- pricing.html contains `class="pricing-grid"`: FOUND (1 match)
- pricing.html contains `id="upgrade-cta"`: FOUND (1 match)
- pricing.html contains `window.__upgradeUrl = ''`: FOUND (1 match)
- pricing.html contains `max-width: 800px`: FOUND (1 match)
- pricing.html contains `pricing-card--featured`: FOUND (2 matches — CSS def + HTML class)
- pricing.html does NOT contain `max-width: 640px`: CONFIRMED
- pricing.html contains `data-clerk-publishable-key="pk_live_Y2xlcmsuY29tb2VkdS5jb20k"`: FOUND
- pricing.html contains `Clerk.user && window.__upgradeUrl`: FOUND
- pricing.html contains `AI-curated YouTube courses`: FOUND (2 occurrences — both cards)
- pricing.html contains `Priority support`: FOUND (Early Access card only)
- pricing.html contains `grid-template-columns: 1fr` inside `@media (max-width: 480px)`: FOUND
- Commit 182b8cf: FOUND
- All 27 tests pass: CONFIRMED

## Self-Check: PASSED

---
*Phase: 09-saas-ui-landing-page*
*Completed: 2026-04-26*
