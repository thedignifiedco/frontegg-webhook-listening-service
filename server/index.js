// server/index.js
import express from 'express';
import bodyParser from 'body-parser';
import { config } from '../config.js';
import {
  getVendorToken,
  getAssignedApps,
  assignUserToApps,
  assignUserToSubTenants,
  verifyWebhookSignature,
} from '../utils.js';

const app = express();
app.use(bodyParser.json());

app.post('/webhooks/user-invited', async (req, res) => {
  const signature = req.headers['x-webhook-secret'];
  if (!verifyWebhookSignature(signature, config.webhookSecret)) {
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  const { user, eventContext } = req.body;
  const userId = user?.id;
  const tenantId = eventContext?.tenantId;

  if (!tenantId || !userId) {
    return res.status(400).json({ error: 'Missing tenantId or userId' });
  }

  try {
    const vendorToken = await getVendorToken();

    const [appIds, subAssignments] = await Promise.all([
      getAssignedApps(tenantId, vendorToken),
      assignUserToSubTenants(userId, tenantId, vendorToken),
    ]);

    const appAssignments = await assignUserToApps(userId, tenantId, appIds, vendorToken);

    return res.status(200).json({
      appsAssigned: appAssignments.length,
      subTenantsAssigned: subAssignments.length,
      appAssignments,
      subAssignments,
    });
  } catch (err) {
    console.error('Error during webhook handling:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 9000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
