const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const CACHE_DIR = path.join(__dirname, '../../.cache');

function cleanCache() {
  if (fs.existsSync(CACHE_DIR)) {
    fs.rmSync(CACHE_DIR, { recursive: true, force: true });
  }
}

process.env.YOUTUBE_API_KEY = 'test-key';

const { fetchTranscript, parseTimedtextXml, transcriptHandler } = require('../../transcript');

// --- parseTimedtextXml tests ---

test('parseTimedtextXml strips tags and returns plain text', () => {
  const result = parseTimedtextXml('<p>Hello</p><p>World</p>');
  assert.strictEqual(result, 'Hello World');
});

test('parseTimedtextXml returns empty string for empty input', () => {
  const result = parseTimedtextXml('');
  assert.strictEqual(result, '');
});

test('parseTimedtextXml decodes HTML entities', () => {
  const result = parseTimedtextXml('<p>&amp; &lt; &gt; &quot; &#39;</p>');
  assert.strictEqual(result, '& < > " \'');
});

test('parseTimedtextXml collapses multiple spaces and trims', () => {
  const result = parseTimedtextXml('<p>  multiple   spaces  </p>');
  assert.strictEqual(result, 'multiple spaces');
});

// --- fetchTranscript tests ---

test('fetchTranscript returns { source: captions, text } when timedtext returns valid XML', async () => {
  cleanCache();
  const validXml = '<transcript><p>' + 'A'.repeat(100) + '</p></transcript>';
  global.fetch = async (url) => {
    if (url.includes('timedtext')) {
      return {
        ok: true,
        text: async () => validXml
      };
    }
    throw new Error('unexpected fetch: ' + url);
  };

  const result = await fetchTranscript('validId123');
  assert.ok(result, 'should return a result');
  assert.strictEqual(result.source, 'captions');
  assert.ok(typeof result.text === 'string' && result.text.length > 0, 'should have non-empty text');
  cleanCache();
});

test('fetchTranscript returns null when timedtext returns empty body', async () => {
  cleanCache();
  global.fetch = async () => ({
    ok: true,
    text: async () => ''
  });

  const result = await fetchTranscript('emptyId456');
  assert.strictEqual(result, null);
  cleanCache();
});

test('fetchTranscript returns null when timedtext returns fewer than 50 chars of text', async () => {
  cleanCache();
  global.fetch = async () => ({
    ok: true,
    text: async () => '<p>short</p>'
  });

  const result = await fetchTranscript('shortId789');
  assert.strictEqual(result, null);
  cleanCache();
});

test('fetchTranscript checks cache before fetching (cache hit skips fetch)', async () => {
  cleanCache();
  const { cacheSet } = require('../../cache');
  cacheSet('transcript_cachedVid.json', { source: 'captions', text: 'cached transcript text here' });

  let fetchCalled = false;
  global.fetch = async () => {
    fetchCalled = true;
    return { ok: true, text: async () => '<p>fresh</p>' };
  };

  const result = await fetchTranscript('cachedVid');
  assert.strictEqual(fetchCalled, false, 'fetch should NOT be called on cache hit');
  assert.strictEqual(result.text, 'cached transcript text here');
  cleanCache();
});

test('fetchTranscript caches successful result as transcript_{videoId}.json', async () => {
  cleanCache();
  const validXml = '<transcript><p>' + 'B'.repeat(100) + '</p></transcript>';
  global.fetch = async () => ({
    ok: true,
    text: async () => validXml
  });

  await fetchTranscript('newVideoId');

  const { cacheGet } = require('../../cache');
  const cached = cacheGet('transcript_newVideoId.json');
  assert.ok(cached, 'should have cached the transcript');
  assert.strictEqual(cached.source, 'captions');
  cleanCache();
});

test('fetchTranscript returns null and does not throw when fetch fails', async () => {
  cleanCache();
  global.fetch = async () => {
    throw new Error('network error');
  };

  const result = await fetchTranscript('failVid');
  assert.strictEqual(result, null);
  cleanCache();
});

// --- transcriptHandler tests ---

test('transcriptHandler returns HTTP 200 with { videoId, source, text } on successful transcript', async () => {
  cleanCache();
  const validXml = '<transcript><p>' + 'C'.repeat(100) + '</p></transcript>';
  global.fetch = async (url) => {
    if (url.includes('timedtext')) {
      return { ok: true, text: async () => validXml };
    }
    // For fetchVideoStats (shouldn't be called here, but guard anyway)
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
  assert.ok(responseBody, 'should have a response body');
  assert.strictEqual(responseBody.videoId, 'handlerVid');
  assert.strictEqual(responseBody.source, 'captions');
  assert.ok(typeof responseBody.text === 'string');
  cleanCache();
});

test('transcriptHandler falls back to description when fetchTranscript returns null', async () => {
  cleanCache();
  const descriptionText = 'A'.repeat(100); // long enough description
  global.fetch = async (url) => {
    if (url.includes('timedtext')) {
      return { ok: true, text: async () => '' }; // empty = null transcript
    }
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
  cleanCache();
});

test('transcriptHandler returns HTTP 404 with { error: NO_TRANSCRIPT } when neither transcript nor description available', async () => {
  cleanCache();
  global.fetch = async (url) => {
    if (url.includes('timedtext')) {
      return { ok: true, text: async () => '' };
    }
    if (url.includes('googleapis.com/youtube/v3/videos')) {
      return {
        ok: true,
        json: async () => ({ items: [] }) // no video found
      };
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
  cleanCache();
});

// Final cleanup
test('cleanup: remove .cache/ directory after tests', () => {
  cleanCache();
  assert.ok(!fs.existsSync(CACHE_DIR) || true);
});
