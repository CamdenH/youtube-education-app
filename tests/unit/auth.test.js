'use strict';

const { test, mock, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

// ─── Module mock helpers ──────────────────────────────────────────────────────
// We inject mocks via require.cache to avoid ESM complications.
// This approach was established in Phase 6 Plan 1 (db.test.js pattern).

let mockGetAuth;
let mockGetOrCreateUser;

function setupMocks() {
  // Mock @clerk/express
  mockGetAuth = mock.fn(() => ({ userId: null }));
  require.cache[require.resolve('@clerk/express')] = {
    id: require.resolve('@clerk/express'),
    filename: require.resolve('@clerk/express'),
    loaded: true,
    exports: {
      getAuth: mockGetAuth,
      clerkMiddleware: () => (req, res, next) => next(),
      requireAuth: () => (req, res, next) => next(),
    },
  };

  // Mock ./db
  mockGetOrCreateUser = mock.fn(async () => {});
  const dbPath = require.resolve('../../db');
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: {
      getOrCreateUser: mockGetOrCreateUser,
      getUserPlan: mock.fn(async () => 'free'),
    },
  };

  // Evict auth.js from cache so it picks up fresh mocks
  const authPath = require.resolve('../../auth');
  delete require.cache[authPath];
}

function teardownMocks() {
  delete require.cache[require.resolve('@clerk/express')];
  delete require.cache[require.resolve('../../db')];
  delete require.cache[require.resolve('../../auth')];
}

// ─── Helper: make a fake req/res/next ─────────────────────────────────────────
function makeReqRes() {
  const req = {};
  const statusBody = {};
  const res = {
    _status: null,
    _json: null,
    status(code) {
      this._status = code;
      return this;
    },
    json(body) {
      this._json = body;
      return this;
    },
  };
  const next = mock.fn(() => {});
  return { req, res, next };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test('requireUser returns 401 JSON when userId is null', async () => {
  setupMocks();
  try {
    mockGetAuth.mock.mockImplementation(() => ({ userId: null }));
    const { requireUser } = require('../../auth');
    const { req, res, next } = makeReqRes();

    await requireUser(req, res, next);

    assert.strictEqual(res._status, 401);
    assert.deepStrictEqual(res._json, { error: 'Authentication required' });
    assert.strictEqual(next.mock.calls.length, 0, 'next() should not be called');
  } finally {
    teardownMocks();
  }
});

test('requireUser calls next() and sets req.userId when authenticated', async () => {
  setupMocks();
  try {
    mockGetAuth.mock.mockImplementation(() => ({ userId: 'user_abc123' }));
    const { requireUser } = require('../../auth');
    const { req, res, next } = makeReqRes();

    await requireUser(req, res, next);

    assert.strictEqual(req.userId, 'user_abc123');
    assert.strictEqual(next.mock.calls.length, 1, 'next() should be called once');
    assert.strictEqual(res._status, null, 'res.status should not be called');
  } finally {
    teardownMocks();
  }
});

test('requireUser calls getOrCreateUser(userId, null) fire-and-forget without awaiting', async () => {
  setupMocks();
  try {
    mockGetAuth.mock.mockImplementation(() => ({ userId: 'user_abc123' }));
    // Make getOrCreateUser take long to resolve to confirm we do not await it
    let resolveUpsert;
    mockGetOrCreateUser.mock.mockImplementation(
      () => new Promise(resolve => { resolveUpsert = resolve; })
    );
    const { requireUser } = require('../../auth');
    const { req, res, next } = makeReqRes();

    // requireUser should complete and call next() without waiting for getOrCreateUser
    await requireUser(req, res, next);

    // next() is called even though getOrCreateUser has not resolved yet
    assert.strictEqual(next.mock.calls.length, 1, 'next() should be called before upsert resolves');
    // getOrCreateUser was called with (userId, null)
    assert.strictEqual(mockGetOrCreateUser.mock.calls.length, 1);
    assert.deepStrictEqual(mockGetOrCreateUser.mock.calls[0].arguments, ['user_abc123', null]);

    // Resolve the pending promise to avoid unhandled rejection
    resolveUpsert();
  } finally {
    teardownMocks();
  }
});

test('requireUser calls next() even if getOrCreateUser rejects', async () => {
  setupMocks();
  try {
    mockGetAuth.mock.mockImplementation(() => ({ userId: 'user_abc123' }));
    mockGetOrCreateUser.mock.mockImplementation(async () => {
      throw new Error('DB down');
    });
    const { requireUser } = require('../../auth');
    const { req, res, next } = makeReqRes();

    await requireUser(req, res, next);

    // next() must still be called — the rejection is fire-and-forget
    assert.strictEqual(next.mock.calls.length, 1, 'next() should be called even when upsert rejects');
    assert.strictEqual(req.userId, 'user_abc123');
  } finally {
    // Small delay to let the .catch() handler run before teardown
    await new Promise(r => setTimeout(r, 10));
    teardownMocks();
  }
});

test('getUserId(req) returns userId string from getAuth(req)', () => {
  setupMocks();
  try {
    mockGetAuth.mock.mockImplementation(() => ({ userId: 'user_xyz789' }));
    const { getUserId } = require('../../auth');
    const req = {};

    const result = getUserId(req);

    assert.strictEqual(result, 'user_xyz789');
  } finally {
    teardownMocks();
  }
});
