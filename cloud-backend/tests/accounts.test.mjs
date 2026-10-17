// End-to-end tests for per-user accounts. Runs the compiled server in MOCK_MODE on a free port.
//   npm run build && npm test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import WebSocket from 'ws';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BOOT_PASSWORD = 'bootstrap-password-for-tests-1234';
const PORT = 18770;
const PORT_NO_LEGACY = 18771;
const BASE = `http://127.0.0.1:${PORT}/api`;

const OWNER = 'yusuf@ramazanoglu.tech';
const OWNER_NEW_PW = 'Owner-new-password-#42';

let server;
let serverNoLegacy;
let n = 0;

function startServer(port, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['dist/index.js'], {
      cwd: ROOT,
      env: {
        PATH: process.env.PATH,
        NODE_ENV: 'development',
        MOCK_MODE: 'true',
        HOST: '127.0.0.1',
        PORT: String(port),
        TRUST_PROXY: '1', // lets each request present its own client IP so per-IP limits never interfere
        SUPER_ADMIN_PASSWORD: BOOT_PASSWORD,
        JWT_SECRET: 'jwt-secret-for-tests-0123456789abcdef0123',
        ...extraEnv,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const timer = setTimeout(() => reject(new Error('server did not start')), 15000);
    child.stdout.on('data', (d) => {
      if (String(d).includes('REST API running')) {
        clearTimeout(timer);
        resolve(child);
      }
    });
    child.stderr.on('data', (d) => process.stderr.write(d));
    child.on('exit', (c) => reject(new Error(`server exited early (${c})`)));
  });
}

