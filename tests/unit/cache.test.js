const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

// The module under test
const { cacheGet, cacheSet, queryHash, ensureCacheDir } = require('../../cache');

const CACHE_DIR = path.join(__dirname, '../../.cache');

// Clean up .cache/ before and after tests
function cleanCache() {
  if (fs.existsSync(CACHE_DIR)) {
    fs.rmSync(CACHE_DIR, { recursive: true, force: true });
  }
}

test('cacheGet returns null on cache miss', () => {
  cleanCache();
  const result = cacheGet('nonexistent.json');
  assert.strictEqual(result, null);
});

test('cacheSet creates a JSON file in .cache/ directory', () => {
  cleanCache();
  cacheSet('test_file.json', { foo: 'bar' });
  const filePath = path.join(CACHE_DIR, 'test_file.json');
  assert.strictEqual(fs.existsSync(filePath), true);
});

test('cacheGet returns parsed JSON after cacheSet', () => {
  cleanCache();
  cacheSet('test_file.json', { foo: 'bar' });
  const result = cacheGet('test_file.json');
  assert.deepStrictEqual(result, { foo: 'bar' });
});

test('queryHash returns a 32-character hex string', () => {
  const hash = queryHash('quantum mechanics beginner');
  assert.strictEqual(typeof hash, 'string');
  assert.strictEqual(hash.length, 32);
  assert.match(hash, /^[0-9a-f]{32}$/);
});

test('queryHash is deterministic — same input returns same value', () => {
  const hash1 = queryHash('quantum mechanics beginner');
  const hash2 = queryHash('quantum mechanics beginner');
  assert.strictEqual(hash1, hash2);
});

test('queryHash differs for different inputs', () => {
  const hash1 = queryHash('quantum mechanics beginner');
  const hash2 = queryHash('quantum mechanics advanced');
  assert.notStrictEqual(hash1, hash2);
});

test('ensureCacheDir creates .cache/ directory if it does not exist', () => {
  cleanCache();
  assert.strictEqual(fs.existsSync(CACHE_DIR), false);
  ensureCacheDir();
  assert.strictEqual(fs.existsSync(CACHE_DIR), true);
});

test('cacheSet overwrites existing file when called again with same filename', () => {
  cleanCache();
  cacheSet('overwrite.json', { version: 1 });
  cacheSet('overwrite.json', { version: 2 });
  const result = cacheGet('overwrite.json');
  assert.deepStrictEqual(result, { version: 2 });
});

// Final cleanup after all tests
test('cleanup: remove .cache/ directory after tests', () => {
  cleanCache();
  assert.strictEqual(fs.existsSync(CACHE_DIR), false);
});
