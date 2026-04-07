'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const Module = require('node:module');

process.env.ANTHROPIC_API_KEY = 'test-key';

const CLAUDE_PATH  = require.resolve(path.join(__dirname, '../../claude'));
const SCORER_PATH  = require.resolve(path.join(__dirname, '../../scorer'));
const SDK_PATH     = require.resolve('@anthropic-ai/sdk');

// ─── Import real deterministic exports directly (no mocking needed) ───────────

const { scoreLikeRatio, scoreDuration, scoreRecency } = require(SCORER_PATH);

// ─── Mock helpers ─────────────────────────────────────────────────────────────

/**
 * Load a fresh copy of scorer.js with a controlled callClaude mock.
 *
 * @param {Function} fakeCallClaude - Replacement for callClaude
 * @returns {{ scoreVideos: Function, scoreDuration: Function, scoreRecency: Function, scoreLikeRatio: Function }}
 */
function loadScorerWithMock(fakeCallClaude) {
  delete require.cache[SCORER_PATH];
  delete require.cache[CLAUDE_PATH];

  // Inject fake claude.js — same pattern as queries.test.js
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

  // Inject a minimal fake SDK so scorer.js's `new Anthropic()` does not blow up
  delete require.cache[SDK_PATH];
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

  return require(SCORER_PATH);
}

/** Remove injected mocks so subsequent tests get a clean require chain. */
function cleanup() {
  delete require.cache[SCORER_PATH];
  delete require.cache[CLAUDE_PATH];
  delete require.cache[SDK_PATH];
}

// ─── Video fixture factory ────────────────────────────────────────────────────

function makeVideo(id, channelTitle, publishedAt, likeCount, viewCount, duration) {
  return {
    id,
    snippet: { channelTitle, publishedAt, description: 'Educational content about X.' },
    statistics: { likeCount, viewCount },
    contentDetails: { duration },
  };
}

// ─── Section 1: scoreLikeRatio ────────────────────────────────────────────────

test('scoreLikeRatio returns 0 when statistics object is empty', () => {
  assert.equal(scoreLikeRatio({}, 40), 0);
});

test('scoreLikeRatio returns 0 when viewCount is "0" (string zero)', () => {
  assert.equal(scoreLikeRatio({ likeCount: '0', viewCount: '0' }, 40), 0);
});

test('scoreLikeRatio returns maxPts for a 4% like ratio (EXCELLENT_RATIO)', () => {
  // 400 likes / 10000 views = 4%
  assert.equal(scoreLikeRatio({ likeCount: '400', viewCount: '10000' }, 40), 40);
});

test('scoreLikeRatio returns 25% of maxPts for a 1% like ratio', () => {
  // 100 likes / 10000 views = 1% = 25% of 4% ceiling → 10 pts of 40
  assert.equal(scoreLikeRatio({ likeCount: '100', viewCount: '10000' }, 40), 10);
});

// ─── Section 2: scoreDuration ─────────────────────────────────────────────────

test('scoreDuration returns maxPts for a 20-min video (ideal beginner range)', () => {
  assert.equal(scoreDuration('PT20M', 'beginner', 20), 20);
});

test('scoreDuration returns 0 for a 1-min video (under 3 min floor)', () => {
  assert.equal(scoreDuration('PT1M', 'beginner', 20), 0);
});

test('scoreDuration returns half maxPts for a 5-min video (3–8 min partial credit)', () => {
  assert.equal(scoreDuration('PT5M', 'beginner', 20), 10);
});

test('scoreDuration returns half maxPts for a 50-min beginner video (45–60 min partial)', () => {
  // Beginner ideal upper is 45 min; 50 min is in the partial zone
  assert.equal(scoreDuration('PT50M', 'beginner', 20), 10);
});

test('scoreDuration returns maxPts for a 50-min advanced video (ideal upper extends to 60 min, D-06)', () => {
  // Advanced ideal range: 8–60 min — 50 min is inside ideal
  assert.equal(scoreDuration('PT50M', 'advanced', 20), 20);
});

test('scoreDuration returns 0 for a 70-min beginner video (over 60 min hard cap)', () => {
  assert.equal(scoreDuration('PT70M', 'beginner', 20), 0);
});

// ─── Section 3: scoreRecency ──────────────────────────────────────────────────

test('scoreRecency returns near-maxPts for a video published 1 week ago', () => {
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const score = scoreRecency(oneWeekAgo, 'beginner', 15);
  // ~0.23 months → 1 - 0.23/36 ≈ 0.994 → rounds to 15 or 14
  assert.ok(score >= 14 && score <= 15, `expected 14–15, got ${score}`);
});

