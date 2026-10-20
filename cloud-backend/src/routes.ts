// =============================================================================
// RAMAZANOĞLU TECH MAIL HQ - REST API ROUTES (PER-USER ACCOUNTS)
// =============================================================================

import { Router, Request, Response, NextFunction } from 'express';
import { config } from './config.js';
import { AuthUser, aliasScope, canAccessAlias, requireAuth, requireRole, signSessionToken } from './auth.js';
import {
  getAliases,
  createAlias,
  getEmails,
  getEmailById,
  updateEmailStatus,
  deleteEmail,
  getStats,
  saveEmail,
  isDbConnected,
} from './db.js';
import {
  findUserByEmail,
  findUserById,
  setUserPassword,
  toPublicUser,
  touchLastLogin,
  validatePasswordStrength,
  verifyPassword,
  writeAudit,
} from './users.js';
import { sendEmailAsAlias } from './smtpDispatcher.js';
import { getSyncStatus, pollInbox } from './syncStatus.js';
import { broadcastWebSocket, getConnectedClientCount, refreshUserSockets } from './websocket.js';
import { SWISS_EMAIL_TEMPLATES } from './templates.js';
import { adminRouter } from './adminRoutes.js';
import { Email } from './types.js';

export const apiRouter = Router();

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

interface RateLimitEntry {
  count: number;
  resetTime: number;
}
const rateLimitMap = new Map<string, RateLimitEntry>();

// Purge expired entries so the maps cannot grow without bound
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of rateLimitMap) {
    if (now > v.resetTime) rateLimitMap.delete(k);
  }
  for (const [k, v] of accountFailures) {
    if (now > v.resetAt) accountFailures.delete(k);
  }
}, 60 * 1000).unref();

