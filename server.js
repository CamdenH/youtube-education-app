'use strict';

require('dotenv').config();

const path = require('path');
const express = require('express');
const { clerkMiddleware, requireAuth, getAuth } = require('@clerk/express');
const { clerkWebhookHandler } = require('./webhooks');
const { requireUser } = require('./auth');
const { courseStreamHandler, sendEvent } = require('./sse');
const { transcriptHandler } = require('./transcript');
const { YouTubeQuotaError } = require('./youtube');
const { callClaude, parseClaudeJSON } = require('./claude');
const Anthropic = require('@anthropic-ai/sdk');
const anthropic = new Anthropic();

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

// STEP 1: Webhook route with raw body — BEFORE express.json() (D-11)
// Raw body is required by verifyWebhook for HMAC-SHA256 signature check (T-06-09)
app.post('/api/webhooks/clerk', express.raw({ type: 'application/json' }), clerkWebhookHandler);

// STEP 2: Clerk middleware — before static files and routes
app.use(clerkMiddleware());

// STEP 3: Landing page — fully static, no auth (D-05)
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'landing.html')));

// STEP 4: Onboarding — static, no auth gate (accessible post-signup before session fully established)
app.get('/onboarding', (req, res) => res.sendFile(path.join(__dirname, 'onboarding.html')));

// STEP 5: Static files (CSS, JS assets) — unchanged
app.use(express.static(__dirname));

// STEP 6: JSON body parser — AFTER webhook route (D-11)
app.use(express.json());

// STEP 7: Protected HTML route — redirect unauth to Clerk sign-in with return URL (D-04, T-06-06)
app.get('/app', (req, res, next) => {
  const { userId } = getAuth(req);
  if (userId) return next();
  const signInUrl = new URL(process.env.CLERK_SIGN_IN_URL);
  signInUrl.searchParams.set('redirect_url', `${req.protocol}://${req.hostname}/app`);
  return res.redirect(signInUrl.toString());
}, (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Validation constants for /api/course-stream
const VALID_LEVELS = new Set(['beginner', 'intermediate', 'advanced', 'all levels']);

// STEP 8: Protected API routes — return 401 JSON (AUTH-03, T-06-05)
app.get('/api/course-stream', requireUser, async (req, res) => {
  // Validate inputs before opening SSE stream
  const { subject, skill_level } = req.query;

  if (!subject || subject.length > 200) {
    return res.status(400).json({ error: 'subject is required and must be 200 characters or fewer' });
  }
  if (!VALID_LEVELS.has(skill_level)) {
    return res.status(400).json({ error: 'skill_level must be one of: beginner, intermediate, advanced, all levels' });
  }

  try {
    await courseStreamHandler(req, res);
  } catch (err) {
    console.error('[course-stream] pipeline error:', err);
    // If headers already sent (SSE stream started), emit error event
    if (res.headersSent) {
      if (err instanceof YouTubeQuotaError) {
        sendEvent(res, 'error', { code: 'QUOTA_EXCEEDED', message: 'YouTube quota exceeded. Try again tomorrow.' });
      } else {
        sendEvent(res, 'error', { code: 'INTERNAL', message: err.message });
      }
      res.end();
    } else {
      // Headers not sent yet — respond with 500
      res.status(500).json({ error: err.message });
    }
  }
});

// STEP 9: Other API routes (transcript, hints) — keep existing
app.get('/api/transcript/:videoId', transcriptHandler);

/**
 * Call Claude to generate 3 Socratic hints — one per question — for a given video.
 * Each hint is a guiding question or reframe that nudges toward the answer without
 * revealing it. Returns an array of exactly 3 hint strings.
 *
 * @param {string} videoId
 * @param {string} videoTitle
 * @param {string[]} questions - Array of exactly 3 question strings
 * @param {string} transcriptSnippet - First ~500 words of transcript or empty string
 * @returns {Promise<string[]>} Array of 3 Socratic hint strings
 */
async function generateHints(videoId, videoTitle, questions, transcriptSnippet) {
  const snippet = transcriptSnippet ? transcriptSnippet.slice(0, 2000) : '';

  const prompt = `You are a Socratic tutor helping a student think through comprehension questions about a YouTube video they just watched.

Video title: ${videoTitle}
${snippet ? `Transcript excerpt:\n${snippet}\n` : ''}
For each of the following questions, provide exactly one thinking hint. A hint must:
- Be a guiding question or reframe that nudges the student toward the answer
- NOT state the answer or conclusion directly
- NOT give away the key insight — leave the student to arrive at it themselves
- Be specific to this video's content, not generic advice
- Be 1–2 sentences maximum

Questions:
${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

Respond with a JSON array of exactly 3 hint strings, one per question, in the same order as the questions above.
Example format: ["Hint for question 1...", "Hint for question 2...", "Hint for question 3..."]`;

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const block = response.content && response.content[0];
  if (!block || !block.text) {
    throw new Error('Claude returned an empty response');
  }

  const hints = parseClaudeJSON(block.text);
  if (!Array.isArray(hints) || hints.length !== 3) {
    throw new Error(`Claude returned ${Array.isArray(hints) ? hints.length : 'non-array'} hints — expected 3`);
  }

  return hints;
}

app.post('/api/hints', async (req, res) => {
  const { videoId, videoTitle, questions, transcriptSnippet } = req.body || {};

  if (!videoId || typeof videoId !== 'string') {
    return res.status(400).json({ error: 'videoId is required and must be a string' });
  }
  if (!videoTitle || typeof videoTitle !== 'string') {
    return res.status(400).json({ error: 'videoTitle is required and must be a string' });
  }
  if (!Array.isArray(questions) || questions.length !== 3) {
    return res.status(400).json({ error: 'questions must be an array of exactly 3 strings' });
  }

  try {
    const hints = await callClaude(generateHints, videoId, videoTitle, questions, transcriptSnippet || '');
    return res.json({ hints });
  } catch (err) {
    console.error('[hints] Claude error:', err);
    return res.status(500).json({ error: 'Failed to generate hints. Please try again.' });
  }
});

// Only start listening if this file is run directly (not required by tests)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

module.exports = app; // Export for testing
