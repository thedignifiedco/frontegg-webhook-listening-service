// utils.js (ESModules)
import fetch from 'node-fetch';

const FRONTEGG_CLIENT_ID = process.env.FRONTEGG_CLIENT_ID;
const FRONTEGG_CLIENT_SECRET = process.env.FRONTEGG_CLIENT_SECRET;

let cachedToken = null;
let tokenExpiry = 0;

/**
 * Fetch and cache Frontegg Vendor Token using Client Credentials Grant
 */
export async function getVendorToken() {
  const now = Date.now() / 1000;

  if (cachedToken && now < tokenExpiry) {
    return cachedToken;
  }

  console.log('🔐 Fetching new Frontegg vendor token...');
  const res = await fetch('https://api.frontegg.com/auth/vendor/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: FRONTEGG_CLIENT_ID,
      secret: FRONTEGG_CLIENT_SECRET,
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    console.error('❌ Failed to fetch token:', error);
    throw new Error('Failed to authenticate with Frontegg');
  }

  const { token, expiresIn } = await res.json();
  cachedToken = token;
  tokenExpiry = now + expiresIn - 60; // Buffer 60s
  return token;
}

/**
 * Get currently assigned app IDs for a given tenant
 */
export async function getAssignedApps(tenantId, vendorToken) {
  try {
    const res = await fetch('https://api.frontegg.com/applications/resources/applications/tenant-assignments/v1', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'frontegg-tenant-id': tenantId,
        'Authorization': `Bearer ${vendorToken}`,
      }
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('🔥 Error fetching assigned apps:', data);
      return [];
    }

    const assigned = data.find(entry => entry.tenantId === tenantId);
    return assigned?.appIds || [];
  } catch (err) {
    console.error('🔥 Unexpected error in getAssignedApps:', err);
    return [];
  }
}

/**
 * Assign user to one or more apps under a tenant
 */
export async function assignUserToApps({ tenantId, userId, appIds, vendorToken }) {
  try {
    const res = await fetch('https://api.frontegg.com/applications/resources/applications/assign-user-to-apps', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${vendorToken}`,
      },
      body: JSON.stringify({
        tenantId,
        userId,
        appIds,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('🔥 Error assigning user to apps:', data);
      return false;
    }

    return true;
  } catch (err) {
    console.error('🔥 Unexpected error in assignUserToApps:', err);
    return false;
  }
}
