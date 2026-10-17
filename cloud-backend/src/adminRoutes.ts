// =============================================================================
// RAMAZANOĞLU TECH MAIL HQ - ADMINISTRATION API (USERS & AUDIT TRAIL)
// Mounted at /api/admin. Owners manage everybody; admins manage members only.
// =============================================================================

import { Router, Request, Response } from 'express';
import { config } from './config.js';
import { AuthUser, canAccessAlias, requireAuth, requireRole, toAuthUser } from './auth.js';
import { getAliases } from './db.js';
import {
  countActiveOwners,
  createUser,
  findUserByEmail,
  findUserById,
  generateTempPassword,
  listAudit,
  listUsers,
  setUserPassword,
  toPublicUser,
  updateUser,
  UserPatch,
  writeAudit,
} from './users.js';
import { refreshUserSockets } from './websocket.js';
import { User, UserRole } from './types.js';

export const adminRouter = Router();
adminRouter.use(requireAuth(), requireRole('owner', 'admin'));

const ROLES: UserRole[] = ['owner', 'admin', 'member'];
const EMAIL_SHAPE = /^[^\s@]{1,64}@[^\s@]{1,190}$/;

/** Owners may manage anyone, admins only members. */
function canManage(actor: AuthUser, target: User): boolean {
  return actor.role === 'owner' || (actor.role === 'admin' && target.role === 'member');
}

type AccessResult = { ok: true; value: string[] } | { ok: false; error: string };

/** Validates a list of identities a user is allowed to use. '*' = all, owner-only to hand out. */
async function normalizeAliasAccess(input: unknown, actor: AuthUser): Promise<AccessResult> {
  if (!Array.isArray(input) || input.length > 200 || input.some((x) => typeof x !== 'string')) {
    return { ok: false, error: 'Kimlik erişim listesi geçersiz.' };
  }
  const wanted = Array.from(new Set((input as string[]).map((a) => a.toLowerCase().trim()).filter(Boolean)));
  if (wanted.includes('*')) {
    if (actor.role !== 'owner' && !actor.alias_access.includes('*')) {
      return { ok: false, error: 'Tüm kimliklere erişim yalnızca bu yetkiye sahip kullanıcılar tarafından verilebilir.' };
    }
    return { ok: true, value: ['*'] };
  }
  const known = new Set((await getAliases()).map((a) => a.email.toLowerCase()));
  for (const a of wanted) {
    if (!a.endsWith(config.domainFilter) || !known.has(a)) {
      return { ok: false, error: `Tanımsız kimlik: ${a}` };
    }
    // Nobody can hand out access they do not have themselves
    if (!canAccessAlias(actor, a)) {
      return { ok: false, error: `Bu kimliğe erişim verme yetkiniz yok: ${a}` };
    }
  }
  return { ok: true, value: wanted };
}

function audit(req: Request, action: string, target: string, details?: Record<string, unknown>) {
  return writeAudit({ user_id: req.auth!.id, user_email: req.auth!.email, action, target, ip: req.ip, details: details ?? null });
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

adminRouter.get('/users', async (_req: Request, res: Response) => {
  try {
    res.json({ users: (await listUsers()).map(toPublicUser) });
  } catch (err) {
    console.error('[ADMIN] list users failed:', err);
    res.status(500).json({ error: 'Kullanıcılar alınamadı.' });
  }
});

adminRouter.post('/users', async (req: Request, res: Response) => {
  try {
    const actor = req.auth!;
    const { email, name, role = 'member', alias_access = [] } = req.body || {};

    if (typeof email !== 'string' || !EMAIL_SHAPE.test(email.trim())) {
      res.status(400).json({ error: 'Geçerli bir e-posta adresi girin.' });
      return;
    }
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 100) {
      res.status(400).json({ error: 'Ad 1-100 karakter olmalı.' });
      return;
    }
    if (!ROLES.includes(role)) {
      res.status(400).json({ error: 'Geçersiz rol.' });
      return;
    }
    if (actor.role === 'admin' && role !== 'member') {
      res.status(403).json({ error: 'Yöneticiler yalnızca "üye" hesabı oluşturabilir.' });
      return;
    }
    if (await findUserByEmail(email)) {
      res.status(409).json({ error: 'Bu e-posta ile bir hesap zaten var.' });
      return;
    }

    let access: string[] = ['*'];
    if (role !== 'owner') {
      const result = await normalizeAliasAccess(alias_access, actor);
      if (!result.ok) {
        res.status(400).json({ error: result.error });
        return;
      }
      access = result.value;
    }

    const tempPassword = generateTempPassword();
    const created = await createUser({
      email: email.trim(),
      name: name.trim(),
      role,
      alias_access: access,
      password: tempPassword,
      must_change_password: true,
    });
    await audit(req, 'user_create', created.email, { role, alias_access: access });
    // The temporary password is returned exactly once and never stored in clear text
    res.status(201).json({ user: toPublicUser(created), temp_password: tempPassword });
  } catch (err) {
    console.error('[ADMIN] create user failed:', err);
    res.status(500).json({ error: 'Kullanıcı oluşturulamadı.' });
  }
});

