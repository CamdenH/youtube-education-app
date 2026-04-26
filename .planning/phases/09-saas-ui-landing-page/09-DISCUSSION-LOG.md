# Phase 9: SaaS UI / Landing Page - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-20
**Phase:** 09-saas-ui-landing-page
**Areas discussed:** Page architecture, Landing page content, Onboarding flow, Pricing page

---

## Page Architecture

| Option | Description | Selected |
|--------|-------------|----------|
| Separate HTML files | landing.html, pricing.html, onboarding.html — each served as its own Express route | ✓ |
| View sections in index.html | Add hidden sections; JS toggles between landing/app view based on auth state | |
| Hybrid: separate landing only | landing.html at /, index.html at /app, pricing/onboarding in own files | |

**User's choice:** Separate HTML files  
**Notes:** Routes: GET / → landing.html, GET /app → index.html, GET /pricing → pricing.html, GET /onboarding → onboarding.html

---

### Follow-up: Unauthenticated /app behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Redirect to / (landing page) | Server returns 302 to / if no Clerk session | |
| Redirect to Clerk sign-in | Server returns 302 to accounts.comoedu.com/sign-in directly | ✓ |
| Show app, Clerk handles it | Serve index.html as-is; Clerk JS gates API calls in-page | |

**User's choice:** Redirect to Clerk sign-in

---

## Landing Page Content

### Primary goal

| Option | Description | Selected |
|--------|-------------|----------|
| Sign-up conversion | Headline + value prop + single CTA: "Start learning free" | |
| Feature education + convert | Explain what the app does in detail, then CTA | ✓ |
| Demo-first | Show a sample generated course inline, then CTA | |

**User's choice:** Feature education + convert

---

### Sections to include

| Option | Description | Selected |
|--------|-------------|----------|
| Hero + CTA | Headline, sub-headline, sign-up button | ✓ |
| How it works | 3-step explanation | ✓ |
| Sample course preview | Static mockup or screenshot of a generated course | ✓ |
| Pricing section | Free vs Early Access comparison inline | |

**User's choice:** Hero + CTA, How it works, Sample course preview  
**Notes:** No pricing section on landing page — that's the separate /pricing page

---

### Hero CTA and color scheme

| Option | Description | Selected |
|--------|-------------|----------|
| Go to Clerk sign-up | Button links to accounts.comoedu.com/sign-up | ✓ |
| Go to /app | Button links to /app; auth-gates naturally | |

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, same dark theme | Share CSS variables from index.html | ✓ |
| Different style for landing | Lighter or distinct landing page visual | |

---

## Onboarding Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Guided first generation | "What do you want to learn first?" with topic input | |
| Welcome + explain + CTA | Welcome message, 2-3 bullets, "Start learning" → /app | ✓ |
| Minimal redirect | Auto-redirect to /app after 2 seconds | |

**User's choice:** Welcome + explain + CTA

---

### Mention free tier limit

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, set expectations upfront | Tell user "1 course/month free, upgrade for 20" | ✓ |
| No, just get them to the app | Don't mention limits — they'll see upgrade prompt if needed | |

**User's choice:** Yes — mention free tier limit upfront

---

### Auth gate for /onboarding

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — redirect to / if not authed | Server-side Clerk session check | ✓ |
| No — client-side only | Serve onboarding.html to anyone; Clerk JS handles | |

**User's choice:** Server-side auth gate, redirect to / if no session

---

## Pricing Page

### Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Two-column card comparison | Free card vs Early Access card side by side | ✓ |
| Single-page feature table | Vertical comparison table with checkmarks | |

**User's choice:** Two-column card comparison

---

### Access

| Option | Description | Selected |
|--------|-------------|----------|
| Public — anyone | No auth check; good for marketing conversion | ✓ |
| Auth-gated | Only logged-in users can view /pricing | |

**User's choice:** Public

---

### Upgrade CTA behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Link to Clerk billing portal | CLERK_ACCOUNT_PORTAL_URL (for authed users) or sign-up for visitors | ✓ |
| Link to Clerk sign-up | Always send to sign-up | |

**User's choice:** Clerk billing portal (with sign-up fallback for visitors)

---

### Nav header

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — minimal nav header | Shared nav on landing, pricing, onboarding | ✓ |
| No nav — standalone pages | Each page self-contained | |

**User's choice:** Minimal shared nav on all marketing pages

---

## Claude's Discretion

- Hero headline and sub-headline copy
- "How it works" step descriptions
- Sample course preview subject/content
- Onboarding bullet copy
- Feature list on pricing cards (beyond course count)
- Client-side CTA swap on pricing page for signed-in users

## Deferred Ideas

- Inline pricing section on landing page
- A/B testing landing variants
- Social proof / testimonials
- Email capture / waitlist flow
