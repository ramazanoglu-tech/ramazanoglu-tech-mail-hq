// =============================================================================
// RAMAZANOĞLU TECH MAIL HQ - MAIL CLIENT (Swiss architectural UI)
// Talks to the real backend only: sign-in, token storage and the authenticated fetch wrapper
// live in auth.js (window.RT). No credential is embedded here and nothing is faked client-side:
// what you see is exactly what the server returned for your account.
// The CSP forbids inline handlers and CDN scripts, so every handler is bound with addEventListener.
// =============================================================================

const API_BASE = RT.API_BASE;
const WS_URL = RT.WS_URL;
const ROLE_LABEL = { owner: 'SAHİP', admin: 'YÖNETİCİ', member: 'ÜYE' };
const $ = (id) => document.getElementById(id);

// ---- state ------------------------------------------------------------------
let currentUser = null;
let features = {};
let aliases = [];
let emails = [];
let availableTemplates = [];
let selectedId = null;
let currentFolder = 'INBOX';
let currentReadFilter = 'ALL';
let currentAlias = 'all';
let currentSearch = '';
let ws = null;
let reconnectTimer = null;
let toastTimer = null;
let loadSeq = 0;

const isStaff = () => currentUser && (currentUser.role === 'owner' || currentUser.role === 'admin');
const selected = () => emails.find((e) => e.id === selectedId) || null;

// ---- helpers ----------------------------------------------------------------
function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showToast(message, isError) {
  const toast = $('toast');
  $('toast-text').textContent = message;
  $('toast-dot').className = 'w-2 h-2 inline-block ' + (isError ? 'bg-white' : 'bg-intlOrange');
  toast.classList.remove('translate-y-16', 'opacity-0');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('translate-y-16', 'opacity-0'), isError ? 5000 : 2600);
}

function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const time = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  return d.toDateString() === new Date().toDateString() ? time : `${d.getDate()}.${d.getMonth() + 1} ${time}`;
}

async function api(method, path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `İstek başarısız (${res.status})`);
  return data;
}

const badgeOf = (aliasTarget) => {
  const a = aliases.find((x) => x.email.toLowerCase() === String(aliasTarget).toLowerCase());
  return a ? a.department_badge : '[RT]';
};

// The other party of a message: sender for received mail, first recipient for sent mail
function counterpart(item) {
  if (item.direction === 'OUTBOUND') return (item.to_addresses || [])[0] || '';
  return item.from_address;
}

// ---- boot -------------------------------------------------------------------
async function initApp() {
  registerServiceWorker();

  // Shows the sign-in / forced password-change screen and never resolves until that is done
  const me = await RT.ensureSession();
  currentUser = me.user;
  features = me.features || {};

  const badge = $('userBadge');
  badge.textContent = `${currentUser.name} · ${ROLE_LABEL[currentUser.role] || ''}`;
  badge.hidden = false;
  $('adminLink').textContent = isStaff() ? 'YÖNETİM' : 'HESAP';
  $('btnDeleteEmail').hidden = !isStaff(); // the server enforces this too
  $('devBar').classList.toggle('hidden', !features.dev_simulate);

  bindEvents();
  await Promise.all([loadAliases(), loadTemplates()]);
  await loadEmails();
  loadStats();
  initWebSocket();
  requestNotificationPermission();
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('[PWA SW] registration ignored:', err));
    });
  }
}

function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
}

// ---- live stream ------------------------------------------------------------
function setStatus(live) {
  $('statusPill').textContent = live ? 'CANLI BAĞLI' : 'BAĞLANTI KOPTU';
  $('syncDot').className = 'w-2 h-2 inline-block ' + (live ? 'bg-emerald-600' : 'bg-intlOrange');
}

function initWebSocket() {
  try {
    // Browsers cannot set WebSocket headers, so the short-lived JWT travels as a query parameter
    ws = new WebSocket(`${WS_URL}?token=${encodeURIComponent(RT.getToken())}`);
    ws.onopen = () => {
      setStatus(true);
      clearTimeout(reconnectTimer);
    };
    ws.onclose = () => {
      setStatus(false);
      scheduleReconnect();
    };
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'EMAIL_RECEIVED') onIncoming(data.payload);
        else if (data.type === 'EMAIL_SENT' || data.type === 'EMAIL_UPDATED') refresh();
      } catch (e) {
        console.error('Failed to parse WS frame:', e);
      }
    };
  } catch (err) {
    console.error('[WS] connection error:', err);
  }
}

