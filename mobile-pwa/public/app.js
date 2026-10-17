// =============================================================================
// RAMAZANOĞLU TECH MAIL HQ - MOBILE PWA CORE APPLICATION JAVASCRIPT
// =============================================================================

// Sign-in, token storage and the authenticated fetch wrapper live in auth.js (window.RT).
// No credential is embedded in this file: every person signs in with their own account.
const API_BASE = RT.API_BASE;
const WS_URL = RT.WS_URL;
let currentUser = null;
let features = {};

// State
let aliases = [];
let emails = [];
let selectedEmail = null;
let currentAliasFilter = 'all';
let currentCategoryFilter = 'all';
let currentSearchQuery = '';
let ws = null;
let reconnectTimer = null;

// DOM Elements
const statusPill = document.getElementById('statusPill');
const aliasScroller = document.getElementById('aliasScroller');
const searchInput = document.getElementById('searchInput');
const filterSegmentBtns = document.querySelectorAll('.filter-segment-btn');
const emailList = document.getElementById('emailList');
const emailCountLabel = document.getElementById('emailCountLabel');
const btnSimulate = document.getElementById('btnSimulate');

// Detail Overlay Elements
const detailOverlay = document.getElementById('detailOverlay');
const btnCloseDetail = document.getElementById('btnCloseDetail');
const btnToggleStar = document.getElementById('btnToggleStar');
const btnToggleRead = document.getElementById('btnToggleRead');
const btnDeleteEmail = document.getElementById('btnDeleteEmail');
const detailBadge = document.getElementById('detailBadge');
const detailAliasTarget = document.getElementById('detailAliasTarget');
const detailSubject = document.getElementById('detailSubject');
const detailFrom = document.getElementById('detailFrom');
const detailTo = document.getElementById('detailTo');
const detailDate = document.getElementById('detailDate');
const detailMsgId = document.getElementById('detailMsgId');
const detailBodyContent = document.getElementById('detailBodyContent');
const replyFromSelect = document.getElementById('replyFromSelect');
const replySubjectInput = document.getElementById('replySubjectInput');
const replyBodyInput = document.getElementById('replyBodyInput');
const btnSendReply = document.getElementById('btnSendReply');

// Compose Modal Elements
const composeModal = document.getElementById('composeModal');
const btnOpenCompose = document.getElementById('btnOpenCompose');
const btnCloseCompose = document.getElementById('btnCloseCompose');
const btnCancelCompose = document.getElementById('btnCancelCompose');
const composeFromSelect = document.getElementById('composeFromSelect');
const composeTemplateSelect = document.getElementById('composeTemplateSelect');
const composeToInput = document.getElementById('composeToInput');
const composeCcInput = document.getElementById('composeCcInput');
const composeSubjectInput = document.getElementById('composeSubjectInput');
const composeBodyInput = document.getElementById('composeBodyInput');
const composeSignaturePreview = document.getElementById('composeSignaturePreview');
const btnDispatchSend = document.getElementById('btnDispatchSend');

let availableTemplates = [];

// 1. Initialize PWA
async function initApp() {
  registerServiceWorker();

  // Shows the sign-in / forced password-change screen and never resolves until that is done
  const me = await RT.ensureSession();
  currentUser = me.user;
  features = me.features || {};
  decorateUserStrip();
  requestNotificationPermission();

  await loadAliases();
  await loadTemplates();
  await loadEmails();
  initWebSocket();
  setupEventListeners();
}

const ROLE_LABEL = { owner: 'SAHİP', admin: 'YÖNETİCİ', member: 'ÜYE' };

function decorateUserStrip() {
  const isStaff = currentUser.role === 'owner' || currentUser.role === 'admin';
  document.getElementById('userChip').innerHTML =
    `<strong>${escapeHtml(currentUser.name)}</strong> · ${ROLE_LABEL[currentUser.role] || ''}`;
  document.getElementById('adminLink').textContent = isStaff ? 'YÖNETİM' : 'HESAP';
  document.getElementById('btnLogout').addEventListener('click', RT.logout);
  document.getElementById('userStrip').hidden = false;
  btnSimulate.hidden = !features.dev_simulate;
  // Members cannot delete mail (the server enforces it too)
  btnDeleteEmail.hidden = !isStaff;
}

