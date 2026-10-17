// =============================================================================
// RAMAZANOĞLU TECH MAIL HQ - OUTBOUND ALIAS DISPATCHER (SMTP ENGINE)
// =============================================================================

import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { config } from './config.js';
import { createAlias, getAliases, saveEmail } from './db.js';
import { Email, SendEmailPayload } from './types.js';
import { broadcastWebSocket } from './websocket.js';

let transporter: nodemailer.Transporter | null = null;

export function initSmtpTransporter() {
  if (!config.smtp.user || !config.smtp.password || config.mockMode) {
    console.log('[SMTP] Running in simulated/mock outbound mode (SMTP credentials not provided or MOCK_MODE=true)');
    return;
  }

  try {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.password,
      },
    });
    console.log(`[SMTP] Initialized SMTP transporter on ${config.smtp.host}:${config.smtp.port}`);
  } catch (err) {
    console.error('[SMTP] Failed to initialize SMTP transporter:', err);
  }
}

export async function sendEmailAsAlias(payload: SendEmailPayload): Promise<Email> {
  const fromAliasEmail = payload.from_alias.toLowerCase().trim();

  // 1. CRLF Header Injection Protection
  const cleanSubject = payload.subject.replace(/[\r\n]+/g, ' ').trim();
  if (!cleanSubject) {
    throw new Error('Email subject cannot be empty.');
  }

  // 2. Strict Email Address Validation (RFC format & CRLF free)
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const sanitizeRecipientList = (list: string[] | undefined, fieldName: string): string[] => {
    if (!list || list.length === 0) return [];
    return list.map((addr) => {
      const clean = addr.replace(/[\r\n]/g, '').trim();
      if (!EMAIL_REGEX.test(clean)) {
        throw new Error(`Security validation failed: Invalid recipient address format in ${fieldName}: '${clean}'`);
      }
      return clean;
    });
  };

  const cleanTo = sanitizeRecipientList(payload.to, 'To');
  if (cleanTo.length === 0) {
    throw new Error('At least one valid recipient must be specified in "To".');
  }
  const cleanCc = sanitizeRecipientList(payload.cc, 'Cc');
  const cleanBcc = sanitizeRecipientList(payload.bcc, 'Bcc');

  // Reply headers must be a single message-id token: no whitespace/CRLF/angle injection
  const cleanInReplyTo = payload.in_reply_to && /^<[^<>\s]{1,512}>$/.test(payload.in_reply_to.trim())
    ? payload.in_reply_to.trim()
    : undefined;

  const aliases = await getAliases();
  let alias = aliases.find((a) => a.email.toLowerCase() === fromAliasEmail);

  if (!alias) {
    if (/^[a-z0-9._-]{1,64}@ramazanoglu\.tech$/.test(fromAliasEmail)) {
      const prefix = fromAliasEmail.split('@')[0];
      const badge = `[${prefix.toUpperCase()}]`;
      const displayName = `Ramazanoğlu Tech ${prefix.charAt(0).toUpperCase() + prefix.slice(1)}`;
      const defaultSig = `<div style="font-family: 'Inter', sans-serif; font-size: 13px; color: #111111; line-height: 1.6; margin-top: 24px; padding-top: 16px; border-top: 1px solid #E2E2DC;"><strong>${displayName}</strong><br><span style="font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #666662;">${badge}</span><br><span style="color: #666662; font-size: 12px;">Ramazanoğlu Technologies Inc. &bull; ramazanoglu.tech</span></div>`;
      alias = await createAlias({
        email: fromAliasEmail,
        display_name: displayName,
        department_badge: badge,
        signature_html: defaultSig,
      });
      console.log(`[SMTP Dispatcher] Auto-registered new corporate alias on-the-fly: ${fromAliasEmail}`);
    } else {
      throw new Error(`Unauthorized sender identity: '${payload.from_alias}'. Must belong to @ramazanoglu.tech.`);
    }
  }

  if (!alias) {
    throw new Error(`Failed to resolve sender alias: ${fromAliasEmail}`);
  }

  // Combine body with corporate Swiss signature
  const signatureHtml = alias.signature_html || '';
  let finalHtml = payload.body_html || '';
  if (signatureHtml && !finalHtml.includes(signatureHtml)) {
    finalHtml = `${finalHtml}<br><br>${signatureHtml}`;
  }

  const plainText = payload.body_text || finalHtml.replace(/<[^>]*>/g, '');
  const messageId = `<out-${Date.now()}.${crypto.randomBytes(6).toString('hex')}@ramazanoglu.tech>`;
  const threadId = payload.thread_id || cleanInReplyTo || messageId;
  // Display name goes into a quoted header: strip CR/LF, quotes and backslashes
  const safeDisplayName = alias.display_name.replace(/[\r\n"\\]/g, ' ').trim();

  // Real SMTP dispatch. A failure must surface to the caller: never record a mail as "sent" when it was not.
  if (transporter && !config.mockMode) {
    try {
      const mailOptions: nodemailer.SendMailOptions = {
        from: `"${safeDisplayName}" <${alias.email}>`,
        sender: config.smtp.user,
        replyTo: alias.email,
        to: cleanTo,
        cc: cleanCc.length > 0 ? cleanCc : undefined,
        bcc: cleanBcc.length > 0 ? cleanBcc : undefined,
        subject: cleanSubject,
        text: plainText,
        html: finalHtml,
        messageId: messageId,
        inReplyTo: cleanInReplyTo,
        references: cleanInReplyTo ? [cleanInReplyTo] : undefined,
        headers: {
          'X-Ramazanoglu-Identity': alias.email,
          'X-Ramazanoglu-Badge': alias.department_badge,
        },
      };

      const info = await transporter.sendMail(mailOptions);
      console.log(`[SMTP] Sent message ${info.messageId} successfully from ${alias.email}`);
    } catch (err) {
      console.error('[SMTP] Real send failed:', err);
      const reason = err instanceof Error ? err.message : String(err);
      throw new Error(`SMTP delivery failed: ${reason}`);
    }
  } else if (config.mockMode) {
    console.log(`[SMTP Mock] Outbound message simulated from ${alias.display_name} <${alias.email}> to ${cleanTo.join(', ')}`);
  } else {
    throw new Error('SMTP delivery failed: SMTP is not configured (set SMTP_USER and SMTP_PASSWORD).');
  }

  // Save into Cloud Database with OUTBOUND direction
  const savedEmail = await saveEmail({
    message_id: messageId,
    thread_id: threadId,
    alias_target: alias.email,
    from_name: safeDisplayName,
    from_address: alias.email,
    to_addresses: cleanTo,
    cc_addresses: cleanCc,
    bcc_addresses: cleanBcc,
    subject: cleanSubject,
    body_text: plainText,
    body_html: finalHtml,
    is_read: true,
    is_starred: false,
    is_archived: false,
    direction: 'OUTBOUND',
    received_at: new Date().toISOString(),
    raw_headers: {
      'From': `"${safeDisplayName}" <${alias.email}>`,
      'To': cleanTo.join(', '),
      'Subject': cleanSubject,
      'Message-ID': messageId,
    },
  });

  // Broadcast WebSocket notification to all C++ desktop and mobile clients
  broadcastWebSocket('EMAIL_SENT', savedEmail);

  return savedEmail;
}
