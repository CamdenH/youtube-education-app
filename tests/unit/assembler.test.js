'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');

process.env.ANTHROPIC_API_KEY = 'test-key';

const ASSEMBLER_PATH = require.resolve(path.join(__dirname, '../../assembler'));
const CLAUDE_PATH    = require.resolve(path.join(__dirname, '../../claude'));
const SDK_PATH       = require.resolve('@anthropic-ai/sdk');

// ─── Mock helpers ─────────────────────────────────────────────────────────────

/**
 * Load a fresh copy of assembler.js with a controlled callClaude mock.
 *
 * @param {Function} fakeCallClaude - Replacement for callClaude
 * @returns {{ assembleCourse: Function }}
 */
function loadAssemblerWithMock(fakeCallClaude) {
  delete require.cache[ASSEMBLER_PATH];
  delete require.cache[CLAUDE_PATH];
  delete require.cache[SDK_PATH];

  // Inject fake claude.js — preserves the real parseClaudeJSON
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
    require: (id) => require(id),
  };

  // Inject a minimal fake SDK so `new Anthropic()` in assembler.js does not blow up
  const fakeAnthropic = function Anthropic() {};
  fakeAnthropic.prototype.messages = { create: async () => ({}) };
  require.cache[SDK_PATH] = {
    id: SDK_PATH,
    filename: SDK_PATH,
    loaded: true,
    exports: fakeAnthropic,
    children: [],
    paths: Module._nodeModulePaths(path.dirname(SDK_PATH)),
    require: (id) => require(id),
  };

  return require(ASSEMBLER_PATH);
}

