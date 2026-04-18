'use strict';

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }
);

async function getOrCreateUser(clerkId, email) {
  const row = { clerk_id: clerkId, plan: 'free' };
  if (email) row.email = email;
  const { error } = await supabase
    .from('users')
    .upsert(row, { onConflict: 'clerk_id', ignoreDuplicates: true });
  if (error) throw new Error(`[db] getOrCreateUser failed: ${error.message}`);
}

async function getUserPlan(clerkId) {
  const { data, error } = await supabase
    .from('users')
    .select('plan')
    .eq('clerk_id', clerkId)
    .single();
  if (error) throw new Error(`[db] getUserPlan failed: ${error.message}`);
  return data.plan;
}

/**
 * Check whether the user is within their monthly generation limit.
 * Resets the counter if the 30-day period has expired (D-06).
 *
 * @param {string} clerkId - Clerk user ID from req.userId
 * @returns {Promise<{allowed: boolean, limit: number, count: number}>}
 */
async function checkUsage(clerkId) {
  const { data, error } = await supabase
    .from('users')
    .select('plan, generation_count, period_start')
    .eq('clerk_id', clerkId)
    .single();
  if (error) throw new Error(`[db] checkUsage failed: ${error.message}`);

  const plan = data.plan || 'free';
  const limit = plan === 'early_access' ? 20 : 1;
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const periodStart = data.period_start ? new Date(data.period_start).getTime() : 0;

  let count = data.generation_count || 0;

  // D-06: Reset counter if the 30-day period has expired
  if (now - periodStart > thirtyDaysMs) {
    const { error: resetErr } = await supabase
      .from('users')
      .update({ generation_count: 0, period_start: new Date().toISOString() })
      .eq('clerk_id', clerkId);
    if (resetErr) throw new Error(`[db] checkUsage reset failed: ${resetErr.message}`);
    count = 0;
  }

  return { allowed: count < limit, limit, count };
}

/**
 * Atomically increment the generation counter for the user.
 * Uses a Postgres function (RPC) to avoid TOCTOU race on concurrent requests (D-07).
 *
 * @param {string} clerkId - Clerk user ID
 */
async function incrementGenerationCount(clerkId) {
  const { error } = await supabase.rpc('increment_generation_count', { p_clerk_id: clerkId });
  if (error) throw new Error(`[db] incrementGenerationCount failed: ${error.message}`);
}

/**
 * Set the plan field on the users row for the given Clerk user ID.
 * Called by the webhook handler to keep users.plan in sync with Clerk Billing.
 * Plain UPDATE — naturally idempotent for duplicate webhook events (D-13).
 *
 * @param {string} clerkId - Clerk user ID (from evt.data.payerId)
 * @param {string} plan - 'free' or 'early_access'
 */
async function updateUserPlan(clerkId, plan) {
  const { error } = await supabase
    .from('users')
    .update({ plan })
    .eq('clerk_id', clerkId);
  if (error) throw new Error(`[db] updateUserPlan failed: ${error.message}`);
}

async function cacheGet(key) {
  const { data, error } = await supabase
    .from('cache')
    .select('data')
    .eq('key', key)
    .maybeSingle();
  if (error) throw new Error(`[db] cacheGet failed: ${error.message}`);
  return data ? data.data : null;
}

async function cacheSet(key, value) {
  const { error } = await supabase
    .from('cache')
    .upsert(
      { key, data: value, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    );
  if (error) throw new Error(`[db] cacheSet failed: ${error.message}`);
}

/**
 * Insert a new course history row.
 *
 * SECURITY: `userId` MUST originate from `req.userId` (Clerk session via requireUser),
 * never from request body/query. Callers in server.js MUST enforce this.
 *
 * @param {string} userId - Clerk user ID from session
 * @param {string} topic - User's subject query
 * @param {string} skillLevel - beginner | intermediate | advanced | all levels
 * @param {object} course - Full assembled course JSON blob
 */
async function saveCourse(userId, topic, skillLevel, course) {
  const { error } = await supabase
    .from('courses')
    .insert({ user_id: userId, topic, skill_level: skillLevel, course });
  if (error) throw new Error(`[db] saveCourse failed: ${error.message}`);
}

/**
 * Return the last 10 course history rows for the user, newest first.
 *
 * @param {string} userId - Clerk user ID
 * @returns {Promise<Array<{id, topic, skill_level, course, created_at}>>}
 */
async function getCourseHistory(userId) {
  const { data, error } = await supabase
    .from('courses')
    .select('id, topic, skill_level, course, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);
  if (error) throw new Error(`[db] getCourseHistory failed: ${error.message}`);
  return data;
}

module.exports = {
  supabase,
  getOrCreateUser,
  getUserPlan,
  checkUsage,
  incrementGenerationCount,
  updateUserPlan,
  cacheGet,
  cacheSet,
  saveCourse,
  getCourseHistory,
};
