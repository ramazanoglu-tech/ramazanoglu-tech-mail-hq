// End-to-end tests for AI agent access (MCP endpoint, scoped tokens, send approval).
//   npm run build && npm test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 18780;
const API = `http://127.0.0.1:${PORT}/api`;
const MCP = `http://127.0.0.1:${PORT}/mcp`;
const BOOT = 'bootstrap-password-for-tests-1234';
const OWNER = 'yusuf@ramazanoglu.tech';
const OWNER_PW = 'Owner-new-password-#42';

let server;
let n = 0;
const s = {};

before(async () => {
  server = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['dist/index.js'], {
      cwd: ROOT,
      env: {
        PATH: process.env.PATH, NODE_ENV: 'development', MOCK_MODE: 'true', HOST: '127.0.0.1', PORT: String(PORT),
        TRUST_PROXY: '1', SUPER_ADMIN_PASSWORD: BOOT, JWT_SECRET: 'jwt-secret-for-tests-0123456789abcdef0123',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const timer = setTimeout(() => reject(new Error('server did not start')), 15000);
    child.stdout.on('data', (d) => { if (String(d).includes('REST API running')) { clearTimeout(timer); resolve(child); } });
    child.stderr.on('data', (d) => process.stderr.write(d));
    child.on('exit', (c) => reject(new Error(`server exited early (${c})`)));
  });
});
after(() => { server?.removeAllListeners('exit'); server?.kill(); });