// Reconnect only while the session is valid: a disabled account gets the sign-in screen instead of a loop
function scheduleReconnect() {
  clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/me`);
      if (res.ok) initWebSocket();
      else if (res.status !== 401 && res.status !== 403) scheduleReconnect();
    } catch {
      scheduleReconnect();
    }
  }, 4000);
}

function onIncoming(mail) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('Yeni E-Posta', {
      body: `[${mail.alias_target}] ${mail.from_name || mail.from_address}: ${mail.subject}`,
      icon: './icon.svg',
    });
  }
  refresh();
}

// ---- data -------------------------------------------------------------------
async function loadAliases() {
  try {
    aliases = (await api('GET', '/aliases')).aliases || [];
  } catch (err) {
    console.error('Failed to load aliases:', err);
  }
  renderChannels();
  renderIdentitySelects();
}

async function loadTemplates() {
  try {
    availableTemplates = (await api('GET', '/templates')).templates || [];
    $('composeTemplateSelect').innerHTML =
      '<option value="">— Şablon (isteğe bağlı) —</option>' +
      availableTemplates.map((t) => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.name)}</option>`).join('');
  } catch (err) {
    console.warn('Failed to load templates:', err);
  }
}

async function loadStats() {
  try {
    const s = await api('GET', '/stats');
    $('badge-inbox').textContent = s.unread_total ? String(s.unread_total) : '';
    $('badge-sent').textContent = s.outbound_total ? String(s.outbound_total) : '';
  } catch {
    /* badges are optional */
  }
}

function buildQuery() {
  const p = new URLSearchParams();
  if (currentAlias !== 'all') p.set('alias', currentAlias);
  if (currentFolder === 'INBOX') { p.set('direction', 'INBOUND'); p.set('archived', 'false'); }
  else if (currentFolder === 'OUTBOUND') { p.set('direction', 'OUTBOUND'); p.set('archived', 'false'); }
  else if (currentFolder === 'STARRED') { p.set('starred', 'true'); }
  else if (currentFolder === 'ARCHIVE') { p.set('archived', 'true'); }
  if (currentReadFilter === 'UNREAD') p.set('unread', 'true');
  if (currentSearch.trim()) p.set('search', currentSearch.trim());
  return p.toString();
}

async function loadEmails() {
  const seq = ++loadSeq;
  try {
    const data = await api('GET', `/emails?${buildQuery()}`);
    if (seq !== loadSeq) return; // a newer request superseded this one
    emails = data.emails || [];
    renderList(data.total || 0);
  } catch (err) {
    if (seq !== loadSeq) return;
    $('emailList').innerHTML = `<div class="p-12 text-center"><div class="font-mono text-[11px] text-slateLight uppercase tracking-wider">${escapeHtml(err.message)}</div></div>`;
  }
}

function refresh() {
  loadEmails();
  loadStats();
}

// ---- rendering --------------------------------------------------------------
function renderChannels() {
  const rows = [{ email: 'all', label: currentUser && currentUser.role === 'owner' ? 'TÜM TRAFİK' : 'TÜM KİMLİKLERİM' }].concat(
    aliases.map((a) => ({ email: a.email, label: a.email.split('@')[0], badge: a.department_badge }))
  );
  $('channelList').innerHTML = rows
    .map((r) => {
      const active = currentAlias === r.email;
      return `<button type="button" data-channel="${escapeHtml(r.email)}" class="w-full px-3 py-2 flex items-center gap-2.5 text-left transition-colors ${
        active ? 'bg-paperMuted text-ink' : 'hover:bg-paperMuted hover:text-ink'
      }"><span class="w-2 h-2 inline-block flex-shrink-0 ${active ? 'bg-intlOrange' : 'bg-hairline'}"></span><span class="truncate">${escapeHtml(r.label)}</span></button>`;
    })
    .join('');

  $('mobileChannel').innerHTML =
    `<option value="all">${rows[0].label}</option>` +
    aliases.map((a) => `<option value="${escapeHtml(a.email)}"${currentAlias === a.email ? ' selected' : ''}>${escapeHtml(a.department_badge)} ${escapeHtml(a.email)}</option>`).join('');
  $('mobileChannel').value = currentAlias;
}

