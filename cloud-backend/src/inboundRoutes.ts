// =============================================================================
// RAMAZANOĞLU TECH MAIL HQ - INBOUND MAIL WEBHOOK (Gmail-free ingestion)
// Cloudflare Email Routing -> Worker -> signed POST of the raw MIME message -> here.
// =============================================================================

import { Router, Request, Response } from 'express';
import express from 'express';
import crypto from 'crypto';
import { simpleParser } from 'mailparser';
import { config } from './config.js';
import { checkMessageExists, saveEmail } from './db.js';
import { createRateLimiter } from './routes.js';
import { broadcastWebSocket } from './websocket.js';
import { recordInbound } from './syncStatus.js';
import { EmailAttachment } from './types.js';

const MAX_MESSAGE_BYTES = 26 * 1024 * 1024; // Cloudflare Email Routing hard limit is 25 MiB
const MAX_SKEW_SECONDS = 300;
const ADDRESS_SHAPE = /^[^\s@<>"]{1,64}@[a-z0-9.-]{1,190}$/i;

export const inboundRouter = Router();

const limiter = createRateLimiter(300, 60 * 1000);

// Signature covers timestamp, envelope recipient/sender and the raw message: HMAC-SHA256(ts "\n" to "\n" from "\n" body)
export function signInbound(secret: string, timestamp: string, envTo: string, envFrom: string, body: Buffer): string {
  return crypto.createHmac('sha256', secret).update(`${timestamp}\n${envTo}\n${envFrom}\n`).update(body).digest('hex');
}

function safeEqualHex(a: string, b: string): boolean {
  const x = Buffer.from(a, 'utf8');
  const y = Buffer.from(b, 'utf8');
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

const rawBody = express.raw({ type: () => true, limit: MAX_MESSAGE_BYTES });

inboundRouter.post('/email', limiter, rawBody, async (req: Request, res: Response) => {
  const secret = config.inboundWebhookSecret;
  if (!secret) {
    res.status(503).json({ error: 'Inbound webhook is not configured.' });
    return;
  }

  const timestamp = String(req.header('x-timestamp') || '');
  const signature = String(req.header('x-signature') || '');
  const body = req.body as Buffer;
  if (!Buffer.isBuffer(body) || body.length === 0 || !/^\d{10,13}$/.test(timestamp) || !signature) {
    res.status(401).json({ error: 'Unauthorized.' });
    return;
  }
  const ts = Number(timestamp) > 1e11 ? Number(timestamp) / 1000 : Number(timestamp);
  if (Math.abs(Date.now() / 1000 - ts) > MAX_SKEW_SECONDS) {
    res.status(401).json({ error: 'Unauthorized.' });
    return;
  }
  const envTo = String(req.header('x-envelope-to') || '').toLowerCase().trim();
  const envFrom = String(req.header('x-envelope-from') || '').toLowerCase().trim();
  if (!safeEqualHex(signature, signInbound(secret, timestamp, envTo, envFrom, body))) {
    console.warn(`[SECURITY] Inbound webhook bad signature from ${req.ip}`);
    res.status(401).json({ error: 'Unauthorized.' });
    return;
  }

  // Envelope data is covered by the signature; shape and domain are still re-validated here.
  if (!ADDRESS_SHAPE.test(envTo) || !envTo.endsWith(config.domainFilter)) {
    // Not ours: acknowledge so the Worker does not retry, store nothing.
    res.status(202).json({ stored: false, reason: 'recipient outside corporate domain' });
    return;
  }

  try {
    const parsed = await simpleParser(body);
    const rawId = (parsed.messageId || `<gen-${crypto.randomBytes(8).toString('hex')}@${config.domainFilter.slice(1)}>`).trim();
    // One row per recipient alias: a mail to two of our addresses arrives as two deliveries sharing one Message-ID.
    const messageId = `${rawId}#${envTo}`;

    if (await checkMessageExists(messageId)) {
      res.status(200).json({ stored: false, reason: 'duplicate' }); // replay / Cloudflare retry: no second row, no second broadcast
      return;
    }

    const attachments: Omit<EmailAttachment, 'id' | 'email_id'>[] = (parsed.attachments || []).map((att) => ({
      filename: att.filename || 'attachment.dat',
      mime_type: att.contentType || 'application/octet-stream',
      size_bytes: att.size || att.content?.length || 0,
      cloud_storage_url: '',
      created_at: new Date().toISOString(),
    }));

    const list = (v: unknown): string[] => {
      if (!v) return [];
      const arr = Array.isArray(v) ? v : [v];
      return arr.map((a: { text?: string }) => a.text || '').filter(Boolean);
    };

    const fromAddr = parsed.from?.value[0]?.address || envFrom || 'unknown@unknown.invalid';
    const text = parsed.text || '';
    const saved = await saveEmail(
      {
        message_id: messageId,
        thread_id: (typeof parsed.inReplyTo === 'string' && parsed.inReplyTo) || rawId,
        alias_target: envTo,
        from_name: parsed.from?.value[0]?.name || null,
        from_address: fromAddr,
        to_addresses: list(parsed.to).length ? list(parsed.to) : [envTo],
        cc_addresses: list(parsed.cc),
        bcc_addresses: [],
        subject: parsed.subject || '(No Subject)',
        body_text: text,
        body_html: typeof parsed.html === 'string' && parsed.html ? parsed.html : `<pre>${escapeHtml(text)}</pre>`,
        is_read: false,
        is_starred: false,
        is_archived: false,
        // Anything arriving over the inbound door is by definition received mail; headers are forgeable.
        direction: 'INBOUND',
        received_at: parsed.date ? parsed.date.toISOString() : new Date().toISOString(),
        raw_headers: { 'message-id': [rawId], 'envelope-from': [envFrom], 'envelope-to': [envTo] },
      },
      attachments
    );

    recordInbound();
    broadcastWebSocket('EMAIL_RECEIVED', saved);
    console.log(`[INBOUND] stored mail for ${envTo}: '${saved.subject}'`);
    res.status(201).json({ stored: true, id: saved.id });
  } catch (err) {
    console.error('[INBOUND] failed:', err instanceof Error ? err.message : err);
    // 5xx makes the Worker fall back to rejecting/forwarding instead of silently losing the mail.
    res.status(500).json({ error: 'Could not store message.' });
  }
});

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
