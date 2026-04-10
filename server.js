'use strict';

require('dotenv').config();

const express = require('express');
const { courseStreamHandler, sendEvent } = require('./sse');
const { transcriptHandler } = require('./transcript');
const { YouTubeQuotaError } = require('./youtube');
const { callClaude, parseClaudeJSON } = require('./claude');
const Anthropic = require('@anthropic-ai/sdk');
const anthropic = new Anthropic();

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from project root (index.html)
app.use(express.static(__dirname));
app.use(express.json());

// Validation constants for /api/course-stream
const VALID_LEVELS = new Set(['beginner', 'intermediate', 'advanced', 'all levels']);

// API routes
app.get('/api/course-stream', async (req, res) => {
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
