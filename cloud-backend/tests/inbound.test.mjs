import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 18772;
const SECRET = 'inbound-secret-for-tests-0123456789';
const URL_ = `http://127.0.0.1:${PORT}/api/inbound/email`;
let server;

before(
  () =>
    new Promise((resolve, reject) => {
      server = spawn(process.execPath, ['dist/index.js'], {
        cwd: ROOT,
        env: {
          PATH: process.env.PATH, NODE_ENV: 'development', MOCK_MODE: 'true', HOST: '127.0.0.1', PORT: String(PORT),
          SUPER_ADMIN_PASSWORD: 'bootstrap-password-for-tests-1234',
          JWT_SECRET: 'jwt-secret-for-tests-0123456789abcdef0123',
          INBOUND_WEBHOOK_SECRET: SECRET,
        },
        stdio: ['ignore', 'pipe', 'inherit'],
      });
      const t = setTimeout(() => reject(new Error('no start')), 15000);
      server.stdout.on('data', (d) => String(d).includes('REST API running') && (clearTimeout(t), resolve()));
    })
);
after(() => server?.kill());

const mime = (id, to = 'destek@ramazanoglu.tech') =>
  Buffer.from(`From: Ali <ali@example.com>\r\nTo: ${to}\r\nSubject: Merhaba dünya\r\nMessage-ID: <${id}@example.com>\r\nDate: Mon, 19 Oct 2026 10:00:00 +0000\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nSelam, teklif istiyoruz.\r\n`);

function post(body, { to = 'destek@ramazanoglu.tech', from = 'ali@example.com', ts = String(Math.floor(Date.now() / 1000)), secret = SECRET, sig } = {}) {
  const s = sig ?? createHmac('sha256', secret).update(`${ts}\n${to}\n${from}\n`).update(body).digest('hex');
  return fetch(URL_, {
    method: 'POST',
    headers: { 'Content-Type': 'message/rfc822', 'X-Timestamp': ts, 'X-Signature': s, 'X-Envelope-To': to, 'X-Envelope-From': from },
    body,
  });
}

test('valid signed mail is stored (201)', async () => {
  const r = await post(mime('a1'));
  assert.equal(r.status, 201);
  assert.equal((await r.json()).stored, true);
});

test('bad signature, wrong secret, tampered envelope, stale timestamp -> 401', async () => {
  assert.equal((await post(mime('b1'), { secret: 'x'.repeat(40) })).status, 401);
  assert.equal((await post(mime('b2'), { sig: 'a'.repeat(64) })).status, 401);
  const body = mime('b3');
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = createHmac('sha256', SECRET).update(`${ts}\ndestek@ramazanoglu.tech\nali@example.com\n`).update(body).digest('hex');
  assert.equal((await post(body, { to: 'ceo@ramazanoglu.tech', ts, sig })).status, 401);
  assert.equal((await post(mime('b4'), { ts: String(Math.floor(Date.now() / 1000) - 3600) })).status, 401);
});

test('recipient outside the corporate domain is acknowledged but not stored', async () => {
  const r = await post(mime('c1', 'x@evil.com'), { to: 'x@evil.com' });
  assert.equal(r.status, 202);
  assert.equal((await r.json()).stored, false);
});

test('replay of the same delivery does not duplicate; second alias gets its own row', async () => {
  const body = mime('d1');
  const ts = String(Math.floor(Date.now() / 1000));
  await post(body, { ts });
  await post(body, { ts });
  await post(body, { to: 'ceo@ramazanoglu.tech' });
  // read back with the legacy-free path: log in as owner
  const login = await fetch(`http://127.0.0.1:${PORT}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'yusuf@ramazanoglu.tech', password: 'bootstrap-password-for-tests-1234' }),
  }).then((x) => x.json());
  const H = { Authorization: `Bearer ${login.token}`, 'Content-Type': 'application/json' };
  const ch = await fetch(`http://127.0.0.1:${PORT}/api/auth/change-password`, { method: 'POST', headers: H, body: JSON.stringify({ current_password: 'bootstrap-password-for-tests-1234', new_password: 'Owner-new-password-#42' }) }).then((x) => x.json());
  const token = ch.token || login.token;
  const list = await fetch(`http://127.0.0.1:${PORT}/api/emails?limit=200`, { headers: { Authorization: `Bearer ${token}` } }).then((x) => x.json());
  const rows = (Array.isArray(list) ? list : list.emails || list.data).filter((e) => e.subject === 'Merhaba dünya' && e.message_id.startsWith('<d1@'));
  assert.equal(rows.length, 2, JSON.stringify(rows.map((r) => r.message_id)));
  assert.deepEqual(rows.map((r) => r.alias_target).sort(), ['ceo@ramazanoglu.tech', 'destek@ramazanoglu.tech']);
  assert.ok(rows.every((r) => r.direction === 'INBOUND'));
});
