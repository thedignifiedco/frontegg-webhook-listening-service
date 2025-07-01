// server/index.js
import express from 'express';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';
import {
  getVendorToken,
  getAssignedApps,
  assignUserToApp,
  verifyWebhookSignature,
} from '../utils.js';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 9000;

app.use(bodyParser.json());

app.post('/webhooks/user-invited', async (req, res) => {
  const signature = req.headers['x-webhook-secret'];
  const secret = process.env.WEBHOOK_SECRET;

  if (!signature || !verifyWebhookSignature(signature, secret)) {
    return res.status(401).send('Invalid signature');
  }

  const { eventContext, user } = req.body;
  const tenantId = eventContext?.tenantId;
  const userId = user?.id;

  if (!tenantId || !userId) {
    console.error('❌ Missing tenantId or userId');
    return res.status(400).send('Missing tenantId or userId');
  }

  try {
    const appIds = await getAssignedApps(tenantId);
    const token = await getVendorToken();

    let successCount = 0;
    for (const appId of appIds) {
      const success = await assignUserToApp(appId, tenantId, userId, token);
      if (success) successCount++;
    }

    res.status(200).json({
      message: `Assigned user to ${successCount}/${appIds.length} apps`,
    });
  } catch (error) {
    console.error('🔥 Internal server error:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server listening on http://localhost:${PORT}`);
});
