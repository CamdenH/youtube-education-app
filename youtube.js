const { cacheGet, cacheSet, queryHash } = require('./cache');

class YouTubeAPIError extends Error {
  constructor(message, code, details) {
    super(message);
    this.name = 'YouTubeAPIError';
    this.code = code;
    this.details = details;
  }
}

class YouTubeQuotaError extends YouTubeAPIError {
  constructor(message) {
    super(message, 'QUOTA_EXCEEDED');
    this.name = 'YouTubeQuotaError';
  }
}

/**
 * Inspects a YouTube API error body and throws an appropriate error.
 * @param {object} errorBody - Parsed JSON from a non-ok YouTube API response
 */
function handleYouTubeError(errorBody) {
  const reason = errorBody?.error?.errors?.[0]?.reason;
  if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') {
    throw new YouTubeQuotaError('YouTube API quota exceeded. Try again tomorrow.');
  }
  throw new YouTubeAPIError(errorBody?.error?.message || 'YouTube API error', reason, errorBody);
}

/**
 * Search YouTube for videos matching the query. Results are cached by query hash.
 *
 * NOTE — Intentional PIPE-03 deviation: videoDuration is 'any' (not 'medium'/'long').
 * Duration filtering is deferred to Phase 2 scoring stage to avoid per-category quota cost.
 *
 * @param {string} query - The search query string
 * @returns {Promise<object>} YouTube search.list response body
 */
async function searchVideos(query) {
  const cacheKey = `search_${queryHash(query)}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  const params = new URLSearchParams({
    key: process.env.YOUTUBE_API_KEY,
    part: 'snippet',
    q: query,
    type: 'video',
    maxResults: '8',
    videoDuration: 'any', // Intentional: PIPE-03 says medium/long but filtering deferred to Phase 2 scoring — saves quota
    relevanceLanguage: 'en',
    safeSearch: 'strict',
    order: 'relevance'
  });

  const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
  if (!res.ok) handleYouTubeError(await res.json());

  const data = await res.json();
  await cacheSet(cacheKey, data);
  return data;
}

/**
 * Fetch detailed video stats for a list of video IDs. Each video is cached individually.
 * Only uncached IDs are fetched from the API; cached IDs are returned from disk.
 *
 * @param {string[]} videoIds - Array of YouTube video IDs
 * @returns {Promise<object[]>} Array of video item objects from YouTube videos.list
 */
async function fetchVideoStats(videoIds) {
  const cachedItems = [];
  const uncachedIds = [];

  for (const id of videoIds) {
    const cached = await cacheGet(`video_${id}`);
    if (cached) {
      cachedItems.push(cached);
    } else {
      uncachedIds.push(id);
    }
  }

  if (uncachedIds.length === 0) {
    return cachedItems;
  }

  // YouTube videos.list caps at 50 IDs per request
  const chunks = [];
  for (let i = 0; i < uncachedIds.length; i += 50) {
    chunks.push(uncachedIds.slice(i, i + 50));
  }

  const fetchedItems = [];
  for (const chunk of chunks) {
    const params = new URLSearchParams({
      key: process.env.YOUTUBE_API_KEY,
      part: 'snippet,statistics,contentDetails,topicDetails',
      id: chunk.join(',')
    });

    const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`);
    if (!res.ok) handleYouTubeError(await res.json());

    const data = await res.json();
    fetchedItems.push(...(data.items || []));
  }

  for (const item of fetchedItems) {
    await cacheSet(`video_${item.id}`, item);
  }

  return [...cachedItems, ...fetchedItems];
}

module.exports = { searchVideos, fetchVideoStats, YouTubeAPIError, YouTubeQuotaError };
