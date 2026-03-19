'use strict';

const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

// Require the module under test
const { sendEvent, sendHeartbeat, startHeartbeat, courseStreamHandler } = require(path.join(__dirname, '../../sse'));

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
function makeMockReq() {
  const listeners = {};
  return {
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

  // The combined writes should equal the expected SSE event string
  const combined = res.writes.join('');
  assert.equal(
    combined,
    'event: videos_fetched\ndata: {"step":2,"total":5,"message":"Fetched 48 videos"}\n\n'
  );
});

test('sendEvent uses res.write (not res.send or res.end)', () => {
  const res = makeMockRes();
  sendEvent(res, 'test_event', { foo: 'bar' });
  // If writes array has content, res.write was called
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
  t.mock.timers.enable({ apis: ['setInterval', 'clearInterval'] });

  const res = makeMockRes();
  const intervalId = startHeartbeat(res);

  // intervalId must be truthy and clearInterval must not throw
  assert.ok(intervalId, 'startHeartbeat should return an interval ID');
  assert.doesNotThrow(() => clearInterval(intervalId));
});

test('startHeartbeat writes a heartbeat after 15 seconds', (t) => {
  t.mock.timers.enable({ apis: ['setInterval', 'clearInterval'] });

  const res = makeMockRes();
  const intervalId = startHeartbeat(res);

  // Tick 15 seconds
  t.mock.timers.tick(15000);

  const combined = res.writes.join('');
  assert.ok(combined.includes(': heartbeat\n\n'), 'heartbeat should be written after 15s');

  clearInterval(intervalId);
});

// ─── courseStreamHandler ─────────────────────────────────────────────────────

test('courseStreamHandler sets all 4 required SSE headers', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval', 'clearInterval', 'setTimeout'] });

  const res = makeMockRes();
  const req = makeMockReq();

  const handlerPromise = courseStreamHandler(req, res);

  // Tick past all 5 events (5 × 800ms = 4000ms) plus a buffer
  t.mock.timers.tick(5000);

  await handlerPromise;

  assert.equal(res.headers['Content-Type'], 'text/event-stream');
  assert.equal(res.headers['Cache-Control'], 'no-cache');
  assert.equal(res.headers['Connection'], 'keep-alive');
  assert.equal(res.headers['X-Accel-Buffering'], 'no');
});

test('courseStreamHandler calls res.flushHeaders()', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval', 'clearInterval', 'setTimeout'] });

  const res = makeMockRes();
  const req = makeMockReq();

  const handlerPromise = courseStreamHandler(req, res);
  t.mock.timers.tick(5000);
  await handlerPromise;

  assert.equal(res.flushed, true, 'res.flushHeaders() should be called');
});

test('courseStreamHandler emits all 5 named events in order', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval', 'clearInterval', 'setTimeout'] });

  const res = makeMockRes();
  const req = makeMockReq();

  const handlerPromise = courseStreamHandler(req, res);
  t.mock.timers.tick(5000);
  await handlerPromise;

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

test('courseStreamHandler emits events with correct payload shape { step, total, message }', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval', 'clearInterval', 'setTimeout'] });

  const res = makeMockRes();
  const req = makeMockReq();

  const handlerPromise = courseStreamHandler(req, res);
  t.mock.timers.tick(5000);
  await handlerPromise;

  // Extract data lines
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

test('courseStreamHandler course_assembled event has a course field', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval', 'clearInterval', 'setTimeout'] });

  const res = makeMockRes();
  const req = makeMockReq();

  const handlerPromise = courseStreamHandler(req, res);
  t.mock.timers.tick(5000);
  await handlerPromise;

  const combined = res.writes.join('');
  // Find the course_assembled event block
  const idx = combined.indexOf('event: course_assembled');
  assert.ok(idx !== -1, 'course_assembled event should exist');

  // The data line follows the event line
  const after = combined.slice(idx);
  const dataLine = after.split('\n').find(l => l.startsWith('data: '));
  assert.ok(dataLine, 'course_assembled should have a data line');

  const payload = JSON.parse(dataLine.slice('data: '.length));
  assert.ok('course' in payload, 'course_assembled payload should have a course field');
  assert.ok(payload.course.title, 'course should have a title');
});

test('courseStreamHandler calls res.end() after the terminal event', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval', 'clearInterval', 'setTimeout'] });

  const res = makeMockRes();
  const req = makeMockReq();

  const handlerPromise = courseStreamHandler(req, res);
  t.mock.timers.tick(5000);
  await handlerPromise;

  assert.equal(res.ended, true, 'res.end() should be called after the last event');
});
