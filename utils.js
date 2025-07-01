// utils.js
import jwt from 'jsonwebtoken';
import fetch from 'node-fetch';

let cachedToken = null;
let tokenExpiry = 0;

export async function getVendorToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpiry) {
    return cachedToken;
  }

  console.log('🔑 Fetching new Frontegg vendor token...');
  const response = await fetch('https://api.frontegg.com/auth/vendor/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: process.env.FRONTEGG_CLIENT_ID,
      secret: process.env.FRONTEGG_SECRET,
    }),
  });

  const data = await response.json();

  if (!response.ok || !data.token) {
    console.error('🔥 Error fetching vendor token:', data);
    throw new Error('Unable to fetch vendor token');
  }

  cachedToken = data.token;
  tokenExpiry = now + 23 * 60 * 60 * 1000; // cache for 23 hours
  return cachedToken;
}

export async function getAssignedApps(tenantId) {
  const response = await fetch('https://api.frontegg.com/applications/resources/applications/tenant-assignments/v1', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'frontegg-tenant-id': tenantId,
    },
  });

  const data = await response.json();

  if (!response.ok || !Array.isArray(data) || !data[0]?.appIds) {
    console.error('🔥 Error fetching assigned apps:', data);
    return [];
  }

  return data[0].appIds;
}

export async function assignUserToApp(appId, tenantId, userId, token) {
  const response = await fetch('https://api.frontegg.com/identity/resources/applications/v1', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      appId,
      tenantId,
      userIds: [userId],
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error(`🔥 Failed to assign user to app ${appId}:`, data);
    return false;
  }

  return true;
}

export function verifyWebhookSignature(headerToken, secret) {
  try {
    jwt.verify(headerToken, secret);
    return true;
  } catch (err) {
    console.error('❌ Invalid webhook signature:', err.message);
    return false;
  }
}
