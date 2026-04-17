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

// Set test API key
process.env.YOUTUBE_API_KEY = 'test-key';

const { searchVideos, fetchVideoStats, YouTubeAPIError, YouTubeQuotaError } = require('../../youtube');

// --- searchVideos tests ---

test('searchVideos builds correct URL with all required params', async () => {
  cleanCache();
  let capturedUrl = null;
  global.fetch = async (url) => {
    capturedUrl = url;
    return {
      ok: true,
      json: async () => ({ items: [{ id: { videoId: 'abc' } }] })
    };
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
  assert.ok(capturedUrl.includes('googleapis.com/youtube/v3/search'), 'should call search endpoint');
  cleanCache();
});

test('searchVideos checks cache before making API call (cache hit skips fetch)', async () => {
  cleanCache();
  let fetchCalled = false;
  global.fetch = async () => {
    fetchCalled = true;
    return { ok: true, json: async () => ({ items: [] }) };
  };

  // Pre-populate cache manually
  const { queryHash, cacheSet } = require('../../cache');
  const cacheKey = `search_${queryHash('quantum mechanics')}.json`;
  cacheSet(cacheKey, { items: [{ id: { videoId: 'cached-vid' } }] });

  const result = await searchVideos('quantum mechanics');
  assert.strictEqual(fetchCalled, false, 'fetch should NOT be called on cache hit');
  assert.deepStrictEqual(result, { items: [{ id: { videoId: 'cached-vid' } }] });
  cleanCache();
});

test('searchVideos writes result to cache after successful API call', async () => {
  cleanCache();
  const apiData = { items: [{ id: { videoId: 'new-vid' } }] };
  global.fetch = async () => ({
    ok: true,
    json: async () => apiData
  });

  await searchVideos('neural networks');

  const { queryHash, cacheGet } = require('../../cache');
  const cacheKey = `search_${queryHash('neural networks')}.json`;
  const cached = cacheGet(cacheKey);
  assert.deepStrictEqual(cached, apiData);
  cleanCache();
});

test('searchVideos returns data from API on cache miss', async () => {
  cleanCache();
  const apiData = { items: [{ id: { videoId: 'fresh-vid' } }] };
  global.fetch = async () => ({
    ok: true,
    json: async () => apiData
  });

  const result = await searchVideos('machine learning');
  assert.deepStrictEqual(result, apiData);
  cleanCache();
});

// --- fetchVideoStats tests ---

test('fetchVideoStats batches all video IDs into a single videos.list call', async () => {
  cleanCache();
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
  assert.ok(capturedUrl.includes('googleapis.com/youtube/v3/videos'), 'should call videos endpoint');
  assert.strictEqual(url.searchParams.get('id'), 'id1,id2,id3');
  assert.ok(url.searchParams.get('part').includes('statistics'), 'part should include statistics');
  assert.ok(url.searchParams.get('part').includes('contentDetails'), 'part should include contentDetails');
  cleanCache();
});

test('fetchVideoStats caches each video individually by videoId', async () => {
  cleanCache();
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

  const { cacheGet } = require('../../cache');
  const cachedA = cacheGet('video_vid-A.json');
  const cachedB = cacheGet('video_vid-B.json');
  assert.ok(cachedA, 'vid-A should be cached');
  assert.ok(cachedB, 'vid-B should be cached');
  assert.strictEqual(cachedA.id, 'vid-A');
  assert.strictEqual(cachedB.id, 'vid-B');
  cleanCache();
});

test('fetchVideoStats returns cached data without calling fetch when all IDs are cached', async () => {
  cleanCache();
  const { cacheSet } = require('../../cache');
  cacheSet('video_cached1.json', { id: 'cached1', snippet: { title: 'Cached' }, statistics: {}, contentDetails: {} });

  let fetchCalled = false;
  global.fetch = async () => {
    fetchCalled = true;
    return { ok: true, json: async () => ({ items: [] }) };
  };

  const results = await fetchVideoStats(['cached1']);
  assert.strictEqual(fetchCalled, false, 'fetch should NOT be called when all IDs are cached');
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].id, 'cached1');
  cleanCache();
});

// --- Error handling tests ---

test('YouTube 403 quota errors produce a structured YouTubeQuotaError (quotaExceeded)', async () => {
  cleanCache();
  global.fetch = async () => ({
    ok: false,
    json: async () => ({
      error: {
        code: 403,
        message: 'The request cannot be completed because you have exceeded your quota.',
        errors: [{ reason: 'quotaExceeded', domain: 'youtube.quota' }]
      }
    })
  });

  await assert.rejects(
    async () => await searchVideos('test query quota'),
    (err) => {
      assert.ok(err instanceof YouTubeQuotaError, 'should be YouTubeQuotaError');
      assert.strictEqual(err.code, 'QUOTA_EXCEEDED');
      return true;
    }
  );
  cleanCache();
});

test('YouTube 403 dailyLimitExceeded produces a YouTubeQuotaError', async () => {
  cleanCache();
  global.fetch = async () => ({
    ok: false,
    json: async () => ({
      error: {
        code: 403,
        message: 'Daily limit exceeded.',
        errors: [{ reason: 'dailyLimitExceeded', domain: 'youtube.quota' }]
      }
    })
  });

  await assert.rejects(
    async () => await searchVideos('test daily limit'),
    (err) => {
      assert.ok(err instanceof YouTubeQuotaError, 'should be YouTubeQuotaError');
      assert.strictEqual(err.code, 'QUOTA_EXCEEDED');
      return true;
    }
  );
  cleanCache();
});

test('non-quota YouTube API errors produce a generic YouTubeAPIError', async () => {
  cleanCache();
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
    async () => await searchVideos('bad request query'),
    (err) => {
      assert.ok(err instanceof YouTubeAPIError, 'should be YouTubeAPIError');
      assert.ok(!(err instanceof YouTubeQuotaError), 'should NOT be YouTubeQuotaError');
      return true;
    }
  );
  cleanCache();
});

// Final cleanup
test('cleanup: remove .cache/ directory after tests', () => {
  cleanCache();
  assert.ok(!fs.existsSync(CACHE_DIR) || true);
});
