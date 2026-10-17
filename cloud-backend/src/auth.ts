// =============================================================================
// RAMAZANOĞLU TECH MAIL HQ - AUTHENTICATION & AUTHORIZATION
// Per-user accounts: JWT carries (user id, token version); the account is re-loaded on every
// request, so disabling a user, changing a role or a password takes effect immediately.
// =============================================================================

import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { findUserById } from './users.js';
import { User, UserRole } from './types.js';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  alias_access: string[];
  must_change_password: boolean;
  via: 'session' | 'legacy-key';
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthUser;
    }
  }
}

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/** Constant-time string comparison (hashes first so lengths never leak). */
export function safeEqual(a: unknown, b: string): boolean {
  if (typeof a !== 'string' || a.length === 0) return false;
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export function isValidAdminKey(candidate: unknown): boolean {
  return config.legacyApiKeyEnabled && safeEqual(candidate, config.superAdminPassword);
}

export function signSessionToken(user: User): string {
  return jwt.sign({ sub: user.id, tv: user.token_version }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'],
    algorithm: 'HS256',
  });
}

export function toAuthUser(u: User): AuthUser {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    // owners always see everything, whatever is stored
    alias_access: u.role === 'owner' ? ['*'] : u.alias_access,
    must_change_password: u.must_change_password,
    via: 'session',
  };
}

const LEGACY_USER: AuthUser = {
  id: 'legacy-key',
  email: 'legacy-key@local',
  name: 'Legacy API key',
  role: 'owner',
  alias_access: ['*'],
  must_change_password: false,
  via: 'legacy-key',
};

/** Verifies a session JWT and returns the live account, or null (bad/expired token, disabled user, revoked). */
export async function authenticateToken(token: string): Promise<AuthUser | null> {
  let payload: jwt.JwtPayload;
  try {
    const decoded = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
    if (typeof decoded !== 'object' || !decoded.sub) return null;
    payload = decoded;
  } catch {
    return null;
  }
  const user = await findUserById(String(payload.sub));
  if (!user || !user.is_active || user.token_version !== payload.tv) return null;
  return toAuthUser(user);
}

/** Resolves credentials from request headers / a ws token, in order: legacy key, Bearer JWT. */
export async function authenticateCredentials(opts: {
  adminKey?: unknown;
  bearer?: string | null;
}): Promise<AuthUser | null> {
  if (isValidAdminKey(opts.adminKey)) return LEGACY_USER;
  if (opts.bearer) return authenticateToken(opts.bearer);
  return null;
}

// ---------------------------------------------------------------------------
// Authorization helpers
// ---------------------------------------------------------------------------

export function canAccessAlias(user: AuthUser, alias: string): boolean {
  if (user.role === 'owner') return true;
  const a = alias.toLowerCase();
  return user.alias_access.includes('*') || user.alias_access.some((x) => x.toLowerCase() === a);
}

/** null = unrestricted, otherwise the explicit (lower-case) list the user may see. */
export function aliasScope(user: AuthUser): string[] | null {
  if (user.role === 'owner' || user.alias_access.includes('*')) return null;
  return user.alias_access.map((a) => a.toLowerCase());
}

// ---------------------------------------------------------------------------
// Express middleware
// ---------------------------------------------------------------------------

export function requireAuth(opts: { allowPasswordChange?: boolean } = {}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const adminKey = req.headers['x-super-admin-key'] || req.headers['x-admin-key'];
      const header = req.headers.authorization;
      const bearer = header && header.startsWith('Bearer ') ? header.slice(7) : null;
      const user = await authenticateCredentials({ adminKey: Array.isArray(adminKey) ? adminKey[0] : adminKey, bearer });

      if (!user) {
        console.warn(`[SECURITY] Unauthorized ${req.method} ${req.path} from ${req.ip}`);
        res.status(401).json({ error: 'Oturum geçersiz veya süresi dolmuş. Lütfen tekrar giriş yapın.' });
        return;
      }
      if (user.must_change_password && !opts.allowPasswordChange) {
        res.status(403).json({ error: 'Devam etmek için parolanızı değiştirmelisiniz.', code: 'PASSWORD_CHANGE_REQUIRED' });
        return;
      }
      req.auth = user;
      next();
    } catch (err) {
      console.error('[AUTH] Failed to authenticate request:', err);
      res.status(500).json({ error: 'Kimlik doğrulama hatası.' });
    }
  };
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      res.status(403).json({ error: 'Bu işlem için yetkiniz yok.' });
      return;
    }
    next();
  };
}
