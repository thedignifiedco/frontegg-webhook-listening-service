// api/webhook.js
import {
  getVendorToken,
  getAssignedApps,
  assignUserToApps,
  verifyWebhookSignature,
} from '../utils.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const signature = req.headers['x-webhook-secret'];
  if (!verifyWebhookSignature(signature, process.env.WEBHOOK_SECRET)) {
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  const { user, eventContext } = req.body;
  const { userId } = user;
  const { tenantId } = eventContext;

  if (!tenantId || !userId) {
    return res.status(400).json({ error: 'Missing tenantId or userId' });
  }

  try {
    const vendorToken = await getVendorToken();
    const appIds = await getAssignedApps(tenantId, vendorToken);

    if (appIds.length === 0) {
      console.warn('No apps assigned to tenant');
      return res.status(200).json({ message: 'No apps to assign' });
    }

    const results = await assignUserToApps(userId, tenantId, appIds, vendorToken);
    return res.status(200).json({ assigned: results });
  } catch (err) {
    console.error('Error during webhook handling:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