async function loadTemplates() {
  try {
    const res = await fetch(`${API_BASE}/templates`);
    if (res.ok) {
      const data = await res.json();
      availableTemplates = data.templates || [];
      if (composeTemplateSelect) {
        composeTemplateSelect.innerHTML =
          '<option value="">-- Şablon Seçin (İsteğe Bağlı) --</option>' +
          availableTemplates.map((t) => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');
      }
    }
  } catch (err) {
    console.warn('[Templates] Failed to load templates:', err);
  }
}

// 2. Service Worker Registration
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch((err) => {
        console.warn('[PWA SW] Service worker registration ignored:', err);
      });
    });
  }
}

function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

// 3. WebSocket Real-time Live Sync
function initWebSocket() {
  try {
    // The browser WebSocket API cannot set headers, so the short-lived JWT travels as a query parameter
    ws = new WebSocket(`${WS_URL}?token=${encodeURIComponent(RT.getToken())}`);

    ws.onopen = () => {
      console.log('[WS] Connected to Ramazanoğlu Tech Cloud Live Stream');
      statusPill.textContent = '● BULUT: CANLI BAĞLI';
      statusPill.classList.add('live');
      clearTimeout(reconnectTimer);
    };

    ws.onclose = () => {
      console.warn('[WS] Live Stream closed. Scheduling auto-reconnect...');
      statusPill.textContent = '○ BULUT: BAĞLANTI KOPTU';
      statusPill.classList.remove('live');
      scheduleReconnect();
    };

    ws.onerror = (err) => {
      console.error('[WS Error]:', err);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'EMAIL_RECEIVED') {
          handleIncomingRealtimeEmail(data.payload);
        } else if (data.type === 'EMAIL_SENT') {
          loadEmails();
        } else if (data.type === 'EMAIL_UPDATED') {
          loadEmails();
        }
      } catch (e) {
        console.error('Failed to parse WS frame:', e);
      }
    };
  } catch (err) {
    console.error('[WS Connection Error]:', err);
  }
}

// Reconnect only while the session is still valid: a disabled account or an ended session
// gets the sign-in screen (via the fetch wrapper) instead of a reconnect loop.
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

function handleIncomingRealtimeEmail(newEmail) {
  // Show browser desktop / mobile notification
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(`Yeni E-Posta [@ramazanoglu.tech]`, {
      body: `[${newEmail.alias_target}] ${newEmail.from_name || newEmail.from_address}: ${newEmail.subject}`,
      icon: './icon.svg',
    });
  }

  // Refresh current email list
  loadEmails();
}

// 4. Load Aliases
async function loadAliases() {
  try {
    const res = await fetch(`${API_BASE}/aliases`);
    const data = await res.json();
    aliases = data.aliases || [];
    renderAliasScroller();
    renderIdentitySelects();
  } catch (err) {
    console.error('Failed to load aliases:', err);
  }
}

function renderAliasScroller() {
  aliasScroller.innerHTML = '';

  const masterBtn = document.createElement('button');
  masterBtn.className = `alias-chip ${currentAliasFilter === 'all' ? 'active' : ''}`;
  masterBtn.textContent = currentUser && currentUser.role === 'owner' ? 'ALL TRAFFIC [MASTER]' : 'TÜM ERİŞİLEBİLİR';
  masterBtn.dataset.alias = 'all';
  masterBtn.onclick = () => selectAliasFilter('all');
  aliasScroller.appendChild(masterBtn);

  for (const a of aliases) {
    const chip = document.createElement('button');
    chip.className = `alias-chip ${currentAliasFilter === a.email ? 'active' : ''}`;
    chip.textContent = `${a.department_badge} ${a.email.split('@')[0]}`;
    chip.dataset.alias = a.email;
    chip.onclick = () => selectAliasFilter(a.email);
    aliasScroller.appendChild(chip);
  }
}

function selectAliasFilter(alias) {
  currentAliasFilter = alias;
  document.querySelectorAll('.alias-chip').forEach((c) => {
    c.classList.toggle('active', c.dataset.alias === alias);
  });
  loadEmails();
}

