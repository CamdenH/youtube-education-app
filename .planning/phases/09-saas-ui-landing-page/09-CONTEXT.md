# Phase 9: SaaS UI / Landing Page - Context

**Gathered:** 2026-04-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the marketing and onboarding surfaces for comoedu.com: a public landing page, a public pricing page, a post-signup onboarding page, and updated Express routing to serve them. The existing `index.html` (the app) moves to `/app`. No changes to course generation logic, billing, or auth — this phase is UI and routing only.

</domain>

<decisions>
## Implementation Decisions

### Page Architecture
- **D-01:** Four separate HTML files, each served by its own Express route:
  - `GET /` → `landing.html` (public)
  - `GET /app` → `index.html` (auth-gated — redirect to Clerk sign-in if no session)
  - `GET /pricing` → `pricing.html` (public)
  - `GET /onboarding` → `onboarding.html` (auth-gated — redirect to `/` if no session)
- **D-02:** `/app` without a Clerk session → 302 redirect to Clerk sign-in (`https://accounts.comoedu.com/sign-in`).
- **D-03:** `/onboarding` without a Clerk session → 302 redirect to `/` (landing page).
- **D-04:** The existing `index.html` is **not** restructured — it keeps its current single-file architecture. The only change is the Express route it's served on (from `/` to `/app`).

### Landing Page
- **D-05:** Goal is feature education → conversion. Three sections:
  1. Hero + CTA (`Sign up free` → `https://accounts.comoedu.com/sign-up`)
  2. How it works (3-step: enter subject → AI curates YouTube → get structured course)
  3. Sample course preview (static mockup showing a generated course structure)
- **D-06:** Landing page uses the same dark color scheme and CSS variables as `index.html` (`--color-bg: #0f0f0f`, `--color-accent: #3b82f6`, etc.) — shared visual identity.
- **D-07:** A minimal nav header appears on landing, pricing, and onboarding pages: site name/logo on the left, "Pricing" link + "Sign in" / "Go to app" on the right.

### Onboarding Flow
- **D-08:** `/onboarding` shows a welcome message, 2–3 bullet points explaining how the app works, and a "Start learning" CTA button that links to `/app`.
- **D-09:** Onboarding page mentions the free tier limit upfront: "Your free plan includes 1 course per month. Upgrade for 20/month."
- **D-10:** Onboarding is auth-gated server-side (see D-03). No client-side-only auth check.

### Pricing Page
- **D-11:** Two-column card layout — Free card on the left, Early Access card on the right.
  - Free: $0/month, 1 course/month, CTA: "Get started" → Clerk sign-up
  - Early Access: $10/month, 20 courses/month, CTA: "Upgrade now" → `CLERK_ACCOUNT_PORTAL_URL` (for authed users) or Clerk sign-up (for visitors)
- **D-12:** Pricing page is public — no auth check. Anyone can view it.
- **D-13:** Shared minimal nav header (same as landing/onboarding — see D-07).

### Claude's Discretion
- Hero headline and sub-headline copy on landing page
- Exact wording for the "How it works" 3-step section
- Sample course preview content (what subject/topic the static mockup shows)
- Exact onboarding bullet point copy
- Which features (beyond course count) to list on pricing cards
- Whether to detect auth state client-side on pricing page to swap "Get started" CTA to "Go to app" for signed-in users

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing app code
- `index.html` — The current app (1,666 lines). Moving from `GET /` to `GET /app`. Read before touching any Express routing.
- `server.js` — Express route registration. All new routes (`/`, `/app`, `/pricing`, `/onboarding`) added here.
- `auth.js` — `requireUser` middleware. Server-side auth gate for `/app` and `/onboarding` uses this (or equivalent Clerk session check).

### Project context
- `.planning/PROJECT.md` — Tech stack constraints (vanilla JS, no framework, no build step, single HTML per file)
- `.planning/phases/08-billing/08-CONTEXT.md` — Tier names (free / early_access), upgrade URL pattern (CLERK_ACCOUNT_PORTAL_URL), upgrade prompt that already exists in index.html

### Clerk config in index.html (lines 1644–1664)
- `signInUrl: 'https://accounts.comoedu.com/sign-in'`
- `signUpUrl: 'https://accounts.comoedu.com/sign-up'`
- `afterSignInUrl: 'https://www.comoedu.com/app'` ← already correct for new routing
- `afterSignUpUrl: 'https://www.comoedu.com/onboarding'` ← already correct

### No external specs
No external spec files — requirements fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- CSS variables in `index.html` `:root` block — copy into all new HTML files for visual consistency (`--color-bg`, `--color-surface`, `--color-accent`, etc.)
- Clerk JS setup (lines 1641–1664 of index.html) — each new HTML file that needs auth state (onboarding, pricing CTA) includes the same Clerk script block
- `auth.js` `requireUser` middleware — already handles Clerk session verification; `/app` and `/onboarding` routes reuse this

### Established Patterns
- `'use strict'` at top of every JS file
- CommonJS `module.exports` only — no ESM
- Express `res.sendFile()` for static HTML files
- Inline `<style>` in each HTML file (no shared CSS file — consistent with existing index.html pattern)

### Integration Points
- `server.js` — Must add 4 new `GET` routes. Current `GET /` (or static serve) must move to `GET /app`
- `auth.js` — `/app` and `/onboarding` routes add `requireUser` (or equivalent redirect logic) before `res.sendFile()`
- `index.html` Clerk config — `afterSignInUrl` already points to `/app`; no change needed

</code_context>

<specifics>
## Specific Ideas

- The shared nav header (D-07) is a small inline HTML+CSS block repeated in landing.html, pricing.html, and onboarding.html — no shared template engine needed, just copy-paste the nav markup across files (consistent with the single-file-per-page constraint)
- Sample course preview on landing page: a static HTML+CSS mockup (not a screenshot image) so it scales cleanly on all devices and stays in-theme

</specifics>

<deferred>
## Deferred Ideas

- Inline pricing section on landing page — user chose not to include it; pricing is its own page
- A/B testing landing page variants — future phase
- Social proof / testimonials section — no users yet, deferred to post-launch
- Email capture before sign-up (waitlist flow) — out of scope; Clerk handles sign-up directly

</deferred>

---

*Phase: 09-saas-ui-landing-page*
*Context gathered: 2026-04-20*
