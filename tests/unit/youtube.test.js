'use strict';

const test = require('node:test');
const assert = require('node:assert');

// ─── Mock ./cache before requiring ./youtube ─────────────────────────────────
const mockStore = new Map();
const cachePath = require.resolve('../../cache.js');
require.cache[cachePath] = {
  id: cachePath,
  filename: cachePath,
  loaded: true,
  exports: {
    cacheGet: async (key) => (mockStore.has(key) ? mockStore.get(key) : null),
    cacheSet: async (key, value) => { mockStore.set(key, value); },
    queryHash: require('node:crypto').createHash
      ? (q => require('node:crypto').createHash('md5').update(q).digest('hex'))
      : null,
  },
};

function resetCache() {
  mockStore.clear();
}

process.env.YOUTUBE_API_KEY = 'test-key';

// Delete any previously cached youtube.js so it picks up our mocked cache.
const youtubePath = require.resolve('../../youtube.js');
delete require.cache[youtubePath];
const { searchVideos, fetchVideoStats, YouTubeAPIError, YouTubeQuotaError } = require('../../youtube');

// ─── searchVideos tests ──────────────────────────────────────────────────────

test('searchVideos builds correct URL with all required params', async () => {
  resetCache();
  let capturedUrl = null;
  global.fetch = async (url) => {
    capturedUrl = url;
    return { ok: true, json: async () => ({ items: [{ id: { videoId: 'abc' } }] }) };
  };

  await searchVideos('quantum mechanics');

  assert.ok(capturedUrl, 'fetch should have been called');
  const url = new URL(capturedUrl);
  assert.strictEqual(url.searchParams.get('key'), 'test-key');
  assert.strictEqual(url.searchParams.get('part'), 'snippet');
  assert.strictEqual(url.searchParams.get('q'), 'quantum mechanics');
  assert.strictEqual(url.searchParams.get('type'), 'video');
  assert.strictEqual(url.searchParams.get('maxResults'), '8');
  assert.strictEqual(url.searchParams.get('videoDuration'), 'any');
  assert.strictEqual(url.searchParams.get('relevanceLanguage'), 'en');
  assert.strictEqual(url.searchParams.get('safeSearch'), 'strict');
  assert.strictEqual(url.searchParams.get('order'), 'relevance');
  assert.ok(capturedUrl.includes('googleapis.com/youtube/v3/search'));
});

test('searchVideos checks cache before making API call (cache hit skips fetch)', async () => {
  resetCache();
  let fetchCalled = false;
  global.fetch = async () => {
    fetchCalled = true;
    return { ok: true, json: async () => ({ items: [] }) };
  };

  // Pre-populate mock cache with the new key format (no .json suffix)
  const { queryHash } = require('../../cache');
  mockStore.set(`search_${queryHash('quantum mechanics')}`, { items: [{ id: { videoId: 'cached-vid' } }] });

  const result = await searchVideos('quantum mechanics');
  assert.strictEqual(fetchCalled, false, 'fetch should NOT be called on cache hit');
  assert.deepStrictEqual(result, { items: [{ id: { videoId: 'cached-vid' } }] });
});

test('searchVideos writes result to cache with no .json suffix key', async () => {
  resetCache();
  const apiData = { items: [{ id: { videoId: 'new-vid' } }] };
  global.fetch = async () => ({ ok: true, json: async () => apiData });

  await searchVideos('neural networks');

  const { queryHash } = require('../../cache');
  const expectedKey = `search_${queryHash('neural networks')}`;
  assert.ok(mockStore.has(expectedKey), `mock cache should contain key ${expectedKey}`);
  assert.ok(!mockStore.has(`${expectedKey}.json`), 'key should NOT include .json suffix');
  assert.deepStrictEqual(mockStore.get(expectedKey), apiData);
});

test('searchVideos returns data from API on cache miss', async () => {
  resetCache();
  const apiData = { items: [{ id: { videoId: 'fresh-vid' } }] };
  global.fetch = async () => ({ ok: true, json: async () => apiData });

  const result = await searchVideos('machine learning');
  assert.deepStrictEqual(result, apiData);
});

// ─── fetchVideoStats tests ───────────────────────────────────────────────────