function renderIdentitySelects() {
  const optionsHtml = aliases
    .map((a) => `<option value="${escapeHtml(a.email)}">${escapeHtml(a.department_badge)} &lt;${escapeHtml(a.email)}&gt; — ${escapeHtml(a.display_name)}</option>`)
    .join('');

  replyFromSelect.innerHTML = optionsHtml;
  composeFromSelect.innerHTML = optionsHtml;
  updateComposeSignaturePreview();
}

function updateComposeSignaturePreview() {
  const selectedEmailAddr = composeFromSelect.value;
  const aliasObj = aliases.find((a) => a.email.toLowerCase() === selectedEmailAddr.toLowerCase());
  if (aliasObj && aliasObj.signature_html) {
    composeSignaturePreview.textContent = '';
    const sigFrame = document.createElement('iframe');
    sigFrame.setAttribute('sandbox', '');
    sigFrame.style.cssText = 'width:100%;height:140px;border:0;background:#fff;';
    sigFrame.srcdoc = aliasObj.signature_html;
    composeSignaturePreview.appendChild(sigFrame);
  } else {
    composeSignaturePreview.innerHTML = '<em>(İmza tanımlanmamış)</em>';
  }
}

// 5. Load Emails
async function loadEmails() {
  try {
    const params = new URLSearchParams();
    if (currentAliasFilter && currentAliasFilter !== 'all') {
      params.append('alias', currentAliasFilter);
    }
    if (currentCategoryFilter === 'unread') {
      params.append('unread', 'true');
    } else if (currentCategoryFilter === 'starred') {
      params.append('starred', 'true');
    } else if (currentCategoryFilter === 'sent') {
      params.append('direction', 'OUTBOUND');
    }
    if (currentSearchQuery.trim()) {
      params.append('search', currentSearchQuery.trim());
    }

    const res = await fetch(`${API_BASE}/emails?${params.toString()}`);
    const data = await res.json();
    emails = data.emails || [];
    renderEmailList(emails, data.total || 0);
  } catch (err) {
    console.error('Failed to load emails:', err);
    emailList.innerHTML = `<div class="empty-state">Bulut API bağlantısı kurulamadı. Sunucunun açık olduğundan emin olun.</div>`;
  }
}

function renderEmailList(items, total) {
  emailCountLabel.textContent = `${items.length} e-posta (Toplam: ${total})`;

  if (items.length === 0) {
    emailList.innerHTML = `<div class="empty-state">Bu filtreye uygun e-posta bulunamadı.</div>`;
    return;
  }

  emailList.innerHTML = items
    .map((item) => {
      const aliasObj = aliases.find((a) => a.email.toLowerCase() === item.alias_target.toLowerCase());
      const badge = aliasObj ? aliasObj.department_badge : '[RT]';
      const dateStr = formatDateTime(item.received_at);
      const isUnread = !item.is_read;

      return `
        <li class="email-item ${isUnread ? 'unread' : ''}" data-id="${escapeHtml(String(item.id))}">
          <div class="email-meta-row">
            <div>
              <span class="badge-tag">${escapeHtml(badge)}</span>
              <span class="sender-name">${escapeHtml(item.from_name || item.from_address)}</span>
            </div>
            <span class="time-stamp">${dateStr}</span>
          </div>
          <div class="email-subject">${escapeHtml(item.subject)}</div>
          <div class="email-snippet">${escapeHtml((item.body_text || '').substring(0, 90))}</div>
        </li>
      `;
    })
    .join('');

  // CSP forbids inline handlers: bind clicks here
  emailList.querySelectorAll('.email-item').forEach((li) => {
    li.addEventListener('click', () => window.openEmailDetail(li.dataset.id));
  });
}

