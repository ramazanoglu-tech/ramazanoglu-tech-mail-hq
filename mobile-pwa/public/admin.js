// =============================================================================
// RAMAZANOĞLU TECH MAIL HQ - ADMIN PANEL
// Users & roles, mail identities, audit trail, own account. All authorization is enforced by the
// server; the checks below only decide what to show.
// =============================================================================

(async function () {
  'use strict';

  const esc = RT.escapeHtml;
  const ROLE_LABEL = { owner: 'SAHİP', admin: 'YÖNETİCİ', member: 'ÜYE' };

  // Shows the sign-in / forced password-change screen and never resolves until that is done
  const me = await RT.ensureSession();
  const user = me.user;
  const isOwner = user.role === 'owner';
  const isStaff = isOwner || user.role === 'admin';
  const canGrantAll = isOwner || (user.alias_access || []).includes('*');

  const state = {
    tab: isStaff ? 'users' : 'profile',
    users: [],
    aliases: [],
    audit: [],
    agent: { tokens: [], outbox: [] },
    editing: null, // user being edited, null = creating
  };

  const $ = (id) => document.getElementById(id);
  const content = $('tabContent');

  // ---- helpers -------------------------------------------------------------
  async function call(method, path, body) {
    const res = await fetch(RT.API_BASE + path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || 'İstek başarısız (' + res.status + ')');
      err.status = res.status;
      throw err;
    }
    return data;
  }

  let toastTimer;
  function toast(message, isError) {
    const t = $('toast');
    t.textContent = message;
    t.classList.toggle('error', !!isError);
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), isError ? 5000 : 2600);
  }

  const fmtDate = (iso) => (iso ? new Date(iso).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }) : null);
  const aliasByEmail = () => new Map(state.aliases.map((a) => [a.email.toLowerCase(), a]));
  const canManage = (u) => isOwner || (user.role === 'admin' && u.role === 'member');
  const prefix = (email) => email.split('@')[0];

  function accessChips(u) {
    if (u.role === 'owner' || (u.alias_access || []).includes('*')) return '<span class="chip all">TÜM KİMLİKLER</span>';
    const list = u.alias_access || [];
    if (list.length === 0) return '<span class="dim">Hiçbiri</span>';
    const map = aliasByEmail();
    const shown = list.slice(0, 4).map((a) => {
      const al = map.get(a.toLowerCase());
      return '<span class="chip">' + esc(al ? al.department_badge + ' ' : '') + esc(prefix(a)) + '</span>';
    });
    if (list.length > 4) shown.push('<span class="chip more">+' + (list.length - 4) + '</span>');
    return '<div class="chips">' + shown.join('') + '</div>';
  }

  // ---- data ----------------------------------------------------------------
  async function loadAliases() {
    state.aliases = (await call('GET', '/aliases')).aliases || [];
  }
  async function loadUsers() {
    state.users = (await call('GET', '/admin/users')).users || [];
  }
  async function loadAgent() {
    const [out, tok] = await Promise.all([
      call('GET', '/agent/outbox'),
      isOwner ? call('GET', '/agent/tokens') : Promise.resolve({ tokens: [] }),
    ]);
    state.agent = { outbox: out.items || [], tokens: tok.tokens || [] };
  }
  async function loadAudit() {
    state.audit = (await call('GET', '/admin/audit?limit=200')).entries || [];
  }

  // ---- shell ---------------------------------------------------------------
  function renderShell() {
    $('adminIdentity').innerHTML =
      '<h1>' + (isStaff ? 'Yönetim' : 'Hesabım') + '</h1>' +
      '<div class="who">' + esc(user.name) + ' · ' + esc(user.email) + ' · [' + ROLE_LABEL[user.role] + ']</div>';
    $('brandSub').textContent = isStaff ? 'MAIL HQ // YÖNETİM' : 'MAIL HQ // HESAP';

    const tabs = isStaff
      ? [['users', 'KULLANICILAR'], ['aliases', 'KİMLİKLER'], ['agents', 'AJANLAR'], ['audit', 'DENETİM KAYDI'], ['profile', 'HESABIM']]
      : [['profile', 'HESABIM']];
    $('adminTabs').innerHTML = tabs
      .map(
        ([id, label]) =>
          '<button class="admin-tab" role="tab" id="tab-' + id + '" data-tab="' + id + '" aria-selected="' +
          (state.tab === id) + '" tabindex="' + (state.tab === id ? 0 : -1) + '">' + label + '</button>'
      )
      .join('');
  }

  async function show(tab) {
    state.tab = tab;
    renderShell();
    content.innerHTML = '<div class="empty-state">Yükleniyor...</div>';
    try {
      if (tab === 'users') await Promise.all([loadAliases(), loadUsers()]);
      if (tab === 'aliases') await Promise.all([loadAliases(), loadUsers()]);
      if (tab === 'audit') await loadAudit();
      if (tab === 'agents') await Promise.all([loadAliases(), loadAgent()]);
      if (tab === 'profile') await loadAliases();
    } catch (e) {
      content.innerHTML = '<div class="empty-state">' + esc(e.message) + '</div>';
      return;
    }
    render();
  }

  function render() {
    if (state.tab === 'users') content.innerHTML = usersHtml();
    else if (state.tab === 'aliases') content.innerHTML = aliasesHtml();
    else if (state.tab === 'audit') content.innerHTML = auditHtml();
    else if (state.tab === 'agents') content.innerHTML = agentsHtml();
    else content.innerHTML = profileHtml();
  }

  // ---- users tab -----------------------------------------------------------
  function usersHtml() {
    const rows = state.users
      .map((u) => {
        const self = u.id === user.id;
        const tags = [
          u.is_active ? '<span class="status-tag on">AKTİF</span>' : '<span class="status-tag off">PASİF</span>',
          u.must_change_password ? '<span class="status-tag warn">PAROLA BEKLİYOR</span>' : '',
        ].join(' ');
        return (
          '<tr class="' + (u.is_active ? '' : 'is-disabled') + '">' +
          '<td data-label="KULLANICI"><div class="cell-main">' + esc(u.name) + (self ? ' <span class="status-tag">SİZ</span>' : '') +
          '</div><div class="cell-sub">' + esc(u.email) + '</div></td>' +
          '<td data-label="ROL"><span class="role-badge ' + esc(u.role) + '">[' + ROLE_LABEL[u.role] + ']</span></td>' +
          '<td data-label="KİMLİK ERİŞİMİ">' + accessChips(u) + '</td>' +
          '<td data-label="DURUM">' + tags + '</td>' +
          '<td data-label="SON GİRİŞ" class="mono">' + (fmtDate(u.last_login_at) || '<span class="dim">Hiç girmedi</span>') + '</td>' +
          '<td class="right">' +
          (canManage(u) || self
            ? '<button class="btn-icon btn-small" data-action="user-edit" data-id="' + esc(u.id) + '">DÜZENLE</button>'
            : '') +
          '</td></tr>'
        );
      })
      .join('');

    return (
      '<div class="admin-toolbar"><span class="count">' + state.users.length + ' KULLANICI</span>' +
      '<button class="btn-primary" data-action="user-new">+ YENİ KULLANICI</button></div>' +
      '<div class="table-wrap"><table class="admin-table"><thead><tr>' +
      '<th>KULLANICI</th><th>ROL</th><th>KİMLİK ERİŞİMİ</th><th>DURUM</th><th>SON GİRİŞ</th><th></th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>'
    );
  }

  // ---- user modal ----------------------------------------------------------
  let lastFocus = null;

  function openModal(id) {
    lastFocus = document.activeElement;
    $(id).classList.add('open');
  }
  function closeModals() {
    document.querySelectorAll('.modal-overlay.open').forEach((m) => m.classList.remove('open'));
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function syncAccessUi() {
    const role = $('fRole').value;
    const isOwnerRole = role === 'owner';
    $('accessGroup').hidden = isOwnerRole;
    $('roleHint').textContent = isOwnerRole
      ? 'Sahip tüm kimliklere ve tüm yönetim işlemlerine erişir.'
      : role === 'admin'
        ? 'Yönetici üye hesapları oluşturur ve yönetir; kendi erişimi olan kimlikleri atayabilir.'
        : '';
    $('aliasChecks').classList.toggle('is-disabled', $('fAll').checked);
  }

  function renderAliasChecks(selected, filter) {
    const q = (filter || '').toLowerCase();
    const list = state.aliases.filter((a) => !q || a.email.toLowerCase().includes(q) || a.department_badge.toLowerCase().includes(q));
    $('aliasChecks').innerHTML = list.length
      ? list
          .map(
            (a) =>
              '<label class="check-row"><input type="checkbox" value="' + esc(a.email) + '"' +
              (selected.has(a.email.toLowerCase()) ? ' checked' : '') + '> <span class="badge-tag">' +
              esc(a.department_badge) + '</span> <span>' + esc(a.email) + '</span></label>'
          )
          .join('')
      : '<div class="none">Kimlik bulunamadı</div>';
  }

  let selectedAliases = new Set();

  function openUserModal(u) {
    state.editing = u;
    const self = !!u && u.id === user.id;
    $('userModalTitle').textContent = u ? 'KULLANICIYI DÜZENLE' : 'YENİ KULLANICI';
    $('fName').value = u ? u.name : '';
    $('fEmail').value = u ? u.email : '';
    $('fEmail').disabled = !!u;

    const roleSel = $('fRole');
    roleSel.value = u ? u.role : 'member';
    roleSel.querySelector('[value="admin"]').disabled = !isOwner;
    roleSel.querySelector('[value="owner"]').disabled = !isOwner;
    roleSel.disabled = !isOwner || self;

    $('fAll').closest('label').hidden = !canGrantAll;
    $('fAll').checked = !!u && (u.alias_access || []).includes('*');
    selectedAliases = new Set((u ? u.alias_access || [] : []).map((a) => a.toLowerCase()));
    $('fAliasFilter').value = '';
    renderAliasChecks(selectedAliases, '');

    const visible = new Set(state.aliases.map((a) => a.email.toLowerCase()));
    const hidden = u ? (u.alias_access || []).filter((a) => a !== '*' && !visible.has(a.toLowerCase())).length : 0;
    $('accessLabel').textContent =
      'KİMLİK ERİŞİMİ (HANGİ ADRESLERİN POSTASINI GÖRÜR / OLARAK GÖNDERİR)' +
      (hidden ? ' · SİZİN GÖREMEDİĞİNİZ ' + hidden + ' KİMLİK KAYDEDİNCE KALDIRILIR' : '');

    $('activeRow').hidden = !u || self;
    $('fActive').checked = u ? u.is_active : true;
    $('btnResetPw').hidden = !u || self;
    $('userFormError').textContent = '';
    $('btnSaveUser').textContent = u ? 'KAYDET' : 'KULLANICI OLUŞTUR';
    syncAccessUi();
    openModal('userModal');
    $('fName').focus();
  }

  async function submitUserForm(e) {
    e.preventDefault();
    const err = $('userFormError');
    err.textContent = '';
    const name = $('fName').value.trim();
    const email = $('fEmail').value.trim();
    const role = $('fRole').value;
    if (!name) return void (err.textContent = 'Ad soyad gerekli.');
    if (!state.editing && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return void (err.textContent = 'Geçerli bir e-posta girin.');

    const access = $('fAll').checked
      ? ['*']
      : Array.from($('aliasChecks').querySelectorAll('input:checked')).map((i) => i.value).concat(
          // keep ticks that the filter currently hides
          Array.from(selectedAliases).filter((a) => !$('aliasChecks').querySelector('input[value="' + CSS.escape(a) + '"]') && state.aliases.some((x) => x.email.toLowerCase() === a))
        );
    const uniqueAccess = Array.from(new Set(access));

    const btn = $('btnSaveUser');
    btn.disabled = true;
    try {
      if (state.editing) {
        const body = { name };
        if (isOwner && state.editing.id !== user.id && role !== state.editing.role) body.role = role;
        if (!$('activeRow').hidden) body.is_active = $('fActive').checked;
        if (role !== 'owner') body.alias_access = uniqueAccess;
        const res = await call('PATCH', '/admin/users/' + encodeURIComponent(state.editing.id), body);
        const i = state.users.findIndex((x) => x.id === res.user.id);
        if (i >= 0) state.users[i] = res.user;
        closeModals();
        render();
        toast('Kullanıcı güncellendi');
      } else {
        const res = await call('POST', '/admin/users', { name, email, role, alias_access: role === 'owner' ? [] : uniqueAccess });
        state.users.push(res.user);
        closeModals();
        render();
        showSecret(res.user, res.temp_password);
      }
    } catch (ex) {
      err.textContent = ex.message;
    } finally {
      btn.disabled = false;
    }
  }

  async function resetPassword() {
    const u = state.editing;
    if (!u) return;
    if (!window.confirm(u.name + ' için parola sıfırlansın mı?\n\nTüm açık oturumları hemen sonlanır ve yeni bir geçici parola üretilir.')) return;
    try {
      const res = await call('POST', '/admin/users/' + encodeURIComponent(u.id) + '/reset-password');
      const i = state.users.findIndex((x) => x.id === res.user.id);
      if (i >= 0) state.users[i] = res.user;
      closeModals();
      render();
      showSecret(res.user, res.temp_password);
    } catch (ex) {
      $('userFormError').textContent = ex.message;
    }
  }

  // ---- one-time temporary password ------------------------------------------
  function showSecret(u, password) {
    $('secretWho').textContent = u.name + ' (' + u.email + ') için geçici parola:';
    $('secretValue').textContent = password;
    openModal('secretModal');
    $('secretValue').focus();
  }

  async function copySecret() {
    const text = $('secretValue').textContent;
    try {
      await navigator.clipboard.writeText(text);
      toast('Panoya kopyalandı');
    } catch (e) {
      const range = document.createRange();
      range.selectNodeContents($('secretValue'));
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      toast('Seçildi: Ctrl/Cmd+C ile kopyalayın');
    }
  }

  function showToken(name, token) {
    $('secretTitle').textContent = 'AJAN TOKEN\'I';
    $('secretWho').textContent = '"' + name + '" için erişim token\'ı:';
    $('secretValue').textContent = token;
    $('secretWarn').textContent = 'Bu token yalnızca şimdi gösterilir; sunucuda yalnızca özeti saklanır. Ajan yapılandırmasına yapıştırın ve başka yere yazmayın. Sızdığından şüphelenirseniz AJANLAR sekmesinden hemen iptal edin.';
    openModal('secretModal');
    $('secretValue').focus();
  }

  function closeSecret() {
    $('secretTitle').textContent = 'GEÇİCİ PAROLA';
    $('secretWarn').textContent = 'Bu parola yalnızca şimdi gösterilir ve sunucuda düz metin olarak saklanmaz. Kullanıcıya güvenli bir kanaldan iletin. İlk girişte kendi parolasını belirlemek zorunda kalacak.';
    $('secretValue').textContent = ''; // do not leave it in the DOM
    closeModals();
  }

  // ---- identities tab ------------------------------------------------------
  function aliasesHtml() {
    const domain = (state.aliases[0] ? state.aliases[0].email : 'x@ramazanoglu.tech').split('@')[1];
    const holders = (email) => {
      const names = state.users
        .filter((u) => u.is_active && (u.role === 'owner' || (u.alias_access || []).includes('*') || (u.alias_access || []).map((a) => a.toLowerCase()).includes(email.toLowerCase())))
        .map((u) => u.name);
      if (names.length === 0) return '<span class="dim">Kimse</span>';
      const chips = names.slice(0, 4).map((n) => '<span class="chip">' + esc(n) + '</span>');
      if (names.length > 4) chips.push('<span class="chip more">+' + (names.length - 4) + '</span>');
      return '<div class="chips">' + chips.join('') + '</div>';
    };

    const rows = state.aliases
      .map(
        (a) =>
          '<tr><td data-label="ROZET"><span class="badge-tag">' + esc(a.department_badge) + '</span></td>' +
          '<td data-label="ADRES"><div class="cell-main">' + esc(a.email) + '</div></td>' +
          '<td data-label="GÖRÜNEN AD">' + esc(a.display_name) + '</td>' +
          '<td data-label="ERİŞİMİ OLANLAR">' + holders(a.email) + '</td></tr>'
      )
      .join('');

    return (
      '<form class="panel" id="aliasForm" novalidate data-domain="' + esc(domain) + '"><h2>YENİ KİMLİK (GÖNDERİM ADRESİ)</h2>' +
      '<div class="form-grid">' +
      '<div class="input-group"><label class="input-label" for="aPrefix">ADRES</label><div class="inline-field">' +
      '<input id="aPrefix" class="search-input" type="text" maxlength="64" placeholder="ornek" autocomplete="off" required>' +
      '<span class="suffix">@' + esc(domain) + '</span></div></div>' +
      '<div class="input-group"><label class="input-label" for="aName">GÖRÜNEN AD</label>' +
      '<input id="aName" class="search-input" type="text" maxlength="120" placeholder="Ramazanoğlu Tech • Örnek" autocomplete="off"></div>' +
      '<div class="input-group"><label class="input-label" for="aBadge">ROZET</label>' +
      '<input id="aBadge" class="search-input" type="text" maxlength="40" placeholder="[ÖRNEK]" autocomplete="off"></div>' +
      '</div><div class="form-error" id="aliasError" role="alert"></div>' +
      '<div class="admin-toolbar"><span class="field-hint">Yeni kimlik oluşturulunca kullanıcılara ayrıca erişim vermeniz gerekir.</span>' +
      '<button class="btn-primary" type="submit">KİMLİK EKLE</button></div></form>' +
      '<div class="admin-toolbar"><span class="count">' + state.aliases.length + ' KİMLİK</span></div>' +
      '<div class="table-wrap"><table class="admin-table"><thead><tr><th>ROZET</th><th>ADRES</th><th>GÖRÜNEN AD</th><th>ERİŞİMİ OLANLAR</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div>'
    );
  }

  async function submitAliasForm(e) {
    e.preventDefault();
    const form = e.target;
    const err = $('aliasError');
    err.textContent = '';
    const local = $('aPrefix').value.trim().toLowerCase();
    if (!/^[a-z0-9._-]{1,64}$/.test(local)) return void (err.textContent = 'Adres yalnızca harf, rakam, nokta, tire ve alt çizgi içerebilir.');
    try {
      await call('POST', '/aliases', {
        email: local + '@' + form.dataset.domain,
        display_name: $('aName').value.trim() || undefined,
        department_badge: $('aBadge').value.trim() || undefined,
      });
      await Promise.all([loadAliases(), loadUsers()]);
      render();
      toast('Kimlik eklendi');
    } catch (ex) {
      err.textContent = ex.message;
    }
  }

  // ---- agents tab (AI access: send approvals + tokens) ----------------------
  const STATUS_LABEL = { pending: 'ONAY BEKLİYOR', sending: 'GÖNDERİLİYOR', sent: 'GÖNDERİLDİ', rejected: 'REDDEDİLDİ', failed: 'BAŞARISIZ' };

  function agentsHtml() {
    const pending = state.agent.outbox.filter((i) => i.status === 'pending');
    const done = state.agent.outbox.filter((i) => i.status !== 'pending').slice(0, 15);

    const card = (i, actions) =>
      '<div class="proposal">' +
      '<div class="proposal-head"><span class="status-tag ' + (i.status === 'sent' ? 'on' : i.status === 'pending' ? 'warn' : 'off') + '">' + esc(STATUS_LABEL[i.status] || i.status) + '</span> ' +
      '<span class="cell-sub">' + esc(fmtDate(i.created_at) || '') + ' · ' + esc(i.requested_by) + '</span></div>' +
      '<dl class="profile-list proposal-meta"><dt>GÖNDEREN</dt><dd>' + esc(i.from_alias) + '</dd>' +
      '<dt>ALICI</dt><dd>' + esc(i.to_addresses.join(', ')) + '</dd>' +
      (i.cc_addresses.length ? '<dt>CC</dt><dd>' + esc(i.cc_addresses.join(', ')) + '</dd>' : '') +
      '<dt>KONU</dt><dd><strong>' + esc(i.subject) + '</strong></dd></dl>' +
      '<pre class="proposal-body">' + esc(i.body_text) + '</pre>' +
      (i.error ? '<div class="form-error">' + esc(i.error) + '</div>' : '') +
      (actions ? '<div class="admin-toolbar">' + actions + '</div>' : '') +
      '</div>';

    const pendingHtml = pending.length
      ? pending
          .map((i) =>
            card(
              i,
              '<span class="field-hint">Onaylarsanız bu metin aynen gönderilir.</span><span class="footer-right">' +
                '<button class="btn-secondary" data-action="agent-reject" data-id="' + esc(i.id) + '">REDDET</button> ' +
                '<button class="btn-primary" data-action="agent-approve" data-id="' + esc(i.id) + '">ONAYLA VE GÖNDER</button></span>'
            )
          )
          .join('')
      : '<div class="empty-state">Onay bekleyen gönderim yok.</div>';

    let html =
      '<div class="admin-toolbar"><span class="count">' + pending.length + ' ONAY BEKLİYOR</span>' +
      '<button class="btn-icon" data-action="agent-refresh">YENİLE</button></div>' + pendingHtml;

    if (done.length) {
      html += '<div class="admin-toolbar"><span class="count">SON İŞLEMLER</span></div>' + done.map((i) => card(i, '')).join('');
    }

    if (isOwner) {
      const checks = state.aliases
        .map((a) => '<label class="check-row"><input type="checkbox" name="tAlias" value="' + esc(a.email) + '"> <span><span class="badge-tag">' + esc(a.department_badge) + '</span> ' + esc(a.email) + '</span></label>')
        .join('');
      const tokenRows = state.agent.tokens
        .map((t) => {
          const live = !t.revoked_at && new Date(t.expires_at).getTime() > Date.now();
          return (
            '<tr class="' + (live ? '' : 'is-disabled') + '"><td data-label="AD"><div class="cell-main">' + esc(t.name) + '</div><div class="cell-sub">' + esc(t.created_by) + '</div></td>' +
            '<td data-label="KAPSAM">' + accessChips({ role: 'member', alias_access: t.alias_scope }) + '</td>' +
            '<td data-label="BİTİŞ" class="mono">' + esc(fmtDate(t.expires_at) || '') + '</td>' +
            '<td data-label="SON KULLANIM" class="mono">' + esc(fmtDate(t.last_used_at) || '—') + '</td>' +
            '<td data-label="DURUM">' + (t.revoked_at ? '<span class="status-tag off">İPTAL</span>' : live ? '<span class="status-tag on">AKTİF</span>' : '<span class="status-tag off">SÜRESİ DOLDU</span>') + '</td>' +
            '<td data-label="">' + (live ? '<button class="btn-danger" data-action="token-revoke" data-id="' + esc(t.id) + '">İPTAL ET</button>' : '') + '</td></tr>'
          );
        })
        .join('');
      html +=
        '<form class="panel" id="tokenForm" novalidate><h2>YENİ AJAN ERİŞİMİ (MCP TOKEN)</h2>' +
        '<div class="form-grid">' +
        '<div class="input-group"><label class="input-label" for="tName">AD (ÖR. CLAUDE)</label><input id="tName" class="search-input" type="text" maxlength="100" autocomplete="off" required></div>' +
        '<div class="input-group"><label class="input-label" for="tDays">GEÇERLİLİK</label><select id="tDays" class="select-input"><option value="30">30 gün</option><option value="90" selected>90 gün</option><option value="365">365 gün</option></select></div>' +
        '</div><div class="input-group"><span class="input-label">HANGİ KİMLİKLERİN POSTASINI GÖREBİLİR</span>' +
        '<label class="check-row check-all"><input type="checkbox" id="tAll"> <span>Tüm kimlikler</span></label>' +
        '<div class="check-list" id="tChecks">' + checks + '</div></div>' +
        '<div class="form-error" id="tokenError" role="alert"></div>' +
        '<div class="admin-toolbar"><span class="field-hint">Ajan posta okuyabilir ve gönderim önerebilir; silemez, onayınız olmadan gönderemez.</span>' +
        '<button class="btn-primary" type="submit">TOKEN OLUŞTUR</button></div></form>' +
        '<div class="admin-toolbar"><span class="count">' + state.agent.tokens.length + ' TOKEN</span></div>' +
        (state.agent.tokens.length
          ? '<div class="table-wrap"><table class="admin-table"><thead><tr><th>AD</th><th>KAPSAM</th><th>BİTİŞ</th><th>SON KULLANIM</th><th>DURUM</th><th></th></tr></thead><tbody>' + tokenRows + '</tbody></table></div>'
          : '<div class="empty-state">Henüz token yok.</div>');
    }
    return html;
  }

  async function agentDecide(id, kind) {
    const item = state.agent.outbox.find((i) => i.id === id);
    if (!item) return;
    if (kind === 'approve' && !window.confirm('Bu e-posta ' + item.to_addresses.join(', ') + ' adresine ' + item.from_alias + ' kimliğiyle gönderilecek. Onaylıyor musunuz?')) return;
    try {
      await call('POST', '/agent/outbox/' + encodeURIComponent(id) + '/' + kind, kind === 'reject' ? { reason: 'Yönetici reddetti' } : {});
      toast(kind === 'approve' ? 'Gönderildi' : 'Reddedildi');
    } catch (ex) {
      toast(ex.message, true);
    }
    await show('agents');
  }

  async function submitTokenForm(e) {
    e.preventDefault();
    const err = $('tokenError');
    err.textContent = '';
    const name = $('tName').value.trim();
    const all = $('tAll').checked;
    const aliases = all ? ['*'] : Array.from(document.querySelectorAll('input[name="tAlias"]:checked')).map((c) => c.value);
    if (!name) return void (err.textContent = 'Bir ad girin.');
    if (aliases.length === 0) return void (err.textContent = 'En az bir kimlik seçin veya "Tüm kimlikler"i işaretleyin.');
    try {
      const res = await call('POST', '/agent/tokens', { name, aliases, days: Number($('tDays').value) });
      showToken(res.record.name, res.token);
      await show('agents');
    } catch (ex) {
      err.textContent = ex.message;
    }
  }

  async function revokeToken(id) {
    if (!window.confirm('Bu token iptal edilsin mi? Kullanan ajanın erişimi hemen kesilir.')) return;
    try {
      await call('DELETE', '/agent/tokens/' + encodeURIComponent(id));
      toast('Token iptal edildi');
    } catch (ex) {
      toast(ex.message, true);
    }
    await show('agents');
  }

  // ---- audit tab -----------------------------------------------------------
  const ACTIONS = {
    login: 'Giriş yaptı',
    login_failed: 'Hatalı giriş denemesi',
    login_locked: 'Kilitli hesaba giriş denemesi',
    login_blocked_disabled: 'Pasif hesapla giriş denemesi',
    password_changed: 'Parolasını değiştirdi',
    password_change_failed: 'Parola değiştirme reddedildi',
    user_create: 'Kullanıcı oluşturdu',
    user_update: 'Kullanıcıyı güncelledi',
    user_password_reset: 'Parola sıfırladı',
    alias_create: 'Kimlik oluşturdu',
    email_send: 'E-posta gönderdi',
    email_delete: 'E-posta sildi',
    send_denied: 'Gönderim reddedildi',
    agent_token_create: 'Ajan token\'ı oluşturdu',
    agent_token_revoke: 'Ajan token\'ını iptal etti',
    outbox_approve: 'Ajan önerisini onayladı (gönderildi)',
    outbox_reject: 'Ajan önerisini reddetti',
    outbox_send_failed: 'Onaylanan öneri gönderilemedi',
    outbox_approve_denied: 'Öneri onayı reddedildi',
    mcp_mail_list: 'Ajan: posta listeledi',
    mcp_mail_read: 'Ajan: mesaj okudu',
    mcp_mail_stats: 'Ajan: istatistik okudu',
    mcp_mail_mark: 'Ajan: mesajı işaretledi',
    mcp_propose_send: 'Ajan: gönderim önerdi',
  };
  const FAILURES = new Set(['login_failed', 'login_locked', 'login_blocked_disabled', 'password_change_failed', 'send_denied']);
  const FIELD = { name: 'ad', role: 'rol', alias_access: 'kimlik erişimi', is_active: 'durum' };

  function auditHtml() {
    const rows = state.audit
      .map((e) => {
        const changes = e.details && e.details.changes ? Object.keys(e.details.changes).map((k) => FIELD[k] || k).join(', ') : '';
        return (
          '<tr><td data-label="ZAMAN" class="mono">' + esc(fmtDate(e.created_at) || '') + '</td>' +
          '<td data-label="KULLANICI"><div class="cell-sub">' + esc(e.user_email) + '</div></td>' +
          '<td data-label="İŞLEM" class="' + (FAILURES.has(e.action) ? 'audit-fail' : '') + '">' + esc(ACTIONS[e.action] || e.action) + '</td>' +
          '<td data-label="HEDEF"><div class="cell-sub">' + esc(e.target || '') + (changes ? ' · ' + esc(changes) : '') + '</div></td>' +
          '<td data-label="IP" class="mono">' + esc(e.ip || '') + '</td></tr>'
        );
      })
      .join('');
    return (
      '<div class="admin-toolbar"><span class="count">SON ' + state.audit.length + ' KAYIT</span>' +
      '<button class="btn-icon" data-action="audit-refresh">YENİLE</button></div>' +
      (state.audit.length
        ? '<div class="table-wrap"><table class="admin-table"><thead><tr><th>ZAMAN</th><th>KULLANICI</th><th>İŞLEM</th><th>HEDEF</th><th>IP</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
        : '<div class="empty-state">Henüz kayıt yok.</div>')
    );
  }

  // ---- profile tab ---------------------------------------------------------
  function profileHtml() {
    return (
      '<div class="panel"><h2>HESAP BİLGİLERİ</h2><dl class="profile-list">' +
      '<dt>AD SOYAD</dt><dd>' + esc(user.name) + '</dd>' +
      '<dt>GİRİŞ E-POSTASI</dt><dd>' + esc(user.email) + '</dd>' +
      '<dt>ROL</dt><dd><span class="role-badge ' + esc(user.role) + '">[' + ROLE_LABEL[user.role] + ']</span></dd>' +
      '<dt>KİMLİK ERİŞİMİ</dt><dd>' + accessChips(user) + '</dd></dl></div>' +
      '<form class="panel" id="profilePwForm" novalidate><h2>PAROLAYI DEĞİŞTİR</h2>' +
      '<input type="text" name="username" value="' + esc(user.email) + '" autocomplete="username" hidden>' +
      '<div class="form-grid">' +
      '<div class="input-group"><label class="input-label" for="cpCurrent">MEVCUT PAROLA</label><input id="cpCurrent" class="search-input" type="password" autocomplete="current-password" required></div>' +
      '<div class="input-group"><label class="input-label" for="cpNew">YENİ PAROLA (EN AZ 12 KARAKTER)</label><input id="cpNew" class="search-input" type="password" autocomplete="new-password" required></div>' +
      '<div class="input-group"><label class="input-label" for="cpNew2">YENİ PAROLA (TEKRAR)</label><input id="cpNew2" class="search-input" type="password" autocomplete="new-password" required></div>' +
      '</div><div class="form-error" id="cpError" role="alert"></div>' +
      '<div class="admin-toolbar"><span class="field-hint">Değiştirince diğer cihazlardaki oturumlarınız sonlanır.</span>' +
      '<button class="btn-primary" type="submit">PAROLAYI DEĞİŞTİR</button></div></form>'
    );
  }

  async function submitPasswordForm(e) {
    e.preventDefault();
    const err = $('cpError');
    err.textContent = '';
    const next = $('cpNew').value;
    if (next !== $('cpNew2').value) return void (err.textContent = 'Yeni parolalar eşleşmiyor.');
    if (next.length < 12) return void (err.textContent = 'Parola en az 12 karakter olmalı.');
    try {
      const res = await call('POST', '/auth/change-password', { current_password: $('cpCurrent').value, new_password: next });
      RT.setToken(res.token);
      e.target.reset();
      toast('Parola değiştirildi');
    } catch (ex) {
      err.textContent = ex.message;
    }
  }

  // ---- events (CSP forbids inline handlers: everything is delegated) --------
  document.addEventListener('click', (ev) => {
    const tab = ev.target.closest('[data-tab]');
    if (tab) return void show(tab.dataset.tab);

    const el = ev.target.closest('[data-action]');
    if (!el) return;
    switch (el.dataset.action) {
      case 'user-new': return openUserModal(null);
      case 'user-edit': return openUserModal(state.users.find((u) => u.id === el.dataset.id) || null);
      case 'reset-password': return void resetPassword();
      case 'close-modal': return closeModals();
      case 'close-secret': return closeSecret();
      case 'audit-refresh': return void show('audit');
      case 'agent-refresh': return void show('agents');
      case 'agent-approve': return void agentDecide(el.dataset.id, 'approve');
      case 'agent-reject': return void agentDecide(el.dataset.id, 'reject');
      case 'token-revoke': return void revokeToken(el.dataset.id);
    }
  });

  document.addEventListener('submit', (ev) => {
    if (ev.target.id === 'userForm') submitUserForm(ev);
    else if (ev.target.id === 'aliasForm') submitAliasForm(ev);
    else if (ev.target.id === 'profilePwForm') submitPasswordForm(ev);
    else if (ev.target.id === 'tokenForm') submitTokenForm(ev);
  });

  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && $('secretModal').classList.contains('open')) return closeSecret();
    if (ev.key === 'Escape') closeModals();
    // arrow keys move between tabs
    if ((ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') && ev.target.matches && ev.target.matches('.admin-tab')) {
      const tabs = Array.from(document.querySelectorAll('.admin-tab'));
      const i = tabs.indexOf(ev.target);
      const next = tabs[(i + (ev.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      next.focus();
      show(next.dataset.tab);
    }
  });

  $('fRole').addEventListener('change', syncAccessUi);
  $('fAll').addEventListener('change', syncAccessUi);
  $('aliasChecks').addEventListener('change', (ev) => {
    if (ev.target.type !== 'checkbox') return;
    const v = ev.target.value.toLowerCase();
    if (ev.target.checked) selectedAliases.add(v);
    else selectedAliases.delete(v);
  });
  $('fAliasFilter').addEventListener('input', (ev) => renderAliasChecks(selectedAliases, ev.target.value));
  $('btnCopySecret').addEventListener('click', copySecret);
  $('btnLogout').addEventListener('click', RT.logout);

  // ---- go --------------------------------------------------------------------
  show(state.tab);
})();