function renderIdentitySelects() {
  const options = aliases
    .map((a) => `<option value="${escapeHtml(a.email)}">${escapeHtml(a.department_badge)} ${escapeHtml(a.email)} — ${escapeHtml(a.display_name)}</option>`)
    .join('');
  $('replyFromSelect').innerHTML = options;
  $('composeFromSelect').innerHTML = options;
  updateSignaturePreview();
}

function updateSignaturePreview() {
  const box = $('composeSignaturePreview');
  const a = aliases.find((x) => x.email.toLowerCase() === $('composeFromSelect').value.toLowerCase());
  box.textContent = '';
  if (a && a.signature_html) {
    // Signatures are HTML: keep them fully sandboxed like received mail
    const frame = document.createElement('iframe');
    frame.setAttribute('sandbox', '');
    frame.className = 'w-full h-36 bg-white border-0';
    frame.srcdoc = a.signature_html;
    box.appendChild(frame);
  } else {
    box.innerHTML = '<em class="text-slateLight">(İmza tanımlanmamış)</em>';
  }
}

function renderList(total) {
  const list = $('emailList');
  $('emailCountLabel').textContent = `${emails.length}/${total}`;

  if (emails.length === 0) {
    list.innerHTML = `
      <div class="p-12 text-center">
        <div class="font-serif italic text-2xl text-slateMuted mb-1">Klasör boş.</div>
        <div class="font-mono text-[11px] text-slateLight uppercase tracking-wider">EŞLEŞEN İLETİ BULUNAMADI</div>
      </div>`;
    selectedId = null;
    renderReader();
    return;
  }

  // Keep the open message when it is still in the list; on desktop otherwise open the first one
  if (!selectedId || !emails.some((e) => e.id === selectedId)) {
    selectedId = isDesktop() ? emails[0].id : null;
  }

  list.innerHTML = emails
    .map((m) => {
      const unread = !m.is_read;
      const active = m.id === selectedId;
      const who = m.direction === 'OUTBOUND' ? `→ ${(m.to_addresses || [])[0] || ''}` : m.from_name || m.from_address;
      return `
      <article data-id="${escapeHtml(String(m.id))}" role="listitem" tabindex="0"
        class="px-5 py-4 cursor-pointer row-hover transition-colors border-l-[3px] border-transparent ${active ? 'msg-active' : ''}">
        <div class="flex items-center justify-between mb-1.5 gap-2">
          <div class="flex items-center gap-2 min-w-0">
            ${unread ? '<span class="w-2 h-2 bg-intlOrange inline-block flex-shrink-0"></span>' : ''}
            <span class="font-mono text-[10px] px-1.5 py-0.5 hairline-box bg-paper text-ink flex-shrink-0">${escapeHtml(badgeOf(m.alias_target))}</span>
            <span class="text-sm truncate ${unread ? 'font-semibold text-ink' : 'font-medium text-slateMuted'}">${escapeHtml(who)}</span>
          </div>
          <span class="font-mono text-[11px] text-slateLight flex-shrink-0">${escapeHtml(formatDateTime(m.received_at))}</span>
        </div>
        <h3 class="text-sm truncate mb-1 ${unread ? 'font-semibold' : 'font-normal'} text-ink">${m.is_starred ? '<span class="text-intlOrange">★</span> ' : ''}${escapeHtml(m.subject)}</h3>
        <p class="text-xs text-slateMuted line-clamp-1 leading-relaxed">${escapeHtml((m.body_text || '').replace(/\s+/g, ' ').substring(0, 120))}</p>
      </article>`;
    })
    .join('');

  renderReader();
}

function isDesktop() {
  return window.matchMedia('(min-width: 1024px)').matches;
}