// 6. Email Reading & Quick Reply
window.openEmailDetail = function (emailId) {
  const item = emails.find((e) => e.id === emailId);
  if (!item) return;

  selectedEmail = item;
  const aliasObj = aliases.find((a) => a.email.toLowerCase() === item.alias_target.toLowerCase());
  const badge = aliasObj ? aliasObj.department_badge : '[RT]';

  detailBadge.textContent = badge;
  detailAliasTarget.textContent = item.alias_target;
  detailSubject.textContent = item.subject;
  detailFrom.textContent = `${item.from_name ? item.from_name + ' ' : ''}<${item.from_address}>`;
  detailTo.textContent = (item.to_addresses || []).join(', ');
  detailDate.textContent = new Date(item.received_at).toLocaleString('tr-TR');
  detailMsgId.textContent = item.message_id;

  btnToggleStar.textContent = item.is_starred ? '★ YILDIZLI' : '☆ YILDIZLA';
  btnToggleRead.textContent = item.is_read ? 'OKUNMADI YAP' : 'OKUNDU İŞARETLE';

  // Body Content. Received HTML is attacker-controlled: render it in a fully sandboxed iframe
  // (no scripts, no same-origin access, no forms/popups) so it can never touch the admin session.
  detailBodyContent.textContent = '';
  const frame = document.createElement('iframe');
  frame.setAttribute('sandbox', '');
  frame.setAttribute('referrerpolicy', 'no-referrer');
  frame.style.cssText = 'width:100%;min-height:320px;border:0;background:#fff;';
  frame.srcdoc = item.body_html
    ? `<base target="_blank"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:">${item.body_html}`
    : `<pre style="font-family:sans-serif;white-space:pre-wrap;">${escapeHtml(item.body_text || '')}</pre>`;
  detailBodyContent.appendChild(frame);

  // Smart Identity Selector: Auto-select target alias in quick reply
  replyFromSelect.value = item.alias_target;

  // Prepare reply subject
  let replySubj = item.subject;
  if (!replySubj.startsWith('Re:')) {
    replySubj = `Re: ${replySubj}`;
  }
  replySubjectInput.value = replySubj;
  replyBodyInput.value = '';

  detailOverlay.classList.add('open');

  // Mark as read automatically
  if (!item.is_read) {
    updateStatus(item.id, { is_read: true });
    item.is_read = true;
  }
};

