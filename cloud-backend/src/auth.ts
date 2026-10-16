// =============================================================================
// RAMAZANOĞLU TECH MAIL HQ - AUTHENTICATION HELPERS
// =============================================================================

import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { config } from './config.js';

/** Constant-time string comparison (hashes first so lengths never leak). */
export function safeEqual(a: unknown, b: string): boolean {
  if (typeof a !== 'string' || a.length === 0) return false;
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export function isValidAdminKey(candidate: unknown): boolean {
  return safeEqual(candidate, config.superAdminPassword);
}

export function signAdminToken(): string {
  return jwt.sign(
    { role: 'SUPER_ADMIN', email: 'yusuf@ramazanoglu.tech', name: 'Yusuf Ramazanoğlu' },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'], algorithm: 'HS256' }
  );
}

export function verifyAdminToken(token: string): jwt.JwtPayload | null {
  try {
    const decoded = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
    return typeof decoded === 'object' ? decoded : null;
  } catch {
    return null;
  }
}
