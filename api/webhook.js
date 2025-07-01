import jwt from 'jsonwebtoken';

let vendorToken = null;
let tokenExpiry = 0;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const receivedSig = req.headers['x-webhook-secret'];
  if (!receivedSig) {
    console.error('❌ Missing x-webhook-secret header');
    return res.status(401).send('Unauthorized');
  }

  // ✅ Verify JWT signed with your WEBHOOK_SECRET
  try {
    jwt.verify(receivedSig, process.env.WEBHOOK_SECRET);
  } catch (err) {
    console.error('❌ Invalid webhook signature:', err.message);
    return res.status(401).send('Unauthorized');
  }

  const { eventKey, eventContext } = req.body;
  if (eventKey !== 'frontegg.user.invitedToTenant') {
    return res.status(400).send('Unsupported event');
  }

  const tenantId = eventContext?.tenantId;
  const userId = eventContext?.userId;
  if (!tenantId || !userId) return res.status(400).send('Missing tenantId or userId');

  const jwtToken = await getVendorToken();
  if (!jwtToken) return res.status(500).send('Failed to authenticate');

  let appIds = [];
  try {
    const appsRes = await fetch('https://api.frontegg.com/applications/resources/applications/tenant-assignments/v1', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${jwtToken}`,
        'frontegg-tenant-id': tenantId
      }
    });
    const appsData = await appsRes.json();
    appIds = appsData?.[0]?.appIds || [];
  } catch (err) {
    console.error('App fetch error:', err);
    return res.status(500).send('App fetch failed');
  }

  let successCount = 0;
  for (const appId of appIds) {
    try {
      const assignRes = await fetch('https://api.frontegg.com/identity/resources/applications/v1', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${jwtToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ appId, tenantId, userIds: [userId] })
      });

      if (assignRes.ok) successCount++;
    } catch (err) {
      console.error(`Assign error for app ${appId}:`, err);
    }
  }

  res.status(200).send(`Apps assigned: ${successCount}`);
}

async function getVendorToken() {
  const now = Math.floor(Date.now() / 1000);
  if (vendorToken && now < tokenExpiry - 60) return vendorToken;

  const res = await fetch('https://api.frontegg.com/auth/vendor/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: process.env.FRONTEGG_CLIENT_ID,
      secret: process.env.FRONTEGG_CLIENT_SECRET
    })
  });

  const data = await res.json();
  if (!res.ok || !data.token) {
    console.error('Token fetch error:', data);
    return null;
  }

  vendorToken = data.token;
  tokenExpiry = now + data.expiresIn;
  return vendorToken;
}
