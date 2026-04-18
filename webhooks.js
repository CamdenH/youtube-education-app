'use strict';

const { verifyWebhook } = require('@clerk/express/webhooks');
const { getOrCreateUser, updateUserPlan } = require('./db');

async function clerkWebhookHandler(req, res) {
  let evt;
  try {
    evt = await verifyWebhook(req);
  } catch (err) {
    console.error('[webhook] verification failed:', err.message);
    return res.status(400).send('Webhook verification failed');
  }

  if (evt.type === 'user.created') {
    const clerkId = evt.data.id;
    const email = evt.data.email_addresses[0]?.email_address ?? null;
    try {
      await getOrCreateUser(clerkId, email);
    } catch (err) {
      console.error('[webhook] user.created DB write failed:', err.message);
      return res.status(500).send('DB write failed');
    }
  }

  if (evt.type === 'subscriptionItem.active') {
    // Defensive: Clerk TypeScript types use camelCase (payerId) but webhook JSON
    // may deliver snake_case (payer_id) depending on serialization. Read both.
    const payerId = evt.data.payerId ?? evt.data.payer_id;
    const planSlug = evt.data.plan && evt.data.plan.slug;
    if (!payerId) {
      console.warn('[webhook] subscriptionItem.active missing payerId — skipping');
      return res.status(200).send('OK');
    }
    if (planSlug === 'early_access') {
      try {
        await updateUserPlan(payerId, 'early_access');
      } catch (err) {
        console.error('[webhook] subscriptionItem.active DB write failed:', err.message);
        return res.status(500).send('DB write failed');
      }
    }
    // If plan.slug is not early_access (e.g. it's the free plan activating), take no action
  }

  if (evt.type === 'subscriptionItem.ended') {
    // Defensive: same camelCase/snake_case fallback as active handler above.
    const payerId = evt.data.payerId ?? evt.data.payer_id;
    const planSlug = evt.data.plan && evt.data.plan.slug;
    if (!payerId) {
      console.warn('[webhook] subscriptionItem.ended missing payerId — skipping');
      return res.status(200).send('OK');
    }
    // CRITICAL: Only downgrade when the early_access plan item ends.
    // The free plan also has a subscriptionItem that fires subscriptionItem.ended
    // at period boundaries — DO NOT downgrade on that event (D-12, Pitfall 3).
    if (planSlug === 'early_access') {
      try {
        await updateUserPlan(payerId, 'free');
      } catch (err) {
        console.error('[webhook] subscriptionItem.ended DB write failed:', err.message);
        return res.status(500).send('DB write failed');
      }
    }
  }

  return res.status(200).send('OK');
}

module.exports = { clerkWebhookHandler };
