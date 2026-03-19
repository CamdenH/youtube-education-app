'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

// Require the module under test
const { callClaude, parseClaudeJSON } = require(path.join(__dirname, '../../claude'));

// ─── callClaude ──────────────────────────────────────────────────────────────

test('callClaude returns result on first success (no retries)', async () => {
  let calls = 0;
  async function fn() {
    calls++;
    return 'success';
  }

  const result = await callClaude(fn);
  assert.equal(result, 'success');
  assert.equal(calls, 1, 'Should be called exactly once');
});

test('callClaude passes arguments to the wrapped function', async () => {
  async function fn(a, b) {
    return a + b;
  }

  const result = await callClaude(fn, 3, 4);
  assert.equal(result, 7);
});

test('callClaude retries on failure and succeeds on the second attempt', async () => {
  let calls = 0;
  async function fn() {
    calls++;
    if (calls < 2) throw new Error('Transient error');
    return 'recovered';
  }

  // Use a fast retry delay for tests (inject 1ms delay multiplier)
  const result = await callClaude(fn, undefined, { _testDelayBase: 1 });
  assert.equal(result, 'recovered');
  assert.equal(calls, 2, 'Should be called twice (1 failure + 1 success)');
});

test('callClaude retries up to 2 times (3 total attempts) then throws', async () => {
  let calls = 0;
  const originalError = new Error('Persistent error');
  async function fn() {
    calls++;
    throw originalError;
  }

  await assert.rejects(
    () => callClaude(fn, undefined, { _testDelayBase: 1 }),
    (err) => {
      assert.equal(err, originalError, 'Should throw the original error');
      return true;
    }
  );
  assert.equal(calls, 3, 'Should be called exactly 3 times (1 initial + 2 retries)');
});

test('callClaude throws the original error after exhausting retries', async () => {
  const originalError = new Error('Original error message');
  async function fn() {
    throw originalError;
  }

  await assert.rejects(
    () => callClaude(fn, undefined, { _testDelayBase: 1 }),
    (err) => {
      assert.equal(err.message, 'Original error message');
      return true;
    }
  );
});

// ─── parseClaudeJSON ─────────────────────────────────────────────────────────

test('parseClaudeJSON parses a plain JSON string', () => {
  const result = parseClaudeJSON('{"key": "value"}');
  assert.deepEqual(result, { key: 'value' });
});

test('parseClaudeJSON strips ```json code fences before parsing', () => {
  const input = '```json\n{"key": "value"}\n```';
  const result = parseClaudeJSON(input);
  assert.deepEqual(result, { key: 'value' });
});

test('parseClaudeJSON strips plain ``` code fences without json label', () => {
  const input = '```\n{"key": "value"}\n```';
  const result = parseClaudeJSON(input);
  assert.deepEqual(result, { key: 'value' });
});

test('parseClaudeJSON strips leading and trailing whitespace before parsing', () => {
  const result = parseClaudeJSON('  \n  {"key": "value"}  \n  ');
  assert.deepEqual(result, { key: 'value' });
});

test('parseClaudeJSON throws SyntaxError on invalid JSON', () => {
  assert.throws(() => parseClaudeJSON('invalid json'), SyntaxError);
});

test('parseClaudeJSON handles nested JSON objects correctly', () => {
  const input = '```json\n{"modules": [{"title": "Intro", "videos": []}]}\n```';
  const result = parseClaudeJSON(input);
  assert.deepEqual(result, { modules: [{ title: 'Intro', videos: [] }] });
});
