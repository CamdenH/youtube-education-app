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

  // Build a fresh mock supabase chain before each test
  function buildChain() {
    mockUpsert = mock.fn();
    mockSingle = mock.fn();
    mockEq = mock.fn(() => ({ single: mockSingle }));
    mockSelect = mock.fn(() => ({ eq: mockEq }));
    mockFrom = mock.fn(() => ({
      upsert: mockUpsert,
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
});