test('fetchVideoStats batches all video IDs into a single videos.list call', async () => {
  resetCache();
  let capturedUrl = null;
  global.fetch = async (url) => {
    capturedUrl = url;
    return {
      ok: true,
      json: async () => ({
        items: [
          { id: 'id1', snippet: {}, statistics: {}, contentDetails: {} },
          { id: 'id2', snippet: {}, statistics: {}, contentDetails: {} },
          { id: 'id3', snippet: {}, statistics: {}, contentDetails: {} }
        ]
      })
    };
  };

  await fetchVideoStats(['id1', 'id2', 'id3']);

  assert.ok(capturedUrl, 'fetch should be called');
  const url = new URL(capturedUrl);
  assert.ok(capturedUrl.includes('googleapis.com/youtube/v3/videos'));
  assert.strictEqual(url.searchParams.get('id'), 'id1,id2,id3');
  assert.ok(url.searchParams.get('part').includes('statistics'));
  assert.ok(url.searchParams.get('part').includes('contentDetails'));
});

test('fetchVideoStats caches each video individually by videoId (no .json suffix)', async () => {
  resetCache();
  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      items: [
        { id: 'vid-A', snippet: { title: 'A' }, statistics: {}, contentDetails: {} },
        { id: 'vid-B', snippet: { title: 'B' }, statistics: {}, contentDetails: {} }
      ]
    })
  });

  await fetchVideoStats(['vid-A', 'vid-B']);

  assert.ok(mockStore.has('video_vid-A'), 'vid-A should be cached under video_vid-A');
  assert.ok(mockStore.has('video_vid-B'), 'vid-B should be cached under video_vid-B');
  assert.ok(!mockStore.has('video_vid-A.json'), 'key should not have .json suffix');
  assert.strictEqual(mockStore.get('video_vid-A').id, 'vid-A');
  assert.strictEqual(mockStore.get('video_vid-B').id, 'vid-B');
});

test('fetchVideoStats returns cached data without calling fetch when all IDs cached', async () => {
  resetCache();
  mockStore.set('video_cached1', { id: 'cached1', snippet: { title: 'Cached' }, statistics: {}, contentDetails: {} });

  let fetchCalled = false;
  global.fetch = async () => {
    fetchCalled = true;
    return { ok: true, json: async () => ({ items: [] }) };
  };

  const results = await fetchVideoStats(['cached1']);
  assert.strictEqual(fetchCalled, false, 'fetch should NOT be called when all IDs are cached');
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].id, 'cached1');
});

// ─── Error handling tests ────────────────────────────────────────────────────

test('YouTube 403 quota errors produce a structured YouTubeQuotaError', async () => {
  resetCache();
  global.fetch = async () => ({
    ok: false,
    json: async () => ({
      error: {
        code: 403,
        message: 'exceeded',
        errors: [{ reason: 'quotaExceeded', domain: 'youtube.quota' }]
      }
    })
  });

  await assert.rejects(
    async () => await searchVideos('q quota'),
    (err) => {
      assert.ok(err instanceof YouTubeQuotaError);
      assert.strictEqual(err.code, 'QUOTA_EXCEEDED');
      return true;
    }
  );
});

test('YouTube 403 dailyLimitExceeded produces a YouTubeQuotaError', async () => {
  resetCache();
  global.fetch = async () => ({
    ok: false,
    json: async () => ({
      error: {
        code: 403,
        message: 'Daily limit',
        errors: [{ reason: 'dailyLimitExceeded', domain: 'youtube.quota' }]
      }
    })
  });

  await assert.rejects(
    async () => await searchVideos('q daily'),
    (err) => {
      assert.ok(err instanceof YouTubeQuotaError);
      return true;
    }
  );
});

test('non-quota YouTube API errors produce a generic YouTubeAPIError', async () => {
  resetCache();
  global.fetch = async () => ({
    ok: false,
    json: async () => ({
      error: {
        code: 400,
        message: 'Bad Request',
        errors: [{ reason: 'invalid', domain: 'youtube' }]
      }
    })
  });

  await assert.rejects(
    async () => await searchVideos('bad request'),
    (err) => {
      assert.ok(err instanceof YouTubeAPIError);
      assert.ok(!(err instanceof YouTubeQuotaError));
      return true;
    }
  );
});
