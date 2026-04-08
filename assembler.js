'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const { callClaude, parseClaudeJSON } = require('./claude');

const anthropic = new Anthropic(); // reads ANTHROPIC_API_KEY from process.env

/**
 * Parse an ISO 8601 duration string (e.g. "PT1H30M15S") to total seconds.
 * Identical to the implementation in scorer.js — copied here to avoid a
 * cross-module dependency on a private function.
 *
 * @param {string} iso - ISO 8601 duration string
 * @returns {number} Total duration in seconds
 */
function parseDurationSeconds(iso) {
  // Implementation in Plan 2
  throw new Error('not implemented');
}

/**
 * Build the single Claude prompt that sends all transcripts and instructs Claude
 * to return a complete course JSON object.
 *
 * @param {Array} videos - Scored video objects (top 12, filtered to those with transcripts)
 * @param {Object} transcripts - Plain object keyed by videoId: { [videoId]: { source, text } }
 * @param {string} subject - The learning subject
 * @param {string} skillLevel - One of 'beginner', 'intermediate', 'advanced', 'all levels'
 * @returns {string} The prompt string
 */
function buildAssemblyPrompt(videos, transcripts, subject, skillLevel) {
  // Implementation in Plan 2
  throw new Error('not implemented');
}

/**
 * Merge Claude's course JSON output with scored video metadata.
 *
 * Claude returns: module grouping, blurb, outdated, questions, connectingQuestion,
 * module title/description, course title/overview/totalWatchTime/prerequisites.
 *
 * This function adds to each video: title, channelTitle, thumbnail, url,
 * durationSeconds, score — derived from the scored video object, NOT from Claude.
 *
 * Thumbnail pattern: https://i.ytimg.com/vi/{videoId}/mqdefault.jpg
 * URL pattern:       https://www.youtube.com/watch?v={videoId}
 *
 * @param {Object} claudeCourse - Parsed JSON object returned by Claude
 * @param {Array} videos - Scored video objects (same set sent to Claude)
 * @returns {Object} Complete course object matching the locked JSON contract
 */
function mergeClaudeOutput(claudeCourse, videos) {
  // Implementation in Plan 2
  throw new Error('not implemented');
}

/**
 * Assemble a structured course from scored videos and their transcripts.
 *
 * Pipeline:
 *   1. TOO_FEW_VIDEOS gate: if videos.length < 5, return error shape immediately
 *   2. Build the assembly prompt (buildAssemblyPrompt)
 *   3. Call Claude via callClaude with max_tokens: 8192 (large response for full course JSON)
 *   4. Parse Claude's JSON response (parseClaudeJSON)
 *   5. Merge Claude output with scored video metadata (mergeClaudeOutput)
 *   6. Return the complete course object
 *
 * Error shape (TOO_FEW_VIDEOS):
 * {
 *   step: 5, total: 5,
 *   error: 'TOO_FEW_VIDEOS',
 *   message: 'Only N videos passed quality review. Try a broader or different search term.'
 * }
 *
 * @param {Array} videos - Scored video objects with transcripts available (filtered by sse.js)
 * @param {Object} transcripts - Plain object keyed by videoId: { [videoId]: { source, text } }
 * @param {string} subject - The learning subject
 * @param {string} skillLevel - One of 'beginner', 'intermediate', 'advanced', 'all levels'
 * @returns {Promise<Object>} Complete course object or TOO_FEW_VIDEOS error shape
 */
async function assembleCourse(videos, transcripts, subject, skillLevel) {
  // Implementation in Plan 2
  throw new Error('not implemented');
}

module.exports = { assembleCourse };
