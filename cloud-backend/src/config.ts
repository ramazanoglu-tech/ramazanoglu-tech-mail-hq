// =============================================================================
// RAMAZANOĞLU TECH MAIL HQ - CONFIGURATION LOADER
// =============================================================================

import dotenv from 'dotenv';
import path from 'path';

dotenv.config();
// Also look for .env in current directory or parent
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const nodeEnv = process.env.NODE_ENV || 'development';
const mockMode = process.env.MOCK_MODE === 'true';

const KNOWN_WEAK_VALUES = new Set([
  'RamazanogluTech2026!Master',
  'ramazanoglu-tech-cloud-super-admin-jwt-secret-key-32chars-min',
  'SetYourStrongSuperAdminPasswordHere!',
  'your-32-chars-minimum-super-admin-jwt-secret-key',
]);

function requireSecret(name: string, minLength: number): string {
  const value = process.env[name] || '';
  if (!value) {
    throw new Error(
      `[CONFIG] ${name} is required. Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`
    );
  }
  if (KNOWN_WEAK_VALUES.has(value)) {
    throw new Error(`[CONFIG] ${name} uses a value that was published in the repository. Generate a new one.`);
  }
  if (value.length < minLength) {
    throw new Error(`[CONFIG] ${name} must be at least ${minLength} characters long.`);
  }
  return value;
}

export const config = {
  port: parseInt(process.env.PORT || '8765', 10),
  host: process.env.HOST || '127.0.0.1',
  nodeEnv,

  // Reverse proxy hops to trust for req.ip (0 = none). Set to 1 behind Cloudflare Tunnel / nginx.
  trustProxy: parseInt(process.env.TRUST_PROXY || '0', 10),

  // Browser origins allowed for CORS (comma separated). Same-origin PWA needs none.
  allowedOrigins: (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  // Database
  databaseUrl: process.env.DATABASE_URL || '',
  // Set DATABASE_SSL=false for a local/docker Postgres without TLS. Default verifies certificates.
  databaseSsl: process.env.DATABASE_SSL !== 'false',

  // Super Admin Auth (no defaults: the process refuses to start without real secrets)
  superAdminPassword: requireSecret('SUPER_ADMIN_PASSWORD', 16),
  jwtSecret: requireSecret('JWT_SECRET', 32),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',

  // First account. Created on first start when the users table is empty; its initial password is
  // SUPER_ADMIN_PASSWORD and the owner is forced to change it at first login.
  ownerEmail: (process.env.OWNER_EMAIL || 'yusuf@ramazanoglu.tech').toLowerCase().trim(),
  ownerName: process.env.OWNER_NAME || 'Yusuf Ramazanoğlu',

  // Legacy shared key (X-Super-Admin-Key) used by the current Qt desktop client. It maps to a
  // synthetic owner and cannot be attributed to a person: turn it off once the desktop app logs in.
  legacyApiKeyEnabled: process.env.LEGACY_API_KEY_ENABLED !== 'false',

  // Strict Domain Filtering
  domainFilter: (process.env.DOMAIN_FILTER || '@ramazanoglu.tech').toLowerCase(),

  // IMAP 7/24 Sync Motor
  imap: {
    host: process.env.IMAP_HOST || 'imap.gmail.com',
    port: parseInt(process.env.IMAP_PORT || '993', 10),
    tls: process.env.IMAP_TLS !== 'false',
    user: process.env.IMAP_USER || '',
    password: (process.env.IMAP_PASSWORD || '').replace(/\s+/g, ''),
    pollIntervalMs: parseInt(process.env.IMAP_POLL_INTERVAL_MS || '30000', 10),
    autoReconnect: process.env.IMAP_AUTO_RECONNECT !== 'false',
  },

  // Outbound SMTP Dispatcher
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '465', 10),
    secure: process.env.SMTP_SECURE !== 'false',
    user: process.env.SMTP_USER || '',
    password: (process.env.SMTP_PASSWORD || '').replace(/\s+/g, ''),
  },

  // Mock / Dev Simulation. Demo data and /api/dev/* only exist when this is true.
  mockMode,
  enableDevEndpoints: mockMode && nodeEnv !== 'production',
};
