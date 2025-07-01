// api/webhook.js
import { assignUserToAllApps, validateWebhookSignature } from '../utils.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end('Method Not Allowed');
  }

  const signature = req.headers['x-webhook-secret'];
  const secret = process.env.FRONTEGG_WEBHOOK_SECRET;

  if (!signature || !validateWebhookSignature(signature, secret)) {
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  const { user, eventContext } = req.body;
  const tenantId = eventContext?.tenantId;
  const userId = user?.id;

  if (!tenantId || !userId) {
    return res.status(400).json({ error: 'Missing tenantId or userId' });
  }

  try {
    const assigned = await assignUserToAllApps({ tenantId, userId });
    return res.status(200).json({ success: true, appsAssigned: assigned.length });
  } catch (err) {
    console.error('❌ Error assigning apps:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
