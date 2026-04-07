'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');

// ─── Stub data ────────────────────────────────────────────────────────────────

const STUB_QUERIES = ['query one', 'query two', 'query three'];
const STUB_VIDEO_ID = 'abc123';
const STUB_VIDEO = {
  id: STUB_VIDEO_ID,
  snippet: {
    title: 'Test Video',
    channelTitle: 'Test Channel',
    publishedAt: '2024-01-01T00:00:00Z',
    description: 'A test video description.',
  },
  statistics: { viewCount: '1000', likeCount: '50' },
  contentDetails: { duration: 'PT20M' },
};

// ─── Module cache injection ───────────────────────────────────────────────────
// Node 22 does not support mock.module(). We inject stubs into require.cache
// before loading sse.js so the stubs are used by courseStreamHandler.

function resolveModule(rel) {
  return require.resolve(path.join(__dirname, '../../', rel));
}

// Register stub modules in the cache before sse.js is required
const queriesPath = resolveModule('queries');
const youtubePath = resolveModule('youtube');
const scorerPath  = resolveModule('scorer');

require.cache[queriesPath] = {
  id: queriesPath,
  filename: queriesPath,
  loaded: true,
  exports: {
    generateQueries: async () => STUB_QUERIES,
  },
};

require.cache[youtubePath] = {
  id: youtubePath,
  filename: youtubePath,
  loaded: true,
  exports: {
    searchVideos: async () => ({ items: [{ id: { videoId: STUB_VIDEO_ID } }] }),
    fetchVideoStats: async () => [STUB_VIDEO],
    YouTubeAPIError: class YouTubeAPIError extends Error {},
    YouTubeQuotaError: class YouTubeQuotaError extends Error {},
  },
};

require.cache[scorerPath] = {
  id: scorerPath,
  filename: scorerPath,
  loaded: true,
  exports: {
    scoreVideos: async (videos) => videos.map(v => ({ ...v, score: 75, scoreBreakdown: {} })),
  },
};

// Now require sse — it will pick up the stub cache entries
const { sendEvent, sendHeartbeat, startHeartbeat, courseStreamHandler } = require(path.join(__dirname, '../../sse'));

// ─── Mock helpers ─────────────────────────────────────────────────────────────

/**
 * Mock response object that captures write() calls and has setHeader/flushHeaders/end stubs.
 */
function makeMockRes() {
  return {
    writes: [],
    headers: {},
    flushed: false,
    ended: false,
    write(chunk) {
      this.writes.push(chunk);
    },
    setHeader(key, value) {
      this.headers[key] = value;
    },
    flushHeaders() {
      this.flushed = true;
    },
    end() {
      this.ended = true;
    },
  };
}

/**
 * Mock request object with an on() method that captures event listeners.
 */
function makeMockReq(query = { subject: 'test', skill_level: 'beginner' }) {
  const listeners = {};
  return {
    query,
    on(event, cb) {
      listeners[event] = cb;
    },
    _trigger(event) {
      if (listeners[event]) listeners[event]();
    },
  };
}

// ─── sendEvent ───────────────────────────────────────────────────────────────

test('sendEvent writes correctly formatted SSE named event with double newline', () => {
  const res = makeMockRes();
  sendEvent(res, 'videos_fetched', { step: 2, total: 5, message: 'Fetched 48 videos' });

  const combined = res.writes.join('');
  assert.equal(
    combined,
    'event: videos_fetched\ndata: {"step":2,"total":5,"message":"Fetched 48 videos"}\n\n'
  );
});

test('sendEvent uses res.write (not res.send or res.end)', () => {
  const res = makeMockRes();
  sendEvent(res, 'test_event', { foo: 'bar' });
  assert.ok(res.writes.length > 0, 'res.write should be called');
  assert.equal(res.ended, false, 'res.end should not be called');
});

// ─── sendHeartbeat ───────────────────────────────────────────────────────────

test('sendHeartbeat writes exactly `: heartbeat\\n\\n` to res', () => {
  const res = makeMockRes();
  sendHeartbeat(res);

  const combined = res.writes.join('');
  assert.equal(combined, ': heartbeat\n\n');
});

// ─── startHeartbeat ──────────────────────────────────────────────────────────

test('startHeartbeat returns an interval ID that can be passed to clearInterval', (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });

  const res = makeMockRes();
  const intervalId = startHeartbeat(res);

  assert.ok(intervalId !== undefined && intervalId !== null, 'startHeartbeat should return an interval ID');
  assert.doesNotThrow(() => clearInterval(intervalId));
});

