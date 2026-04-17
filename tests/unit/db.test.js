'use strict';

const { describe, it, mock, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

// --- Mock @supabase/supabase-js before requiring db.js ---
// We need to intercept the require call at module load time.
// Strategy: use module mock hooking via mock.module if available (Node 22+),
// otherwise mock via manual require cache manipulation.

describe('db.js', async () => {
  let db;
  let mockUpsert;
  let mockSingle;
  let mockEq;
  let mockSelect;
  let mockFrom;
  let mockCreateClient;
  let mockInsert;
  let mockMaybeSingle;
  let mockLimit;
  let mockOrder;

  // Build a fresh mock supabase chain before each test
  function buildChain() {
    mockUpsert = mock.fn();
    mockInsert = mock.fn();
    mockSingle = mock.fn();
    mockMaybeSingle = mock.fn();
    mockLimit = mock.fn();
    mockOrder = mock.fn(() => ({ limit: mockLimit }));
    mockEq = mock.fn(() => ({
      single: mockSingle,
      maybeSingle: mockMaybeSingle,
      order: mockOrder,
    }));
    mockSelect = mock.fn(() => ({ eq: mockEq }));
    mockFrom = mock.fn(() => ({
      upsert: mockUpsert,
      insert: mockInsert,
      select: mockSelect,
    }));
    return { from: mockFrom };
  }

  beforeEach(async () => {
    // Clear module cache so db.js re-evaluates on each require
    for (const key of Object.keys(require.cache)) {
      if (key.includes('/db.js') || key.includes('@supabase')) {
        delete require.cache[key];
      }
    }
    const mockClient = buildChain();
    mockCreateClient = mock.fn(() => mockClient);

    // Replace the module in require cache before loading db.js
    require.cache[require.resolve('@supabase/supabase-js')] = {
      id: require.resolve('@supabase/supabase-js'),
      filename: require.resolve('@supabase/supabase-js'),
      loaded: true,
      exports: { createClient: mockCreateClient },
    };

    // Set dummy env vars so createClient doesn't complain
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

    // Now load db.js with the mocked supabase
    const dbPath = require.resolve('../../db.js');
    delete require.cache[dbPath];
    db = require('../../db.js');
  });

  afterEach(() => {
    // Restore real supabase in cache
    delete require.cache[require.resolve('@supabase/supabase-js')];
    delete require.cache[require.resolve('../../db.js')];
  });

  it('Test 1: getOrCreateUser calls upsert with correct args and does not throw on success', async () => {
    mockUpsert.mock.mockImplementation(() => Promise.resolve({ error: null }));

    await assert.doesNotReject(() => db.getOrCreateUser('user_abc', 'test@example.com'));

    assert.equal(mockFrom.mock.calls.length, 1);
    assert.equal(mockFrom.mock.calls[0].arguments[0], 'users');

    assert.equal(mockUpsert.mock.calls.length, 1);
    const [row, opts] = mockUpsert.mock.calls[0].arguments;
    assert.equal(row.clerk_id, 'user_abc');
    assert.equal(row.email, 'test@example.com');
    assert.equal(row.plan, 'free');
    assert.equal(opts.onConflict, 'clerk_id');
    assert.equal(opts.ignoreDuplicates, true);
  });

  it('Test 2: getOrCreateUser with null email omits email from upsert row', async () => {
    mockUpsert.mock.mockImplementation(() => Promise.resolve({ error: null }));

    await db.getOrCreateUser('user_abc', null);

    const [row] = mockUpsert.mock.calls[0].arguments;
    assert.ok(!Object.prototype.hasOwnProperty.call(row, 'email'), 'email should not be present in row when null');
    assert.equal(row.clerk_id, 'user_abc');
    assert.equal(row.plan, 'free');
  });

  it('Test 3: getOrCreateUser throws with [db] getOrCreateUser failed when supabase returns error', async () => {
    mockUpsert.mock.mockImplementation(() => Promise.resolve({ error: { message: 'connection refused' } }));

    await assert.rejects(
      () => db.getOrCreateUser('user_abc', 'test@example.com'),
      (err) => {
        assert.ok(err.message.includes('[db] getOrCreateUser failed'), `Expected '[db] getOrCreateUser failed' in: ${err.message}`);
        return true;
      }
    );
  });

  it('Test 4: getUserPlan returns the plan string from supabase query result', async () => {
    mockSingle.mock.mockImplementation(() => Promise.resolve({ data: { plan: 'pro' }, error: null }));

    const plan = await db.getUserPlan('user_abc');

    assert.equal(plan, 'pro');
    assert.equal(mockFrom.mock.calls[0].arguments[0], 'users');
    assert.equal(mockSelect.mock.calls[0].arguments[0], 'plan');
    assert.equal(mockEq.mock.calls[0].arguments[0], 'clerk_id');
    assert.equal(mockEq.mock.calls[0].arguments[1], 'user_abc');
  });

  it('Test 5: getUserPlan throws with [db] getUserPlan failed when supabase returns error', async () => {
    mockSingle.mock.mockImplementation(() => Promise.resolve({ data: null, error: { message: 'not found' } }));

    await assert.rejects(
      () => db.getUserPlan('user_abc'),
      (err) => {
        assert.ok(err.message.includes('[db] getUserPlan failed'), `Expected '[db] getUserPlan failed' in: ${err.message}`);
        return true;
      }
    );
  });

  it('Test 6: cacheGet returns null on cache miss', async () => {
    mockMaybeSingle.mock.mockImplementation(() => Promise.resolve({ data: null, error: null }));

    const result = await db.cacheGet('nonexistent_key');

    assert.equal(result, null);
    assert.equal(mockFrom.mock.calls[0].arguments[0], 'cache');
    assert.equal(mockSelect.mock.calls[0].arguments[0], 'data');
    assert.equal(mockEq.mock.calls[0].arguments[0], 'key');
    assert.equal(mockEq.mock.calls[0].arguments[1], 'nonexistent_key');
  });

  it('Test 7: cacheGet returns the data field on cache hit', async () => {
    mockMaybeSingle.mock.mockImplementation(() => Promise.resolve({ data: { data: { foo: 'bar' } }, error: null }));

    const result = await db.cacheGet('hit_key');

    assert.deepEqual(result, { foo: 'bar' });
  });

  it('Test 8: cacheGet throws with [db] cacheGet failed on supabase error', async () => {
    mockMaybeSingle.mock.mockImplementation(() => Promise.resolve({ data: null, error: { message: 'network' } }));

    await assert.rejects(
      () => db.cacheGet('k'),
      (err) => {
        assert.ok(err.message.includes('[db] cacheGet failed'), `got: ${err.message}`);
        return true;
      }
    );
  });

  it('Test 9: cacheSet upserts with onConflict key', async () => {
    mockUpsert.mock.mockImplementation(() => Promise.resolve({ error: null }));

    await db.cacheSet('search_abc', { items: [] });

    assert.equal(mockFrom.mock.calls[0].arguments[0], 'cache');
    const [row, opts] = mockUpsert.mock.calls[0].arguments;
    assert.equal(row.key, 'search_abc');
    assert.deepEqual(row.data, { items: [] });
    assert.ok(typeof row.updated_at === 'string' && !isNaN(Date.parse(row.updated_at)), 'updated_at should be ISO string');
    assert.equal(opts.onConflict, 'key');
  });

  it('Test 10: cacheSet throws with [db] cacheSet failed on supabase error', async () => {
    mockUpsert.mock.mockImplementation(() => Promise.resolve({ error: { message: 'conn refused' } }));

    await assert.rejects(
      () => db.cacheSet('k', {}),
      (err) => {
        assert.ok(err.message.includes('[db] cacheSet failed'), `got: ${err.message}`);
        return true;
      }
    );
  });

  it('Test 11: saveCourse inserts with correct column names', async () => {
    mockInsert.mock.mockImplementation(() => Promise.resolve({ error: null }));

    await db.saveCourse('user_abc', 'quantum mechanics', 'beginner', { title: 'T', modules: [] });

    assert.equal(mockFrom.mock.calls[0].arguments[0], 'courses');
    const [row] = mockInsert.mock.calls[0].arguments;
    assert.equal(row.user_id, 'user_abc');
    assert.equal(row.topic, 'quantum mechanics');
    assert.equal(row.skill_level, 'beginner');
    assert.deepEqual(row.course, { title: 'T', modules: [] });
  });

  it('Test 12: saveCourse throws with [db] saveCourse failed on supabase error', async () => {
    mockInsert.mock.mockImplementation(() => Promise.resolve({ error: { message: 'fk violation' } }));

    await assert.rejects(
      () => db.saveCourse('u', 't', 's', {}),
      (err) => {
        assert.ok(err.message.includes('[db] saveCourse failed'), `got: ${err.message}`);
        return true;
      }
    );
  });

  it('Test 13: getCourseHistory returns ordered limited array', async () => {
    const rows = [{ id: '1', topic: 't', skill_level: 'beginner', course: {}, created_at: '2026-04-15T00:00:00Z' }];
    mockLimit.mock.mockImplementation(() => Promise.resolve({ data: rows, error: null }));

    const result = await db.getCourseHistory('user_abc');

    assert.equal(mockFrom.mock.calls[0].arguments[0], 'courses');
    assert.equal(mockSelect.mock.calls[0].arguments[0], 'id, topic, skill_level, course, created_at');
    assert.equal(mockEq.mock.calls[0].arguments[0], 'user_id');
    assert.equal(mockEq.mock.calls[0].arguments[1], 'user_abc');
    assert.equal(mockOrder.mock.calls[0].arguments[0], 'created_at');
    assert.deepEqual(mockOrder.mock.calls[0].arguments[1], { ascending: false });
    assert.equal(mockLimit.mock.calls[0].arguments[0], 10);
    assert.deepEqual(result, rows);
  });

  it('Test 14: getCourseHistory throws with [db] getCourseHistory failed on supabase error', async () => {
    mockLimit.mock.mockImplementation(() => Promise.resolve({ data: null, error: { message: 'rls denied' } }));

    await assert.rejects(
      () => db.getCourseHistory('u'),
      (err) => {
        assert.ok(err.message.includes('[db] getCourseHistory failed'), `got: ${err.message}`);
        return true;
      }
    );
  });
});
