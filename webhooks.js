'use strict';

const { verifyWebhook } = require('@clerk/express/webhooks');
const { getOrCreateUser } = require('./db');

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

  return res.status(200).send('OK');
}

module.exports = { clerkWebhookHandler };
