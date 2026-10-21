// =============================================================================
// RAMAZANOĞLU TECH MAIL HQ - AGENT ADMINISTRATION (tokens + send approvals)
// Mounted at /api/agent. Tokens: owner only. Approvals: owner/admin who may use the identity.
// =============================================================================

import { Router, Request, Response } from 'express';
import { canAccessAlias, requireAuth, requireRole } from './auth.js';
import { config } from './config.js';
import {
  claimOutboxItem,
  createAgentToken,
  DEFAULT_TOKEN_DAYS,
  finishOutboxItem,
  getOutboxItem,
  listAgentTokens,
  listOutbox,
  MAX_TOKEN_DAYS,
  OutboxStatus,
  revokeAgentToken,
} from './agent.js';
import { getAliases } from './db.js';
import { sendEmailAsAlias } from './smtpDispatcher.js';
import { writeAudit } from './users.js';

export const agentRouter = Router();
agentRouter.use(requireAuth(), requireRole('owner', 'admin'));

const STATUSES: OutboxStatus[] = ['pending', 'sending', 'sent', 'rejected', 'failed'];
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

const textToHtml = (t: string) =>
  `<p>${t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</p>`;

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

agentRouter.get('/tokens', async (_req: Request, res: Response) => {
  try {
    res.json({ tokens: await listAgentTokens() });
  } catch (err) {
    console.error('[AGENT] list tokens:', errMsg(err));
    res.status(500).json({ error: 'Token listesi alınamadı.' });
  }
});

agentRouter.post('/tokens', requireRole('owner'), async (req: Request, res: Response) => {
  try {
    const user = req.auth!;
    const { name, aliases, days } = req.body || {};
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 100) {
      res.status(400).json({ error: 'Geçerli bir ad gerekli (en fazla 100 karakter).' });
      return;
    }
    if (!Array.isArray(aliases) || aliases.length === 0 || aliases.length > 100 || aliases.some((a: unknown) => typeof a !== 'string')) {
      res.status(400).json({ error: "aliases: en az bir kimlik içeren liste gerekli (tümü için ['*'])." });
      return;
    }
    const wanted = Array.from(new Set((aliases as string[]).map((a) => a.toLowerCase().trim()).filter(Boolean)));
    if (!wanted.includes('*')) {
      const known = new Set((await getAliases()).map((a) => a.email.toLowerCase()));
      const unknown = wanted.find((a) => !a.endsWith(config.domainFilter) || !known.has(a));
      if (unknown) {
        res.status(400).json({ error: `Tanımsız kimlik: ${unknown}` });
        return;
      }
    }
    const d = days === undefined ? DEFAULT_TOKEN_DAYS : Number(days);
    if (!Number.isInteger(d) || d < 1 || d > MAX_TOKEN_DAYS) {
      res.status(400).json({ error: `days 1 ile ${MAX_TOKEN_DAYS} arasında tam sayı olmalı.` });
      return;
    }
    const { token, record } = await createAgentToken({
      name: name.trim(),
      alias_scope: wanted.includes('*') ? ['*'] : wanted,
      created_by: user.email,
      days: d,
    });
    await writeAudit({
      user_id: user.id,
      user_email: user.email,
      action: 'agent_token_create',
      target: record.id,
      ip: req.ip,
      details: { name: record.name, scope: record.alias_scope, expires_at: record.expires_at },
    });
    // The plain token is shown exactly once; only its hash is stored.
    res.status(201).json({ token, record, note: 'Bu token bir daha gösterilmeyecek. Güvenli bir yerde saklayın.' });
  } catch (err) {
    console.error('[AGENT] create token:', errMsg(err));
    res.status(500).json({ error: 'Token oluşturulamadı.' });
  }
});

agentRouter.delete('/tokens/:id', requireRole('owner'), async (req: Request, res: Response) => {
  try {
    const user = req.auth!;
    const done = await revokeAgentToken(String(req.params.id));
    if (!done) {
      res.status(404).json({ error: 'Token bulunamadı veya zaten iptal edilmiş.' });
      return;
    }
    await writeAudit({ user_id: user.id, user_email: user.email, action: 'agent_token_revoke', target: String(req.params.id), ip: req.ip });
    res.json({ revoked: true });
  } catch (err) {
    console.error('[AGENT] revoke token:', errMsg(err));
    res.status(500).json({ error: 'Token iptal edilemedi.' });
  }
});