function setReaderOpenOnMobile(open) {
  const pane = $('readerPane');
  if (isDesktop()) return;
  pane.classList.toggle('hidden', !open);
  pane.classList.toggle('flex', open);
}

function renderReader() {
  const content = $('reader-content');
  const msg = selected();
  const hasMsg = !!msg;
  $('quick-reply-box').classList.toggle('hidden', !hasMsg);
  ['btnReply', 'btnForward', 'btnCopySender', 'btnToggleStar', 'btnToggleRead', 'btnArchive', 'btnDeleteEmail'].forEach((id) => {
    $(id).disabled = !hasMsg;
    $(id).classList.toggle('opacity-40', !hasMsg);
  });

  if (!msg) {
    content.innerHTML = `
      <div class="h-full flex flex-col items-center justify-center text-center py-20">
        <span class="font-serif italic text-3xl text-slateMuted mb-2">Okumak için bir ileti seçin.</span>
        <span class="font-mono text-xs text-slateLight uppercase tracking-widest">MAIL HQ // RAMAZANOĞLU TECH</span>
      </div>`;
    setReaderOpenOnMobile(false);
    return;
  }

  $('btnToggleStar').textContent = msg.is_starred ? '★' : '☆';
  $('btnToggleStar').classList.toggle('text-intlOrange', !!msg.is_starred);
  $('btnToggleRead').textContent = msg.is_read ? 'OKUNMADI' : 'OKUNDU';
  $('btnArchive').textContent = msg.is_archived ? 'ARŞİVDEN ÇIKAR' : 'ARŞİVLE';
  $('reply-to-label').textContent = counterpart(msg);
  if (aliases.some((a) => a.email.toLowerCase() === msg.alias_target.toLowerCase())) {
    $('replyFromSelect').value = aliases.find((a) => a.email.toLowerCase() === msg.alias_target.toLowerCase()).email;
  }

  const meta = `
    <div class="max-w-3xl">
      <div class="flex items-start justify-between gap-4 mb-6">
        <h1 class="text-xl sm:text-2xl font-semibold text-ink tracking-tight leading-snug break-words min-w-0">${escapeHtml(msg.subject)}</h1>
        <span class="font-mono text-[11px] px-2.5 py-1 hairline-box bg-paper text-ink flex-shrink-0">${escapeHtml(msg.direction)}</span>
      </div>
      <div class="hairline-box bg-paper p-4 sm:p-5 mb-8 grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
        <div class="sm:col-span-8 space-y-1 min-w-0">
          <div class="flex items-baseline gap-2 flex-wrap">
            <span class="font-mono text-[11px] uppercase tracking-wider text-slateLight w-16 flex-shrink-0">KİMDEN:</span>
            <span class="text-sm font-semibold text-ink">${escapeHtml(msg.from_name || '')}</span>
            <span class="font-mono text-xs text-slateMuted break-all">&lt;${escapeHtml(msg.from_address)}&gt;</span>
          </div>
          <div class="flex items-baseline gap-2">
            <span class="font-mono text-[11px] uppercase tracking-wider text-slateLight w-16 flex-shrink-0">KİME:</span>
            <span class="font-mono text-xs text-ink break-all">${escapeHtml((msg.to_addresses || []).join(', '))}</span>
          </div>
          <div class="flex items-baseline gap-2">
            <span class="font-mono text-[11px] uppercase tracking-wider text-slateLight w-16 flex-shrink-0">KİMLİK:</span>
            <span class="font-mono text-xs text-ink">${escapeHtml(badgeOf(msg.alias_target))} ${escapeHtml(msg.alias_target)}</span>
          </div>
        </div>
        <div class="sm:col-span-4 sm:text-right font-mono text-xs text-slateLight">${escapeHtml(new Date(msg.received_at).toLocaleString('tr-TR'))}</div>
      </div>
      <div id="bodyHost"></div>
    </div>`;
  content.innerHTML = meta;

  // Received HTML is attacker-controlled: a fully sandboxed iframe (no scripts, no same-origin access,
  // no forms/popups) means it can never touch the signed-in session.
  const host = $('bodyHost');
  if (msg.body_html) {
    const frame = document.createElement('iframe');
    frame.setAttribute('sandbox', '');
    frame.setAttribute('referrerpolicy', 'no-referrer');
    frame.title = 'E-posta içeriği';
    frame.className = 'w-full bg-white border border-hairline';
    frame.style.height = '60vh';
    frame.style.minHeight = '320px';
    frame.srcdoc = `<base target="_blank"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:">${msg.body_html}`;
    host.appendChild(frame);
  } else {
    const pre = document.createElement('div');
    pre.className = 'text-[15px] text-[#1A1A1A] leading-[1.75] whitespace-pre-line break-words';
    pre.textContent = msg.body_text || '';
    host.appendChild(pre);
  }
}

