// api/webhook.js
import { getVendorToken, getAssignedApps, assignUserToApps } from '../utils.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const signature = req.headers['x-webhook-secret'];
  const expectedSecret = process.env.FRONTEGG_WEBHOOK_SECRET;

  if (!signature || signature !== expectedSecret) {
    console.error('❌ Invalid webhook signature');
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  const { eventContext, user } = req.body;

  const tenantId = eventContext?.tenantId;
  const userId = user?.id;

  if (!tenantId || !userId) {
    console.error('❌ Missing tenantId or userId in request');
    return res.status(400).json({ error: 'Missing tenantId or userId' });
  }

  try {
    const token = await getVendorToken();
    const assignedAppIds = await getAssignedApps(tenantId, token);

    if (assignedAppIds.length === 0) {
      console.log(`ℹ️ No apps assigned to tenant ${tenantId}. Skipping.`);
      return res.status(200).json({ message: 'No apps to assign' });
    }

    const success = await assignUserToApps({ tenantId, userId, appIds: assignedAppIds, vendorToken: token });

    if (!success) {
      return res.status(500).json({ error: 'Failed to assign apps' });
    }

    return res.status(200).json({ message: 'User assigned to apps', appsAssigned: assignedAppIds.length });
  } catch (err) {
    console.error('🔥 Internal server error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
