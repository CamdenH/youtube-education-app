'use strict';

const test = require('node:test');
const assert = require('node:assert');

// ─── Mock ./cache before requiring ./transcript ──────────────────────────────
const mockStore = new Map();
const cachePath = require.resolve('../../cache.js');
require.cache[cachePath] = {
  id: cachePath,
  filename: cachePath,
  loaded: true,
  exports: {
    cacheGet: async (key) => (mockStore.has(key) ? mockStore.get(key) : null),
    cacheSet: async (key, value) => { mockStore.set(key, value); },
    queryHash: (q) => require('node:crypto').createHash('md5').update(q).digest('hex'),
  },
};

function resetCache() {
  mockStore.clear();
}

process.env.YOUTUBE_API_KEY = 'test-key';

// Ensure transcript.js (and youtube.js which it requires) load with mocked cache.
const transcriptPath = require.resolve('../../transcript.js');
const youtubePath = require.resolve('../../youtube.js');
delete require.cache[transcriptPath];
delete require.cache[youtubePath];

const { fetchTranscript, parseTimedtextXml, transcriptHandler } = require('../../transcript');

// ─── parseTimedtextXml tests ─────────────────────────────────────────────────

test('parseTimedtextXml strips tags and returns plain text', () => {
  assert.strictEqual(parseTimedtextXml('<p>Hello</p><p>World</p>'), 'Hello World');
});

test('parseTimedtextXml returns empty string for empty input', () => {
  assert.strictEqual(parseTimedtextXml(''), '');
});

test('parseTimedtextXml decodes HTML entities', () => {
  assert.strictEqual(parseTimedtextXml('<p>&amp; &lt; &gt; &quot; &#39;</p>'), '& < > " \'');
});

test('parseTimedtextXml collapses multiple spaces and trims', () => {
  assert.strictEqual(parseTimedtextXml('<p>  multiple   spaces  </p>'), 'multiple spaces');
});

// ─── fetchTranscript tests ───────────────────────────────────────────────────

test('fetchTranscript returns { source: captions, text } when timedtext returns valid XML', async () => {
  resetCache();
  const validXml = '<transcript><p>' + 'A'.repeat(100) + '</p></transcript>';
  global.fetch = async (url) => {
    if (url.includes('timedtext')) return { ok: true, text: async () => validXml };
    throw new Error('unexpected fetch: ' + url);
  };

  const result = await fetchTranscript('validId123');
  assert.ok(result);
  assert.strictEqual(result.source, 'captions');
  assert.ok(typeof result.text === 'string' && result.text.length > 0);
});

test('fetchTranscript returns null when timedtext returns empty body', async () => {
  resetCache();
  global.fetch = async () => ({ ok: true, text: async () => '' });
  assert.strictEqual(await fetchTranscript('emptyId456'), null);
});

test('fetchTranscript returns null when timedtext returns fewer than 50 chars of text', async () => {
  resetCache();
  global.fetch = async () => ({ ok: true, text: async () => '<p>short</p>' });
  assert.strictEqual(await fetchTranscript('shortId789'), null);
});

test('fetchTranscript checks cache before fetching (cache hit skips fetch) — uses new key format', async () => {
  resetCache();
  mockStore.set('transcript_cachedVid', { source: 'captions', text: 'cached transcript text here' });

  let fetchCalled = false;
  global.fetch = async () => {
    fetchCalled = true;
    return { ok: true, text: async () => '<p>fresh</p>' };
  };

  const result = await fetchTranscript('cachedVid');
  assert.strictEqual(fetchCalled, false, 'fetch should NOT be called on cache hit');
  assert.strictEqual(result.text, 'cached transcript text here');
});

test('fetchTranscript caches successful result under transcript_{videoId} key (no .json)', async () => {
  resetCache();
  const validXml = '<transcript><p>' + 'B'.repeat(100) + '</p></transcript>';
  global.fetch = async () => ({ ok: true, text: async () => validXml });

  await fetchTranscript('newVideoId');

  assert.ok(mockStore.has('transcript_newVideoId'), 'should have cached under key without .json');
  assert.ok(!mockStore.has('transcript_newVideoId.json'), 'should NOT have .json suffix');
  assert.strictEqual(mockStore.get('transcript_newVideoId').source, 'captions');
});

test('fetchTranscript returns null and does not throw when fetch fails', async () => {
  resetCache();
  global.fetch = async () => { throw new Error('network error'); };
  assert.strictEqual(await fetchTranscript('failVid'), null);
});

// ─── transcriptHandler tests ─────────────────────────────────────────────────

test('transcriptHandler returns HTTP 200 with { videoId, source, text } on successful transcript', async () => {
  resetCache();
  const validXml = '<transcript><p>' + 'C'.repeat(100) + '</p></transcript>';
  global.fetch = async (url) => {
    if (url.includes('timedtext')) return { ok: true, text: async () => validXml };
    return { ok: true, json: async () => ({ items: [] }) };
  };

  const req = { params: { videoId: 'handlerVid' } };
  let statusCode = 200;
  let responseBody = null;
  const res = {
    status(code) { statusCode = code; return this; },
    json(body) { responseBody = body; }
  };

  await transcriptHandler(req, res);

  assert.strictEqual(statusCode, 200);
  assert.strictEqual(responseBody.videoId, 'handlerVid');
  assert.strictEqual(responseBody.source, 'captions');
  assert.ok(typeof responseBody.text === 'string');
});

test('transcriptHandler falls back to description when fetchTranscript returns null', async () => {
  resetCache();
  const descriptionText = 'A'.repeat(100);
  global.fetch = async (url) => {
    if (url.includes('timedtext')) return { ok: true, text: async () => '' };
    if (url.includes('googleapis.com/youtube/v3/videos')) {
      return {
        ok: true,
        json: async () => ({
          items: [{
            id: 'descVid',
            snippet: { description: descriptionText },
            statistics: {},
            contentDetails: {}
          }]
        })
      };
    }
    throw new Error('unexpected fetch: ' + url);
  };

  const req = { params: { videoId: 'descVid' } };
  let statusCode = 200;
  let responseBody = null;
  const res = {
    status(code) { statusCode = code; return this; },
    json(body) { responseBody = body; }
  };

  await transcriptHandler(req, res);

  assert.strictEqual(statusCode, 200);
  assert.strictEqual(responseBody.source, 'description');
  assert.strictEqual(responseBody.text, descriptionText);
  // Verify description was cached under new key format
  assert.ok(mockStore.has('transcript_descVid'));
  assert.ok(!mockStore.has('transcript_descVid.json'));
});

test('transcriptHandler returns HTTP 404 with { error: NO_TRANSCRIPT } when neither transcript nor description available', async () => {
  resetCache();
  global.fetch = async (url) => {
    if (url.includes('timedtext')) return { ok: true, text: async () => '' };
    if (url.includes('googleapis.com/youtube/v3/videos')) {
      return { ok: true, json: async () => ({ items: [] }) };
    }
    throw new Error('unexpected fetch: ' + url);
  };

  const req = { params: { videoId: 'noDataVid' } };
  let statusCode = 200;
  let responseBody = null;
  const res = {
    status(code) { statusCode = code; return this; },
    json(body) { responseBody = body; }
  };

  await transcriptHandler(req, res);

  assert.strictEqual(statusCode, 404);
  assert.strictEqual(responseBody.error, 'NO_TRANSCRIPT');
  assert.strictEqual(responseBody.videoId, 'noDataVid');
});