// ---- actions ----------------------------------------------------------------
function selectMessage(id) {
  selectedId = id;
  const msg = selected();
  if (msg && !msg.is_read) {
    msg.is_read = true;
    patch(msg.id, { is_read: true }).then(loadStats);
  }
  // re-render the list highlight and the reader without refetching
  renderList(Number($('emailCountLabel').textContent.split('/')[1]) || emails.length);
  setReaderOpenOnMobile(true);
}

async function patch(id, updates) {
  try {
    await api('PATCH', `/emails/${encodeURIComponent(id)}`, updates);
    return true;
  } catch (err) {
    showToast(err.message, true);
    return false;
  }
}

function setFolder(folder) {
  currentFolder = folder;
  selectedId = null;
  document.querySelectorAll('.folder-btn').forEach((btn) => {
    const active = btn.dataset.folder === folder;
    btn.classList.toggle('nav-active', active);
    btn.classList.toggle('font-medium', active);
    btn.classList.toggle('text-slateMuted', !active);
    btn.classList.toggle('hover:bg-paperMuted', !active);
    btn.classList.toggle('hover:text-ink', !active);
  });
  loadEmails();
}

function setReadFilter(filter) {
  currentReadFilter = filter;
  document.querySelectorAll('.read-filter').forEach((btn) => {
    const active = btn.dataset.read === filter;
    btn.classList.toggle('font-semibold', active);
    btn.classList.toggle('text-ink', active);
    btn.classList.toggle('underline', active);
    btn.classList.toggle('underline-offset-4', active);
    btn.classList.toggle('text-slateMuted', !active);
  });
  loadEmails();
}

function setAlias(alias) {
  currentAlias = alias;
  selectedId = null;
  renderChannels();
  loadEmails();
}

function focusQuickReply() {
  if (!selected()) return;
  setReaderOpenOnMobile(true);
  $('quick-reply-input').focus();
}

async function sendMail(payload, button, idleLabel) {
  button.disabled = true;
  button.querySelector('span') ? (button.querySelector('span').textContent = 'GÖNDERİLİYOR...') : (button.textContent = 'GÖNDERİLİYOR...');
  try {
    await api('POST', '/emails/send', payload);
    showToast(`GÖNDERİLDİ: ${payload.to.join(', ').toUpperCase()}`);
    return true;
  } catch (err) {
    showToast(err.message, true);
    return false;
  } finally {
    button.disabled = false;
    button.querySelector('span') ? (button.querySelector('span').textContent = idleLabel) : (button.textContent = idleLabel);
  }
}

async function sendQuickReply() {
  const msg = selected();
  const text = $('quick-reply-input').value.trim();
  if (!msg) return;
  if (!text) return showToast('Lütfen bir yanıt metni girin.', true);
  const to = counterpart(msg);
  if (!to) return showToast('Yanıtlanacak adres bulunamadı.', true);

  const ok = await sendMail(
    {
      from_alias: $('replyFromSelect').value,
      to: [to],
      subject: /^re:/i.test(msg.subject) ? msg.subject : `Re: ${msg.subject}`,
      body_text: text,
      body_html: `<p>${escapeHtml(text).replace(/\n/g, '<br>')}</p>`,
      in_reply_to: msg.message_id,
      thread_id: msg.thread_id || msg.message_id,
    },
    $('btnSendQuickReply'),
    'GÖNDER'
  );
  if (ok) {
    $('quick-reply-input').value = '';
    refresh();
  }
}

