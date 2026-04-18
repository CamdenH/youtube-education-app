'use strict';

const { describe, it, mock, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

describe('webhooks.js', async () => {
  let webhooks;
  let mockVerifyWebhook;
  let mockGetOrCreateUser;
  let mockUpdateUserPlan;

  // Build mock req/res helpers
  function buildResMock() {
    const res = {
      _status: null,
      _body: null,
      status(code) {
        this._status = code;
        return this;
      },
      send(body) {
        this._body = body;
        return this;
      },
    };
    return res;
  }

  function buildReqMock(headers = {}) {
    return { headers };
  }

  beforeEach(() => {
    // Clear module caches
    for (const key of Object.keys(require.cache)) {
      if (
        key.includes('/webhooks.js') ||
        key.includes('@clerk/express') ||
        key.includes('/db.js')
      ) {
        delete require.cache[key];
      }
    }

    // Mock @clerk/express/webhooks
    mockVerifyWebhook = mock.fn();
    const clerkExpressWebhooksPath = require.resolve('@clerk/express/webhooks');
    require.cache[clerkExpressWebhooksPath] = {
      id: clerkExpressWebhooksPath,
      filename: clerkExpressWebhooksPath,
      loaded: true,
      exports: { verifyWebhook: mockVerifyWebhook },
    };

    // Mock ./db
    mockGetOrCreateUser = mock.fn();
    mockUpdateUserPlan = mock.fn();
    const dbPath = require.resolve('../../db.js');
    require.cache[dbPath] = {
      id: dbPath,
      filename: dbPath,
      loaded: true,
      exports: {
        getOrCreateUser: mockGetOrCreateUser,
        supabase: {},
        getUserPlan: mock.fn(),
        updateUserPlan: mockUpdateUserPlan,
      },
    };

    // Load webhooks.js fresh
    const webhooksPath = require.resolve('../../webhooks.js');
    delete require.cache[webhooksPath];
    webhooks = require('../../webhooks.js');
  });

  afterEach(() => {
    delete require.cache[require.resolve('@clerk/express/webhooks')];
    delete require.cache[require.resolve('../../db.js')];
    delete require.cache[require.resolve('../../webhooks.js')];
  });

  it('Test 1: clerkWebhookHandler returns 400 when verifyWebhook throws (invalid signature)', async () => {
    mockVerifyWebhook.mock.mockImplementation(() => Promise.reject(new Error('Invalid signature')));

    const req = buildReqMock();
    const res = buildResMock();

    await webhooks.clerkWebhookHandler(req, res);

    assert.equal(res._status, 400, `Expected status 400, got ${res._status}`);
  });

  it('Test 2: clerkWebhookHandler calls getOrCreateUser with clerkId and email on user.created', async () => {
    mockVerifyWebhook.mock.mockImplementation(() => Promise.resolve({
      type: 'user.created',
      data: {
        id: 'user_abc123',
        email_addresses: [{ email_address: 'test@example.com' }],
      },
    }));
    mockGetOrCreateUser.mock.mockImplementation(() => Promise.resolve());

    const req = buildReqMock();
    const res = buildResMock();

    await webhooks.clerkWebhookHandler(req, res);

    assert.equal(mockGetOrCreateUser.mock.calls.length, 1, 'getOrCreateUser should be called once');
    const [clerkId, email] = mockGetOrCreateUser.mock.calls[0].arguments;
    assert.equal(clerkId, 'user_abc123');
    assert.equal(email, 'test@example.com');
    assert.equal(res._status, 200);
  });

  it('Test 3: clerkWebhookHandler returns 200 on non-user.created event and does NOT call getOrCreateUser', async () => {
    mockVerifyWebhook.mock.mockImplementation(() => Promise.resolve({
      type: 'user.updated',
      data: { id: 'user_abc123', email_addresses: [] },
    }));

    const req = buildReqMock();
    const res = buildResMock();

    await webhooks.clerkWebhookHandler(req, res);

    assert.equal(mockGetOrCreateUser.mock.calls.length, 0, 'getOrCreateUser should NOT be called');
    assert.equal(res._status, 200);
  });

  it('Test 4: clerkWebhookHandler returns 500 when getOrCreateUser throws (DB write failure)', async () => {
    mockVerifyWebhook.mock.mockImplementation(() => Promise.resolve({
      type: 'user.created',
      data: {
        id: 'user_abc123',
        email_addresses: [{ email_address: 'test@example.com' }],
      },
    }));
    mockGetOrCreateUser.mock.mockImplementation(() => Promise.reject(new Error('[db] getOrCreateUser failed: connection error')));

    const req = buildReqMock();
    const res = buildResMock();

    await webhooks.clerkWebhookHandler(req, res);

    assert.equal(res._status, 500, `Expected status 500, got ${res._status}`);
  });

  it('Test 5: clerkWebhookHandler handles user.created with empty email_addresses (passes null for email)', async () => {
    mockVerifyWebhook.mock.mockImplementation(() => Promise.resolve({
      type: 'user.created',
      data: {
        id: 'user_abc123',
        email_addresses: [],
      },
    }));
    mockGetOrCreateUser.mock.mockImplementation(() => Promise.resolve());

    const req = buildReqMock();
    const res = buildResMock();

    await webhooks.clerkWebhookHandler(req, res);

    assert.equal(mockGetOrCreateUser.mock.calls.length, 1);
    const [clerkId, email] = mockGetOrCreateUser.mock.calls[0].arguments;
    assert.equal(clerkId, 'user_abc123');
    assert.equal(email, null, `Expected email to be null, got ${email}`);
    assert.equal(res._status, 200);
  });

  it('Test 6: subscriptionItem.active with early_access slug calls updateUserPlan(payerId, early_access)', async () => {
    mockVerifyWebhook.mock.mockImplementation(() => Promise.resolve({
      type: 'subscriptionItem.active',
      data: {
        payerId: 'user_abc123',
        plan: { slug: 'early_access' },
      },
    }));
    mockUpdateUserPlan.mock.mockImplementation(() => Promise.resolve());
    const req = buildReqMock();
    const res = buildResMock();
    await webhooks.clerkWebhookHandler(req, res);
    assert.equal(mockUpdateUserPlan.mock.calls.length, 1);
    const [clerkId, plan] = mockUpdateUserPlan.mock.calls[0].arguments;
    assert.equal(clerkId, 'user_abc123');
    assert.equal(plan, 'early_access');
    assert.equal(res._status, 200);
  });

  it('Test 7: subscriptionItem.active with non-early_access slug does NOT call updateUserPlan', async () => {
    mockVerifyWebhook.mock.mockImplementation(() => Promise.resolve({
      type: 'subscriptionItem.active',
      data: {
        payerId: 'user_abc123',
        plan: { slug: 'free' },
      },
    }));
    const req = buildReqMock();
    const res = buildResMock();
    await webhooks.clerkWebhookHandler(req, res);
    assert.equal(mockUpdateUserPlan.mock.calls.length, 0, 'updateUserPlan must NOT be called for non-early_access plan');
    assert.equal(res._status, 200);
  });

  it('Test 8: subscriptionItem.active with missing payerId skips DB write and returns 200', async () => {
    mockVerifyWebhook.mock.mockImplementation(() => Promise.resolve({
      type: 'subscriptionItem.active',
      data: {
        payerId: undefined,
        plan: { slug: 'early_access' },
      },
    }));
    const req = buildReqMock();
    const res = buildResMock();
    await webhooks.clerkWebhookHandler(req, res);
    assert.equal(mockUpdateUserPlan.mock.calls.length, 0, 'updateUserPlan must NOT be called when payerId is undefined');
    assert.equal(res._status, 200);
  });

  it('Test 9: subscriptionItem.ended with early_access slug calls updateUserPlan(payerId, free)', async () => {
    mockVerifyWebhook.mock.mockImplementation(() => Promise.resolve({
      type: 'subscriptionItem.ended',
      data: {
        payerId: 'user_abc123',
        plan: { slug: 'early_access' },
      },
    }));
    mockUpdateUserPlan.mock.mockImplementation(() => Promise.resolve());
    const req = buildReqMock();
    const res = buildResMock();
    await webhooks.clerkWebhookHandler(req, res);
    assert.equal(mockUpdateUserPlan.mock.calls.length, 1);
    const [clerkId, plan] = mockUpdateUserPlan.mock.calls[0].arguments;
    assert.equal(clerkId, 'user_abc123');
    assert.equal(plan, 'free');
    assert.equal(res._status, 200);
  });

  it('Test 10: subscriptionItem.ended with non-early_access slug does NOT call updateUserPlan', async () => {
    mockVerifyWebhook.mock.mockImplementation(() => Promise.resolve({
      type: 'subscriptionItem.ended',
      data: {
        payerId: 'user_abc123',
        plan: { slug: 'free' },
      },
    }));
    const req = buildReqMock();
    const res = buildResMock();
    await webhooks.clerkWebhookHandler(req, res);
    assert.equal(mockUpdateUserPlan.mock.calls.length, 0, 'updateUserPlan must NOT be called for non-early_access plan end');
    assert.equal(res._status, 200);
  });

  it('Test 11: subscriptionItem.ended with missing payerId skips DB write and returns 200', async () => {
    mockVerifyWebhook.mock.mockImplementation(() => Promise.resolve({
      type: 'subscriptionItem.ended',
      data: {
        payerId: undefined,
        plan: { slug: 'early_access' },
      },
    }));
    const req = buildReqMock();
    const res = buildResMock();
    await webhooks.clerkWebhookHandler(req, res);
    assert.equal(mockUpdateUserPlan.mock.calls.length, 0);
    assert.equal(res._status, 200);
  });

  it('Test 12: duplicate subscriptionItem.active events are idempotent (updateUserPlan called twice, both succeed)', async () => {
    mockVerifyWebhook.mock.mockImplementation(() => Promise.resolve({
      type: 'subscriptionItem.active',
      data: {
        payerId: 'user_abc123',
        plan: { slug: 'early_access' },
      },
    }));
    mockUpdateUserPlan.mock.mockImplementation(() => Promise.resolve());
    const req = buildReqMock();
    const res1 = buildResMock();
    const res2 = buildResMock();
    await webhooks.clerkWebhookHandler(req, res1);
    await webhooks.clerkWebhookHandler(req, res2);
    assert.equal(mockUpdateUserPlan.mock.calls.length, 2, 'updateUserPlan called on both events');
    assert.equal(res1._status, 200);
    assert.equal(res2._status, 200);
  });
});
