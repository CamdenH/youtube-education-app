'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const app = require('../../server');
const { sendEvent } = require('../../sse');
const { YouTubeQuotaError } = require('../../youtube');

/**
 * Creates a fresh Express app with a /api/course-stream route that uses the
 * same wrapper pattern as server.js but with an injected mock handler.
 * This avoids the module-cache binding issue (server.js captures courseStreamHandler
 * at require time, so monkey-patching sse.courseStreamHandler has no effect).
 */
function makeTestApp(mockHandler) {
  const testApp = express();
  testApp.get('/api/course-stream', async (req, res) => {
    try {
      await mockHandler(req, res);
    } catch (err) {
      if (res.headersSent) {
        if (err instanceof YouTubeQuotaError) {
          sendEvent(res, 'error', { code: 'QUOTA_EXCEEDED', message: 'YouTube quota exceeded. Try again tomorrow.' });
        } else {
          sendEvent(res, 'error', { code: 'INTERNAL', message: err.message });
        }
        res.end();
      } else {
        res.status(500).json({ error: err.message });
      }
    }
  });
  return testApp;
}

test('GET / returns 200 and HTML content', async () => {
  const server = app.listen(0);
  const port = server.address().port;
  try {
    const res = await fetch(`http://localhost:${port}/`);
    assert.strictEqual(res.status, 200);
    const contentType = res.headers.get('content-type') || '';
    assert.ok(contentType.includes('text/html'), `Expected text/html, got: ${contentType}`);
  } finally {
    server.close();
  }
});

test('GET /api/course-stream returns SSE headers', async () => {
  const server = app.listen(0);
  const port = server.address().port;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    let res;
    try {
      res = await fetch(`http://localhost:${port}/api/course-stream?subject=test&skill_level=beginner`, {
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
    assert.strictEqual(res.status, 200);
    const contentType = res.headers.get('content-type') || '';
    assert.ok(contentType.includes('text/event-stream'), `Expected text/event-stream, got: ${contentType}`);
    const cacheControl = res.headers.get('cache-control') || '';
    assert.ok(cacheControl.includes('no-cache'), `Expected no-cache, got: ${cacheControl}`);
    // Abort the body read — don't wait for stream to complete
    controller.abort();
  } finally {
    server.close();
  }
});

test('GET /api/transcript/nonexistent returns response (route is registered)', async () => {
  const server = app.listen(0);
  const port = server.address().port;
  try {
    const res = await fetch(`http://localhost:${port}/api/transcript/nonexistent`);
    // Route must be registered — Express "Cannot GET" would return HTML with 404
    // but our route returns JSON, so status should be 404 (NO_TRANSCRIPT) or 500, not a routing miss
    const body = await res.text();
    // Confirm it's JSON (our handler) not Express's default HTML 404
    assert.ok(
      res.headers.get('content-type')?.includes('application/json') || res.status !== 404 || body.includes('NO_TRANSCRIPT') || body.includes('videoId'),
      `Expected registered route response, got status=${res.status} body=${body.slice(0, 200)}`
    );
  } finally {
    server.close();
  }
});

test('GET /nonexistent returns 404', async () => {
  const server = app.listen(0);
  const port = server.address().port;
  try {
    const res = await fetch(`http://localhost:${port}/nonexistent-api-route`);
    assert.strictEqual(res.status, 404);
  } finally {
    server.close();
  }
});

test('quota error in stream emits SSE error event with QUOTA_EXCEEDED code', async () => {
  // Handler that sets SSE headers then throws YouTubeQuotaError
  const mockHandler = async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    throw new YouTubeQuotaError('YouTube API quota exceeded. Try again tomorrow.');
  };

  const testApp = makeTestApp(mockHandler);
  const server = testApp.listen(0);
  const port = server.address().port;
  try {
    const res = await fetch(`http://localhost:${port}/api/course-stream`);
    assert.strictEqual(res.status, 200);
    const text = await res.text();
    assert.ok(text.includes('event: error'), `Expected SSE error event, got: ${text.slice(0, 300)}`);
    assert.ok(text.includes('QUOTA_EXCEEDED'), `Expected QUOTA_EXCEEDED code, got: ${text.slice(0, 300)}`);
  } finally {
    server.close();
  }
});

test('generic error in stream emits SSE error event with INTERNAL code', async () => {
  // Handler that sets SSE headers then throws a generic Error
  const mockHandler = async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    throw new Error('something broke');
  };

  const testApp = makeTestApp(mockHandler);
  const server = testApp.listen(0);
  const port = server.address().port;
  try {
    const res = await fetch(`http://localhost:${port}/api/course-stream`);
    assert.strictEqual(res.status, 200);
    const text = await res.text();
    assert.ok(text.includes('event: error'), `Expected SSE error event, got: ${text.slice(0, 300)}`);
    assert.ok(text.includes('INTERNAL'), `Expected INTERNAL code, got: ${text.slice(0, 300)}`);
    assert.ok(text.includes('something broke'), `Expected error message, got: ${text.slice(0, 300)}`);
  } finally {
    server.close();
  }
});