async function api(method, route, { token, body } = {}) {
  const res = await fetch(API + route, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `10.1.${Math.floor(++n / 250)}.${n % 250}`, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body && method !== 'GET' ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

let rpcId = 0;
async function rpc(token, method, params = {}) {
  const res = await fetch(MCP, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method, params }),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}
async function tool(token, name, args = {}) {
  const r = await rpc(token, 'tools/call', { name, arguments: args });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  const res = r.json.result;
  let data;
  try { data = JSON.parse(res.content[0].text); } catch { data = res.content[0].text; }
  return { isError: !!res.isError, data };
}

test('owner logs in and sets a real password', async () => {
  const l = await api('POST', '/auth/login', { body: { email: OWNER, password: BOOT } });
  assert.equal(l.status, 200);
  const c = await api('POST', '/auth/change-password', { token: l.json.token, body: { current_password: BOOT, new_password: OWNER_PW } });
  s.owner = c.json.token || l.json.token;
  assert.ok(s.owner);
});

test('MCP refuses missing, malformed and unknown tokens; wrong methods are 405', async () => {
  assert.equal((await rpc(null, 'tools/list')).status, 401);
  assert.equal((await rpc('nope', 'tools/list')).status, 401);
  assert.equal((await rpc('mhq_' + 'a'.repeat(43), 'tools/list')).status, 401);
  assert.equal((await fetch(MCP)).status, 405);
});

test('only the owner can create tokens; validation; token is shown once and never listed', async () => {
  assert.equal((await api('POST', '/agent/tokens', { body: { name: 'x', aliases: ['*'] } })).status, 401);
  assert.equal((await api('POST', '/agent/tokens', { token: s.owner, body: { name: '', aliases: ['*'] } })).status, 400);
  assert.equal((await api('POST', '/agent/tokens', { token: s.owner, body: { name: 'x', aliases: [] } })).status, 400);
  assert.equal((await api('POST', '/agent/tokens', { token: s.owner, body: { name: 'x', aliases: ['ghost@ramazanoglu.tech'] } })).status, 400);
  assert.equal((await api('POST', '/agent/tokens', { token: s.owner, body: { name: 'x', aliases: ['support@ramazanoglu.tech'], days: 9999 } })).status, 400);

  const r = await api('POST', '/agent/tokens', { token: s.owner, body: { name: 'claude-test', aliases: ['support@ramazanoglu.tech'], days: 30 } });
  assert.equal(r.status, 201);
  assert.match(r.json.token, /^mhq_[A-Za-z0-9_-]{40,}$/);
  s.agent = r.json.token;
  s.agentId = r.json.record.id;

  const list = await api('GET', '/agent/tokens', { token: s.owner });
  assert.equal(list.status, 200);
  assert.ok(list.json.tokens.some((t) => t.id === s.agentId));
  assert.ok(!JSON.stringify(list.json).includes(s.agent), 'plain token must never be listed');
  assert.ok(!JSON.stringify(list.json).includes('token_hash'));
});

test('a mail-session JWT is not an agent token, and an agent token is not an API session', async () => {
  assert.equal((await rpc(s.owner, 'tools/list')).status, 401);
  assert.equal((await api('GET', '/emails', { token: s.agent })).status, 401);
});

test('tools/list exposes only the safe tool set (no delete, no direct send)', async () => {
  const r = await rpc(s.agent, 'tools/list');
  assert.equal(r.status, 200);
  const names = r.json.result.tools.map((t) => t.name).sort();
  assert.deepEqual(names, ['mail_list', 'mail_mark', 'mail_proposal_status', 'mail_propose_send', 'mail_read', 'mail_stats']);
  assert.ok(!names.some((x) => /delete|remove|send$/.test(x.replace('propose_send', ''))));
});

test('initialize carries the injection-defence instructions', async () => {
  const r = await rpc(s.agent, 'initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 't', version: '1' } });
  assert.equal(r.status, 200);
  assert.match(r.json.result.instructions, /untrusted_email/);
});

test('mail_list is limited to the token scope; other identities are refused', async () => {
  const all = await tool(s.agent, 'mail_list', { limit: 50 });
  assert.equal(all.isError, false);
  assert.ok(all.data.emails.length > 0);
  assert.ok(all.data.emails.every((e) => e.alias === 'support@ramazanoglu.tech'), JSON.stringify(all.data.emails.map((e) => e.alias)));
  s.supportMailId = all.data.emails[0].id;

  const denied = await tool(s.agent, 'mail_list', { alias: 'billing@ramazanoglu.tech' });
  assert.equal(denied.isError, true);

  const stats = await tool(s.agent, 'mail_stats');
  assert.ok(stats.data.alias_breakdown.every((a) => a.alias === 'support@ramazanoglu.tech'));
});

test('mail_read wraps the body as untrusted and hides mail outside the scope', async () => {
  const ok = await tool(s.agent, 'mail_read', { id: s.supportMailId });
  assert.equal(ok.isError, false);
  assert.match(ok.data.body, /^<untrusted_email>\n[\s\S]*\n<\/untrusted_email>$/);
  assert.equal(ok.data.html, undefined);

  const ownerList = await api('GET', '/emails?alias=billing@ramazanoglu.tech&limit=5', { token: s.owner });
  const billing = (Array.isArray(ownerList.json) ? ownerList.json : ownerList.json.emails || ownerList.json.data)[0];
  assert.ok(billing, 'demo data should contain a billing mail');
  const hidden = await tool(s.agent, 'mail_read', { id: billing.id });
  assert.equal(hidden.isError, true);
  assert.equal((await tool(s.agent, 'mail_mark', { id: billing.id, is_read: true })).isError, true);
});

test('mail_mark flips flags inside the scope', async () => {
  const r = await tool(s.agent, 'mail_mark', { id: s.supportMailId, is_starred: true, is_read: true });
  assert.equal(r.isError, false);
  assert.equal(r.data.is_starred, true);
});

test('propose_send: validation and scope are enforced, nothing is sent', async () => {
  const base = { to: ['musteri@example.com'], subject: 'Merhaba', body_text: 'Selam' };
  assert.equal((await tool(s.agent, 'mail_propose_send', { ...base, from_alias: 'billing@ramazanoglu.tech' })).isError, true, 'out of scope');
  assert.equal((await tool(s.agent, 'mail_propose_send', { ...base, from_alias: 'support@evil.com' })).isError, true, 'foreign domain');
  assert.equal((await tool(s.agent, 'mail_propose_send', { ...base, from_alias: 'support@ramazanoglu.tech', to: ['not-an-address'] })).isError, true);
  assert.equal((await tool(s.agent, 'mail_propose_send', { ...base, from_alias: 'support@ramazanoglu.tech', subject: 'a\r\nBcc: x@y.z' })).isError, true, 'header injection');
  const pending = await api('GET', '/agent/outbox?status=pending', { token: s.owner });
  assert.equal(pending.json.items.length, 0);
});

test('propose -> pending -> owner approves exactly once -> sent', async () => {
  const p = await tool(s.agent, 'mail_propose_send', {
    from_alias: 'support@ramazanoglu.tech', to: ['musteri@example.com'], subject: 'Yanıtınız', body_text: 'Merhaba,\nTalebiniz alındı.', in_reply_to: '<abc@example.com>#support@ramazanoglu.tech',
  });
  assert.equal(p.isError, false);
  assert.equal(p.data.status, 'pending');
  s.proposal = p.data.proposal_id;

  assert.equal((await tool(s.agent, 'mail_proposal_status', { proposal_id: s.proposal })).data.status, 'pending');

  const list = await api('GET', '/agent/outbox?status=pending', { token: s.owner });
  assert.equal(list.json.items.length, 1);
  assert.equal(list.json.items[0].requested_by, 'agent:claude-test');

  const [a, b] = await Promise.all([
    api('POST', `/agent/outbox/${s.proposal}/approve`, { token: s.owner }),
    api('POST', `/agent/outbox/${s.proposal}/approve`, { token: s.owner }),
  ]);
  assert.deepEqual([a.status, b.status].sort(), [200, 409], 'double click must send once');
  assert.equal((await tool(s.agent, 'mail_proposal_status', { proposal_id: s.proposal })).data.status, 'sent');
  assert.equal((await api('POST', `/agent/outbox/${s.proposal}/approve`, { token: s.owner })).status, 409);
});

test('reject keeps the mail unsent and records the reason', async () => {
  const p = await tool(s.agent, 'mail_propose_send', { from_alias: 'support@ramazanoglu.tech', to: ['x@example.com'], subject: 'Hayır', body_text: 'ret' });
  const r = await api('POST', `/agent/outbox/${p.data.proposal_id}/reject`, { token: s.owner, body: { reason: 'yanlış alıcı' } });
  assert.equal(r.status, 200);
  const st = await tool(s.agent, 'mail_proposal_status', { proposal_id: p.data.proposal_id });
  assert.equal(st.data.status, 'rejected');
  assert.equal(st.data.reason, 'yanlış alıcı');
  assert.equal((await api('POST', `/agent/outbox/${p.data.proposal_id}/approve`, { token: s.owner })).status, 409);
});

test('an agent cannot read another token\'s proposals and cannot approve anything', async () => {
  const other = await api('POST', '/agent/tokens', { token: s.owner, body: { name: 'other', aliases: ['support@ramazanoglu.tech'] } });
  const peek = await tool(other.json.token, 'mail_proposal_status', { proposal_id: s.proposal });
  assert.equal(peek.isError, true);
  assert.equal((await api('POST', `/agent/outbox/${s.proposal}/approve`, { token: s.agent })).status, 401);
  assert.equal((await api('GET', '/agent/outbox', { token: s.agent })).status, 401);
});

test('pending proposals are capped per token', async () => {
  const t = await api('POST', '/agent/tokens', { token: s.owner, body: { name: 'spammer', aliases: ['support@ramazanoglu.tech'] } });
  let blocked = 0;
  for (let i = 0; i < 12; i++) {
    const r = await tool(t.json.token, 'mail_propose_send', { from_alias: 'support@ramazanoglu.tech', to: ['x@example.com'], subject: `s${i}`, body_text: 'x' });
    if (r.isError) blocked++;
  }
  assert.ok(blocked >= 2, `hourly cap should stop the 11th and 12th (blocked ${blocked})`);
});

test('revoking a token cuts access immediately and is audited', async () => {
  assert.equal((await rpc(s.agent, 'tools/list')).status, 200);
  assert.equal((await api('DELETE', `/agent/tokens/${s.agentId}`, { token: s.owner })).status, 200);
  assert.equal((await rpc(s.agent, 'tools/list')).status, 401);
  assert.equal((await api('DELETE', `/agent/tokens/${s.agentId}`, { token: s.owner })).status, 404);

  const audit = await api('GET', '/admin/audit?limit=200', { token: s.owner });
  const actions = new Set((audit.json.entries || audit.json.audit || audit.json).map((e) => e.action));
  for (const a of ['agent_token_create', 'agent_token_revoke', 'mcp_mail_list', 'mcp_propose_send', 'outbox_approve', 'outbox_reject']) {
    assert.ok(actions.has(a), `missing audit action ${a}`);
  }
});
