// =============================================================================
// RAMAZANOĞLU TECH MAIL HQ - REST API ROUTES & SUPER ADMIN CONTROLLERS
// =============================================================================

import { Router, Request, Response } from 'express';
import { config } from './config.js';
import { isValidAdminKey, signAdminToken, verifyAdminToken } from './auth.js';
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
import { sendEmailAsAlias } from './smtpDispatcher.js';
import { getSyncStatus, pollInbox } from './imapSync.js';
import { broadcastWebSocket, getConnectedClientCount } from './websocket.js';
import { SWISS_EMAIL_TEMPLATES } from './templates.js';

export const apiRouter = Router();

// Rate limiter state
interface RateLimitEntry {
  count: number;
  resetTime: number;
}
const rateLimitMap = new Map<string, RateLimitEntry>();

// Purge expired entries so the map cannot grow without bound
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of rateLimitMap) {
    if (now > v.resetTime) rateLimitMap.delete(k);
  }
}, 60 * 1000).unref();

export function createRateLimiter(maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: () => void) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${req.baseUrl}${req.path}:${ip}`;
    const now = Date.now();
    const entry = rateLimitMap.get(key);

    if (!entry || now > entry.resetTime) {
      rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (entry.count >= maxRequests) {
      console.warn(`[SECURITY WARNING] Rate limit exceeded for IP: ${ip} on ${req.path}`);
      res.status(429).json({
        error: 'Too Many Requests: Rate limit exceeded. Security policy cooldown in effect.',
        retryAfterMs: entry.resetTime - now,
      });
      return;
    }

    entry.count++;
    next();
  };
}

const loginLimiter = createRateLimiter(5, 15 * 60 * 1000); // 5 attempts per 15 min
const sendLimiter = createRateLimiter(30, 60 * 1000); // 30 emails per min
const syncLimiter = createRateLimiter(5, 60 * 1000); // 5 manual syncs per min

// Security Middleware: Authenticate Super Admin JWT or Secret Key
export function requireAdminAuth(req: Request, res: Response, next: () => void) {
  // Check X-Super-Admin-Key header (for automated desktop clients / services)
  const adminKey = req.headers['x-super-admin-key'] || req.headers['x-admin-key'];
  if (isValidAdminKey(adminKey)) {
    (req as Request & { user?: unknown }).user = { role: 'SUPER_ADMIN', authMethod: 'API_KEY' };
    return next();
  }

  // Check Bearer JWT token
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const decoded = verifyAdminToken(token);
    if (decoded) {
      (req as Request & { user?: unknown }).user = decoded;
      return next();
    }
    res.status(401).json({ error: 'Unauthorized: Invalid or expired Bearer token.' });
    return;
  }

  // Reject unauthorized access with zero data leakage
  console.warn(`[SECURITY VIOLATION] Unauthorized attempt on protected endpoint ${req.method} ${req.path} from ${req.ip}`);
  res.status(401).json({ error: 'Unauthorized: Access Denied. Valid Super Admin token or API key required.' });
}

// 1. Super Admin Authentication (Brute-Force Protected)
apiRouter.post('/auth/login', loginLimiter, (req: Request, res: Response) => {
  const { password } = req.body || {};
  if (!isValidAdminKey(password)) {
    res.status(401).json({ error: 'Invalid Super Admin password.' });
    return;
  }

  const token = signAdminToken();

  res.json({
    token,
    user: {
      role: 'SUPER_ADMIN',
      name: 'Yusuf Ramazanoğlu',
      primary_email: 'yusuf@ramazanoglu.tech',
    },
  });
});

// 2. Health & Telemetry Status
apiRouter.get('/health', (req: Request, res: Response) => {
  // Public liveness probe: no operational details. Authenticated clients get telemetry via /api/stats.
  res.json({ status: 'ONLINE', timestamp: new Date().toISOString() });
});

apiRouter.get('/health/details', requireAdminAuth, (req: Request, res: Response) => {
  const syncStatus = getSyncStatus();
  syncStatus.connected_clients = getConnectedClientCount();
  res.json({
    status: 'ONLINE',
    service: 'Ramazanoğlu Tech Mail HQ Cloud Backend',
    version: '1.0.0',
    db_connected: isDbConnected(),
    sync: syncStatus,
    timestamp: new Date().toISOString(),
  });
});

// 3. Department & Identity Aliases
apiRouter.get('/aliases', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const aliases = await getAliases();
    res.json({ aliases });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// 3.1 Email Templates Catalog
apiRouter.get('/templates', requireAdminAuth, (_req: Request, res: Response) => {
  res.json({ templates: SWISS_EMAIL_TEMPLATES });
});

apiRouter.post('/aliases', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { email, display_name, department_badge, signature_html } = req.body || {};
    if (typeof email !== 'string' || !/^[a-z0-9._-]{1,64}@[a-z0-9.-]+$/i.test(email) || !email.toLowerCase().endsWith(config.domainFilter)) {
      res.status(400).json({ error: `Alias email must be a simple address belonging strictly to ${config.domainFilter}` });
      return;
    }
    const created = await createAlias({
      email,
      display_name: display_name || 'Ramazanoğlu Tech Identity',
      department_badge: department_badge || `[${email.split('@')[0].toUpperCase()}]`,
      signature_html,
    });
    res.status(201).json({ alias: created });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// 4. Emails List & Filtering
apiRouter.get('/emails', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const alias = req.query.alias as string | undefined;
    const unread = req.query.unread !== undefined ? req.query.unread === 'true' : undefined;
    const starred = req.query.starred !== undefined ? req.query.starred === 'true' : undefined;
    const archived = req.query.archived !== undefined ? req.query.archived === 'true' : undefined;
    const direction = req.query.direction as string | undefined;
    const search = req.query.search as string | undefined;
    const rawLimit = parseInt(String(req.query.limit ?? '50'), 10);
    const rawOffset = parseInt(String(req.query.offset ?? '0'), 10);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 200) : 50;
    const offset = Number.isFinite(rawOffset) ? Math.max(rawOffset, 0) : 0;

    const result = await getEmails({
      alias,
      unread,
      starred,
      archived,
      direction,
      search,
      limit,
      offset,
    });

    res.json({
      emails: result.emails,
      total: result.total,
      limit,
      offset,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// 5. Single Email Retrieval
apiRouter.get('/emails/:id', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const emailId = String(req.params.id);
    const email = await getEmailById(emailId);
    if (!email) {
      res.status(404).json({ error: 'Email message not found.' });
      return;
    }
    res.json({ email });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// 6. Update Email Status (Mark read/unread, star, archive)
apiRouter.patch('/emails/:id', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const emailId = String(req.params.id);
    const { is_read, is_starred, is_archived } = req.body;
    const updated = await updateEmailStatus(emailId, {
      is_read: typeof is_read === 'boolean' ? is_read : undefined,
      is_starred: typeof is_starred === 'boolean' ? is_starred : undefined,
      is_archived: typeof is_archived === 'boolean' ? is_archived : undefined,
    });

    if (!updated) {
      res.status(404).json({ error: 'Email message not found.' });
      return;
    }

    broadcastWebSocket('EMAIL_UPDATED', updated);
    res.json({ email: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// 7. Delete Email
apiRouter.delete('/emails/:id', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const emailId = String(req.params.id);
    const success = await deleteEmail(emailId);
    if (!success) {
      res.status(404).json({ error: 'Email message not found or already deleted.' });
      return;
    }
    broadcastWebSocket('EMAIL_UPDATED', { id: emailId, deleted: true });
    res.json({ success: true, id: emailId });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// 8. Outbound Dispatcher (Send Email as Alias - Rate Limited & Auth Required)
apiRouter.post('/emails/send', requireAdminAuth, sendLimiter, async (req: Request, res: Response) => {
  try {
    const { from_alias, to, cc, bcc, subject, body_text, body_html, in_reply_to, thread_id } = req.body || {};

    if (typeof from_alias !== 'string' || !to || typeof subject !== 'string' || !subject.trim()) {
      res.status(400).json({ error: 'Missing required fields: from_alias, to, and subject are mandatory.' });
      return;
    }

    const asList = (v: unknown): string[] =>
      (Array.isArray(v) ? v : v ? [v] : []).map((x: unknown) => String(x));
    const toAddresses = asList(to);
    const ccAddresses = asList(cc);
    const bccAddresses = asList(bcc);
    if (toAddresses.length + ccAddresses.length + bccAddresses.length > 50) {
      res.status(400).json({ error: 'Too many recipients (max 50 per message).' });
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

    res.status(201).json({ email: sentEmail });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[HTTP ERROR in /emails/send]:', msg);
    // Validation errors from the dispatcher are the caller's fault; SMTP failures are a bad gateway.
    const status = /^(Security validation|Unauthorized sender|At least one|Email subject)/.test(msg)
      ? 400
      : /^SMTP delivery failed/.test(msg)
        ? 502
        : 500;
    res.status(status).json({ error: msg });
  }
});

// 9. Statistics Dashboard
apiRouter.get('/stats', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const stats = await getStats();
    res.json(stats);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// 10. Manual IMAP Sync Trigger
apiRouter.post('/sync/trigger', requireAdminAuth, syncLimiter, async (req: Request, res: Response) => {
  try {
    await pollInbox();
    res.json({ message: 'IMAP sync cycle triggered successfully.' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// 11. Dev Simulation Endpoint: only mounted when MOCK_MODE=true and NODE_ENV != production
apiRouter.post('/dev/simulate', (req: Request, res: Response, next: () => void) => {
  if (!config.enableDevEndpoints) {
    res.status(404).json({ error: 'Not found.' });
    return;
  }
  next();
}, requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const {
      alias_target = 'info@ramazanoglu.tech',
      from_name = 'Dr. Alexander Keller',
      from_address = 'a.keller@ethz.ch',
      subject = 'Applied Distributed Systems & AI Research Proposal',
      body_html = '<p>Greetings Ramazanoğlu Tech team,</p><p>We would like to submit a formal inquiry regarding the GPU cluster cloud scheduling protocol. Kindly advise on the next steps for technical evaluation.</p><p>Best regards,<br>Dr. Alexander Keller<br>ETH Zürich</p>',
    } = req.body;

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
      body_text: body_html.replace(/<[^>]*>/g, ''),
      body_html,
      is_read: false,
      is_starred: false,
      is_archived: false,
      direction: 'INBOUND',
      received_at: new Date().toISOString(),
      raw_headers: {
        'From': `"${from_name}" <${from_address}>`,
        'To': alias_target,
        'Subject': subject,
        'Message-ID': messageId,
      },
    });

    // Broadcast instant WebSocket notification
    broadcastWebSocket('EMAIL_RECEIVED', simulated);

    res.status(201).json({ message: 'Simulated inbound email injected and broadcasted.', email: simulated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});
