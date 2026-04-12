'use strict';

const { getAuth } = require('@clerk/express');
const { getOrCreateUser } = require('./db');

async function requireUser(req, res, next) {
  const { userId } = getAuth(req);
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  // D-07: Optimistic upsert — safety net for webhook race window
  // Fire-and-forget: do not block the request on DB write
  getOrCreateUser(userId, null).catch(err =>
    console.error('[auth] optimistic upsert failed:', err.message)
  );
  req.userId = userId;
  next();
}

function getUserId(req) {
  return getAuth(req).userId;
}

module.exports = { requireUser, getUserId };