test('startHeartbeat writes a heartbeat after 15 seconds', (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });

  const res = makeMockRes();
  const intervalId = startHeartbeat(res);

  // Tick 15 seconds
  t.mock.timers.tick(15000);

  const combined = res.writes.join('');
  assert.ok(combined.includes(': heartbeat\n\n'), 'heartbeat should be written after 15s');

  clearInterval(intervalId);
});

// ─── courseStreamHandler ─────────────────────────────────────────────────────
// Dependencies are stubbed via require.cache above — no real API calls are made.

test('courseStreamHandler sets all 4 required SSE headers', async () => {
  const res = makeMockRes();
  const req = makeMockReq();

  await courseStreamHandler(req, res);

  assert.equal(res.headers['Content-Type'], 'text/event-stream');
  assert.equal(res.headers['Cache-Control'], 'no-cache');
  assert.equal(res.headers['Connection'], 'keep-alive');
  assert.equal(res.headers['X-Accel-Buffering'], 'no');
});

test('courseStreamHandler calls res.flushHeaders()', async () => {
  const res = makeMockRes();
  const req = makeMockReq();

  await courseStreamHandler(req, res);

  assert.equal(res.flushed, true, 'res.flushHeaders() should be called');
});

test('courseStreamHandler emits all 5 named events in order', async () => {
  const res = makeMockRes();
  const req = makeMockReq();

  await courseStreamHandler(req, res);

  const combined = res.writes.join('');
  const expectedOrder = [
    'event: query_generated',
    'event: videos_fetched',
    'event: scored',
    'event: transcripts_fetched',
    'event: course_assembled',
  ];

  let lastIndex = -1;
  for (const eventLine of expectedOrder) {
    const idx = combined.indexOf(eventLine);
    assert.ok(idx > lastIndex, `Expected "${eventLine}" to appear after the previous event`);
    lastIndex = idx;
  }
});

test('courseStreamHandler emits events with correct payload shape { step, total, message }', async () => {
  const res = makeMockRes();
  const req = makeMockReq();

  await courseStreamHandler(req, res);

  const combined = res.writes.join('');
  const dataLines = combined.split('\n').filter(l => l.startsWith('data: '));

  assert.ok(dataLines.length >= 5, 'Should have at least 5 data lines');

  for (const line of dataLines) {
    const payload = JSON.parse(line.slice('data: '.length));
    assert.ok('step' in payload, 'Payload should have step');
    assert.equal(payload.total, 5, 'Payload total should be 5');
    assert.ok('message' in payload, 'Payload should have message');
  }
});

test('courseStreamHandler course_assembled event has a course field', async () => {
  const res = makeMockRes();
  const req = makeMockReq();

  await courseStreamHandler(req, res);

  const combined = res.writes.join('');
  const idx = combined.indexOf('event: course_assembled');
  assert.ok(idx !== -1, 'course_assembled event should exist');

  const after = combined.slice(idx);
  const dataLine = after.split('\n').find(l => l.startsWith('data: '));
  assert.ok(dataLine, 'course_assembled should have a data line');

  const payload = JSON.parse(dataLine.slice('data: '.length));
  assert.ok('course' in payload, 'course_assembled payload should have a course field');
  assert.ok(payload.course.title, 'course should have a title');
});

test('courseStreamHandler calls res.end() after the terminal event', async () => {
  const res = makeMockRes();
  const req = makeMockReq();

  await courseStreamHandler(req, res);

  assert.equal(res.ended, true, 'res.end() should be called after the last event');
});

test('courseStreamHandler query_generated event includes queries array', async () => {
  const res = makeMockRes();
  const req = makeMockReq();

  await courseStreamHandler(req, res);

  const combined = res.writes.join('');
  const idx = combined.indexOf('event: query_generated');
  assert.ok(idx !== -1, 'query_generated event should exist');

  const after = combined.slice(idx);
  const dataLine = after.split('\n').find(l => l.startsWith('data: '));
  const payload = JSON.parse(dataLine.slice('data: '.length));

  assert.ok(Array.isArray(payload.queries), 'query_generated payload should have queries array');
  assert.deepEqual(payload.queries, STUB_QUERIES);
});

test('courseStreamHandler scored event includes videos array', async () => {
  const res = makeMockRes();
  const req = makeMockReq();

  await courseStreamHandler(req, res);

  const combined = res.writes.join('');
  const idx = combined.indexOf('event: scored');
  assert.ok(idx !== -1, 'scored event should exist');

  const after = combined.slice(idx);
  const dataLine = after.split('\n').find(l => l.startsWith('data: '));
  const payload = JSON.parse(dataLine.slice('data: '.length));

  assert.ok(Array.isArray(payload.videos), 'scored payload should have videos array');
  assert.ok(payload.videos.length > 0, 'scored videos should be non-empty');
  assert.ok('score' in payload.videos[0], 'each video should have a score');
});
