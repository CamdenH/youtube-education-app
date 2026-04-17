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

module.exports = { supabase, getOrCreateUser, getUserPlan, cacheGet, cacheSet, saveCourse, getCourseHistory };
