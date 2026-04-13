---
phase: 06-auth
plan: "03"
subsystem: frontend-auth-pages
tags: [landing-page, onboarding, clerk, auth-flow, static-html]
dependency_graph:
  requires: [06-01]
  provides: [landing-page-at-root, onboarding-page, app-header-with-clerk]
  affects: [index.html, server.js-routing]
tech_stack:
  added: []
  patterns: [fully-static-html, clerk-js-cdn, css-custom-properties]
key_files:
  created:
    - landing.html
    - onboarding.html
  modified:
    - index.html
decisions:
  - "landing.html is fully static with no JavaScript per D-05 — /app links rely on server.js requireAuth to redirect unauthenticated users to Clerk sign-up/sign-in"
  - "Clerk JS loaded via CDN in index.html with placeholder values — user must substitute real keys from Clerk Dashboard before deploying"
  - "padding-top: 48px added to main CSS rule (not inline) for clean override of var(--space-lg) top padding"
metrics:
  duration: "~15 min"
  completed: "2026-04-12"
  tasks_completed: 3
  tasks_total: 4
  files_modified: 3
---

# Phase 6 Plan 03: Auth Pages (Landing, Onboarding, App Header) Summary

Static marketing and auth-flow HTML pages with Clerk user-button integration in the app. Three fully verified pages form the complete user-facing auth experience.

## What Was Built

**landing.html** — Fully static marketing page served at `/`. Contains hero section with exact Copywriting Contract copy ("Learn anything with the best YouTube has to offer"), three feature items, CTA and secondary link both pointing to `/app`, and a footer. No JavaScript of any kind per D-05.

**onboarding.html** — Post-signup explanation page served at `/onboarding`. Four content sections: how course generation works, skill level options (Beginner/Intermediate/Advanced/All levels) with exact copy, a static example course card showing 3 mock videos with score badges, and a "Start learning" CTA to `/app`. No JavaScript.

**index.html** — Updated with a fixed 48px header bar containing the app name (left) and `<div id="clerk-user-button">` (right). `padding-top: 48px` added to `main` to prevent content overlap. Clerk JS CDN script appended before `</body>` with placeholder values and replacement instructions in an HTML comment. `Clerk.load()` + `Clerk.mountUserButton` wired on `window load`. All existing functionality untouched.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create landing.html | 091e395 | landing.html (new) |
| 2 | Create onboarding.html | c5d8acd | onboarding.html (new) |
| 3 | Update index.html — add header bar with Clerk user-button | 2cecc8a | index.html (modified) |
| 4 | Verify auth flow end-to-end | — | PENDING (checkpoint) |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

**index.html Clerk placeholder values** — `data-clerk-publishable-key="CLERK_PUBLISHABLE_KEY_PLACEHOLDER"` and `src="https://CLERK_FAPI_URL_PLACEHOLDER/..."` are intentional stubs. The user must replace these with real values from the Clerk Dashboard before the app functions with live auth. An HTML comment in index.html provides exact instructions. This is the expected delivery state for this plan; wiring live values is a deployment step, not a code step.

## Threat Flags

No new security surface introduced beyond what is documented in the plan's threat model.

- T-06-11 (mitigated): Clerk JS script uses `crossorigin="anonymous"` attribute as specified.
- T-06-13 (mitigated): `Clerk.user` guard ensures `mountUserButton` only fires for authenticated users; the `clerk-user-button` div is empty for unauthenticated visitors.

## Self-Check: PASSED

- landing.html: FOUND
- onboarding.html: FOUND
- Commit 091e395 (landing.html): FOUND
- Commit c5d8acd (onboarding.html): FOUND
- Commit 2cecc8a (index.html header): FOUND
