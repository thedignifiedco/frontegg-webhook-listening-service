require('dotenv').config();
const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Use native fetch (Node.js 18+)
const fetch = global.fetch;

const app = express();

// Only parse this route as raw buffer to validate signature
app.post('/webhooks/user-invited', express.raw({ type: 'application/json' }));

// In-memory vendor token cache
let vendorToken = null;
let tokenExpiry = 0;

async function getVendorToken() {
  const now = Math.floor(Date.now() / 1000);

  if (vendorToken && now < tokenExpiry - 60) {
    return vendorToken;
  }

  console.log('🔐 Fetching new Frontegg vendor token...');
  try {
    const res = await fetch('https://api.frontegg.com/auth/vendor/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: process.env.FRONTEGG_CLIENT_ID,
        secret: process.env.FRONTEGG_CLIENT_SECRET,
      }),
    });

    const data = await res.json();

    if (!res.ok || !data.token) {
      console.error('❌ Failed to fetch vendor token:', data);
      return null;
    }

    vendorToken = data.token;
    tokenExpiry = now + data.expiresIn;
    console.log('✅ Token cached until:', new Date(tokenExpiry * 1000).toISOString());
    return vendorToken;
  } catch (err) {
    console.error('🔥 Error fetching vendor token:', err);
    return null;
  }
}

app.post('/webhooks/user-invited', async (req, res) => {
  const rawBody = req.body;
  const receivedSig = req.headers['x-webhook-secret'];

  if (!receivedSig) {
    console.error('❌ Missing x-webhook-secret header');
    return res.status(401).send('Unauthorized');
  }

  if (receivedSig !== process.env.WEBHOOK_SECRET) {
  console.error('❌ Invalid webhook signature');
  return res.status(401).send('Invalid signature');
}

  let payload;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch (err) {
    console.error('❌ Failed to parse JSON body:', err);
    return res.status(400).send('Invalid JSON');
  }

  const { eventKey, eventContext } = payload;

  if (eventKey !== 'frontegg.user.invitedToTenant') {
    return res.status(400).send('Unsupported event');
  }

  const tenantId = eventContext?.tenantId;
  const userId = eventContext?.userId;

  if (!tenantId || !userId) {
    console.error('❌ Missing tenantId or userId');
    return res.status(400).send('Missing data');
  }

  const jwt = await getVendorToken();
  if (!jwt) return res.status(500).send('Unable to authenticate');

  // Step 1: Fetch assigned apps
  let appIds = [];
  try {
    const appsRes = await fetch('https://api.frontegg.com/applications/resources/applications/tenant-assignments/v1', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${jwt}`,
        'frontegg-tenant-id': tenantId,
      },
    });

    const appsData = await appsRes.json();
    appIds = appsData?.[0]?.appIds || [];
    console.log(`🔍 Apps for tenant ${tenantId}:`, appIds);
  } catch (err) {
    console.error('❌ Failed to fetch tenant apps:', err);
    return res.status(500).send('App lookup failed');
  }

  // Step 2: Assign user to each app
  let successCount = 0;
  for (const appId of appIds) {
    try {
      const assignRes = await fetch('https://api.frontegg.com/identity/resources/applications/v1', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          appId,
          tenantId,
          userIds: [userId],
        }),
      });

      const text = await assignRes.text();
      if (assignRes.ok) {
        console.log(`✅ Assigned user ${userId} to app ${appId}:`, text);
        successCount++;
      } else {
        console.error(`❌ Failed to assign user to app ${appId}:`, text);
      }
    } catch (err) {
      console.error(`🔥 Error assigning to app ${appId}:`, err);
    }
  }

  res.status(200).send(`Apps assigned: ${successCount}`);
});

// Load self-signed HTTPS certs
const certPath = path.resolve(__dirname, 'certs');
const credentials = {
  key: fs.readFileSync(path.join(certPath, 'key.pem')),
  cert: fs.readFileSync(path.join(certPath, 'cert.pem')),
};

const PORT = process.env.PORT || 9000;

https.createServer(credentials, app).listen(PORT, () => {
  console.log(`🔐 HTTPS webhook server running at https://localhost:${PORT}`);
});
