// server/index.js
import express from 'express';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import { getVendorToken, getAssignedApps, assignUserToApps } from '../utils.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 9000;

app.use(bodyParser.json());

app.post('/webhooks/user-invited', async (req, res) => {
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
});

app.listen(PORT, () => {
  console.log(`🚀 Webhook server listening on http://localhost:${PORT}`);
});