async function updateStatus(id, updates) {
  try {
    await fetch(`${API_BASE}/emails/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
  } catch (err) {
    console.error('Failed to update status:', err);
  }
}

// 7. Event Listeners Setup
function setupEventListeners() {
  // Search
  let searchTimeout;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      currentSearchQuery = e.target.value;
      loadEmails();
    }, 250);
  });

  // Filter segments
  filterSegmentBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      filterSegmentBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentCategoryFilter = btn.dataset.filter;
      loadEmails();
    });
  });

  // Detail actions
  btnCloseDetail.addEventListener('click', () => {
    detailOverlay.classList.remove('open');
    selectedEmail = null;
  });

  btnToggleStar.addEventListener('click', async () => {
    if (!selectedEmail) return;
    const newStar = !selectedEmail.is_starred;
    await updateStatus(selectedEmail.id, { is_starred: newStar });
    selectedEmail.is_starred = newStar;
    btnToggleStar.textContent = newStar ? '★ YILDIZLI' : '☆ YILDIZLA';
  });

  btnToggleRead.addEventListener('click', async () => {
    if (!selectedEmail) return;
    const newRead = !selectedEmail.is_read;
    await updateStatus(selectedEmail.id, { is_read: newRead });
    selectedEmail.is_read = newRead;
    btnToggleRead.textContent = newRead ? 'OKUNMADI YAP' : 'OKUNDU İŞARETLE';
  });

  btnDeleteEmail.addEventListener('click', async () => {
    if (!selectedEmail) return;
    if (confirm('Bu e-postayı bulut veritabanından kalıcı olarak silmek istiyor musunuz?')) {
      await fetch(`${API_BASE}/emails/${selectedEmail.id}`, { method: 'DELETE' });
      detailOverlay.classList.remove('open');
      selectedEmail = null;
      loadEmails();
    }
  });

  // Quick Reply
  btnSendReply.addEventListener('click', async () => {
    if (!selectedEmail) return;
    const replyText = replyBodyInput.value.trim();
    if (!replyText) {
      alert('Lütfen bir yanıt metni girin.');
      return;
    }

    const payload = {
      from_alias: replyFromSelect.value,
      to: [selectedEmail.from_address],
      subject: replySubjectInput.value.trim(),
      body_text: replyText,
      body_html: `<p>${escapeHtml(replyText).replace(/\n/g, '<br>')}</p>`,
      in_reply_to: selectedEmail.message_id,
      thread_id: selectedEmail.thread_id || selectedEmail.message_id,
    };

    btnSendReply.disabled = true;
    btnSendReply.textContent = 'GÖNDERİLİYOR...';

    try {
      const res = await fetch(`${API_BASE}/emails/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        alert(`${payload.from_alias} kimliğiyle yanıt bulut SMTP üzerinden başarıyla gönderildi.`);
        replyBodyInput.value = '';
        detailOverlay.classList.remove('open');
        loadEmails();
      } else {
        const errData = await res.json();
        alert(`Hata: ${errData.error || 'Gönderilemedi'}`);
      }
    } catch (e) {
      alert('Ağ hatası oluştu.');
    } finally {
      btnSendReply.disabled = false;
      btnSendReply.textContent = 'SMTP İLE YANITLA';
    }
  });

  // Compose Modal Handlers
  btnOpenCompose.addEventListener('click', () => {
    composeModal.classList.add('open');
  });

  const closeCompose = () => composeModal.classList.remove('open');
  btnCloseCompose.addEventListener('click', closeCompose);
  btnCancelCompose.addEventListener('click', closeCompose);

  composeFromSelect.addEventListener('change', updateComposeSignaturePreview);

  if (composeTemplateSelect) {
    composeTemplateSelect.addEventListener('change', () => {
      const selectedId = composeTemplateSelect.value;
      const tpl = availableTemplates.find((t) => t.id === selectedId);
      if (tpl) {
        composeSubjectInput.value = tpl.defaultSubject;
        composeBodyInput.value = tpl.htmlContent;
      }
    });
  }

  btnDispatchSend.addEventListener('click', async () => {
    const to = composeToInput.value.split(',').map((s) => s.trim()).filter(Boolean);
    const cc = composeCcInput.value.split(',').map((s) => s.trim()).filter(Boolean);
    const subject = composeSubjectInput.value.trim();
    const body = composeBodyInput.value.trim();

    if (to.length === 0) {
      alert('Lütfen en az bir alıcı (To) e-posta adresi girin.');
      return;
    }
    if (!subject) {
      alert('Lütfen bir konu girin.');
      return;
    }

    const isHtml = body.includes('<table') || body.includes('<div') || body.includes('<p');
    const payload = {
      from_alias: composeFromSelect.value,
      to,
      cc,
      subject,
      body_text: isHtml ? body.replace(/<[^>]*>/g, '') : body,
      body_html: isHtml ? body : `<p>${escapeHtml(body).replace(/\n/g, '<br>')}</p>`,
    };

    btnDispatchSend.disabled = true;
    btnDispatchSend.textContent = 'GÖNDERİLİYOR...';

    try {
      const res = await fetch(`${API_BASE}/emails/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        alert('Kurumsal e-posta başarıyla SMTP ile iletildi.');
        composeModal.classList.remove('open');
        composeToInput.value = '';
        composeCcInput.value = '';
        composeSubjectInput.value = '';
        composeBodyInput.value = '';
        loadEmails();
      } else {
        const err = await res.json();
        alert(`Hata: ${err.error}`);
      }
    } catch (e) {
      alert('Gönderim sırasında ağ hatası oluştu.');
    } finally {
      btnDispatchSend.disabled = false;
      btnDispatchSend.textContent = 'BULUT SMTP İLE GÖNDER';
    }
  });

  // Dev simulation: the endpoint only exists when the server runs with MOCK_MODE=true (404 otherwise)
  btnSimulate.addEventListener('click', async () => {
    const target = currentAliasFilter === 'all' ? 'info@ramazanoglu.tech' : currentAliasFilter;
    try {
      await fetch(`${API_BASE}/dev/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alias_target: target }),
      });
    } catch (e) {
      console.error(e);
    }
  });
}

// Helpers
function formatDateTime(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  if (isToday) return time;
  return `${d.getDate()}.${d.getMonth() + 1} ${time}`;
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Start App
window.addEventListener('DOMContentLoaded', initApp);
