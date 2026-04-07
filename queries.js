'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const { callClaude, parseClaudeJSON } = require('./claude');

const anthropic = new Anthropic();

/**
 * Build the Claude prompt for query generation.
 *
 * @param {string} subject - The topic to generate queries for
 * @param {string} skillLevel - One of 'beginner', 'intermediate', 'advanced', 'all levels'
 * @returns {string} The prompt string
 */
function buildQueryPrompt(subject, skillLevel) {
  const angleHints = {
    beginner: 'introduction, overview, tutorial, beginner guide, explained simply, getting started',
    intermediate: 'tutorial, how-to, practical guide, real-world application, common mistakes',
    advanced: 'lecture, deep dive, research, advanced concepts, theory, university course',
    'all levels': 'overview, tutorial, practical guide, explained, how-to',
  };

  const hints = angleHints[skillLevel] || angleHints['all levels'];

  return `Generate 6 to 8 YouTube search queries to help a ${skillLevel} learner study "${subject}".

The queries should cover different angles, including: ${hints}.

Requirements:
- each query must be meaningfully different (different angle, format, or intent)
- Do NOT generate vocabulary variants of the same query
- Cover conceptual overviews, tutorials/how-to, real-world applications, common mistakes, and deep-dive subtopics where relevant
- Tailor angle emphasis to the ${skillLevel} skill level

Return ONLY a JSON array of query strings with no wrapper, metadata, or angle labels.
Example format: ["query one", "query two", "query three"]`;
}

/**
 * Generate 6–8 angle-diverse YouTube search queries for a subject and skill level.
 *
 * @param {string} subject - The topic to generate queries for
 * @param {string} skillLevel - One of 'beginner', 'intermediate', 'advanced', 'all levels'
 * @returns {Promise<string[]>} Array of 6–8 search query strings
 * @throws {Error} If Claude returns a non-array response
 */
async function generateQueries(subject, skillLevel) {
  const prompt = buildQueryPrompt(subject, skillLevel);

  const text = await callClaude(async () => {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    });
    return response.content[0].text;
  });

  const result = parseClaudeJSON(text);

  if (!Array.isArray(result)) {
    throw new Error('generateQueries: expected array from Claude, got ' + typeof result);
  }

  return result;
}

module.exports = { generateQueries };
