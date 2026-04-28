// Shared front-end helpers for YugaNaturals
(function () {
  const API_BASE  = '/api';
  const CART_KEY  = 'yuga_cart_id';
  const TOKEN_KEY = 'yuga_auth_token';

  function getCartId()      { return localStorage.getItem(CART_KEY) || null; }
  function setCartId(id)    { if (id) localStorage.setItem(CART_KEY, id); }
  function getToken()       { return localStorage.getItem(TOKEN_KEY) || null; }
  function setToken(t)      { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); }

  async function request(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(API_BASE + path, {
      ...options,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    if (!res.ok) {
      let err = 'Request failed';
      try { err = (await res.json()).error || err; } catch (_) {}
      // Auto-clear token on 401 so the UI flips back to logged-out
      if (res.status === 401) setToken(null);
      throw new Error(err);
    }
    return res.json();
  }

  const auth = {
    isLoggedIn() { return !!getToken(); },
    signup({ name, email, password, phone }) {
      return request('/auth/signup', { method: 'POST', body: { name, email, password, phone } })
        .then(r => { setToken(r.token); return r.user; });
    },
    login({ email, password }) {
      return request('/auth/login', { method: 'POST', body: { email, password } })
        .then(r => { setToken(r.token); return r.user; });
    },
    google(credential) {
      return request('/auth/google', { method: 'POST', body: { credential } })
        .then(r => { setToken(r.token); return r.user; });
    },
    logout() {
      return request('/auth/logout', { method: 'POST' })
        .catch(() => null)
        .finally(() => setToken(null));
    },
    me() {
      if (!getToken()) return Promise.resolve(null);
      return request('/auth/me').then(r => r.user).catch(() => null);
    },
    update(data) {
      return request('/auth/me', { method: 'PATCH', body: data }).then(r => r.user);
    }
  };

  const orders = {
    list()    { return request('/orders').then(r => r.orders); },
    get(id)   { return request('/orders/' + id).then(r => r.order); },
    create({ cartId, paymentMethod, shippingAddress, notes }) {
      return request('/orders', {
        method: 'POST',
        body: { cartId, paymentMethod, shippingAddress, notes }
      }).then(r => r.order);
    }
  };

  const admin = {
    bootstrap()             { return request('/admin/bootstrap', { method: 'POST' }).then(r => r.user); },
    createProduct(data)     { return request('/admin/products', { method: 'POST',  body: data }).then(r => r.product); },
    updateProduct(id, data) { return request('/admin/products/' + id, { method: 'PATCH', body: data }).then(r => r.product); },
    deleteProduct(id)       { return request('/admin/products/' + id, { method: 'DELETE' }); },
    // Reads a File from <input type="file"> as a base64 data URL, posts it to
    // the server, and resolves with the saved /uploads/<name> URL.
    uploadImage(file) {
      return new Promise((resolve, reject) => {
        if (!file) return reject(new Error('no file selected'));
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('could not read file'));
        reader.onload  = () => {
          request('/admin/uploads', {
            method: 'POST',
            body: { filename: file.name, dataUrl: reader.result }
          }).then(r => resolve(r.url)).catch(reject);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  // Resolve any of: full http(s) URL · root-relative path · bare filename (-> /images/<file>)
  // Used by the storefront to render product imagery without the admin having to
  // worry about which folder a file lives in.
  function resolveImage(path, fallback) {
    if (!path) return fallback || '/frames/001.png';
    if (/^https?:\/\//i.test(path)) return path;
    if (path.startsWith('/'))      return path;
    return '/images/' + path;
  }

  const api = {
    listProducts(q) {
      const qs = q ? `?q=${encodeURIComponent(q)}` : '';
      return request('/products' + qs);
    },
    getProduct(slug) { return request('/products/' + encodeURIComponent(slug)); },
    search(q, limit = 8) {
      if (!q) return Promise.resolve([]);
      return request(`/search?q=${encodeURIComponent(q)}&limit=${limit}`);
    },
    getCart() {
      const id = getCartId();
      if (!id) {
        return request('/cart', { method: 'POST', body: {} }).then(c => {
          setCartId(c.cartId); return c;
        });
      }
      return request('/cart/' + id).then(c => { setCartId(c.cartId); return c; });
    },
    addItem(productId, size, quantity = 1) {
      return api.getCart().then(cart =>
        request(`/cart/${cart.cartId}/items`, {
          method: 'POST',
          body: { productId, size, quantity },
        })
      );
    },
    updateItem(itemId, quantity) {
      const id = getCartId();
      return request(`/cart/${id}/items/${itemId}`, {
        method: 'PATCH', body: { quantity }
      });
    },
    removeItem(itemId) {
      const id = getCartId();
      return request(`/cart/${id}/items/${itemId}`, { method: 'DELETE' });
    },
    auth, orders, admin
  };

  // Toast helper
  function toast(msg) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 2200);
  }

  // Cart count updater
  async function refreshCartCount() {
    try {
      const c = await api.getCart();
      const badge = document.getElementById('cartCount');
      if (badge) badge.textContent = c.count || 0;
    } catch (e) { /* ignore */ }
  }

  // Product image loader — uses the product's own image if set, else the bottle render
  function productImage(product) {
    const src = resolveImage(product?.image, '/frames/001.png');
    return `<img src="${src}" alt="${product?.name || ''}" loading="lazy" />`;
  }
  function productImageHover(product) {
    return resolveImage(product?.imageHover, '/frames/250.png');
  }
  function productImageFront(product) {
    return resolveImage(product?.image, '/frames/001.png');
  }

  // Format helpers
  const inr = (n) => '₹' + Number(n).toLocaleString('en-IN');
  const pct = (mrp, price) => Math.round(((mrp - price) / mrp) * 100);

  // Scroll-reveal — fade-up sections and grid items as they enter the viewport.
  // Idempotent: safe to call after async renders (product cards, cart rows).
  const REVEAL_SINGLE = [
    '.trust-strip', '.welcome', '.collection-header', '.toolbar',
    '.why-choose', '.native-ingredients', '.rewards-bar',
    '.site-footer', '.related', '.product-detail', '.pd-tabs',
    '.cart-heading', '.free-ship-progress', '.summary'
  ];
  const REVEAL_GRIDS = [
    ['.grid', '.card'],
    ['.cart-items', '.cart-row'],
    ['.related-grid', '.related-card'],
    ['.why-grid', '.why-item'],
    ['.native-tiles', '.native-tile'],
    ['.trust-inner', '.trust-item']
  ];
  let revealObserver = null;
  function getRevealObserver() {
    if (revealObserver || !('IntersectionObserver' in window)) return revealObserver;
    revealObserver = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
    return revealObserver;
  }
  function setupReveal() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const obs = getRevealObserver();
    const tag = (el, delay) => {
      if (el.classList.contains('reveal')) return;
      el.classList.add('reveal');
      if (delay) el.style.transitionDelay = delay + 'ms';
      if (obs) obs.observe(el);
      else el.classList.add('is-visible');
    };
    REVEAL_SINGLE.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => tag(el, 0));
    });
    REVEAL_GRIDS.forEach(([container, child]) => {
      document.querySelectorAll(container).forEach(parent => {
        parent.querySelectorAll(child).forEach((el, i) => tag(el, Math.min(i * 60, 480)));
      });
    });
  }

  window.YugaAPI = api;
  window.YugaUI  = { toast, refreshCartCount, productImage, productImageFront, productImageHover, resolveImage, inr, pct, setupReveal };

  // Auto-refresh cart badge + reveal static sections on every page
  document.addEventListener('DOMContentLoaded', () => {
    refreshCartCount();
    setupReveal();
  });
})();