export function createRateLimiter(maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${req.baseUrl}${req.path}:${ip}`;
    const now = Date.now();
    const entry = rateLimitMap.get(key);

    if (!entry || now > entry.resetTime) {
      rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (entry.count >= maxRequests) {
      console.warn(`[SECURITY] Rate limit exceeded for ${ip} on ${req.path}`);
      res.status(429).json({
        error: 'Çok fazla istek. Lütfen biraz bekleyip tekrar deneyin.',
        retryAfterMs: entry.resetTime - now,
      });
      return;
    }

    entry.count++;
    next();
  };
}

const loginLimiter = createRateLimiter(20, 15 * 60 * 1000); // per IP: 20 attempts / 15 min
const passwordLimiter = createRateLimiter(10, 15 * 60 * 1000);
const sendLimiter = createRateLimiter(30, 60 * 1000);
const syncLimiter = createRateLimiter(5, 60 * 1000);

// Per-account lockout: 5 wrong passwords => 15 minutes, no matter which IP they come from
const MAX_ACCOUNT_FAILURES = 5;
const ACCOUNT_LOCK_MS = 15 * 60 * 1000;
const accountFailures = new Map<string, { count: number; resetAt: number }>();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EMAIL_SHAPE = /^[^\s@]{1,64}@[^\s@]{1,190}$/;

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function authPublic(a: AuthUser) {
  return {
    id: a.id,
    email: a.email,
    name: a.name,
    role: a.role,
    alias_access: a.alias_access,
    must_change_password: a.must_change_password,
  };
}

/** Loads an e-mail the caller may see; answers 404 (not 403) so existence is not revealed. */
async function loadAccessibleEmail(req: Request, res: Response): Promise<Email | null> {
  const email = await getEmailById(String(req.params.id));
  if (!email || !canAccessAlias(req.auth!, email.alias_target)) {
    res.status(404).json({ error: 'E-posta bulunamadı.' });
    return null;
  }
  return email;
}

const authed = requireAuth();
const staff = requireRole('owner', 'admin');

// ---------------------------------------------------------------------------
// 1. Authentication
// ---------------------------------------------------------------------------

apiRouter.post('/auth/login', loginLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || typeof password !== 'string' || !EMAIL_SHAPE.test(email) || password.length > 256) {
      res.status(400).json({ error: 'E-posta ve parola gerekli.' });
      return;
    }
    const key = email.toLowerCase().trim();

    const failure = accountFailures.get(key);
    if (failure && failure.count >= MAX_ACCOUNT_FAILURES && Date.now() < failure.resetAt) {
      await writeAudit({ user_email: key, action: 'login_locked', ip: req.ip });
      res.status(429).json({
        error: 'Bu hesap çok fazla hatalı deneme nedeniyle geçici olarak kilitlendi. 15 dakika sonra tekrar deneyin.',
        retryAfterMs: failure.resetAt - Date.now(),
      });
      return;
    }

    const user = await findUserByEmail(key);
    // Always run a bcrypt compare (against a dummy hash when the user is unknown): same cost either way
    const passwordOk = await verifyPassword(password, user ? user.password_hash : null);

    if (!user || !passwordOk || !user.is_active) {
      const prev = failure && Date.now() < failure.resetAt ? failure : { count: 0, resetAt: Date.now() + ACCOUNT_LOCK_MS };
      accountFailures.set(key, { count: prev.count + 1, resetAt: prev.resetAt });
      await writeAudit({
        user_id: user?.id,
        user_email: key,
        action: user && passwordOk && !user.is_active ? 'login_blocked_disabled' : 'login_failed',
        ip: req.ip,
      });
      // One generic message: do not reveal whether the account exists or is disabled
      res.status(401).json({ error: 'E-posta veya parola hatalı.' });
      return;
    }

    accountFailures.delete(key);
    await touchLastLogin(user.id);
    await writeAudit({ user_id: user.id, user_email: user.email, action: 'login', ip: req.ip });

    res.json({
      token: signSessionToken(user),
      user: toPublicUser(user),
      must_change_password: user.must_change_password,
    });
  } catch (err) {
    console.error('[AUTH] Login error:', errMsg(err));
    res.status(500).json({ error: 'Giriş sırasında bir hata oluştu.' });
  }
});

apiRouter.get('/auth/me', requireAuth({ allowPasswordChange: true }), (req: Request, res: Response) => {
  const a = req.auth!;
  res.json({
    user: authPublic(a),
    features: { dev_simulate: config.enableDevEndpoints && a.role === 'owner' },
  });
});

apiRouter.post('/auth/change-password', passwordLimiter, requireAuth({ allowPasswordChange: true }), async (req: Request, res: Response) => {
  try {
    const a = req.auth!;
    if (a.via === 'legacy-key') {
      res.status(400).json({ error: 'API anahtarıyla parola değiştirilemez.' });
      return;
    }
    const { current_password, new_password } = req.body || {};
    if (typeof current_password !== 'string' || typeof new_password !== 'string') {
      res.status(400).json({ error: 'Mevcut ve yeni parola gerekli.' });
      return;
    }

    const user = await findUserById(a.id);
    if (!user || !(await verifyPassword(current_password, user.password_hash))) {
      await writeAudit({ user_id: a.id, user_email: a.email, action: 'password_change_failed', ip: req.ip });
      res.status(401).json({ error: 'Mevcut parola hatalı.' });
      return;
    }
    if (current_password === new_password) {
      res.status(400).json({ error: 'Yeni parola mevcut parolayla aynı olamaz.' });
      return;
    }
    const weak = validatePasswordStrength(new_password, user.email);
    if (weak) {
      res.status(400).json({ error: weak });
      return;
    }

    const updated = await setUserPassword(user.id, new_password, false);
    if (!updated) {
      res.status(404).json({ error: 'Hesap bulunamadı.' });
      return;
    }
    // Every other session of this account is now invalid: drop its sockets, hand out a fresh token
    refreshUserSockets(updated.id, null);
    await writeAudit({ user_id: updated.id, user_email: updated.email, action: 'password_changed', ip: req.ip });
    res.json({ token: signSessionToken(updated), user: toPublicUser(updated) });
  } catch (err) {
    console.error('[AUTH] Change password error:', errMsg(err));
    res.status(500).json({ error: 'Parola değiştirilemedi.' });
  }
});

// ---------------------------------------------------------------------------
// 2. Health
// ---------------------------------------------------------------------------

apiRouter.get('/health', (_req: Request, res: Response) => {
  // Public liveness probe: no operational details
  res.json({ status: 'ONLINE', timestamp: new Date().toISOString() });
});

apiRouter.get('/health/details', authed, staff, (_req: Request, res: Response) => {
  const syncStatus = getSyncStatus();
  syncStatus.connected_clients = getConnectedClientCount();
  res.json({
    status: 'ONLINE',
    service: 'Ramazanoğlu Tech Mail HQ Cloud Backend',
    version: '1.1.0',
    db_connected: isDbConnected(),
    sync: syncStatus,
    timestamp: new Date().toISOString(),
  });
});

// ---------------------------------------------------------------------------
// 3. Identities (aliases) and templates
// ---------------------------------------------------------------------------

apiRouter.get('/aliases', authed, async (req: Request, res: Response) => {
  try {
    const user = req.auth!;
    const aliases = (await getAliases()).filter((a) => canAccessAlias(user, a.email));
    res.json({ aliases });
  } catch (err) {
    res.status(500).json({ error: errMsg(err) });
  }
});

apiRouter.get('/templates', authed, (_req: Request, res: Response) => {
  res.json({ templates: SWISS_EMAIL_TEMPLATES });
});

apiRouter.post('/aliases', authed, staff, async (req: Request, res: Response) => {
  try {
    const { email, display_name, department_badge, signature_html } = req.body || {};
    if (
      typeof email !== 'string' ||
      !/^[a-z0-9._-]{1,64}@[a-z0-9.-]+$/i.test(email) ||
      !email.toLowerCase().endsWith(config.domainFilter)
    ) {
      res.status(400).json({ error: `Kimlik adresi ${config.domainFilter} alan adına ait basit bir adres olmalı.` });
      return;
    }
    const created = await createAlias({
      email,
      display_name: typeof display_name === 'string' && display_name.trim() ? display_name.trim().slice(0, 120) : 'Ramazanoğlu Tech Identity',
      department_badge:
        typeof department_badge === 'string' && department_badge.trim()
          ? department_badge.trim().slice(0, 40)
          : `[${email.split('@')[0].toUpperCase()}]`,
      signature_html,
    });
    await writeAudit({ user_id: req.auth!.id, user_email: req.auth!.email, action: 'alias_create', target: created.email, ip: req.ip });
    res.status(201).json({ alias: created });
  } catch (err) {
    res.status(500).json({ error: errMsg(err) });
  }
});

// ---------------------------------------------------------------------------
// 4. E-mails (always scoped to the caller's identities)
// ---------------------------------------------------------------------------

apiRouter.get('/emails', authed, async (req: Request, res: Response) => {
  try {
    const user = req.auth!;
    const alias = typeof req.query.alias === 'string' ? req.query.alias : undefined;
    if (alias && alias !== 'all' && alias !== 'master' && !canAccessAlias(user, alias)) {
      res.status(403).json({ error: 'Bu kimliğe erişim yetkiniz yok.' });
      return;
    }
    const unread = req.query.unread !== undefined ? req.query.unread === 'true' : undefined;
    const starred = req.query.starred !== undefined ? req.query.starred === 'true' : undefined;
    const archived = req.query.archived !== undefined ? req.query.archived === 'true' : undefined;
    const direction = typeof req.query.direction === 'string' ? req.query.direction : undefined;
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const rawLimit = parseInt(String(req.query.limit ?? '50'), 10);
    const rawOffset = parseInt(String(req.query.offset ?? '0'), 10);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 200) : 50;
    const offset = Number.isFinite(rawOffset) ? Math.max(rawOffset, 0) : 0;

    const result = await getEmails({
      allowedAliases: aliasScope(user),
      alias,
      unread,
      starred,
      archived,
      direction,
      search,
      limit,
      offset,
    });

    res.json({ emails: result.emails, total: result.total, limit, offset });
  } catch (err) {
    res.status(500).json({ error: errMsg(err) });
  }
});

apiRouter.get('/emails/:id', authed, async (req: Request, res: Response) => {
  try {
    const email = await loadAccessibleEmail(req, res);
    if (email) res.json({ email });
  } catch (err) {
    res.status(500).json({ error: errMsg(err) });
  }
});

apiRouter.patch('/emails/:id', authed, async (req: Request, res: Response) => {
  try {
    const existing = await loadAccessibleEmail(req, res);
    if (!existing) return;

    const { is_read, is_starred, is_archived } = req.body || {};
    const updated = await updateEmailStatus(existing.id, {
      is_read: typeof is_read === 'boolean' ? is_read : undefined,
      is_starred: typeof is_starred === 'boolean' ? is_starred : undefined,
      is_archived: typeof is_archived === 'boolean' ? is_archived : undefined,
    });
    if (!updated) {
      res.status(404).json({ error: 'E-posta bulunamadı.' });
      return;
    }

    broadcastWebSocket('EMAIL_UPDATED', updated);
    res.json({ email: updated });
  } catch (err) {
    res.status(500).json({ error: errMsg(err) });
  }
});

apiRouter.delete('/emails/:id', authed, staff, async (req: Request, res: Response) => {
  try {
    const existing = await loadAccessibleEmail(req, res);
    if (!existing) return;

    const success = await deleteEmail(existing.id);
    if (!success) {
      res.status(404).json({ error: 'E-posta bulunamadı veya zaten silinmiş.' });
      return;
    }
    await writeAudit({
      user_id: req.auth!.id,
      user_email: req.auth!.email,
      action: 'email_delete',
      target: existing.alias_target,
      ip: req.ip,
      details: { subject: existing.subject.slice(0, 120) },
    });
    // alias_target lets the socket layer deliver this only to accounts that could see the mail
    broadcastWebSocket('EMAIL_UPDATED', { id: existing.id, deleted: true, alias_target: existing.alias_target });
    res.json({ success: true, id: existing.id });
  } catch (err) {
    res.status(500).json({ error: errMsg(err) });
  }
});

// ---------------------------------------------------------------------------
// 5. Outbound dispatcher (send as an identity the caller may use)
// ---------------------------------------------------------------------------

apiRouter.post('/emails/send', authed, sendLimiter, async (req: Request, res: Response) => {
  try {
    const user = req.auth!;
    const { from_alias, to, cc, bcc, subject, body_text, body_html, in_reply_to, thread_id } = req.body || {};

    if (typeof from_alias !== 'string' || !to || typeof subject !== 'string' || !subject.trim()) {
      res.status(400).json({ error: 'Eksik alan: from_alias, to ve subject zorunludur.' });
      return;
    }

    const fromLower = from_alias.toLowerCase().trim();
    if (!canAccessAlias(user, fromLower)) {
      await writeAudit({ user_id: user.id, user_email: user.email, action: 'send_denied', target: fromLower, ip: req.ip });
      res.status(403).json({ error: 'Bu kimlikle e-posta gönderme yetkiniz yok.' });
      return;
    }
    // Only the owner may mint a brand-new identity by sending from it
    if (user.role !== 'owner' && !(await getAliases()).some((a) => a.email.toLowerCase() === fromLower)) {
      res.status(403).json({ error: 'Tanımsız kimlik. Yeni kimliği bir yönetici oluşturmalı.' });
      return;
    }

    const asList = (v: unknown): string[] =>
      (Array.isArray(v) ? v : v ? [v] : []).map((x: unknown) => String(x));
    const toAddresses = asList(to);
    const ccAddresses = asList(cc);
    const bccAddresses = asList(bcc);
    if (toAddresses.length + ccAddresses.length + bccAddresses.length > 50) {
      res.status(400).json({ error: 'Çok fazla alıcı (en fazla 50).' });
      return;
    }

    const sentEmail = await sendEmailAsAlias({
      from_alias,
      to: toAddresses,
      cc: ccAddresses,
      bcc: bccAddresses,
      subject,
      body_text,
      body_html:
        typeof body_html === 'string' && body_html
          ? body_html
          : `<p>${String(body_text || '')
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/\n/g, '<br>')}</p>`,
      in_reply_to,
      thread_id,
    });

    await writeAudit({
      user_id: user.id,
      user_email: user.email,
      action: 'email_send',
      target: fromLower,
      ip: req.ip,
      details: { recipients: toAddresses.length + ccAddresses.length + bccAddresses.length },
    });
    res.status(201).json({ email: sentEmail });
  } catch (err) {
    const msg = errMsg(err);
    console.error('[HTTP ERROR in /emails/send]:', msg);
    const status = /^(Security validation|Unauthorized sender|At least one|Email subject)/.test(msg)
      ? 400
      : /^SMTP delivery failed/.test(msg)
        ? 502
        : 500;
    res.status(status).json({ error: msg });
  }
});

// ---------------------------------------------------------------------------
// 6. Stats, sync, dev simulation
// ---------------------------------------------------------------------------

apiRouter.get('/stats', authed, async (req: Request, res: Response) => {
  try {
    res.json(await getStats(aliasScope(req.auth!)));
  } catch (err) {
    res.status(500).json({ error: errMsg(err) });
  }
});

apiRouter.post('/sync/trigger', authed, staff, syncLimiter, async (_req: Request, res: Response) => {
  try {
    await pollInbox();
    res.json({ message: 'Gelen mail push tabanlıdır; yoklanacak bir şey yok.' });
  } catch (err) {
    res.status(500).json({ error: errMsg(err) });
  }
});

// Dev simulation: only mounted when MOCK_MODE=true and NODE_ENV != production
apiRouter.post(
  '/dev/simulate',
  (_req: Request, res: Response, next: NextFunction) => {
    if (!config.enableDevEndpoints) {
      res.status(404).json({ error: 'Not found.' });
      return;
    }
    next();
  },
  authed,
  requireRole('owner'),
  async (req: Request, res: Response) => {
    try {
      const {
        alias_target = 'info@ramazanoglu.tech',
        from_name = 'Dr. Alexander Keller',
        from_address = 'a.keller@ethz.ch',
        subject = 'Applied Distributed Systems & AI Research Proposal',
        body_html = '<p>Greetings Ramazanoğlu Tech team,</p><p>We would like to submit a formal inquiry regarding the GPU cluster cloud scheduling protocol.</p><p>Best regards,<br>Dr. Alexander Keller<br>ETH Zürich</p>',
      } = req.body || {};

      const messageId = `<sim-${Date.now()}-${Math.random().toString(36).substring(2, 7)}@ramazanoglu.tech>`;
      const simulated = await saveEmail({
        message_id: messageId,
        thread_id: messageId,
        alias_target,
        from_name,
        from_address,
        to_addresses: [alias_target],
        cc_addresses: [],
        bcc_addresses: [],
        subject,
        body_text: String(body_html).replace(/<[^>]*>/g, ''),
        body_html,
        is_read: false,
        is_starred: false,
        is_archived: false,
        direction: 'INBOUND',
        received_at: new Date().toISOString(),
        raw_headers: { From: `"${from_name}" <${from_address}>`, To: alias_target, Subject: subject, 'Message-ID': messageId },
      });

      broadcastWebSocket('EMAIL_RECEIVED', simulated);
      res.status(201).json({ message: 'Simulated inbound email injected and broadcasted.', email: simulated });
    } catch (err) {
      res.status(500).json({ error: errMsg(err) });
    }
  }
);

// ---------------------------------------------------------------------------
// 7. Administration (users, audit trail)
// ---------------------------------------------------------------------------

apiRouter.use('/admin', adminRouter);