test('scoreRecency returns 0 for a video published 4 years ago', () => {
  const fourYearsAgo = new Date(Date.now() - 4 * 365 * 24 * 60 * 60 * 1000).toISOString();
  // 48 months > 36 month decay period → clamped to 0
  assert.equal(scoreRecency(fourYearsAgo, 'beginner', 15), 0);
});

// ─── Section 4: scoreVideos with mocked Claude (SCOR-01, SCOR-02, SCOR-04) ───

test('scoreVideos returns videos with numeric score in [0, 100] and sorted descending', async () => {
  let callCount = 0;

  // Mock callClaude to return a fixed JSON response (one batch call)
  const mockCallClaude = async (fn) => {
    callCount++;
    return '{"channels":{"Test Channel":15},"descriptions":{"vid1":7,"vid2":4}}';
  };

  const { scoreVideos } = loadScorerWithMock(mockCallClaude);

  const now = new Date().toISOString();
  const oldDate = new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000).toISOString();
  const videos = [
    makeVideo('vid1', 'Test Channel', oldDate, '100',  '10000', 'PT20M'),  // older
    makeVideo('vid2', 'Test Channel', now,     '400',  '10000', 'PT20M'),  // newer, better like ratio
  ];

  const result = await scoreVideos(videos, 'beginner');

  assert.ok(Array.isArray(result), 'result should be an Array');
  assert.equal(result.length, 2, 'result should have same number of videos');

  for (const v of result) {
    assert.equal(typeof v.score, 'number', 'score must be a number');
    assert.ok(v.score >= 0 && v.score <= 100, `score ${v.score} must be in [0, 100]`);
    assert.ok(v.scoreBreakdown, 'scoreBreakdown must exist');
  }

  // Sorted descending
  assert.ok(result[0].score >= result[1].score, 'results must be sorted descending by score');

  cleanup();
});

test('scoreVideos calls Claude exactly once regardless of channel count (SCOR-04)', async () => {
  let callCount = 0;

  const mockCallClaude = async (fn) => {
    callCount++;
    return '{"channels":{"Channel A":15,"Channel B":10},"descriptions":{"v1":5,"v2":5,"v3":5}}';
  };

  const { scoreVideos } = loadScorerWithMock(mockCallClaude);

  const now = new Date().toISOString();
  const videos = [
    makeVideo('v1', 'Channel A', now, '100', '10000', 'PT20M'),
    makeVideo('v2', 'Channel B', now, '200', '10000', 'PT20M'),
    makeVideo('v3', 'Channel A', now, '150', '10000', 'PT30M'), // duplicate channel
  ];

  await scoreVideos(videos, 'intermediate');

  assert.equal(callCount, 1, `callClaude must be called exactly once; called ${callCount} times`);

  cleanup();
});

test('scoreVideos does not mutate original video objects', async () => {
  const mockCallClaude = async () =>
    '{"channels":{"Test Channel":15},"descriptions":{"orig1":7}}';

  const { scoreVideos } = loadScorerWithMock(mockCallClaude);

  const original = makeVideo('orig1', 'Test Channel', new Date().toISOString(), '100', '10000', 'PT20M');
  const originalCopy = JSON.parse(JSON.stringify(original));

  await scoreVideos([original], 'beginner');

  // Original must be unchanged
  assert.deepEqual(original, originalCopy, 'original video object must not be mutated');

  cleanup();
});

// ─── Section 5: credibility prompt content (SCOR-03, D-12) ───────────────────

test('scorer.js source contains MIT OpenCourseWare calibration anchor (D-12)', () => {
  const source = fs.readFileSync(SCORER_PATH, 'utf8');
  assert.ok(source.includes('MIT OpenCourseWare'), 'prompt must include MIT OpenCourseWare anchor');
});

test('scorer.js source contains 3Blue1Brown calibration anchor (D-12)', () => {
  const source = fs.readFileSync(SCORER_PATH, 'utf8');
  assert.ok(source.includes('3Blue1Brown'), 'prompt must include 3Blue1Brown anchor');
});

// ─── Section 6: description quality cap (SCOR-05) ────────────────────────────

test('descScore in scoreBreakdown is capped at weights.description (10 pts)', async () => {
  // Claude returns description score of 99 — must be clamped to 10
  const mockCallClaude = async () =>
    '{"channels":{"Test Channel":15},"descriptions":{"cap1":99}}';

  const { scoreVideos } = loadScorerWithMock(mockCallClaude);

  const video = makeVideo('cap1', 'Test Channel', new Date().toISOString(), '100', '10000', 'PT20M');
  const result = await scoreVideos([video], 'beginner');

  assert.ok(result[0].scoreBreakdown.descScore <= 10,
    `descScore must be capped at 10; got ${result[0].scoreBreakdown.descScore}`);

  cleanup();
});
