const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const CACHE_DIR = path.join(__dirname, '.cache');

/**
 * Creates the .cache/ directory if it does not already exist.
 */
function ensureCacheDir() {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

/**
 * Returns a deterministic MD5 hex string for the given query string.
 * Used to build cache filenames: `search_${queryHash(query)}.json`
 *
 * @param {string} query - The search query to hash
 * @returns {string} 32-character lowercase hex MD5 digest
 */
function queryHash(query) {
  return crypto.createHash('md5').update(query).digest('hex');
}

/**
 * Reads and parses a JSON cache file from .cache/{filename}.
 * Returns null on cache miss (file does not exist).
 *
 * @param {string} filename - e.g. "search_abc123.json"
 * @returns {object|null} Parsed JSON object, or null if not cached
 */
function cacheGet(filename) {
  const filepath = path.join(CACHE_DIR, filename);
  if (!fs.existsSync(filepath)) return null;
  return JSON.parse(fs.readFileSync(filepath, 'utf8'));
}

/**
 * Writes data as pretty-printed JSON to .cache/{filename}.
 * Creates the cache directory if it does not exist.
 *
 * @param {string} filename - e.g. "search_abc123.json"
 * @param {object} data - JSON-serializable data to cache
 */
function cacheSet(filename, data) {
  ensureCacheDir();
  fs.writeFileSync(path.join(CACHE_DIR, filename), JSON.stringify(data, null, 2));
}

module.exports = { cacheGet, cacheSet, queryHash, ensureCacheDir };