// ---------------------------------------------------------------------------
// Send approvals
// ---------------------------------------------------------------------------

agentRouter.get('/outbox', async (req: Request, res: Response) => {
  try {
    const user = req.auth!;
    const status = typeof req.query.status === 'string' ? (req.query.status as OutboxStatus) : undefined;
    if (status && !STATUSES.includes(status)) {
      res.status(400).json({ error: 'Geçersiz durum.' });
      return;
    }
    const items = (await listOutbox(status, 100)).filter((i) => canAccessAlias(user, i.from_alias));
    res.json({ items });
  } catch (err) {
    console.error('[AGENT] list outbox:', errMsg(err));
    res.status(500).json({ error: 'Liste alınamadı.' });
  }
});

agentRouter.post('/outbox/:id/approve', async (req: Request, res: Response) => {
  const user = req.auth!;
  const id = String(req.params.id);
  try {
    const item = await getOutboxItem(id);
    if (!item) {
      res.status(404).json({ error: 'Öneri bulunamadı.' });
      return;
    }
    if (!canAccessAlias(user, item.from_alias)) {
      await writeAudit({ user_id: user.id, user_email: user.email, action: 'outbox_approve_denied', target: id, ip: req.ip });
      res.status(403).json({ error: 'Bu kimlikle gönderim onaylama yetkiniz yok.' });
      return;
    }
    // Exactly one caller wins this claim, so a double click can never send twice.
    const claimed = await claimOutboxItem(id, 'sending', user.email);
    if (!claimed) {
      res.status(409).json({ error: 'Öneri artık beklemede değil (başkası işledi veya süresi doldu).' });
      return;
    }
    try {
      const sent = await sendEmailAsAlias({
        from_alias: claimed.from_alias,
        to: claimed.to_addresses,
        cc: claimed.cc_addresses,
        subject: claimed.subject,
        body_text: claimed.body_text,
        body_html: textToHtml(claimed.body_text),
        in_reply_to: claimed.in_reply_to || undefined,
      });
      await finishOutboxItem(id, { ok: true, email_id: sent.id });
      await writeAudit({
        user_id: user.id,
        user_email: user.email,
        action: 'outbox_approve',
        target: id,
        ip: req.ip,
        details: { from: claimed.from_alias, recipients: claimed.to_addresses.length + claimed.cc_addresses.length, requested_by: claimed.requested_by },
      });
      res.json({ status: 'sent', email_id: sent.id });
    } catch (err) {
      await finishOutboxItem(id, { ok: false, error: errMsg(err) });
      await writeAudit({ user_id: user.id, user_email: user.email, action: 'outbox_send_failed', target: id, ip: req.ip });
      res.status(502).json({ error: `Gönderim başarısız: ${errMsg(err)}` });
    }
  } catch (err) {
    console.error('[AGENT] approve:', errMsg(err));
    res.status(500).json({ error: 'Onay işlemi başarısız.' });
  }
});

agentRouter.post('/outbox/:id/reject', async (req: Request, res: Response) => {
  const user = req.auth!;
  const id = String(req.params.id);
  try {
    const item = await getOutboxItem(id);
    if (!item) {
      res.status(404).json({ error: 'Öneri bulunamadı.' });
      return;
    }
    if (!canAccessAlias(user, item.from_alias)) {
      res.status(403).json({ error: 'Bu öneri üzerinde yetkiniz yok.' });
      return;
    }
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.slice(0, 300) : undefined;
    const claimed = await claimOutboxItem(id, 'rejected', user.email, reason);
    if (!claimed) {
      res.status(409).json({ error: 'Öneri artık beklemede değil.' });
      return;
    }
    await writeAudit({ user_id: user.id, user_email: user.email, action: 'outbox_reject', target: id, ip: req.ip });
    res.json({ status: 'rejected' });
  } catch (err) {
    console.error('[AGENT] reject:', errMsg(err));
    res.status(500).json({ error: 'Reddetme işlemi başarısız.' });
  }
});
