'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

// ─── Mock ./db.js before requiring cache.js ──────────────────────────────────
let dbCacheGetImpl = async () => null;
let dbCacheSetImpl = async () => undefined;
const dbCacheGetCalls = [];
const dbCacheSetCalls = [];

const dbPath = require.resolve('../../db.js');
require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: {
    cacheGet: async (key) => { dbCacheGetCalls.push([key]); return dbCacheGetImpl(key); },
    cacheSet: async (key, value) => { dbCacheSetCalls.push([key, value]); return dbCacheSetImpl(key, value); },
    // Other exports are unused in cache.js — empty stubs.
    supabase: {},
    getOrCreateUser: async () => {},
    getUserPlan: async () => 'free',
    saveCourse: async () => {},
    getCourseHistory: async () => [],
  },
};

// Delete any previously cached cache.js so it loads fresh against our mocked db.
const cachePath = require.resolve('../../cache.js');
delete require.cache[cachePath];
const { cacheGet, cacheSet, queryHash } = require('../../cache.js');

// ─── cacheGet ────────────────────────────────────────────────────────────────

test('cacheGet returns null on cache miss', async () => {
  dbCacheGetImpl = async () => null;
  const result = await cacheGet('nonexistent_key');
  assert.equal(result, null);
});

test('cacheGet delegates to db.cacheGet with the exact key', async () => {
  dbCacheGetCalls.length = 0;
  dbCacheGetImpl = async () => null;
  await cacheGet('search_abc123');
  assert.equal(dbCacheGetCalls.length, 1);
  assert.equal(dbCacheGetCalls[0][0], 'search_abc123');
});

test('cacheGet returns the value from db.cacheGet on hit', async () => {
  const stored = { items: [{ id: 'v1' }] };
  dbCacheGetImpl = async () => stored;
  const result = await cacheGet('hit_key');
  assert.deepEqual(result, stored);
});

// ─── cacheSet ────────────────────────────────────────────────────────────────

test('cacheSet delegates to db.cacheSet with (key, value)', async () => {
  dbCacheSetCalls.length = 0;
  dbCacheSetImpl = async () => undefined;
  await cacheSet('video_abc', { id: 'abc', title: 'T' });
  assert.equal(dbCacheSetCalls.length, 1);
  assert.equal(dbCacheSetCalls[0][0], 'video_abc');
  assert.deepEqual(dbCacheSetCalls[0][1], { id: 'abc', title: 'T' });
});

test('cacheSet awaits db.cacheSet — rejection propagates to caller', async () => {
  dbCacheSetImpl = async () => { throw new Error('db write failed'); };
  await assert.rejects(
    () => cacheSet('k', { v: 1 }),
    (err) => {
      assert.ok(err.message.includes('db write failed'), `got: ${err.message}`);
      return true;
    }
  );
});

// ─── queryHash ───────────────────────────────────────────────────────────────

test('queryHash returns a 32-character lowercase hex string', () => {
  const hash = queryHash('quantum mechanics beginner');
  assert.equal(typeof hash, 'string');
  assert.equal(hash.length, 32);
  assert.match(hash, /^[0-9a-f]{32}$/);
});

test('queryHash is deterministic — same input returns same value', () => {
  assert.equal(queryHash('x'), queryHash('x'));
});

test('queryHash differs for different inputs', () => {
  assert.notEqual(queryHash('a'), queryHash('b'));
});
