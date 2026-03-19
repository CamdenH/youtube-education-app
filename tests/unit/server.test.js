'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../../server');

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
      res = await fetch(`http://localhost:${port}/api/course-stream`, {
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
