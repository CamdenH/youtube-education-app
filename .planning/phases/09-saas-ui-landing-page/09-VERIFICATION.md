---
phase: 09-saas-ui-landing-page
verified: 2026-04-26T20:00:00Z
status: human_needed
score: 14/14 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Visit landing.html in browser and confirm visual layout"
    expected: "Nav shows 'Pricing' text link + 'Sign up free' blue button on right; hero CTA links to Clerk sign-up; 3-step how-it-works section renders correctly; sample ML course preview card displays 3 video rows with scores; bottom CTA heading 'Ready to start learning?' present"
    why_human: "Visual rendering and responsive layout cannot be confirmed via grep/test runner — need browser to confirm dark theme, button colors, two-column pricing grid at different viewports"
  - test: "Visit pricing.html in browser, inspect upgrade CTA behavior"
    expected: "Two-column pricing grid renders (Free left, Early Access right with accent border); all feature checkboxes visible; at mobile width (<480px) cards stack to single column; 'Upgrade now' CTA stays on Clerk sign-up URL (window.__upgradeUrl is empty string, guard skips swap)"
    why_human: "Responsive grid stacking, visual border highlight on featured card, and client-side Clerk.load() CTA swap logic require browser verification"
  - test: "Visit /onboarding as unauthenticated user in browser"
    expected: "Browser is redirected to / (landing page) — server-side 302 redirect fires before any HTML is served"
    why_human: "Browser redirect behavior from real Clerk session (not test mock) needs human confirmation"
  - test: "Visit /onboarding as authenticated user in browser"
    expected: "Welcome page renders: 'Welcome to YouTube Learning Curator' heading, 3 bullet items, tier notice with /pricing link, 'Start learning' button linking to /app"
    why_human: "Requires a real Clerk auth session in browser; the test suite mocks Clerk but browser behavior uses the live Clerk JS"
---

# Phase 9: SaaS UI / Landing Page Verification Report

**Phase Goal:** Deliver a polished SaaS marketing and onboarding UI — updated landing page, new pricing page, auth-gated onboarding page, server.js routing — so the app looks and works like a real SaaS product.
**Verified:** 2026-04-26T20:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | GET /pricing route registered in server.js and serves pricing.html | VERIFIED | server.js line 41: `app.get('/pricing', (req, res) => res.sendFile(path.join(__dirname, 'pricing.html')))` |
| 2 | GET /onboarding redirects unauthenticated users to / | VERIFIED | server.js lines 34-38: inline `getAuth(req)`, `if (!userId) return res.redirect('/')` |
| 3 | GET /onboarding returns 200 for authenticated users | VERIFIED | Test 27 passes; route calls `res.sendFile(onboarding.html)` when userId present |
| 4 | All 3 Wave 0 tests pass | VERIFIED | `tests 27 / pass 27 / fail 0` on server.test.js run |
| 5 | landing.html nav shows Pricing link and Sign up free link | VERIFIED | `<a href="/pricing" class="nav-link">Pricing</a>` and `<a href="https://accounts.comoedu.com/sign-up" class="btn-primary">Sign up free</a>` in nav |
| 6 | Hero CTAs link to Clerk sign-up and sign-in URLs, not /app | VERIFIED | Hero: `href="https://accounts.comoedu.com/sign-up"` and `href="https://accounts.comoedu.com/sign-in"`; no `href="/app"` in landing.html (confirmed: 0 occurrences) |
| 7 | Features list replaced with 3-step how-it-works section | VERIFIED | `<section class="how-it-works">` with Step 1/2/3 `<ol class="steps-list">` present; `class="features-list"` and `class="feature-item"` absent (0 occurrences each) |
| 8 | Sample course preview section present with ML course static mockup | VERIFIED | `<section class="sample-preview">` with "Introduction to Machine Learning", 3Blue1Brown (x2), freeCodeCamp.org, and score badges 9.2/9.0/8.7 |
| 9 | Bottom CTA links to Clerk sign-up URL | VERIFIED | `<a href="https://accounts.comoedu.com/sign-up" class="btn-primary">Sign up free</a>` in `.cta-section`; heading "Ready to start learning?" confirmed |
| 10 | pricing.html exists with two-column pricing grid | VERIFIED | File at project root (307 lines); `class="pricing-grid"` with `grid-template-columns: 1fr 1fr`; Free and Early Access cards |
| 11 | Free card CTA links to Clerk sign-up; Early Access CTA has id="upgrade-cta" with Clerk swap | VERIFIED | Free card: `href="https://accounts.comoedu.com/sign-up"`; Early Access: `id="upgrade-cta"` with `Clerk.user && window.__upgradeUrl` guard |
| 12 | window.__upgradeUrl is hardcoded empty string (Option B) | VERIFIED | `<script>window.__upgradeUrl = '';</script>` present; intentional — falsy guard prevents swap when URL absent; fallback is Clerk sign-up URL |
| 13 | onboarding.html has welcome heading, 3 bullets, tier notice with /pricing link, Start learning CTA | VERIFIED | "Welcome to YouTube Learning Curator" h1; 3 `li.step-item` elements; `.tier-notice` with `href="/pricing"` and "Upgrade to Early Access"; `<a href="/app" class="btn-primary">Start learning</a>` |
| 14 | Full test suite passes (186 tests) | VERIFIED | `tests 186 / pass 186 / fail 0` confirmed on `tests/unit/*.test.js` run |

