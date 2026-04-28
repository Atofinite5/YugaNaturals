// Shared header UI: search overlay, profile dropdown, auth + account modal.
// Loaded on every page after api.js. Markup is injected once per page.
(function () {
  function el(tag, attrs = {}, html) {
    const e = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'class') e.className = v;
      else if (k === 'hidden' && v) e.hidden = true;
      else e.setAttribute(k, v);
    });
    if (html != null) e.innerHTML = html;
    return e;
  }

  // ─────────────────────── INLINE SEARCH BAR (slides down) ──────────────────
  function mountSearch() {
    if (document.getElementById('searchBar')) return;
    const bar = el('div', { id: 'searchBar', class: 'search-bar', hidden: true }, `
      <div class="search-bar-inner">
        <div class="search-bar-row">
          <div class="search-bar-input">
            <input type="search" id="searchOverlayInput"
                   placeholder="आवडते तेल शोधा — नारळ, मोहरी, तीळ…"
                   autocomplete="off"/>
            <svg class="search-bar-icon" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="1.8"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="6.5"/>
              <line x1="16" y1="16" x2="20.5" y2="20.5"/>
            </svg>
          </div>
          <button class="search-bar-close" id="searchClose" aria-label="बंद करा">✕</button>
        </div>
        <div class="search-results" id="searchResults"></div>
      </div>
    `);
    // Slide it in below the announce bar so the header pushes down naturally.
    const anchor = document.querySelector('.announce');
    if (anchor) anchor.insertAdjacentElement('afterend', bar);
    else document.body.insertBefore(bar, document.body.firstChild);

    const input   = bar.querySelector('#searchOverlayInput');
    const results = bar.querySelector('#searchResults');
    let timer;

    const open = () => {
      bar.hidden = false;
      requestAnimationFrame(() => bar.classList.add('open'));
      setTimeout(() => input.focus(), 280);
    };
    const close = () => {
      bar.classList.remove('open');
      setTimeout(() => {
        bar.hidden = true;
        input.value = '';
        results.innerHTML = '';
      }, 280);
    };

    document.querySelectorAll('[data-action="search"]').forEach(b =>
      b.addEventListener('click', e => { e.preventDefault(); open(); })
    );
    bar.querySelector('#searchClose').addEventListener('click', close);
    document.addEventListener('keydown', e => { if (!bar.hidden && e.key === 'Escape') close(); });

    async function run(q) {
      if (!q) { results.innerHTML = ''; return; }
      try {
        const list = await YugaAPI.search(q, 8);
        if (!list.length) {
          results.innerHTML = '<div class="search-empty">कोणतेही जुळणारे तेल सापडले नाही</div>';
          return;
        }
        results.innerHTML = list.map(p => `
          <a href="/product.html?slug=${encodeURIComponent(p.slug)}" class="search-result">
            <div class="search-result-thumb"><img src="/frames/001.png" alt=""/></div>
            <div class="search-result-meta">
              <div class="search-result-name">${p.name}</div>
              <div class="search-result-sub">${p.sourceRegion || ''}${p.woodType ? ' · ' + p.woodType : ''}</div>
            </div>
            <div class="search-result-price">${YugaUI.inr(p.price)}</div>
          </a>
        `).join('');
      } catch (err) {
        results.innerHTML = `<div class="search-empty">शोध अपयशी: ${err.message}</div>`;
      }
    }
    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => run(input.value.trim()), 220);
    });
  }

  // ─────────────────────────────────── PROFILE DROPDOWN + MODAL ─────────────
  function mountProfile() {
    if (document.getElementById('profileMenu')) return;

    const menu  = el('div',  { id: 'profileMenu', class: 'profile-menu', hidden: true });
    const modal = el('div',  { id: 'authModal',   class: 'auth-modal',   hidden: true });
    modal.innerHTML = '<div class="auth-modal-inner"></div>';
    document.body.appendChild(menu);
    document.body.appendChild(modal);

    const inner = modal.querySelector('.auth-modal-inner');

    function placeMenu(btn) {
      const r = btn.getBoundingClientRect();
      menu.style.top   = (r.bottom + window.scrollY + 6) + 'px';
      menu.style.right = (window.innerWidth - r.right)  + 'px';
    }
    function openMenu(btn) {
      placeMenu(btn);
      menu.hidden = false;
      requestAnimationFrame(() => menu.classList.add('open'));
    }
    function closeMenu() {
      menu.classList.remove('open');
      setTimeout(() => { menu.hidden = true; }, 180);
    }
    function openModal() {
      modal.hidden = false;
      requestAnimationFrame(() => modal.classList.add('open'));
    }
    function closeModal() {
      modal.classList.remove('open');
      setTimeout(() => { modal.hidden = true; inner.innerHTML = ''; }, 180);
    }

    modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
    document.addEventListener('keydown', e => { if (!modal.hidden && e.key === 'Escape') closeModal(); });

    // ── Menu rendering ─────────────────────────────────────────────────────
    let currentUser = null;
    function renderMenu(user) {
      currentUser = user;
      menu.innerHTML = user ? `
        <div class="profile-greeting">नमस्ते,<br/><strong>${user.name}</strong></div>
        <a href="#" class="profile-item" data-act="orders">माझे ऑर्डर</a>
        <a href="#" class="profile-item" data-act="profile">प्रोफाइल</a>
        ${user.isAdmin ? '<a href="/admin/" class="profile-item">अ‍ॅडमिन डॅशबोर्ड</a>' : ''}
        <a href="#" class="profile-item profile-item-danger" data-act="logout">लॉगआउट</a>
      ` : `
        <div class="profile-greeting">YugaNaturals मध्ये आपले स्वागत</div>
        <a href="/login.html"  class="profile-item">लॉगिन</a>
        <a href="/signup.html" class="profile-item">नवीन खाते</a>
      `;
    }

    // One delegated handler — survives Chrome Translate wrapping menu text in <font>
    menu.addEventListener('click', async (e) => {
      const item = e.target.closest('[data-act]');
      if (!item || !menu.contains(item)) return;
      e.preventDefault();
      const act = item.dataset.act;
      closeMenu();
      if (act === 'logout') {
        await YugaAPI.auth.logout();
        YugaUI.toast('लॉगआउट झाले');
      } else if (act === 'orders') {
        renderOrders();
      } else if (act === 'profile') {
        renderProfile(currentUser);
      }
    });

    document.querySelectorAll('[data-action="account"]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (!menu.hidden) return closeMenu();
        const user = await YugaAPI.auth.me();
        renderMenu(user);
        openMenu(btn);
      });
    });
    document.addEventListener('click', (e) => {
      if (menu.hidden) return;
      if (menu.contains(e.target)) return;
      if (e.target.closest('[data-action="account"]')) return;
      closeMenu();
    });

    // ── Login / Signup view ────────────────────────────────────────────────
    function renderAuth(tab = 'login') {
      inner.innerHTML = `
        <button class="auth-close" aria-label="बंद">✕</button>
        <div class="auth-tabs">
          <button class="auth-tab ${tab==='login'?'active':''}"  data-tab="login">लॉगिन</button>
          <button class="auth-tab ${tab==='signup'?'active':''}" data-tab="signup">नवीन खाते</button>
        </div>
        <form class="auth-form" id="loginForm" ${tab!=='login'?'hidden':''}>
          <input type="email"    name="email"    placeholder="ईमेल"      required autocomplete="email"/>
          <input type="password" name="password" placeholder="पासवर्ड"  required autocomplete="current-password"/>
          <button type="submit" class="btn wide">लॉगिन करा</button>
          <div class="auth-msg" data-msg></div>
        </form>
        <form class="auth-form" id="signupForm" ${tab!=='signup'?'hidden':''}>
          <input type="text"     name="name"     placeholder="पूर्ण नाव"               required/>
          <input type="email"    name="email"    placeholder="ईमेल"                   required autocomplete="email"/>
          <input type="tel"      name="phone"    placeholder="मोबाइल (पर्यायी)"      autocomplete="tel"/>
          <input type="password" name="password" placeholder="पासवर्ड (६+ अक्षरे)"   required minlength="6" autocomplete="new-password"/>
          <button type="submit" class="btn wide">खाते तयार करा</button>
          <div class="auth-msg" data-msg></div>
        </form>
      `;
      openModal();
      const tabs    = inner.querySelectorAll('.auth-tab');
      const loginF  = inner.querySelector('#loginForm');
      const signupF = inner.querySelector('#signupForm');

      inner.querySelector('.auth-close').onclick = closeModal;
      tabs.forEach(t => t.onclick = () => {
        const which = t.dataset.tab;
        tabs.forEach(x => x.classList.toggle('active', x === t));
        loginF.hidden  = which !== 'login';
        signupF.hidden = which !== 'signup';
      });

      const submit = (form, fn) => form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd  = new FormData(form);
        const msg = form.querySelector('[data-msg]');
        msg.className = 'auth-msg';
        msg.textContent = '';
        try {
          const user = await fn(Object.fromEntries(fd.entries()));
          closeModal();
          YugaUI.toast(`स्वागत, ${user.name}!`);
        } catch (err) {
          msg.className = 'auth-msg err';
          msg.textContent = err.message;
        }
      });
      submit(loginF,  YugaAPI.auth.login);
      submit(signupF, YugaAPI.auth.signup);
    }

    // ── Orders view ────────────────────────────────────────────────────────
    function renderOrders() {
      inner.innerHTML = `
        <button class="auth-close" aria-label="बंद">✕</button>
        <h3 class="auth-title">माझे ऑर्डर</h3>
        <div id="ordersList" class="orders-list">लोड होत आहे…</div>
      `;
      openModal();
      inner.querySelector('.auth-close').onclick = closeModal;
      const list = inner.querySelector('#ordersList');
      YugaAPI.orders.list().then(os => {
        if (!os.length) { list.innerHTML = '<div class="search-empty">अजून कोणतेही ऑर्डर नाहीत</div>'; return; }
        list.innerHTML = os.map(o => `
          <div class="order-card">
            <div class="order-head">
              <strong>ऑर्डर #${o.id}</strong>
              <span class="order-status ${o.status}">${o.status}</span>
            </div>
            <div class="order-meta">
              ${new Date(o.createdAt).toLocaleDateString('en-IN')} · ${o.items.length} वस्तू ·
              <strong>${YugaUI.inr(o.total)}</strong>
            </div>
            <div class="order-items">${o.items.map(i =>
              `${i.name} (${i.size}ml × ${i.quantity})`).join(' · ')}</div>
          </div>
        `).join('');
      }).catch(err => {
        list.innerHTML = `<div class="search-empty">त्रुटी: ${err.message}</div>`;
      });
    }

    // ── Profile editor ─────────────────────────────────────────────────────
    function renderProfile(user) {
      const a = user.address || {};
      inner.innerHTML = `
        <button class="auth-close" aria-label="बंद">✕</button>
        <h3 class="auth-title">प्रोफाइल</h3>
        <form class="auth-form" id="profileForm">
          <input type="text" name="name"    placeholder="पूर्ण नाव" value="${user.name || ''}" required/>
          <input type="tel"  name="phone"   placeholder="मोबाइल"   value="${user.phone || ''}"/>
          <input type="text" name="line1"   placeholder="पत्ता ओळ १" value="${a.line1 || ''}"/>
          <input type="text" name="city"    placeholder="शहर"        value="${a.city || ''}"/>
          <input type="text" name="state"   placeholder="राज्य"      value="${a.state || ''}"/>
          <input type="text" name="pincode" placeholder="पिनकोड"    value="${a.pincode || ''}"/>
          <button type="submit" class="btn wide">सेव्ह करा</button>
          <div class="auth-msg" data-msg></div>
        </form>
      `;
      openModal();
      inner.querySelector('.auth-close').onclick = closeModal;
      inner.querySelector('#profileForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd  = new FormData(e.target);
        const msg = e.target.querySelector('[data-msg]');
        msg.className = 'auth-msg'; msg.textContent = '';
        try {
          await YugaAPI.auth.update({
            name:  fd.get('name'),
            phone: fd.get('phone'),
            address: {
              line1:   fd.get('line1'),
              city:    fd.get('city'),
              state:   fd.get('state'),
              pincode: fd.get('pincode')
            }
          });
          msg.className = 'auth-msg ok';
          msg.textContent = '✓ सेव्ह झाले';
        } catch (err) {
          msg.className = 'auth-msg err';
          msg.textContent = err.message;
        }
      });
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    mountSearch();
    mountProfile();
  });
})();
