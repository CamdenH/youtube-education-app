'use strict';

const crypto = require('node:crypto');
const { cacheGet: dbCacheGet, cacheSet: dbCacheSet } = require('./db');

/**
 * Returns a deterministic 32-character lowercase hex MD5 digest of the query.
 * Used to build cache keys like `search_${queryHash(query)}`.
 *
 * @param {string} query
 * @returns {string} 32-char hex MD5
 */
function queryHash(query) {
  return crypto.createHash('md5').update(query).digest('hex');
}

/**
 * Look up a cached value by key. Returns the parsed JSON value on hit,
 * or null on cache miss. Delegates to db.cacheGet (Supabase cache table).
 *
 * @param {string} key - e.g. "search_<md5>" | "video_<id>" | "transcript_<id>"
 * @returns {Promise<object|null>}
 */
async function cacheGet(key) {
  return dbCacheGet(key);
}

/**
 * Store a value in the cache under the given key. Overwrites on conflict.
 * Delegates to db.cacheSet (Supabase upsert on key).
 *
 * @param {string} key
 * @param {object} value - JSON-serializable object
 * @returns {Promise<void>}
 */
async function cacheSet(key, value) {
  await dbCacheSet(key, value);
}

module.exports = { cacheGet, cacheSet, queryHash };
