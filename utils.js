// utils.js
import jwt from 'jsonwebtoken';
import fetch from 'node-fetch';

let cachedToken = null;
let tokenExpiry = 0;

export function validateWebhookSignature(signedToken, secret) {
  try {
    jwt.verify(signedToken, secret); // HS256 signed JWT from Frontegg
    return true;
  } catch (err) {
    console.error('❌ Invalid webhook signature:', err.message);
    return false;
  }
}

export async function getVendorToken() {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && now < tokenExpiry) {
    return cachedToken;
  }

  console.log('🔐 Fetching new Frontegg vendor token...');

  const res = await fetch('https://api.frontegg.com/auth/vendor/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: process.env.FRONTEGG_CLIENT_ID,
      secret: process.env.FRONTEGG_CLIENT_SECRET,
    }),
  });

  if (!res.ok) {
    throw new Error(`Error fetching token: ${res.statusText}`);
  }

  const { token, expiresIn } = await res.json();
  cachedToken = token;
  tokenExpiry = now + expiresIn - 60; // renew 1 min before expiry

  return token;
}

export async function assignUserToAllApps({ tenantId, userId }) {
  const vendorToken = await getVendorToken();

  const appsRes = await fetch('https://api.frontegg.com/vendor/resources/applications', {
    headers: {
      Authorization: `Bearer ${vendorToken}`,
    },
  });

  const apps = await appsRes.json();
  if (!Array.isArray(apps)) throw new Error('Invalid apps response');

  const assignedApps = [];

  for (const app of apps) {
    const assignRes = await fetch(
      `https://api.frontegg.com/vendor/resources/tenants/${tenantId}/users/${userId}/applications/${app.id}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${vendorToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (assignRes.ok) {
      assignedApps.push(app.id);
    } else {
      console.error(`❌ Failed to assign app ${app.id}:`, await assignRes.text());
    }
  }

  return assignedApps;
}
