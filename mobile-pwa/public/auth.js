// =============================================================================
// RAMAZANOĞLU TECH MAIL HQ - SHARED SESSION MODULE (login, forced password change, fetch wrapper)
// Loaded by index.html and admin.html. No credential lives in the client: each person signs in with
// their own account and gets a short-lived token kept in sessionStorage (gone when the tab closes).
// =============================================================================

(function () {
  'use strict';

  const TOKEN_KEY = 'rt_mailhq_token';
  const IS_LOCAL = /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);

  const API_BASE = IS_LOCAL ? `${window.location.protocol}//${window.location.hostname}:8765/api` : `${window.location.origin}/api`;
  const WS_URL = IS_LOCAL
    ? `ws://${window.location.hostname}:8765/ws`
    : `ws${window.location.protocol === 'https:' ? 's' : ''}://${window.location.host}/ws`;

  // ---- token storage -------------------------------------------------------
  function getToken() {
    try {
      return sessionStorage.getItem(TOKEN_KEY) || '';
    } catch (e) {
      return '';
    }
  }
  function setToken(token) {
    try {
      if (token) sessionStorage.setItem(TOKEN_KEY, token);
      else sessionStorage.removeItem(TOKEN_KEY);
    } catch (e) {
      /* storage unavailable (private mode): the session simply will not survive a reload */
    }
  }
  function logout() {
    setToken('');
    window.location.reload();
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ---- fetch wrapper -------------------------------------------------------
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async function (url, options) {
    const opts = options || {};
    const isApi = String(url).startsWith(API_BASE);
    if (!isApi) return nativeFetch(url, opts);

    const headers = new Headers(opts.headers || {});
    const token = getToken();
    if (token) headers.set('Authorization', 'Bearer ' + token);
    const res = await nativeFetch(url, Object.assign({}, opts, { headers: headers }));

    if (res.status === 401 && !String(url).includes('/auth/login')) {
      setToken('');
      showLogin('Oturum sona erdi. Lütfen tekrar giriş yapın.');
    } else if (res.status === 403) {
      const body = await res.clone().json().catch(function () { return {}; });
      if (body.code === 'PASSWORD_CHANGE_REQUIRED') showPasswordChange(true);
    }
    return res;
  };

  // ---- overlays ------------------------------------------------------------
  function mount(html) {
    const old = document.getElementById('authOverlay');
    if (old) old.remove();
    const el = document.createElement('div');
    el.id = 'authOverlay';
    el.className = 'auth-overlay';
    el.innerHTML = html;
    document.body.appendChild(el);
    return el;
  }

  const BRAND =
    '<div class="auth-brand">RAMAZANOĞLU TECH<span class="brand-dot"></span></div>' +
    '<div class="auth-sub">MAIL HQ</div>';

  function showLogin(message) {
    const el = mount(
      '<form class="auth-card" id="loginForm" novalidate>' +
        BRAND +
        '<label class="input-label" for="loginEmail">E-POSTA</label>' +
        '<input id="loginEmail" class="search-input" type="email" autocomplete="username" required>' +
        '<label class="input-label" for="loginPassword">PAROLA</label>' +
        '<input id="loginPassword" class="search-input" type="password" autocomplete="current-password" required>' +
        '<div class="auth-error" id="loginError" role="alert"></div>' +
        '<button type="submit" class="btn-primary auth-submit">GİRİŞ YAP</button>' +
        '</form>'
    );
    const err = el.querySelector('#loginError');
    if (message) err.textContent = message;
    el.querySelector('#loginEmail').focus();

    el.querySelector('#loginForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      err.textContent = '';
      const btn = el.querySelector('.auth-submit');
      btn.disabled = true;
      try {
        const res = await nativeFetch(API_BASE + '/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: el.querySelector('#loginEmail').value.trim(),
            password: el.querySelector('#loginPassword').value,
          }),
        });
        const data = await res.json().catch(function () { return {}; });
        if (res.ok && data.token) {
          setToken(data.token);
          if (data.must_change_password) showPasswordChange(true);
          else window.location.reload();
          return;
        }
        err.textContent = data.error || 'Giriş yapılamadı.';
      } catch (ex) {
        err.textContent = 'Sunucuya ulaşılamadı.';
      } finally {
        btn.disabled = false;
      }
    });
  }

  function showPasswordChange(forced) {
    const el = mount(
      '<form class="auth-card" id="pwForm" novalidate>' +
        BRAND +
        (forced
          ? '<p class="auth-note">Hesabınız için geçici bir parola belirlendi. Devam etmek için kendi parolanızı oluşturun.</p>'
          : '') +
        '<label class="input-label" for="pwCurrent">' + (forced ? 'GEÇİCİ / MEVCUT PAROLA' : 'MEVCUT PAROLA') + '</label>' +
        '<input id="pwCurrent" class="search-input" type="password" autocomplete="current-password" required>' +
        '<label class="input-label" for="pwNew">YENİ PAROLA (EN AZ 12 KARAKTER)</label>' +
        '<input id="pwNew" class="search-input" type="password" autocomplete="new-password" required>' +
        '<label class="input-label" for="pwNew2">YENİ PAROLA (TEKRAR)</label>' +
        '<input id="pwNew2" class="search-input" type="password" autocomplete="new-password" required>' +
        '<div class="auth-error" id="pwError" role="alert"></div>' +
        '<button type="submit" class="btn-primary auth-submit">PAROLAYI DEĞİŞTİR</button>' +
        '<button type="button" class="auth-link" id="pwLogout">Çıkış yap</button>' +
        '</form>'
    );
    const err = el.querySelector('#pwError');
    el.querySelector('#pwCurrent').focus();
    el.querySelector('#pwLogout').addEventListener('click', logout);

    el.querySelector('#pwForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      err.textContent = '';
      const next = el.querySelector('#pwNew').value;
      if (next !== el.querySelector('#pwNew2').value) {
        err.textContent = 'Yeni parolalar eşleşmiyor.';
        return;
      }
      if (next.length < 12) {
        err.textContent = 'Parola en az 12 karakter olmalı.';
        return;
      }
      const btn = el.querySelector('.auth-submit');
      btn.disabled = true;
      try {
        const res = await window.fetch(API_BASE + '/auth/change-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ current_password: el.querySelector('#pwCurrent').value, new_password: next }),
        });
        const data = await res.json().catch(function () { return {}; });
        if (res.ok && data.token) {
          setToken(data.token);
          window.location.reload();
          return;
        }
        err.textContent = data.error || 'Parola değiştirilemedi.';
      } catch (ex) {
        err.textContent = 'Sunucuya ulaşılamadı.';
      } finally {
        btn.disabled = false;
      }
    });
  }

  function showOffline() {
    const el = mount(
      '<div class="auth-card">' + BRAND +
        '<p class="auth-note">Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.</p>' +
        '<button type="button" class="btn-primary auth-submit" id="retryBtn">TEKRAR DENE</button></div>'
    );
    el.querySelector('#retryBtn').addEventListener('click', function () { window.location.reload(); });
  }

  // Resolves with { user, features } for a signed-in, fully set-up account.
  // When login or a password change is needed it shows that screen and never resolves.
  async function ensureSession() {
    const never = new Promise(function () {});
    if (!getToken()) {
      showLogin();
      return never;
    }
    let res;
    try {
      res = await nativeFetch(API_BASE + '/auth/me', { headers: { Authorization: 'Bearer ' + getToken() } });
    } catch (e) {
      showOffline();
      return never;
    }
    if (res.status === 401) {
      setToken('');
      showLogin('Oturum süresi doldu. Lütfen tekrar giriş yapın.');
      return never;
    }
    if (!res.ok) {
      showOffline();
      return never;
    }
    const me = await res.json();
    if (me.user.must_change_password) {
      showPasswordChange(true);
      return never;
    }
    return me;
  }

  window.RT = {
    API_BASE: API_BASE,
    WS_URL: WS_URL,
    getToken: getToken,
    setToken: setToken,
    logout: logout,
    ensureSession: ensureSession,
    showPasswordChange: showPasswordChange,
    escapeHtml: escapeHtml,
  };
})();
