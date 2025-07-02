// utils.js
import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';

const VENDOR_TOKEN_CACHE = {
  token: null,
  expiry: null,
};

export async function getVendorToken() {
  const now = Date.now();

  if (VENDOR_TOKEN_CACHE.token && VENDOR_TOKEN_CACHE.expiry > now) {
    return VENDOR_TOKEN_CACHE.token;
  }

  const res = await fetch('https://api.frontegg.com/auth/vendor/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: process.env.FRONTEGG_CLIENT_ID,
      secret: process.env.FRONTEGG_CLIENT_SECRET,
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch vendor token: ${res.status}`);
  }

  const { token, expiresIn } = await res.json();
  VENDOR_TOKEN_CACHE.token = token;
  VENDOR_TOKEN_CACHE.expiry = now + expiresIn * 1000;

  return token;
}

export async function getAssignedApps(tenantId, vendorToken) {
  const res = await fetch(
    'https://api.frontegg.com/applications/resources/applications/tenant-assignments/v1',
    {
      headers: {
        'frontegg-tenant-id': tenantId,
        Authorization: `Bearer ${vendorToken}`,
      },
    }
  );

  if (!res.ok) {
    throw new Error('Failed to fetch tenant applications');
  }

  const data = await res.json();
  const apps = data.find((item) => item.tenantId === tenantId);
  return apps?.appIds || [];
}

export async function assignUserToApps(userId, tenantId, appIds, vendorToken) {
  const results = [];

  for (const appId of appIds) {
    const res = await fetch(
      'https://api.frontegg.com/identity/resources/applications/v1',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${vendorToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          appId,
          tenantId,
          userIds: [userId],
        }),
      }
    );

    const result = await res.json();
    results.push({ appId, status: res.status, result });
  }

  return results;
}

export function verifyWebhookSignature(headerValue, webhookSecret) {
  try {
    const decoded = jwt.verify(headerValue, webhookSecret);
    return !!decoded;
  } catch {
    return false;
  }
}