adminRouter.patch('/users/:id', async (req: Request, res: Response) => {
  try {
    const actor = req.auth!;
    const target = await findUserById(String(req.params.id));
    if (!target) {
      res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
      return;
    }
    if (!canManage(actor, target)) {
      res.status(403).json({ error: 'Bu hesabı düzenleme yetkiniz yok.' });
      return;
    }

    const { name, role, alias_access, is_active } = req.body || {};
    const patch: UserPatch = {};
    const isSelf = target.id === actor.id;

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim() || name.trim().length > 100) {
        res.status(400).json({ error: 'Ad 1-100 karakter olmalı.' });
        return;
      }
      patch.name = name.trim();
    }
    if (role !== undefined) {
      if (!ROLES.includes(role)) {
        res.status(400).json({ error: 'Geçersiz rol.' });
        return;
      }
      if (isSelf && role !== target.role) {
        res.status(400).json({ error: 'Kendi rolünüzü değiştiremezsiniz.' });
        return;
      }
      if (actor.role === 'admin' && role !== 'member') {
        res.status(403).json({ error: 'Yöneticiler rol yükseltemez.' });
        return;
      }
      if (role !== target.role) patch.role = role;
    }
    if (is_active !== undefined) {
      if (typeof is_active !== 'boolean') {
        res.status(400).json({ error: 'is_active true/false olmalı.' });
        return;
      }
      if (isSelf && is_active === false) {
        res.status(400).json({ error: 'Kendi hesabınızı devre dışı bırakamazsınız.' });
        return;
      }
      if (is_active !== target.is_active) patch.is_active = is_active;
    }

    const finalRole = patch.role ?? target.role;
    if (finalRole === 'owner') {
      patch.alias_access = ['*'];
    } else if (alias_access !== undefined) {
      const result = await normalizeAliasAccess(alias_access, actor);
      if (!result.ok) {
        res.status(400).json({ error: result.error });
        return;
      }
      patch.alias_access = result.value;
    }

    // Never leave the system without an active owner
    const losesOwner =
      target.role === 'owner' && target.is_active && (patch.role !== undefined || patch.is_active === false);
    if (losesOwner && (await countActiveOwners()) <= 1) {
      res.status(409).json({ error: 'Sistemde en az bir aktif sahip (owner) kalmalı.' });
      return;
    }

    const updated = await updateUser(target.id, patch);
    if (!updated) {
      res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
      return;
    }

    // Disabled or re-roled accounts lose their sessions (token_version bumped); alias changes apply live
    const sessionEnded = patch.is_active === false || patch.role !== undefined;
    refreshUserSockets(updated.id, updated.is_active && !sessionEnded ? toAuthUser(updated) : null);

    await audit(req, 'user_update', updated.email, { changes: patch });
    res.json({ user: toPublicUser(updated) });
  } catch (err) {
    console.error('[ADMIN] update user failed:', err);
    res.status(500).json({ error: 'Kullanıcı güncellenemedi.' });
  }
});

adminRouter.post('/users/:id/reset-password', async (req: Request, res: Response) => {
  try {
    const actor = req.auth!;
    const target = await findUserById(String(req.params.id));
    if (!target) {
      res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
      return;
    }
    if (target.id === actor.id) {
      res.status(400).json({ error: 'Kendi parolanızı Hesabım sayfasından değiştirin.' });
      return;
    }
    if (!canManage(actor, target)) {
      res.status(403).json({ error: 'Bu hesabın parolasını sıfırlama yetkiniz yok.' });
      return;
    }

    const tempPassword = generateTempPassword();
    const updated = await setUserPassword(target.id, tempPassword, true);
    if (!updated) {
      res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
      return;
    }
    refreshUserSockets(updated.id, null);
    await audit(req, 'user_password_reset', updated.email);
    res.json({ user: toPublicUser(updated), temp_password: tempPassword });
  } catch (err) {
    console.error('[ADMIN] reset password failed:', err);
    res.status(500).json({ error: 'Parola sıfırlanamadı.' });
  }
});

// ---------------------------------------------------------------------------
// Audit trail
// ---------------------------------------------------------------------------

adminRouter.get('/audit', async (req: Request, res: Response) => {
  try {
    const raw = parseInt(String(req.query.limit ?? '100'), 10);
    const limit = Number.isFinite(raw) ? Math.min(Math.max(raw, 1), 500) : 100;
    res.json({ entries: await listAudit(limit) });
  } catch (err) {
    console.error('[ADMIN] audit failed:', err);
    res.status(500).json({ error: 'Denetim kaydı alınamadı.' });
  }
});
