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

module.exports = { supabase, getOrCreateUser, getUserPlan };
