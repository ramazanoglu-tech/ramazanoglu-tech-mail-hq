// =============================================================================
// RAMAZANOĞLU TECH MAIL HQ - 7/24 CLOUD IMAP SYNC ENGINE (STRICT ISOLATION)
// =============================================================================

import imaps from 'imap-simple';
import { simpleParser, ParsedMail } from 'mailparser';
import { config } from './config.js';
import { checkMessageExists, saveEmail } from './db.js';
import { evaluateStrictDomainFilter } from './domainFilter.js';
import { SyncStatus, EmailAttachment } from './types.js';
import { broadcastWebSocket } from './websocket.js';

let imapConnection: imaps.ImapSimple | null = null;
let isSyncing = false;
let pollingTimer: NodeJS.Timeout | null = null;
let statsTotalProcessed = 0;
let statsDomainFiltered = 0;
let lastSyncTimestamp: string | null = null;

export function getSyncStatus(): SyncStatus {
  return {
    imap_connected: imapConnection !== null,
    last_sync_time: lastSyncTimestamp,
    sync_active: isSyncing,
    inbox_total: statsTotalProcessed,
    domain_filtered_count: statsDomainFiltered,
    connected_clients: 0,
    database_status: config.databaseUrl ? 'CONNECTED' : 'MOCK_STORE',
  };
}

export async function startImapSyncEngine() {
  if (config.mockMode || !config.imap.user || !config.imap.password) {
    console.log('[IMAP] IMAP credentials missing or MOCK_MODE=true. Starting in standby/mock mode.');
    lastSyncTimestamp = new Date().toISOString();
    return;
  }

  console.log(`[IMAP] Initializing 7/24 IMAP engine for ${config.imap.user} on ${config.imap.host}:${config.imap.port}...`);
  await connectAndListen();

  // Setup periodic polling interval fallback (in addition to IDLE)
  if (config.imap.pollIntervalMs > 0) {
    pollingTimer = setInterval(async () => {
      try {
        await pollInbox();
      } catch (err) {
        console.error('[IMAP Poll Error]:', err);
      }
    }, config.imap.pollIntervalMs);
  }
}