async function api(method, route, { token, body, headers = {}, base = BASE } = {}) {
  const res = await fetch(base + route, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Forwarded-For': `10.0.${Math.floor(++n / 250)}.${n % 250}`,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body && method !== 'GET' ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

const login = (email, password) => api('POST', '/auth/login', { body: { email, password } });

before(async () => {
  server = await startServer(PORT);
  serverNoLegacy = await startServer(PORT_NO_LEGACY, { LEGACY_API_KEY_ENABLED: 'false' });
});
after(() => {
  server?.removeAllListeners('exit');
  serverNoLegacy?.removeAllListeners('exit');
  server?.kill();
  serverNoLegacy?.kill();
});

// Shared state across the ordered tests below
const s = {};

test('owner is bootstrapped and forced to change the initial password', async () => {
  const r = await login(OWNER, BOOT_PASSWORD);
  assert.equal(r.status, 200);
  assert.equal(r.json.must_change_password, true);
  assert.equal(r.json.user.role, 'owner');
  assert.equal(r.json.user.password_hash, undefined, 'hash must never reach the client');
  s.ownerBootToken = r.json.token;

  const blocked = await api('GET', '/emails', { token: s.ownerBootToken });
  assert.equal(blocked.status, 403);
  assert.equal(blocked.json.code, 'PASSWORD_CHANGE_REQUIRED');
  assert.equal((await api('GET', '/auth/me', { token: s.ownerBootToken })).status, 200);
});

test('change password: weak rejected, strong accepted, old sessions revoked', async () => {
  const weak = await api('POST', '/auth/change-password', {
    token: s.ownerBootToken,
    body: { current_password: BOOT_PASSWORD, new_password: 'short' },
  });
  assert.equal(weak.status, 400);

  const wrongCurrent = await api('POST', '/auth/change-password', {
    token: s.ownerBootToken,
    body: { current_password: 'not-the-password-123', new_password: OWNER_NEW_PW },
  });
  assert.equal(wrongCurrent.status, 401);

  const ok = await api('POST', '/auth/change-password', {
    token: s.ownerBootToken,
    body: { current_password: BOOT_PASSWORD, new_password: OWNER_NEW_PW },
  });
  assert.equal(ok.status, 200);
  s.owner = ok.json.token;

  assert.equal((await api('GET', '/auth/me', { token: s.ownerBootToken })).status, 401, 'old token revoked');
  assert.equal((await api('GET', '/emails', { token: s.owner })).status, 200);
  assert.equal((await login(OWNER, BOOT_PASSWORD)).status, 401, 'old password no longer works');
  assert.equal((await login(OWNER, OWNER_NEW_PW)).status, 200);
});

test('login does not reveal whether an account exists', async () => {
  const unknown = await login('nobody@ramazanoglu.tech', 'whatever-password-1234');
  const wrong = await login(OWNER, 'wrong-password-123456');
  assert.equal(unknown.status, 401);
  assert.equal(wrong.status, 401);
  assert.equal(unknown.json.error, wrong.json.error);
});

test('owner creates a member scoped to one identity; temp password works once and must be changed', async () => {
  // an e-mail for each of two identities so scoping is observable
  for (const alias of ['info@ramazanoglu.tech', 'support@ramazanoglu.tech']) {
    const r = await api('POST', '/dev/simulate', { token: s.owner, body: { alias_target: alias, subject: `hello ${alias}` } });
    assert.equal(r.status, 201);
    s[alias] = r.json.email;
  }

  const created = await api('POST', '/admin/users', {
    token: s.owner,
    body: { email: 'nur@ramazanoglu.tech', name: 'Nur', role: 'member', alias_access: ['info@ramazanoglu.tech'] },
  });
  assert.equal(created.status, 201);
  assert.match(created.json.temp_password, /^[A-Za-z0-9]{4}(-[A-Za-z0-9]{4}){3}$/);
  assert.equal(created.json.user.password_hash, undefined);
  s.memberId = created.json.user.id;

  const dup = await api('POST', '/admin/users', { token: s.owner, body: { email: 'NUR@ramazanoglu.tech', name: 'Nur 2' } });
  assert.equal(dup.status, 409);

  const first = await login('nur@ramazanoglu.tech', created.json.temp_password);
  assert.equal(first.status, 200);
  assert.equal(first.json.must_change_password, true);
  const change = await api('POST', '/auth/change-password', {
    token: first.json.token,
    body: { current_password: created.json.temp_password, new_password: 'Nur-very-secret-pass-9' },
  });
  assert.equal(change.status, 200);
  s.member = change.json.token;
});

test('member only sees, reads, changes and sends as their own identity', async () => {
  const list = await api('GET', '/emails', { token: s.member });
  assert.equal(list.status, 200);
  assert.ok(list.json.emails.length >= 1);
  assert.ok(list.json.emails.every((e) => e.alias_target === 'info@ramazanoglu.tech'));

  assert.equal((await api('GET', '/emails?alias=support@ramazanoglu.tech', { token: s.member })).status, 403);
  const foreign = s['support@ramazanoglu.tech'];
  assert.equal((await api('GET', `/emails/${foreign.id}`, { token: s.member })).status, 404);
  assert.equal(
    (await api('PATCH', `/emails/${foreign.id}`, { token: s.member, body: { is_starred: true } })).status,
    404
  );
  const own = s['info@ramazanoglu.tech'];
  assert.equal((await api('PATCH', `/emails/${own.id}`, { token: s.member, body: { is_read: true } })).status, 200);

  const aliases = await api('GET', '/aliases', { token: s.member });
  assert.deepEqual(aliases.json.aliases.map((a) => a.email), ['info@ramazanoglu.tech']);

  const stats = await api('GET', '/stats', { token: s.member });
  assert.ok(stats.json.alias_breakdown.every((a) => a.alias === 'info@ramazanoglu.tech'));

  const send = (from) =>
    api('POST', '/emails/send', { token: s.member, body: { from_alias: from, to: ['x@example.com'], subject: 'hi', body_text: 'x' } });
  assert.equal((await send('info@ramazanoglu.tech')).status, 201);
  assert.equal((await send('support@ramazanoglu.tech')).status, 403);
  assert.equal((await send('brand-new@ramazanoglu.tech')).status, 403, 'members cannot mint identities');

  assert.equal((await api('DELETE', `/emails/${own.id}`, { token: s.member })).status, 403, 'members cannot delete');
});

test('member cannot reach administration or owner-only endpoints', async () => {
  for (const [method, route] of [
    ['GET', '/admin/users'],
    ['GET', '/admin/audit'],
    ['POST', '/admin/users'],
    ['POST', '/aliases'],
    ['POST', '/sync/trigger'],
    ['GET', '/health/details'],
    ['POST', '/dev/simulate'],
  ]) {
    const r = await api(method, route, { token: s.member, body: {} });
    assert.equal(r.status, 403, `${method} ${route} should be 403, got ${r.status}`);
  }
});

test('admin manages members only and cannot grant what they do not have', async () => {
  const mk = await api('POST', '/admin/users', {
    token: s.owner,
    body: { email: 'ali@ramazanoglu.tech', name: 'Ali', role: 'admin', alias_access: ['info@ramazanoglu.tech'] },
  });
  assert.equal(mk.status, 201);
  const first = await login('ali@ramazanoglu.tech', mk.json.temp_password);
  const pw = await api('POST', '/auth/change-password', {
    token: first.json.token,
    body: { current_password: mk.json.temp_password, new_password: 'Ali-admin-password-77' },
  });
  s.admin = pw.json.token;
  s.adminId = mk.json.user.id;

  const member = await api('POST', '/admin/users', {
    token: s.admin,
    body: { email: 'can@ramazanoglu.tech', name: 'Can', alias_access: ['info@ramazanoglu.tech'] },
  });
  assert.equal(member.status, 201);

  const escalate = await api('POST', '/admin/users', {
    token: s.admin,
    body: { email: 'boss@ramazanoglu.tech', name: 'Boss', role: 'admin' },
  });
  assert.equal(escalate.status, 403);

  const overreach = await api('POST', '/admin/users', {
    token: s.admin,
    body: { email: 'rich@ramazanoglu.tech', name: 'Rich', alias_access: ['support@ramazanoglu.tech'] },
  });
  assert.equal(overreach.status, 400, 'cannot grant an identity the admin cannot access');

  const allAccess = await api('POST', '/admin/users', {
    token: s.admin,
    body: { email: 'all@ramazanoglu.tech', name: 'All', alias_access: ['*'] },
  });
  assert.equal(allAccess.status, 400);

  const users = await api('GET', '/admin/users', { token: s.admin });
  const ownerRow = users.json.users.find((u) => u.email === OWNER);
  assert.equal((await api('PATCH', `/admin/users/${ownerRow.id}`, { token: s.admin, body: { name: 'Hacked' } })).status, 403);
  assert.equal((await api('POST', `/admin/users/${ownerRow.id}/reset-password`, { token: s.admin })).status, 403);
  // admins manage members only, which also means they cannot promote themselves
  assert.equal((await api('PATCH', `/admin/users/${s.adminId}`, { token: s.admin, body: { role: 'owner' } })).status, 403);
});

test('owner protections: no self-disable, no self-demotion', async () => {
  const users = await api('GET', '/admin/users', { token: s.owner });
  const me = users.json.users.find((u) => u.email === OWNER);
  assert.equal((await api('PATCH', `/admin/users/${me.id}`, { token: s.owner, body: { is_active: false } })).status, 400);
  assert.equal((await api('PATCH', `/admin/users/${me.id}`, { token: s.owner, body: { role: 'member' } })).status, 400);
});

test('live stream only delivers mail for identities the account may see', async () => {
  const received = [];
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws?token=${s.member}`);
  await new Promise((resolve, reject) => {
    ws.on('message', (m) => {
      const msg = JSON.parse(m);
      if (msg.type === 'SYNC_STATUS') resolve();
      if (msg.type === 'EMAIL_RECEIVED') received.push(msg.payload.alias_target);
    });
    ws.on('error', reject);
    ws.on('close', () => reject(new Error('socket closed before welcome')));
  });
  await api('POST', '/dev/simulate', { token: s.owner, body: { alias_target: 'support@ramazanoglu.tech', subject: 'secret support mail' } });
  await api('POST', '/dev/simulate', { token: s.owner, body: { alias_target: 'info@ramazanoglu.tech', subject: 'visible info mail' } });
  await new Promise((r) => setTimeout(r, 400));
  ws.removeAllListeners('close');
  ws.close();
  assert.deepEqual(received, ['info@ramazanoglu.tech']);
});

test('sockets are rejected without a valid personal session', async () => {
  for (const url of [`ws://127.0.0.1:${PORT}/ws`, `ws://127.0.0.1:${PORT}/ws?token=garbage`]) {
    const code = await new Promise((resolve) => {
      const ws = new WebSocket(url);
      ws.on('close', (c) => resolve(c));
      ws.on('error', () => {});
    });
    assert.equal(code, 1008);
  }
});

test('disabling an account ends its session immediately (HTTP and WebSocket)', async () => {
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws?token=${s.member}`);
  await new Promise((resolve, reject) => {
    ws.on('message', (m) => JSON.parse(m).type === 'SYNC_STATUS' && resolve());
    ws.on('error', reject);
  });
  const closed = new Promise((resolve) => ws.on('close', (c) => resolve(c)));

  const off = await api('PATCH', `/admin/users/${s.memberId}`, { token: s.owner, body: { is_active: false } });
  assert.equal(off.status, 200);
  assert.equal(await closed, 1008, 'socket closed by the server');

  assert.equal((await api('GET', '/emails', { token: s.member })).status, 401);
  assert.equal((await login('nur@ramazanoglu.tech', 'Nur-very-secret-pass-9')).status, 401);

  // re-enabling does not resurrect the old token
  await api('PATCH', `/admin/users/${s.memberId}`, { token: s.owner, body: { is_active: true } });
  assert.equal((await api('GET', '/emails', { token: s.member })).status, 401);
  assert.equal((await login('nur@ramazanoglu.tech', 'Nur-very-secret-pass-9')).status, 200);
});

test('resetting a password issues a one-time temp password and kills old sessions', async () => {
  const fresh = (await login('nur@ramazanoglu.tech', 'Nur-very-secret-pass-9')).json.token;
  const reset = await api('POST', `/admin/users/${s.memberId}/reset-password`, { token: s.owner });
  assert.equal(reset.status, 200);
  assert.ok(reset.json.temp_password);
  assert.equal((await api('GET', '/emails', { token: fresh })).status, 401);
  assert.equal((await login('nur@ramazanoglu.tech', 'Nur-very-secret-pass-9')).status, 401);
  const again = await login('nur@ramazanoglu.tech', reset.json.temp_password);
  assert.equal(again.json.must_change_password, true);
});

test('five wrong passwords lock the account even from other IPs', async () => {
  for (let i = 0; i < 5; i++) {
    assert.equal((await login('ali@ramazanoglu.tech', `wrong-password-${i}-xxxx`)).status, 401);
  }
  const locked = await login('ali@ramazanoglu.tech', 'Ali-admin-password-77');
  assert.equal(locked.status, 429, 'even the right password is refused while locked');
});

test('audit trail records who did what', async () => {
  const r = await api('GET', '/admin/audit?limit=200', { token: s.owner });
  assert.equal(r.status, 200);
  const actions = new Set(r.json.entries.map((e) => e.action));
  for (const a of ['login', 'login_failed', 'password_changed', 'user_create', 'user_update', 'email_send', 'send_denied', 'login_locked']) {
    assert.ok(actions.has(a), `missing audit action ${a}`);
  }
  assert.ok(r.json.entries.every((e) => !JSON.stringify(e).includes('Nur-very-secret')), 'no passwords in the log');
});

test('legacy shared key: works as owner while enabled, refused when disabled', async () => {
  const on = await api('GET', '/emails', { headers: { 'X-Super-Admin-Key': BOOT_PASSWORD } });
  assert.equal(on.status, 200);
  const off = await api('GET', '/emails', {
    base: `http://127.0.0.1:${PORT_NO_LEGACY}/api`,
    headers: { 'X-Super-Admin-Key': BOOT_PASSWORD },
  });
  assert.equal(off.status, 401);
});
