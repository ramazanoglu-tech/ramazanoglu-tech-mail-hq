// =============================================================================
// RAMAZANOĞLU TECH MAIL HQ - USER ACCOUNTS & AUDIT TRAIL REPOSITORY
// PostgreSQL when connected, in-memory (MOCK_MODE only) otherwise.
// =============================================================================

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { config } from './config.js';
import { getPool } from './db.js';
import { AuditEntry, PublicUser, User, UserRole } from './types.js';

const BCRYPT_COST = 12;
const mockUsers: User[] = [];
const mockAudit: AuditEntry[] = [];

// Compared against when the e-mail is unknown, so "no such user" costs the same time as "wrong password"
const DUMMY_HASH = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), BCRYPT_COST);

// ---------------------------------------------------------------------------
// Passwords
// ---------------------------------------------------------------------------

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export async function verifyPassword(password: string, hash: string | null): Promise<boolean> {
  const ok = await bcrypt.compare(password, hash || DUMMY_HASH);
  return hash ? ok : false;
}

/** Returns a Turkish error message, or null when the password is acceptable. */
export function validatePasswordStrength(password: unknown, email: string): string | null {
  if (typeof password !== 'string') return 'Parola gerekli.';
  if (password.length < 12) return 'Parola en az 12 karakter olmalı.';
  if (password.length > 128) return 'Parola en fazla 128 karakter olabilir.';
  if (new Set(password).size < 6) return 'Parola çok basit: daha fazla farklı karakter kullanın.';
  const local = email.split('@')[0].toLowerCase();
  if (local.length >= 4 && password.toLowerCase().includes(local)) return 'Parola e-posta adresinizi içeremez.';
  if (/^(password|parola|12345678|qwertyuiop)/i.test(password)) return 'Parola çok yaygın bir kalıp.';
  return null;
}