**Score:** 14/14 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `tests/unit/server.test.js` | 3 Wave 0 tests for /pricing and /onboarding auth gate | VERIFIED | Tests at lines 678-714; all 3 GREEN |
| `server.js` | GET /pricing route (public) and GET /onboarding (auth-gated) | VERIFIED | Lines 34-41; /pricing at line 41, /onboarding at lines 34-38 |
| `landing.html` | Updated marketing landing page with nav, hero, how-it-works, sample preview, CTA | VERIFIED | 441 lines; all sections present, no /app hrefs |
| `pricing.html` | Public pricing page with two-tier comparison | VERIFIED | 307 lines; Free + Early Access cards, Clerk swap script, 800px max-width |
| `onboarding.html` | Post-signup onboarding welcome page | VERIFIED | 250 lines; welcome heading, 3 bullets, tier notice, Start learning CTA |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| server.js GET /onboarding | getAuth(req) | inline handler — NOT requireUser | WIRED | Lines 35-37: `const { userId } = getAuth(req); if (!userId) return res.redirect('/')` |
| server.js GET /pricing | pricing.html | res.sendFile | WIRED | Line 41: `res.sendFile(path.join(__dirname, 'pricing.html'))` |
| landing.html nav | /pricing | nav-link anchor | WIRED | `<a href="/pricing" class="nav-link">Pricing</a>` |
| landing.html hero CTA | https://accounts.comoedu.com/sign-up | btn-primary anchor | WIRED | `<a href="https://accounts.comoedu.com/sign-up" class="btn-primary">Sign up free</a>` |
| landing.html .sample-preview | static ML course data | inline HTML video-list | WIRED | 3Blue1Brown, freeCodeCamp.org items in `.video-list` |
| pricing.html upgrade-cta | window.__upgradeUrl or accounts.comoedu.com/sign-up | Clerk.load() + client-side swap | WIRED | `id="upgrade-cta"` + guard `if (Clerk.user && window.__upgradeUrl)` |
| onboarding.html tier-notice | /pricing | anchor in tier-notice paragraph | WIRED | `<a href="/pricing">Upgrade to Early Access</a>` |
| onboarding.html CTA | /app | btn-primary anchor | WIRED | `<a href="/app" class="btn-primary">Start learning</a>` |

### Data-Flow Trace (Level 4)

