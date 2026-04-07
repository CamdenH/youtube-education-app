'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');

process.env.ANTHROPIC_API_KEY = 'test-key';

const CLAUDE_PATH = require.resolve(path.join(__dirname, '../../claude'));
const QUERIES_PATH = require.resolve(path.join(__dirname, '../../queries'));
const SDK_PATH = require.resolve('@anthropic-ai/sdk');

/**
 * Load a fresh copy of queries.js with a controlled callClaude mock.
 *
 * @param {Function} fakeCallClaude - Replacement for callClaude
 * @param {Function} [onMessagesCreate] - Optional spy called with the messages.create args
 * @returns {{ generateQueries: Function }}
 */
function loadQueriesWithMock(fakeCallClaude, onMessagesCreate) {
  // Remove any cached modules so each test gets a fresh require chain
  delete require.cache[QUERIES_PATH];
  delete require.cache[CLAUDE_PATH];

  // Inject fake claude.js into the require cache
  require.cache[CLAUDE_PATH] = {
    id: CLAUDE_PATH,
    filename: CLAUDE_PATH,
    loaded: true,
    exports: {
      callClaude: fakeCallClaude,
      parseClaudeJSON: require(CLAUDE_PATH).parseClaudeJSON,
    },
    children: [],
    paths: Module._nodeModulePaths(path.dirname(CLAUDE_PATH)),
    // Node 22 added 'require' to Module cache entries — provide a passthrough
    require: (id) => require(id),
  };

  // If caller wants to spy on anthropic.messages.create, inject a fake SDK too
  if (onMessagesCreate) {
    delete require.cache[SDK_PATH];

    const fakeAnthropic = function Anthropic() {};
    fakeAnthropic.prototype.messages = {
      create: onMessagesCreate,
    };

    require.cache[SDK_PATH] = {
      id: SDK_PATH,
      filename: SDK_PATH,
      loaded: true,
      exports: fakeAnthropic,
      children: [],
      paths: Module._nodeModulePaths(path.dirname(SDK_PATH)),
      require: (id) => require(id),
    };
  }

  return require(QUERIES_PATH);
}

/**
 * Cleanup: restore the real claude.js and sdk after each test if faked.
 */
function cleanup() {
  delete require.cache[QUERIES_PATH];
  delete require.cache[CLAUDE_PATH];
  delete require.cache[SDK_PATH];
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test('generateQueries is exported as a function', () => {
  const { generateQueries } = loadQueriesWithMock(async (fn) => fn());
  assert.equal(typeof generateQueries, 'function');
  cleanup();
});

test('generateQueries returns an array of strings from Claude response', async () => {
  const sevenQueries = [
    'query one', 'query two', 'query three', 'query four',
    'query five', 'query six', 'query seven',
  ];
  const mockCallClaude = async (fn) => {
    // Simulate callClaude calling fn() and returning the text
    return JSON.stringify(sevenQueries);
  };

  const { generateQueries } = loadQueriesWithMock(mockCallClaude);
  const result = await generateQueries('machine learning', 'beginner');

  assert.ok(Array.isArray(result), 'result should be an Array');
  assert.ok(result.length >= 6 && result.length <= 8, `length ${result.length} should be 6–8`);
  for (const item of result) {
    assert.equal(typeof item, 'string', 'each element should be a string');
  }
  cleanup();
});

test('generateQueries throws if Claude returns wrapped object', async () => {
  const mockCallClaude = async () => '{"queries": ["q1", "q2", "q3"]}';
  const { generateQueries } = loadQueriesWithMock(mockCallClaude);

  await assert.rejects(
    () => generateQueries('machine learning', 'beginner'),
    (err) => {
      assert.ok(err instanceof Error);
      assert.ok(err.message.includes('expected array'), `message was: ${err.message}`);
      return true;
    }
  );
  cleanup();
});

test('beginner prompt contains beginner angle keywords', async () => {
  let capturedPrompt = '';

  const fakeMessagesCreate = async ({ messages }) => {
    capturedPrompt = messages[0].content;
    return { content: [{ text: '["a","b","c","d","e","f"]' }] };
  };

  // callClaude must actually call fn() so the inner anthropic call is captured
  const mockCallClaude = async (fn) => fn();

  const { generateQueries } = loadQueriesWithMock(mockCallClaude, fakeMessagesCreate);
  await generateQueries('physics', 'beginner');

  const hasBeginnerKeyword =
    capturedPrompt.includes('tutorial') ||
    capturedPrompt.includes('introduction') ||
    capturedPrompt.includes('overview');

  assert.ok(hasBeginnerKeyword, `beginner prompt should include tutorial/introduction/overview. Got: ${capturedPrompt.slice(0, 200)}`);
  cleanup();
});

test('advanced prompt contains advanced angle keywords', async () => {
  let capturedPrompt = '';

  const fakeMessagesCreate = async ({ messages }) => {
    capturedPrompt = messages[0].content;
    return { content: [{ text: '["a","b","c","d","e","f"]' }] };
  };

  const mockCallClaude = async (fn) => fn();

  const { generateQueries } = loadQueriesWithMock(mockCallClaude, fakeMessagesCreate);
  await generateQueries('physics', 'advanced');

  const hasAdvancedKeyword =
    capturedPrompt.includes('lecture') ||
    capturedPrompt.includes('deep dive') ||
    capturedPrompt.includes('research');

  assert.ok(hasAdvancedKeyword, `advanced prompt should include lecture/deep dive/research. Got: ${capturedPrompt.slice(0, 200)}`);
  cleanup();
});

test('prompt always contains diversity instruction', async () => {
  let capturedPrompt = '';

  const fakeMessagesCreate = async ({ messages }) => {
    capturedPrompt = messages[0].content;
    return { content: [{ text: '["a","b","c","d","e","f"]' }] };
  };

  const mockCallClaude = async (fn) => fn();

  const { generateQueries } = loadQueriesWithMock(mockCallClaude, fakeMessagesCreate);
  await generateQueries('history', 'intermediate');

  assert.ok(
    capturedPrompt.includes('meaningfully different'),
    `prompt must include "meaningfully different". Got: ${capturedPrompt.slice(0, 200)}`
  );
  cleanup();
});
