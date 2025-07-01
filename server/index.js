// server/index.js
import express from 'express';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import { assignUserToAllApps, validateWebhookSignature } from '../utils.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 9000;

app.use(bodyParser.json());

app.post('/webhooks/user-invited', async (req, res) => {
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
});

app.listen(PORT, () => {
  console.log(`🚀 Webhook listener running on http://localhost:${PORT}`);
});
