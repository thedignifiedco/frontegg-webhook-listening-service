// utils.js
import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';
import { config } from './config.js';

const API_BASE = config.apiBaseUrl;

let cachedToken = null;
let tokenExpiry = 0;

export function verifyWebhookSignature(signedToken, secret) {
  try {
    jwt.verify(signedToken, secret);
    return true;
  } catch (err) {
    console.error('❌ Invalid webhook signature:', err.message);
    return false;
  }
}

export async function getVendorToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpiry) return cachedToken;

  const res = await fetch(`${API_BASE}/auth/vendor/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: config.clientId,
      secret: config.clientSecret,
    }),
  });

  if (!res.ok) throw new Error(`Failed to fetch vendor token: ${res.status}`);
  const { token, expiresIn } = await res.json();

  cachedToken = token;
  tokenExpiry = now + expiresIn * 1000;
  return token;
}

/**
 * Get current tenants assigned to a user
 */
export async function getUserTenants(userId, vendorToken) {
  const url = `${API_BASE}/identity/resources/users/v2/me/tenants`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${vendorToken}`,
      'frontegg-user-id': userId,
    },
  });

  if (!res.ok) {
    console.error(`❌ Failed to fetch user tenants for ${userId}:`, await res.text());
    return [];
  }

  const data = await res.json();
  return Array.isArray(data) ? data.map((t) => t.tenantId) : [];
}

/**
 * Get applications assigned to tenant
 */
export async function getAssignedApps(tenantId, vendorToken) {
  const res = await fetch(
    `${API_BASE}/applications/resources/applications/tenant-assignments/v1`,
    {
      headers: {
        'frontegg-tenant-id': tenantId,
        Authorization: `Bearer ${vendorToken}`,
      },
    }
  );

  if (!res.ok) throw new Error('Failed to fetch tenant applications');
  const data = await res.json();
  const apps = data.find((item) => item.tenantId === tenantId);
  return apps?.appIds || [];
}

/**
 * Assign user to applications (parallelized)
 */
export async function assignUserToApps(userId, tenantId, appIds, vendorToken) {
  const promises = appIds.map(async (appId) => {
    const res = await fetch(
      `${API_BASE}/identity/resources/applications/v1`,
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

    return { appId, status: res.status, success: res.ok };
  });

  return Promise.all(promises);
}

/**
 * Get sub-tenants for a tenant
 */
export async function getSubTenants(tenantId, vendorToken) {
  const res = await fetch(
    `${API_BASE}/tenants/resources/hierarchy/v1`,
    {
      headers: {
        'frontegg-tenant-id': tenantId,
        Authorization: `Bearer ${vendorToken}`,
      },
    }
  );

  if (!res.ok) {
    console.error('❌ Failed to fetch sub-tenants:', await res.text());
    return [];
  }

  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

/**
 * Assign user to sub-tenants, skipping already assigned
 */
export async function assignUserToSubTenants(userId, tenantId, vendorToken) {
  const subTenants = await getSubTenants(tenantId, vendorToken);
  if (subTenants.length === 0) {
    console.log('ℹ️ No sub-tenants found. Skipping sub-tenant assignment.');
    return [];
  }

  const userTenantIds = await getUserTenants(userId, vendorToken);
  const promises = subTenants.map(async (sub) => {
    if (userTenantIds.includes(sub.tenantId)) {
      console.log(`ℹ️ User ${userId} is already in sub-tenant ${sub.tenantId}. Skipping.`);
      return { subTenantId: sub.tenantId, success: true, skipped: true };
    }

    const url = `${API_BASE}/identity/resources/users/v1/${userId}/tenant`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${vendorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        validateTenantExist: true,
        tenantId: sub.tenantId,
        skipInviteEmail: true,
      }),
    });

    return {
      subTenantId: sub.tenantId,
      status: res.status,
      success: res.ok,
      skipped: false,
    };
  });

  return Promise.all(promises);
}

/**
 * Disable a user immediately
 */
export async function disableUser(userId, tenantId, vendorToken) {
  const url = `${API_BASE}/identity/resources/tenants/users/v1/${userId}/disable`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${vendorToken}`,
      'frontegg-tenant-id': tenantId,
    },
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    console.error(`❌ Failed to disable user ${userId}:`, res.status, errorText);
  }

  return { status: res.status, success: res.ok };
}