async function connectAndListen() {
  const imapConfig: imaps.ImapSimpleOptions = {
    imap: {
      user: config.imap.user,
      password: config.imap.password,
      host: config.imap.host,
      port: config.imap.port,
      tls: config.imap.tls,
      tlsOptions: { rejectUnauthorized: false },
      authTimeout: 15000,
      keepalive: {
        interval: 10000,
        idleInterval: 300000, // 5 mins
        forceNoop: true,
      },
    },
    onmail: async (numNewMail: number) => {
      console.log(`[IMAP IDLE] Received notification: ${numNewMail} new message(s) arrived.`);
      await pollInbox();
    },
  };

  try {
    imapConnection = await imaps.connect(imapConfig);
    console.log('[IMAP] Successfully authenticated and connected to IMAP server.');
    await pollInbox();

    imapConnection.on('error', (err: Error) => {
      console.error('[IMAP Socket Error]:', err.message);
      handleDisconnect();
    });

    imapConnection.on('end', () => {
      console.warn('[IMAP Socket End] Connection terminated by remote host.');
      handleDisconnect();
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[IMAP Connection Error]: ${errorMsg}`);
    handleDisconnect();
  }
}

function handleDisconnect() {
  imapConnection = null;
  if (config.imap.autoReconnect) {
    console.log('[IMAP] Reconnecting in 10 seconds...');
    setTimeout(connectAndListen, 10000);
  }
}

export async function pollInbox() {
  if (!imapConnection || isSyncing) return;
  isSyncing = true;

  try {
    const box: any = await imapConnection.openBox('INBOX');
    const total = box.messages ? box.messages.total : 0;
    if (total === 0) {
      isSyncing = false;
      return;
    }
    const startSeq = Math.max(1, total - 49);
    console.log(`[IMAP Poll] Total messages in Gmail INBOX: ${total}. Inspecting messages ${startSeq}:${total}...`);

    const rawImap = (imapConnection as any).imap;
    const Imap = rawImap.constructor;

    interface CandidateHeader {
      seqno: number;
      uid?: number;
      headers: Record<string, any>;
    }

    const candidates: CandidateHeader[] = await new Promise((resolve) => {
      const msgs: CandidateHeader[] = [];
      const fetcher = rawImap.seq.fetch(`${startSeq}:${total}`, { bodies: 'HEADER', struct: true });
      fetcher.on('message', (msg: any, seqno: number) => {
        let headerStr = '';
        let uid: number | undefined;
        msg.on('body', (stream: any) => {
          stream.on('data', (chunk: Buffer) => (headerStr += chunk.toString('utf8')));
        });
        msg.on('attributes', (attrs: any) => {
          uid = attrs?.uid;
        });
        msg.on('end', () => {
          try {
            const parsed = Imap.parseHeader(headerStr);
            msgs.push({ seqno, uid, headers: parsed || {} });
          } catch {
            // fallback
          }
        });
      });
      fetcher.once('error', (err: any) => {
        console.warn('[IMAP Seq Fetch Error]:', err.message);
        resolve(msgs);
      });
      fetcher.once('end', () => resolve(msgs));
    });

    console.log(`[IMAP Poll] Scanning ${candidates.length} candidate message headers against '@ramazanoglu.tech'...`);

    for (const item of candidates) {
      statsTotalProcessed++;
      const headersRecord = item.headers;

      const filterResult = await evaluateStrictDomainFilter(headersRecord);

      if (!filterResult.matchesDomain) {
        // Discard personal Gmail messages
        continue;
      }

      statsDomainFiltered++;
      const rawMsgId = headersRecord['message-id'] ? headersRecord['message-id'][0] : null;
      const messageId = rawMsgId || `<gen-${Date.now()}-${Math.random()}@ramazanoglu.tech>`;

      // Deduplication check
      const alreadySaved = await checkMessageExists(messageId);
      if (alreadySaved) {
        continue;
      }

      console.log(`[IMAP Sync] Found corporate @ramazanoglu.tech message [UID: ${item.uid || item.seqno}]. Fetching full body...`);

      // Fetch full body only for this matched message
      let rawMime = '';
      if (item.uid) {
        const fullMsgParts = await imapConnection.search([['UID', String(item.uid)]], {
          bodies: [''],
          markSeen: false,
        });
        if (fullMsgParts.length > 0) {
          const bodyPart = fullMsgParts[0].parts.find((p) => p.which === '');
          if (bodyPart) rawMime = bodyPart.body;
        }
      }

      const parsed: ParsedMail = rawMime ? await simpleParser(rawMime) : null as unknown as ParsedMail;

      // Process attachments
      const processedAttachments: Omit<EmailAttachment, 'id' | 'email_id'>[] = [];
      if (parsed && parsed.attachments && parsed.attachments.length > 0) {
        for (const att of parsed.attachments) {
          processedAttachments.push({
            filename: att.filename || 'attachment.dat',
            mime_type: att.contentType || 'application/octet-stream',
            size_bytes: att.size || (att.content ? att.content.length : 0),
            cloud_storage_url: `https://storage.ramazanoglu.tech/attachments/${encodeURIComponent(att.filename || 'attachment')}`,
            created_at: new Date().toISOString(),
          });
        }
      }

      const toAddrs = parsed?.to
        ? Array.isArray(parsed.to)
          ? parsed.to.map((t) => t.text)
          : [parsed.to.text]
        : headersRecord.to || [filterResult.matchedAlias];

      const ccAddrs = parsed?.cc
        ? Array.isArray(parsed.cc)
          ? parsed.cc.map((c) => c.text)
          : [parsed.cc.text]
        : headersRecord.cc || [];

      const subject = parsed?.subject || (headersRecord.subject ? headersRecord.subject[0] : '(No Subject)');
      let fromName = parsed?.from?.value[0]?.name || (headersRecord.from ? headersRecord.from[0] : null);
      let fromAddr = parsed?.from?.value[0]?.address || (headersRecord.from ? headersRecord.from[0] : 'unknown@domain.com');

      // Resolve true corporate sender if relayed via Gmail
      if (headersRecord['x-google-original-from']) {
        const orig = String(headersRecord['x-google-original-from'][0] || headersRecord['x-google-original-from']);
        const match = orig.match(/<([^>]+)>/);
        if (match) fromAddr = match[1];
      }
      if (headersRecord['x-ramazanoglu-identity']) {
        fromAddr = String(headersRecord['x-ramazanoglu-identity'][0] || headersRecord['x-ramazanoglu-identity']);
      }

      const isOutbound = fromAddr.toLowerCase().endsWith(config.domainFilter.toLowerCase());
      const direction: 'INBOUND' | 'OUTBOUND' = isOutbound ? 'OUTBOUND' : 'INBOUND';

      // Save into Cloud Database
      const savedEmail = await saveEmail(
        {
          message_id: messageId,
          thread_id: parsed?.inReplyTo || messageId,
          alias_target: filterResult.matchedAlias,
          from_name: fromName,
          from_address: fromAddr,
          to_addresses: Array.isArray(toAddrs) ? toAddrs : [String(toAddrs)],
          cc_addresses: Array.isArray(ccAddrs) ? ccAddrs : [String(ccAddrs)],
          bcc_addresses: [],
          subject,
          body_text: parsed?.text || '',
          body_html: parsed?.html || `<pre>${parsed?.text || ''}</pre>`,
          is_read: false,
          is_starred: false,
          is_archived: false,
          direction,
          received_at: parsed?.date ? parsed.date.toISOString() : new Date().toISOString(),
          raw_headers: headersRecord,
        },
        processedAttachments
      );

      console.log(`[IMAP Sync] Successfully ingested isolated mail for [${filterResult.matchedAlias}] (${direction}): '${savedEmail.subject}'`);

      // Real-time broadcast to C++ Desktop & Mobile PWA via WebSocket!
      broadcastWebSocket('EMAIL_RECEIVED', savedEmail);
    }

    lastSyncTimestamp = new Date().toISOString();
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[IMAP Poll Error]: ${errorMsg}`);
  } finally {
    isSyncing = false;
  }
}