Not applicable — all new artifacts (landing.html, pricing.html, onboarding.html) are static HTML pages with no server-rendered dynamic data. The Clerk client-side swap in pricing.html reads `window.__upgradeUrl` which is a static empty string (intentional Option B). No dynamic data sources to trace.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| GET /pricing returns 200 | Test 25 in server.test.js | PASS | PASS |
| GET /onboarding unauthenticated redirects to / with 302 | Test 26 in server.test.js | PASS | PASS |
| GET /onboarding authenticated returns 200 | Test 27 in server.test.js | PASS | PASS |
| Full suite 186 tests | `node --test --test-concurrency=1 tests/unit/*.test.js` | 186 pass, 0 fail | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| D-01 | 09-01, 09-02 | Four separate HTML files, each served by its own Express route | SATISFIED | GET /, /app, /pricing, /onboarding all registered; /pricing new in this phase |
| D-02 | 09-02 | /app without Clerk session → 302 redirect to Clerk sign-in | SATISFIED | server.js lines 50-58: existing /app auth gate redirects to CLERK_SIGN_IN_URL |
| D-03 | 09-02 | /onboarding without Clerk session → 302 redirect to / | SATISFIED | server.js lines 34-38: getAuth inline + redirect('/') |
| D-05 | 09-03 | Landing page: Hero + CTA, How it works, Sample preview | SATISFIED | All three sections present in landing.html |
| D-06 | 09-03 | Landing page uses dark color scheme and shared CSS variables | SATISFIED | :root block with --color-bg: #0f0f0f, --color-accent: #3b82f6, etc. present |
| D-07 | 09-03 | Minimal nav header on landing, pricing, onboarding pages | SATISFIED | .nav present in all three HTML files |
| D-08 | 09-05 | /onboarding shows welcome message, 2-3 bullet points, Start learning CTA | SATISFIED | onboarding.html: h1 heading + 3 `li.step-item` + btn-primary → /app |
| D-09 | 09-05 | Onboarding page mentions free tier limit with upgrade path | SATISFIED | "Your free plan includes 1 course per month. Upgrade to Early Access for 20 courses per month." |
| D-10 | 09-02, 09-05 | Onboarding is auth-gated server-side (not client-side only) | SATISFIED | server.js getAuth() check before res.sendFile; route registered before express.static |
| D-11 | 09-04 | Two-column pricing card layout: Free and Early Access | SATISFIED | pricing.html: .pricing-grid with two .pricing-card elements |
| D-12 | 09-02, 09-04 | Pricing page is public — no auth check | SATISFIED | GET /pricing route has no auth middleware; test confirms 200 with no auth |
| D-13 | 09-04 | Pricing page has shared minimal nav header | SATISFIED | pricing.html: nav with brand + Sign in link |

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| pricing.html | `window.__upgradeUrl = ''` | Info | Intentional Option B placeholder — falsy guard prevents broken CTA swap; fallback to Clerk sign-up URL is correct for this phase. Documented in plan 09-04 Known Stubs section. Not a blocker. |

No TODO/FIXME/placeholder comments, empty handlers, or unintentional stubs found in any modified file.

### Human Verification Required

#### 1. Landing page visual layout

**Test:** Open landing.html in browser (via `http://localhost:3000/`)
**Expected:** Dark theme renders correctly; nav shows "Pricing" text link on left and "Sign up free" blue button on right; hero headline visible; 3-step how-it-works section renders with step numbers in accent blue; sample ML course preview card shows 3 video rows with score badges; bottom CTA section centered with "Ready to start learning?" heading
**Why human:** CSS rendering, flex layout, font sizes, and dark theme color correctness cannot be confirmed programmatically

#### 2. Pricing page two-column grid and responsive behavior

**Test:** Open `http://localhost:3000/pricing` in browser; also resize to mobile width (<480px)
**Expected:** Two pricing cards side-by-side on desktop (Free left with standard border, Early Access right with blue accent border); at mobile width cards stack vertically; feature checkmarks visible; "Upgrade now" CTA stays on Clerk sign-up URL (window.__upgradeUrl empty string skips swap)
**Why human:** CSS Grid responsive stacking and visual card border differentiation require browser rendering

#### 3. /onboarding unauthenticated redirect in real browser (non-mocked Clerk)

**Test:** Open `http://localhost:3000/onboarding` in incognito browser with no Clerk session
**Expected:** Browser redirects to `http://localhost:3000/` (landing page) — no flash of onboarding content
**Why human:** Server test mocks Clerk via `_clerkGetAuthImpl`; real browser uses live Clerk middleware and actual session cookies

#### 4. /onboarding authenticated welcome page in real browser

**Test:** Sign in via Clerk, then navigate to `http://localhost:3000/onboarding`
**Expected:** Welcome page renders: heading "Welcome to YouTube Learning Curator", 3 bullet items (Enter any topic / Choose your level / Get your structured course), tier notice with clickable /pricing link, blue "Start learning" button that navigates to /app
**Why human:** Requires a real Clerk auth session; also verifies the nav "Go to app" link appears and links to /app

### Gaps Summary

No gaps found. All 14 must-haves are verified against actual codebase content. The `window.__upgradeUrl = ''` pattern is an intentional documented placeholder (Option B), not a broken stub — the CTA guard correctly falls back to the Clerk sign-up URL when the value is falsy.

4 human verification items remain for browser-side visual and real-Clerk-session behavior. These cannot be automated.

---

_Verified: 2026-04-26T20:00:00Z_
_Verifier: Claude (gsd-verifier)_
