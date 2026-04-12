---
plan: 06-02
phase: 06-auth
status: complete
tasks_completed: 2
tasks_total: 2
tests_passing: 21
tests_total: 21
---

# Plan 06-02 Summary: Clerk Auth Middleware + Route Protection

## What Was Built

### auth.js
- `requireUser` middleware — returns 401 JSON `{"error":"Unauthorized"}` for unauthenticated API requests; fire-and-forget `getOrCreateUser` upsert on first request; sets `req.userId`
- `getUserId` helper — extracts Clerk user ID from request context

### server.js (restructured)
Route order corrected to:
1. Webhook route (raw body parser — must be before `express.json()`)
2. `clerkMiddleware()` — attaches auth context to all requests
3. Static file serving
4. `express.json()` body parser
5. Protected routes (`/api/course-stream`, `/app`)

### .env.example
All 9 required env vars documented: `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `CLERK_WEBHOOK_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `YOUTUBE_API_KEY`, `ANTHROPIC_API_KEY`, `PORT`, `NODE_ENV`

### tests/unit/auth.test.js (new — 5 tests)
- requireUser: passes through authenticated request
- requireUser: returns 401 for unauthenticated request
- requireUser: fire-and-forget upsert does not block response
- getUserId: returns clerk user ID from auth context
- getUserId: returns null when no auth context

### tests/unit/server.test.js (updated — 16 tests total, 3 new)
- Clerk middleware applied before protected routes
- /api/course-stream returns 401 without auth
- Route order: webhook before clerkMiddleware

## Test Results
21/21 passing

## Commits
- `f6e8527` test(06-02): add failing tests for auth.js requireUser and getUserId
- `a850e28` feat(06-02): implement auth.js requireUser middleware and getUserId helper
- `c5b19f7` feat(06-02): wire Clerk auth into server.js, add .env.example, update server tests

## Threat Mitigations
All threats T-06-05 through T-06-09 implemented:
- T-06-05: Raw body preserved for webhook signature verification
- T-06-06: clerkMiddleware applied globally before route handlers
- T-06-07: 401 JSON (not redirect) for unauthenticated API calls
- T-06-08: Fire-and-forget upsert — auth latency not impacted by DB
- T-06-09: .env.example documents all required secrets
