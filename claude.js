'use strict';

/**
 * claude.js — Claude API retry and JSON parsing utilities
 *
 * Exports: callClaude, parseClaudeJSON
 *
 * Note: @anthropic-ai/sdk is a Phase 2 dependency. This module provides
 * the retry wrapper and JSON parsing utilities that will wrap Claude API
 * calls when added in Phase 2.
 */

/**
 * Call an async function with retry logic and exponential backoff.
 *
 * Attempts the function up to 3 times total (1 initial + 2 retries).
 * Backoff delays: 1000ms after first failure, 2000ms after second failure.
 *
 * @param {Function} fn - Async function to call
 * @param {*} args - Arguments to pass to fn (all positional args after fn)
 * @param {object} [_opts] - Internal options (used in tests only)
 * @param {number} [_opts._testDelayBase] - Override delay base for testing (default: 1000)
 * @returns {Promise<*>} Result of fn on success
 * @throws {Error} The original error after all retries are exhausted
 */
async function callClaude(fn, ...args) {
  // Extract test options if the last arg is a plain options object with _testDelayBase
  let delayBase = 1000;
  let callArgs = args;

  if (
    args.length > 0 &&
    args[args.length - 1] !== null &&
    typeof args[args.length - 1] === 'object' &&
    '_testDelayBase' in args[args.length - 1]
  ) {
    const opts = args[args.length - 1];
    delayBase = opts._testDelayBase;
    callArgs = args.slice(0, -1);
  }

  const MAX_RETRIES = 2;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn(...callArgs);
    } catch (error) {
      if (attempt < MAX_RETRIES) {
        // Exponential backoff: 1000ms * 2^attempt (1000ms, 2000ms)
        const delay = delayBase * Math.pow(2, attempt);
        console.warn(`Claude retry ${attempt + 1}/${MAX_RETRIES}: ${error.message}`);
        await new Promise((r) => setTimeout(r, delay));
      } else {
        // All retries exhausted — re-throw the original error
        throw error;
      }
    }
  }
}

/**
 * Strip markdown code fences from a Claude response and parse as JSON.
 *
 * Claude often wraps JSON responses in ```json ... ``` or ``` ... ``` blocks.
 * This function strips those fences before parsing.
 *
 * @param {string} text - Raw text from Claude (may contain code fences)
 * @returns {object} Parsed JSON object
 * @throws {SyntaxError} If the text (after stripping) is not valid JSON
 */
function parseClaudeJSON(text) {
  // Strip opening fence: ```json or ``` at start, with optional trailing whitespace/newline
  let cleaned = text.replace(/^```(?:json)?\s*\n?/, '');
  // Strip closing fence: ``` at end, with optional leading newline/whitespace
  cleaned = cleaned.replace(/\n?\s*```\s*$/, '');
  // Trim any remaining whitespace
  cleaned = cleaned.trim();

  return JSON.parse(cleaned);
}

module.exports = { callClaude, parseClaudeJSON };
