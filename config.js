// config.js
import dotenv from 'dotenv';

dotenv.config();

const requiredEnvVars = [
  'FRONTEGG_CLIENT_ID',
  'FRONTEGG_CLIENT_SECRET',
  'FRONTEGG_WEBHOOK_SECRET',
  'FRONTEGG_API_BASE_URL',
];

for (const varName of requiredEnvVars) {
  if (!process.env[varName]) {
    throw new Error(`❌ Missing required environment variable: ${varName}`);
  }
}

export const config = {
  clientId: process.env.FRONTEGG_CLIENT_ID,
  clientSecret: process.env.FRONTEGG_CLIENT_SECRET,
  webhookSecret: process.env.FRONTEGG_WEBHOOK_SECRET,
  apiBaseUrl: process.env.FRONTEGG_API_BASE_URL,
};