function openCompose(prefill) {
  const p = prefill || {};
  if (p.from) $('composeFromSelect').value = p.from;
  $('composeToInput').value = p.to || '';
  $('composeCcInput').value = '';
  $('composeSubjectInput').value = p.subject || '';
  $('composeBodyInput').value = p.body || '';
  $('composeTemplateSelect').value = '';
  updateSignaturePreview();
  $('composeModal').classList.remove('hidden');
  $('composeModal').classList.add('flex');
  (p.to ? $('composeBodyInput') : $('composeToInput')).focus();
}

function closeCompose() {
  $('composeModal').classList.add('hidden');
  $('composeModal').classList.remove('flex');
}

async function dispatchCompose() {
  const to = $('composeToInput').value.split(',').map((s) => s.trim()).filter(Boolean);
  const cc = $('composeCcInput').value.split(',').map((s) => s.trim()).filter(Boolean);
  const subject = $('composeSubjectInput').value.trim();
  const body = $('composeBodyInput').value.trim();
  if (to.length === 0) return showToast('En az bir alıcı girin.', true);
  if (!subject) return showToast('Lütfen bir konu girin.', true);

  const isHtml = /<(table|div|p)\b/i.test(body);
  const ok = await sendMail(
    {
      from_alias: $('composeFromSelect').value,
      to,
      cc,
      subject,
      body_text: isHtml ? body.replace(/<[^>]*>/g, '') : body,
      body_html: isHtml ? body : `<p>${escapeHtml(body).replace(/\n/g, '<br>')}</p>`,
    },
    $('btnDispatchSend'),
    'GÖNDER'
  );
  if (ok) {
    closeCompose();
    refresh();
  }
}