// No 0/O/1/l/I: temp passwords get read out or typed from a screen
const TEMP_ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateTempPassword(): string {
  const bytes = crypto.randomBytes(16);
  let out = '';
  for (let i = 0; i < 16; i++) {
    out += TEMP_ALPHABET[bytes[i] % TEMP_ALPHABET.length];
    if (i % 4 === 3 && i < 15) out += '-';
  }
  return out;
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

function iso(v: unknown): string | null {
  if (!v) return null;
  return v instanceof Date ? v.toISOString() : String(v);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToUser(r: any): User {
  return {
    id: String(r.id),
    email: r.email,
    name: r.name,
    password_hash: r.password_hash,
    role: r.role,
    alias_access: r.alias_access || [],
    is_active: r.is_active,
    must_change_password: r.must_change_password,
    token_version: r.token_version,
    last_login_at: iso(r.last_login_at),
    created_at: iso(r.created_at) || new Date().toISOString(),
  };
}

export function toPublicUser(u: User): PublicUser {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password_hash, token_version, ...rest } = u;
  return rest;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function findUserByEmail(email: string): Promise<User | null> {
  const e = email.toLowerCase().trim();
  const pool = getPool();
  if (pool) {
    const res = await pool.query('SELECT * FROM users WHERE LOWER(email) = $1', [e]);
    return res.rows[0] ? rowToUser(res.rows[0]) : null;
  }
  return mockUsers.find((u) => u.email === e) || null;
}

export async function findUserById(id: string): Promise<User | null> {
  const pool = getPool();
  if (pool) {
    // Not a UUID => cannot exist; avoids a Postgres cast error on junk input
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    const res = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    return res.rows[0] ? rowToUser(res.rows[0]) : null;
  }
  return mockUsers.find((u) => u.id === id) || null;
}

export async function listUsers(): Promise<User[]> {
  const pool = getPool();
  if (pool) {
    const res = await pool.query('SELECT * FROM users ORDER BY created_at ASC');
    return res.rows.map(rowToUser);
  }
  return [...mockUsers];
}

export async function countActiveOwners(): Promise<number> {
  const pool = getPool();
  if (pool) {
    const res = await pool.query("SELECT COUNT(*)::int AS c FROM users WHERE role = 'owner' AND is_active = TRUE");
    return res.rows[0].c;
  }
  return mockUsers.filter((u) => u.role === 'owner' && u.is_active).length;
}

export async function createUser(input: {
  email: string;
  name: string;
  role: UserRole;
  alias_access: string[];
  password: string;
  must_change_password?: boolean;
}): Promise<User> {
  const password_hash = await hashPassword(input.password);
  const email = input.email.toLowerCase().trim();
  const mustChange = input.must_change_password ?? true;
  const pool = getPool();
  if (pool) {
    const res = await pool.query(
      `INSERT INTO users (email, name, password_hash, role, alias_access, must_change_password)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [email, input.name, password_hash, input.role, input.alias_access, mustChange]
    );
    return rowToUser(res.rows[0]);
  }
  const user: User = {
    id: crypto.randomUUID(),
    email,
    name: input.name,
    password_hash,
    role: input.role,
    alias_access: input.alias_access,
    is_active: true,
    must_change_password: mustChange,
    token_version: 0,
    last_login_at: null,
    created_at: new Date().toISOString(),
  };
  mockUsers.push(user);
  return user;
}

export interface UserPatch {
  name?: string;
  role?: UserRole;
  alias_access?: string[];
  is_active?: boolean;
}

export async function updateUser(id: string, patch: UserPatch): Promise<User | null> {
  const cols: string[] = [];
  const vals: unknown[] = [];
  const add = (col: string, v: unknown) => {
    vals.push(v);
    cols.push(`${col} = $${vals.length + 1}`);
  };
  if (patch.name !== undefined) add('name', patch.name);
  if (patch.role !== undefined) add('role', patch.role);
  if (patch.alias_access !== undefined) add('alias_access', patch.alias_access);
  if (patch.is_active !== undefined) add('is_active', patch.is_active);
  // Disabling or changing the role ends every existing session of that account
  const revoke = patch.is_active === false || patch.role !== undefined;
  if (cols.length === 0) return findUserById(id);

  const pool = getPool();
  if (pool) {
    const extra = revoke ? ', token_version = token_version + 1' : '';
    const res = await pool.query(`UPDATE users SET ${cols.join(', ')}${extra} WHERE id = $1 RETURNING *`, [id, ...vals]);
    return res.rows[0] ? rowToUser(res.rows[0]) : null;
  }
  const u = mockUsers.find((x) => x.id === id);
  if (!u) return null;
  if (patch.name !== undefined) u.name = patch.name;
  if (patch.role !== undefined) u.role = patch.role;
  if (patch.alias_access !== undefined) u.alias_access = patch.alias_access;
  if (patch.is_active !== undefined) u.is_active = patch.is_active;
  if (revoke) u.token_version += 1;
  return u;
}

/** Sets a new password, ends all other sessions (token_version++), and records whether a change is still required. */
export async function setUserPassword(id: string, password: string, mustChange: boolean): Promise<User | null> {
  const password_hash = await hashPassword(password);
  const pool = getPool();
  if (pool) {
    const res = await pool.query(
      `UPDATE users SET password_hash = $2, must_change_password = $3, token_version = token_version + 1
       WHERE id = $1 RETURNING *`,
      [id, password_hash, mustChange]
    );
    return res.rows[0] ? rowToUser(res.rows[0]) : null;
  }
  const u = mockUsers.find((x) => x.id === id);
  if (!u) return null;
  u.password_hash = password_hash;
  u.must_change_password = mustChange;
  u.token_version += 1;
  return u;
}

export async function touchLastLogin(id: string): Promise<void> {
  const pool = getPool();
  if (pool) {
    await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [id]);
    return;
  }
  const u = mockUsers.find((x) => x.id === id);
  if (u) u.last_login_at = new Date().toISOString();
}

// ---------------------------------------------------------------------------
// First owner
// ---------------------------------------------------------------------------

export async function bootstrapOwner(): Promise<void> {
  const existing = await listUsers();
  if (existing.length > 0) return;

  await createUser({
    email: config.ownerEmail,
    name: config.ownerName,
    role: 'owner',
    alias_access: ['*'],
    password: config.superAdminPassword,
    must_change_password: true,
  });
  console.log(
    `[AUTH] First start: owner account created for ${config.ownerEmail}. ` +
      'Initial password = SUPER_ADMIN_PASSWORD (you must change it at first login).'
  );
}

// ---------------------------------------------------------------------------
// Audit trail (never throws: logging must not break the request)
// ---------------------------------------------------------------------------

export async function writeAudit(entry: {
  user_id?: string | null;
  user_email: string;
  action: string;
  target?: string | null;
  ip?: string | null;
  details?: Record<string, unknown> | null;
}): Promise<void> {
  const row = {
    user_id: entry.user_id && entry.user_id !== 'legacy-key' ? entry.user_id : null,
    user_email: entry.user_email,
    action: entry.action,
    target: entry.target ?? null,
    ip: entry.ip ?? null,
    details: entry.details ?? null,
  };
  try {
    const pool = getPool();
    if (pool) {
      await pool.query(
        'INSERT INTO audit_logs (user_id, user_email, action, target, ip, details) VALUES ($1, $2, $3, $4, $5, $6)',
        [row.user_id, row.user_email, row.action, row.target, row.ip, row.details ? JSON.stringify(row.details) : null]
      );
      return;
    }
    mockAudit.unshift({ id: crypto.randomUUID(), ...row, created_at: new Date().toISOString() });
    if (mockAudit.length > 1000) mockAudit.length = 1000;
  } catch (err) {
    console.error('[AUDIT] Failed to write audit entry:', err);
  }
}

export async function listAudit(limit: number): Promise<AuditEntry[]> {
  const pool = getPool();
  if (pool) {
    const res = await pool.query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT $1', [limit]);
    return res.rows.map((r) => ({ ...r, id: String(r.id), created_at: iso(r.created_at) || '' }));
  }
  return mockAudit.slice(0, limit);
}