/** Remove injected mocks so subsequent tests get a clean require chain. */
function cleanup() {
  delete require.cache[ASSEMBLER_PATH];
  delete require.cache[CLAUDE_PATH];
  delete require.cache[SDK_PATH];
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

// Minimal valid Claude response — contains only what Claude generates.
// mergeClaudeOutput adds title, channelTitle, thumbnail, url, durationSeconds, score.
const STUB_COURSE_FROM_CLAUDE = {
  title: 'Test Subject',
  overview: 'A 3-4 sentence overview.',
  totalWatchTime: '2h 0m',
  prerequisites: ['Basic math'],
  modules: [
    {
      title: 'Module One',
      description: 'A 2-3 sentence description.',
      connectingQuestion: 'How do these videos connect?',
      videos: [
        {
          videoId: 'vid001',
          blurb: 'Why this video.',
          outdated: false,
          questions: [
            { type: 'recall',      text: 'What is X?' },
            { type: 'conceptual',  text: 'Why does X matter?' },
            { type: 'application', text: 'How would you use X?' },
          ],
        },
      ],
    },
  ],
};

/**
 * Factory for scored video objects matching the shape sse.js sends to assembler.
 *
 * @param {string} id - Video ID
 * @returns {Object} Scored video object
 */
function makeVideo(id) {
  return {
    id,
    snippet: {
      title: `Video ${id}`,
      channelTitle: `Channel ${id}`,
      publishedAt: '2024-01-01T00:00:00Z',
      description: 'A description.',
    },
    statistics: { viewCount: '1000', likeCount: '50' },
    contentDetails: { duration: 'PT30M' }, // 1800 seconds
    score: 75,
    scoreBreakdown: {},
  };
}

// Stub transcripts object — assembler receives this alongside videos
const STUB_TRANSCRIPTS = {
  vid001: { source: 'timedtext', text: 'Transcript content for vid001.' },
};

// ─── Tests ────────────────────────────────────────────────────────────────────

// Test A — TOO_FEW_VIDEOS gate
test('assembleCourse returns TOO_FEW_VIDEOS error when fewer than 5 videos provided', async () => {
  let claudeCalled = false;
  const fakeCallClaude = async () => { claudeCalled = true; return '{}'; };

  const { assembleCourse } = loadAssemblerWithMock(fakeCallClaude);

  const videos = [makeVideo('v1'), makeVideo('v2'), makeVideo('v3'), makeVideo('v4')];
  const result = await assembleCourse(videos, STUB_TRANSCRIPTS, 'TestSubject', 'beginner');

  assert.equal(result.error, 'TOO_FEW_VIDEOS', 'error field must be TOO_FEW_VIDEOS');
  assert.ok(!('course' in result), 'result must not have a course key');
  assert.equal(claudeCalled, false, 'callClaude must NOT be called when gate fires');

  cleanup();
});

// Test B — callClaude is called exactly once
test('assembleCourse calls callClaude exactly once with 5+ videos', async () => {
  let callCount = 0;
  const fakeCallClaude = async () => {
    callCount++;
    return JSON.stringify(STUB_COURSE_FROM_CLAUDE);
  };

  const { assembleCourse } = loadAssemblerWithMock(fakeCallClaude);

  const videos = [
    makeVideo('vid001'), makeVideo('v2'), makeVideo('v3'), makeVideo('v4'), makeVideo('v5'),
  ];
  await assembleCourse(videos, STUB_TRANSCRIPTS, 'TestSubject', 'beginner');

  assert.equal(callCount, 1, `callClaude must be called exactly once; called ${callCount} times`);

  cleanup();
});

// Test C — merged video fields are correct
test('assembleCourse merges video metadata fields correctly onto the first video', async () => {
  const fakeCallClaude = async () => JSON.stringify(STUB_COURSE_FROM_CLAUDE);

  const { assembleCourse } = loadAssemblerWithMock(fakeCallClaude);

  const videos = [
    makeVideo('vid001'), makeVideo('v2'), makeVideo('v3'), makeVideo('v4'), makeVideo('v5'),
  ];
  const result = await assembleCourse(videos, STUB_TRANSCRIPTS, 'TestSubject', 'beginner');

  const firstVideo = result.modules[0].videos[0];

  assert.equal(
    firstVideo.thumbnail,
    'https://i.ytimg.com/vi/vid001/mqdefault.jpg',
    'thumbnail must use mqdefault.jpg pattern'
  );
  assert.equal(
    firstVideo.url,
    'https://www.youtube.com/watch?v=vid001',
    'url must use standard YouTube watch URL pattern'
  );
  assert.equal(firstVideo.durationSeconds, 1800, 'PT30M must parse to 1800 seconds');
  assert.equal(firstVideo.score, 75, 'score must come from scored video object');
  assert.equal(firstVideo.title, 'Video vid001', 'title must come from snippet.title');
  assert.equal(firstVideo.channelTitle, 'Channel vid001', 'channelTitle must come from snippet.channelTitle');

  cleanup();
});

// Test D — course structure fields exist
test('assembleCourse returns a course object with all required top-level and module fields', async () => {
  const fakeCallClaude = async () => JSON.stringify(STUB_COURSE_FROM_CLAUDE);

  const { assembleCourse } = loadAssemblerWithMock(fakeCallClaude);

  const videos = [
    makeVideo('vid001'), makeVideo('v2'), makeVideo('v3'), makeVideo('v4'), makeVideo('v5'),
  ];
  const result = await assembleCourse(videos, STUB_TRANSCRIPTS, 'TestSubject', 'beginner');

  assert.equal(typeof result.title, 'string', 'title must be a string');
  assert.equal(typeof result.overview, 'string', 'overview must be a string');
  assert.equal(typeof result.totalWatchTime, 'string', 'totalWatchTime must be a string');
  assert.ok(Array.isArray(result.prerequisites), 'prerequisites must be an array');
  assert.ok(Array.isArray(result.modules), 'modules must be an array');
  assert.ok(result.modules.length >= 1, 'must have at least one module');

  const firstModule = result.modules[0];
  assert.equal(typeof firstModule.title, 'string', 'module.title must be a string');
  assert.equal(typeof firstModule.description, 'string', 'module.description must be a string');
  assert.equal(typeof firstModule.connectingQuestion, 'string', 'module.connectingQuestion must be a string');
  assert.ok(Array.isArray(firstModule.videos), 'module.videos must be an array');

  cleanup();
});

// Test E — each video has 3 questions
test('first video in first module has exactly 3 questions with correct types', async () => {
  const fakeCallClaude = async () => JSON.stringify(STUB_COURSE_FROM_CLAUDE);

  const { assembleCourse } = loadAssemblerWithMock(fakeCallClaude);

  const videos = [
    makeVideo('vid001'), makeVideo('v2'), makeVideo('v3'), makeVideo('v4'), makeVideo('v5'),
  ];
  const result = await assembleCourse(videos, STUB_TRANSCRIPTS, 'TestSubject', 'beginner');

  const firstVideo = result.modules[0].videos[0];
  assert.equal(firstVideo.questions.length, 3, 'must have exactly 3 questions');
  assert.equal(firstVideo.questions[0].type, 'recall',      'first question must be recall');
  assert.equal(firstVideo.questions[1].type, 'conceptual',  'second question must be conceptual');
  assert.equal(firstVideo.questions[2].type, 'application', 'third question must be application');

  cleanup();
});

// Test F — outdated field is boolean
test('first video in first module has outdated field as a boolean', async () => {
  const fakeCallClaude = async () => JSON.stringify(STUB_COURSE_FROM_CLAUDE);

  const { assembleCourse } = loadAssemblerWithMock(fakeCallClaude);

  const videos = [
    makeVideo('vid001'), makeVideo('v2'), makeVideo('v3'), makeVideo('v4'), makeVideo('v5'),
  ];
  const result = await assembleCourse(videos, STUB_TRANSCRIPTS, 'TestSubject', 'beginner');

  const firstVideo = result.modules[0].videos[0];
  assert.equal(typeof firstVideo.outdated, 'boolean', 'outdated must be a boolean');

  cleanup();
});

// Test G — subject and skillLevel pass through; Claude output is used
test('assembleCourse uses Claude response for course title (call path is wired)', async () => {
  const fakeCallClaude = async () => JSON.stringify(STUB_COURSE_FROM_CLAUDE);

  const { assembleCourse } = loadAssemblerWithMock(fakeCallClaude);

  const videos = [
    makeVideo('vid001'), makeVideo('v2'), makeVideo('v3'), makeVideo('v4'), makeVideo('v5'),
  ];
  const result = await assembleCourse(videos, STUB_TRANSCRIPTS, 'uniqueSubject123', 'intermediate');

  // Claude echoes back STUB_COURSE_FROM_CLAUDE.title — proves the response is used
  assert.equal(result.title, STUB_COURSE_FROM_CLAUDE.title,
    'result.title must equal the title from Claude\'s response');

  cleanup();
});
