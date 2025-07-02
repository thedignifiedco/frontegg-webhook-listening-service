// server/index.js
import express from 'express';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';
import {
  getVendorToken,
  getAssignedApps,
  assignUserToApps,
  verifyWebhookSignature,
} from '../utils.js';

dotenv.config();
const app = express();
app.use(bodyParser.json());

app.post('/webhooks/user-invited', async (req, res) => {
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
});

const PORT = process.env.PORT || 9000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
