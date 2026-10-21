// =============================================================================
// RAMAZANOĞLU TECH MAIL HQ - AI AGENT ACCESS (TOKENS + SEND-APPROVAL OUTBOX)
// An agent gets a scoped, expiring, revocable token. It can read mail inside its scope and
// *propose* mail; a human approves every proposal before anything is sent.
// PostgreSQL when connected, in-memory (MOCK_MODE only) otherwise.
// =============================================================================

import crypto from 'crypto';
import { getPool } from './db.js';

export const TOKEN_PREFIX = 'mhq_';
export const DEFAULT_TOKEN_DAYS = 90;
export const MAX_TOKEN_DAYS = 365;
export const PROPOSAL_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface AgentToken {
  id: string;
  name: string;
  /** ['*'] = every identity, otherwise the explicit lower-case list. */
  alias_scope: string[];
  created_by: string;
  created_at: string;
  expires_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export type OutboxStatus = 'pending' | 'sending' | 'sent' | 'rejected' | 'failed';

export interface OutboxItem {
  id: string;
  token_id: string | null;
  requested_by: string;
  from_alias: string;
  to_addresses: string[];
  cc_addresses: string[];
  subject: string;
  body_text: string;
  in_reply_to: string | null;
  status: OutboxStatus;
  decided_by: string | null;
  decided_at: string | null;
  result_email_id: string | null;
  error: string | null;
  created_at: string;
}

const mockTokens: (AgentToken & { token_hash: string })[] = [];
const mockOutbox: OutboxItem[] = [];

const iso = (v: unknown): string | null => (v ? new Date(v as string | number | Date).toISOString() : null);
export const hashToken = (plain: string): string => crypto.createHash('sha256').update(plain).digest('hex');

function toToken(row: object): AgentToken {
  const r = row as Record<string, unknown>;
  return {
    id: String(r.id),
    name: String(r.name),
    alias_scope: (r.alias_scope as string[]) || [],
    created_by: String(r.created_by),
    created_at: iso(r.created_at) || '',
    expires_at: iso(r.expires_at) || '',
    last_used_at: iso(r.last_used_at),
    revoked_at: iso(r.revoked_at),
  };
}

function toOutbox(row: object): OutboxItem {
  const r = row as Record<string, unknown>;
  return {
    id: String(r.id),
    token_id: r.token_id ? String(r.token_id) : null,
    requested_by: String(r.requested_by),
    from_alias: String(r.from_alias),
    to_addresses: (r.to_addresses as string[]) || [],
    cc_addresses: (r.cc_addresses as string[]) || [],
    subject: String(r.subject),
    body_text: String(r.body_text),
    in_reply_to: (r.in_reply_to as string) || null,
    status: r.status as OutboxStatus,
    decided_by: (r.decided_by as string) || null,
    decided_at: iso(r.decided_at),
    result_email_id: (r.result_email_id as string) || null,
    error: (r.error as string) || null,
    created_at: iso(r.created_at) || '',
  };
}

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

export async function createAgentToken(input: {
  name: string;
  alias_scope: string[];
  created_by: string;
  days: number;
}): Promise<{ token: string; record: AgentToken }> {
  const token = TOKEN_PREFIX + crypto.randomBytes(32).toString('base64url');
  const hash = hashToken(token);
  const expires = new Date(Date.now() + input.days * 24 * 60 * 60 * 1000);
  const pool = getPool();
  if (pool) {
    const res = await pool.query(
      `INSERT INTO agent_tokens (name, token_hash, alias_scope, created_by, expires_at)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [input.name, hash, input.alias_scope, input.created_by, expires]
    );
    return { token, record: toToken(res.rows[0]) };
  }
  const record: AgentToken & { token_hash: string } = {
    id: crypto.randomUUID(),
    name: input.name,
    alias_scope: input.alias_scope,
    created_by: input.created_by,
    created_at: new Date().toISOString(),
    expires_at: expires.toISOString(),
    last_used_at: null,
    revoked_at: null,
    token_hash: hash,
  };
  mockTokens.push(record);
  return { token, record: toToken(record) };
}

/** Resolves a presented token to a live (not revoked, not expired) record, or null. */
export async function authenticateAgentToken(plain: string): Promise<AgentToken | null> {
  if (!plain.startsWith(TOKEN_PREFIX) || plain.length > 200) return null;
  const hash = hashToken(plain);
  const pool = getPool();
  let rec: AgentToken | null = null;
  if (pool) {
    const res = await pool.query('SELECT * FROM agent_tokens WHERE token_hash = $1', [hash]);
    rec = res.rows[0] ? toToken(res.rows[0]) : null;
  } else {
    const m = mockTokens.find((t) => t.token_hash === hash);
    rec = m ? toToken(m) : null;
  }
  if (!rec || rec.revoked_at || new Date(rec.expires_at).getTime() <= Date.now()) return null;
  // Best effort, at most once a minute per token: usage info must never break a request
  const last = rec.last_used_at ? new Date(rec.last_used_at).getTime() : 0;
  if (Date.now() - last > 60_000) {
    if (pool) pool.query('UPDATE agent_tokens SET last_used_at = NOW() WHERE id = $1', [rec.id]).catch(() => undefined);
    else {
      const m = mockTokens.find((t) => t.id === rec!.id);
      if (m) m.last_used_at = new Date().toISOString();
    }
  }
  return rec;
}

export async function listAgentTokens(): Promise<AgentToken[]> {
  const pool = getPool();
  if (pool) {
    const res = await pool.query('SELECT * FROM agent_tokens ORDER BY created_at DESC LIMIT 200');
    return res.rows.map(toToken);
  }
  return mockTokens.map(toToken).reverse();
}

export async function revokeAgentToken(id: string): Promise<boolean> {
  const pool = getPool();
  if (pool) {
    const res = await pool.query('UPDATE agent_tokens SET revoked_at = NOW() WHERE id = $1 AND revoked_at IS NULL', [id]);
    return (res.rowCount ?? 0) > 0;
  }
  const m = mockTokens.find((t) => t.id === id && !t.revoked_at);
  if (!m) return false;
  m.revoked_at = new Date().toISOString();
  return true;
}

// ---------------------------------------------------------------------------
// Outbox (send proposals)
// ---------------------------------------------------------------------------

export async function countPendingFor(tokenId: string): Promise<number> {
  const pool = getPool();
  if (pool) {
    const res = await pool.query("SELECT COUNT(*)::int AS n FROM outbox WHERE token_id = $1 AND status = 'pending'", [tokenId]);
    return res.rows[0].n;
  }
  return mockOutbox.filter((o) => o.token_id === tokenId && o.status === 'pending').length;
}

export async function countRecentFor(tokenId: string, sinceMs: number): Promise<number> {
  const since = new Date(Date.now() - sinceMs);
  const pool = getPool();
  if (pool) {
    const res = await pool.query('SELECT COUNT(*)::int AS n FROM outbox WHERE token_id = $1 AND created_at > $2', [tokenId, since]);
    return res.rows[0].n;
  }
  return mockOutbox.filter((o) => o.token_id === tokenId && new Date(o.created_at) > since).length;
}

export async function createOutboxItem(input: {
  token_id: string;
  requested_by: string;
  from_alias: string;
  to_addresses: string[];
  cc_addresses: string[];
  subject: string;
  body_text: string;
  in_reply_to: string | null;
}): Promise<OutboxItem> {
  const pool = getPool();
  if (pool) {
    const res = await pool.query(
      `INSERT INTO outbox (token_id, requested_by, from_alias, to_addresses, cc_addresses, subject, body_text, in_reply_to)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [input.token_id, input.requested_by, input.from_alias, input.to_addresses, input.cc_addresses, input.subject, input.body_text, input.in_reply_to]
    );
    return toOutbox(res.rows[0]);
  }
  const item: OutboxItem = {
    id: crypto.randomUUID(),
    ...input,
    status: 'pending',
    decided_by: null,
    decided_at: null,
    result_email_id: null,
    error: null,
    created_at: new Date().toISOString(),
  };
  mockOutbox.unshift(item);
  return item;
}

export async function getOutboxItem(id: string): Promise<OutboxItem | null> {
  const pool = getPool();
  if (pool) {
    const res = await pool.query('SELECT * FROM outbox WHERE id = $1', [id]);
    return res.rows[0] ? toOutbox(res.rows[0]) : null;
  }
  return mockOutbox.find((o) => o.id === id) || null;
}

export async function listOutbox(status?: OutboxStatus, limit = 100): Promise<OutboxItem[]> {
  const pool = getPool();
  if (pool) {
    const res = status
      ? await pool.query('SELECT * FROM outbox WHERE status = $1 ORDER BY created_at DESC LIMIT $2', [status, limit])
      : await pool.query('SELECT * FROM outbox ORDER BY created_at DESC LIMIT $1', [limit]);
    return res.rows.map(toOutbox);
  }
  return mockOutbox.filter((o) => !status || o.status === status).slice(0, limit);
}

/**
 * Atomically moves pending -> sending/rejected. Returns the item only for the single caller that wins,
 * so a double click (or two admins) can never send the same proposal twice.
 */
export async function claimOutboxItem(id: string, to: 'sending' | 'rejected', by: string, reason?: string): Promise<OutboxItem | null> {
  const oldest = new Date(Date.now() - PROPOSAL_TTL_MS);
  const pool = getPool();
  if (pool) {
    const res = await pool.query(
      `UPDATE outbox SET status = $2, decided_by = $3, decided_at = NOW(), error = $4
       WHERE id = $1 AND status = 'pending' AND created_at > $5 RETURNING *`,
      [id, to, by, to === 'rejected' ? reason || null : null, oldest]
    );
    return res.rows[0] ? toOutbox(res.rows[0]) : null;
  }
  const m = mockOutbox.find((o) => o.id === id);
  if (!m || m.status !== 'pending' || new Date(m.created_at) <= oldest) return null;
  m.status = to;
  m.decided_by = by;
  m.decided_at = new Date().toISOString();
  m.error = to === 'rejected' ? reason || null : null;
  return m;
}

export async function finishOutboxItem(id: string, result: { ok: true; email_id: string } | { ok: false; error: string }): Promise<void> {
  const status: OutboxStatus = result.ok ? 'sent' : 'failed';
  const emailId = result.ok ? result.email_id : null;
  const error = result.ok ? null : result.error.slice(0, 500);
  const pool = getPool();
  if (pool) {
    await pool.query('UPDATE outbox SET status = $2, result_email_id = $3, error = $4 WHERE id = $1', [id, status, emailId, error]);
    return;
  }
  const m = mockOutbox.find((o) => o.id === id);
  if (m) {
    m.status = status;
    m.result_email_id = emailId;
    m.error = error;
  }
}
