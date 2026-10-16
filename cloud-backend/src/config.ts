// =============================================================================
// RAMAZANOĞLU TECH MAIL HQ - CONFIGURATION LOADER
// =============================================================================

import dotenv from 'dotenv';
import path from 'path';

dotenv.config();
// Also look for .env in current directory or parent
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const config = {
  port: parseInt(process.env.PORT || '8765', 10),
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',

  // Database
  databaseUrl: process.env.DATABASE_URL || '',

  // Super Admin Auth
  superAdminPassword: process.env.SUPER_ADMIN_PASSWORD || process.env.ADMIN_TOKEN || 'RamazanogluTech2026!Master',
  jwtSecret: process.env.JWT_SECRET || 'ramazanoglu-tech-cloud-super-admin-jwt-secret-key-32chars-min',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '30d',

  // Strict Domain Filtering
  domainFilter: (process.env.DOMAIN_FILTER || (process.env.CORPORATE_DOMAIN ? (process.env.CORPORATE_DOMAIN.startsWith('@') ? process.env.CORPORATE_DOMAIN : '@' + process.env.CORPORATE_DOMAIN) : '@ramazanoglu.tech')).toLowerCase(),

  // IMAP 7/24 Sync Motor
  imap: {
    host: process.env.IMAP_HOST || 'imap.gmail.com',
    port: parseInt(process.env.IMAP_PORT || '993', 10),
    tls: process.env.IMAP_TLS !== 'false',
    user: process.env.IMAP_USER || '',
    password: (process.env.IMAP_PASSWORD || process.env.IMAP_PASS || '').replace(/["']/g, '').replace(/\s+/g, ''),
    pollIntervalMs: parseInt(process.env.IMAP_POLL_INTERVAL_MS || '30000', 10),
    autoReconnect: process.env.IMAP_AUTO_RECONNECT !== 'false',
  },

  // Outbound SMTP Dispatcher
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '465', 10),
    secure: process.env.SMTP_SECURE !== 'false',
    user: process.env.SMTP_USER || '',
    password: (process.env.SMTP_PASSWORD || process.env.SMTP_PASS || '').replace(/["']/g, '').replace(/\s+/g, ''),
  },

  // Mock / Dev Simulation
  mockMode: process.env.MOCK_MODE === 'true',
};
