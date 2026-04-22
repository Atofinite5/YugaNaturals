// Shared front-end helpers for YugaNaturals
(function () {
  const API_BASE = '/api';
  const CART_KEY = 'yuga_cart_id';

  function getCartId() {
    return localStorage.getItem(CART_KEY) || null;
  }
  function setCartId(id) {
    if (id) localStorage.setItem(CART_KEY, id);
  }

  async function request(path, options = {}) {
    const res = await fetch(API_BASE + path, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    if (!res.ok) {
      let err = 'Request failed';
      try { err = (await res.json()).error || err; } catch (_) {}
      throw new Error(err);
    }
    return res.json();
  }

  const api = {
    listProducts(q) {
      const qs = q ? `?q=${encodeURIComponent(q)}` : '';
      return request('/products' + qs);
    },
    getProduct(slug) { return request('/products/' + encodeURIComponent(slug)); },
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

  // Product image loader (falls back to inline SVG)
  function productImage(product) {
    if (product.image) {
      return `<img src="/images/${product.image}" alt="${product.name}" loading="lazy" />`;
    }
    return '';
  }

  // Format helpers
  const inr = (n) => '₹' + Number(n).toLocaleString('en-IN');
  const pct = (mrp, price) => Math.round(((mrp - price) / mrp) * 100);

  window.YugaAPI = api;
  window.YugaUI  = { toast, refreshCartCount, productImage, inr, pct };

  // Auto-refresh cart badge on every page that has it
  document.addEventListener('DOMContentLoaded', refreshCartCount);
})();