// ---- events -----------------------------------------------------------------
function bindEvents() {
  // list: click or Enter/Space on a row
  $('emailList').addEventListener('click', (ev) => {
    const row = ev.target.closest('[data-id]');
    if (row) selectMessage(row.dataset.id);
  });
  $('emailList').addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    const row = ev.target.closest('[data-id]');
    if (row) { ev.preventDefault(); selectMessage(row.dataset.id); }
  });

  document.querySelectorAll('.folder-btn').forEach((b) => b.addEventListener('click', () => setFolder(b.dataset.folder)));
  document.querySelectorAll('.read-filter').forEach((b) => b.addEventListener('click', () => setReadFilter(b.dataset.read)));
  $('channelList').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-channel]');
    if (b) setAlias(b.dataset.channel);
  });
  $('mobileChannel').addEventListener('change', (ev) => setAlias(ev.target.value));
  $('btnRefresh').addEventListener('click', () => { refresh(); showToast('SENKRONİZE EDİLİYOR...'); });
  $('btnLogout').addEventListener('click', RT.logout);

  // search (desktop and phone inputs stay in sync)
  let searchTimer;
  const onSearch = (ev) => {
    $('searchInput').value = ev.target.value;
    $('searchInputMobile').value = ev.target.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { currentSearch = ev.target.value; selectedId = null; loadEmails(); }, 250);
  };
  $('searchInput').addEventListener('input', onSearch);
  $('searchInputMobile').addEventListener('input', onSearch);

  // reader
  $('btnBack').addEventListener('click', () => setReaderOpenOnMobile(false));
  $('btnReply').addEventListener('click', focusQuickReply);
  $('btnForward').addEventListener('click', () => {
    const m = selected();
    if (!m) return;
    openCompose({
      from: m.alias_target,
      subject: /^fwd:/i.test(m.subject) ? m.subject : `Fwd: ${m.subject}`,
      body: `\n\n--- İletilen İleti ---\nKimden: ${m.from_address}\nKonu: ${m.subject}\n\n${m.body_text || ''}`,
    });
  });
  $('btnCopySender').addEventListener('click', async () => {
    const m = selected();
    if (!m) return;
    try {
      await navigator.clipboard.writeText(counterpart(m));
      showToast(`KOPYALANDI: ${counterpart(m).toUpperCase()}`);
    } catch {
      showToast('Kopyalanamadı', true);
    }
  });
  $('btnToggleStar').addEventListener('click', async () => {
    const m = selected();
    if (!m) return;
    if (await patch(m.id, { is_starred: !m.is_starred })) { m.is_starred = !m.is_starred; renderList(emails.length); }
  });
  $('btnToggleRead').addEventListener('click', async () => {
    const m = selected();
    if (!m) return;
    if (await patch(m.id, { is_read: !m.is_read })) { m.is_read = !m.is_read; renderList(emails.length); loadStats(); }
  });
  $('btnArchive').addEventListener('click', async () => {
    const m = selected();
    if (!m) return;
    if (await patch(m.id, { is_archived: !m.is_archived })) {
      showToast(m.is_archived ? 'ARŞİVDEN ÇIKARILDI' : 'İLETİ ARŞİVLENDİ');
      selectedId = null;
      setReaderOpenOnMobile(false);
      refresh();
    }
  });
  $('btnDeleteEmail').addEventListener('click', async () => {
    const m = selected();
    if (!m || !window.confirm('Bu e-postayı veritabanından kalıcı olarak silmek istiyor musunuz?')) return;
    try {
      await api('DELETE', `/emails/${encodeURIComponent(m.id)}`);
      showToast('İLETİ SİLİNDİ');
      selectedId = null;
      setReaderOpenOnMobile(false);
      refresh();
    } catch (err) {
      showToast(err.message, true);
    }
  });
  $('btnSendQuickReply').addEventListener('click', sendQuickReply);
  $('btnFullEditor').addEventListener('click', () => {
    const m = selected();
    if (!m) return;
    openCompose({
      from: $('replyFromSelect').value,
      to: counterpart(m),
      subject: /^re:/i.test(m.subject) ? m.subject : `Re: ${m.subject}`,
      body: $('quick-reply-input').value,
    });
  });

  // compose
  $('btnOpenCompose').addEventListener('click', () => openCompose());
  $('btnCloseCompose').addEventListener('click', closeCompose);
  $('btnCancelCompose').addEventListener('click', closeCompose);
  $('btnDispatchSend').addEventListener('click', dispatchCompose);
  $('composeFromSelect').addEventListener('change', updateSignaturePreview);
  $('composeTemplateSelect').addEventListener('change', () => {
    const tpl = availableTemplates.find((t) => t.id === $('composeTemplateSelect').value);
    if (tpl) {
      $('composeSubjectInput').value = tpl.defaultSubject;
      $('composeBodyInput').value = tpl.htmlContent;
    }
  });

  // dev simulation: the endpoint exists only when the server runs with MOCK_MODE=true
  $('btnSimulate').addEventListener('click', async () => {
    try {
      await api('POST', '/dev/simulate', { alias_target: currentAlias === 'all' ? (aliases[0] && aliases[0].email) : currentAlias });
    } catch (err) {
      showToast(err.message, true);
    }
  });

  // keyboard: C compose, R reply, / search, Esc close, Ctrl+Enter send
  document.addEventListener('keydown', (ev) => {
    const el = document.activeElement;
    const typing = el && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
    if (ev.key === 'Escape') {
      if (!$('composeModal').classList.contains('hidden')) return closeCompose();
      if (typing) return el.blur();
      return setReaderOpenOnMobile(false);
    }
    if ((ev.ctrlKey || ev.metaKey) && ev.key === 'Enter') {
      if (el && el.id === 'quick-reply-input') return sendQuickReply();
      if (!$('composeModal').classList.contains('hidden')) return dispatchCompose();
    }
    if (typing || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (ev.key === 'c' || ev.key === 'C') { ev.preventDefault(); openCompose(); }
    else if (ev.key === 'r' || ev.key === 'R') { ev.preventDefault(); focusQuickReply(); }
    else if (ev.key === '/') { ev.preventDefault(); $('searchInput').focus(); }
  });

  // leaving the phone breakpoint (rotate/resize) must not leave the reader hidden or stuck open
  window.matchMedia('(min-width: 1024px)').addEventListener('change', () => {
    $('readerPane').classList.remove('hidden', 'flex');
    if (!isDesktop()) $('readerPane').classList.add('hidden');
  });
}

window.addEventListener('DOMContentLoaded', initApp);
