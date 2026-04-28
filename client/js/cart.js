// Cart page
(function () {
  const itemsEl   = document.getElementById('cartItems');
  const sumEl     = document.getElementById('summary');
  const countEl   = document.getElementById('cartItemCount');
  const fsBar     = document.getElementById('freeShipBar');
  const fsFill    = document.getElementById('freeShipFill');
  const fsText    = document.getElementById('freeShipText');
  const relatedEl = document.getElementById('related');
  const relatedGrid = document.getElementById('relatedGrid');

  const FREE_SHIP_THRESHOLD = 499;
  const PROMO_CODES = { YUGA10: 10, FIRST15: 15 };
  let appliedPromo = null;

  function renderEmpty() {
    sumEl.style.display = 'none';
    countEl.textContent = '';
    fsBar.hidden = true;
    itemsEl.innerHTML = `
      <div class="empty">
        <div class="empty-icon">🛒</div>
        <h2>तुमचे कार्ट रिकामे आहे</h2>
        <p>आमची लाकडी घाण्यावर काढलेली तेले पाहा आणि तुमचे आवडते निवडा.</p>
        <a href="/" class="btn-pill" style="margin-top:8px;">तेले खरेदी करा</a>
      </div>`;
  }

  function updateFreeShipBar(subtotal) {
    if (subtotal >= FREE_SHIP_THRESHOLD) {
      fsBar.hidden = false;
      fsFill.style.width = '100%';
      fsBar.classList.add('done');
      fsText.innerHTML = '✓ तुम्ही <strong>मोफत शिपिंगसाठी</strong> पात्र आहात';
    } else {
      fsBar.hidden = false;
      fsBar.classList.remove('done');
      const pct = Math.min(100, Math.round((subtotal / FREE_SHIP_THRESHOLD) * 100));
      fsFill.style.width = pct + '%';
      const remaining = FREE_SHIP_THRESHOLD - subtotal;
      fsText.innerHTML = `मोफत शिपिंगसाठी आणखी <strong>${YugaUI.inr(remaining)}</strong> खरेदी करा`;
    }
  }

  function render(cart) {
    if (!cart.items || cart.items.length === 0) return renderEmpty();

    sumEl.style.display = '';
    const totalItems = cart.items.reduce((n, it) => n + it.quantity, 0);
    countEl.textContent = `(${totalItems} ${totalItems === 1 ? 'उत्पादन' : 'उत्पादने'})`;

    itemsEl.innerHTML = cart.items.map(it => `
      <div class="cart-row" data-item="${it.itemId}">
        <a href="/product.html?slug=${encodeURIComponent(it.slug || '')}" class="cart-thumb">
          <img src="/frames/001.png" alt="${it.name}" />
        </a>
        <div class="cart-meta">
          <a href="/product.html?slug=${encodeURIComponent(it.slug || '')}" class="cart-name">${it.name}</a>
          <div class="cart-sub">आकार: ${it.sizeLabel} · प्रत्येकी ${YugaUI.inr(it.price)}</div>
          <button class="link-danger" data-act="rm">× काढून टाका</button>
        </div>
        <div class="cart-qty">
          <div class="qty-stepper">
            <button data-act="dec" aria-label="कमी">−</button>
            <span>${it.quantity}</span>
            <button data-act="inc" aria-label="अधिक">+</button>
          </div>
        </div>
        <div class="cart-line-price">
          <strong>${YugaUI.inr(it.lineTotal)}</strong>
          ${it.quantity > 1 ? `<small>${it.quantity} × ${YugaUI.inr(it.price)}</small>` : ''}
        </div>
      </div>
    `).join('');

    let discount = 0;
    if (appliedPromo && PROMO_CODES[appliedPromo]) {
      discount = Math.round(cart.subtotal * PROMO_CODES[appliedPromo] / 100);
    }
    const finalTotal = Math.max(0, cart.total - discount);

    document.getElementById('sumSubtotal').textContent = YugaUI.inr(cart.subtotal);
    document.getElementById('sumSavings').textContent  = '−' + YugaUI.inr(cart.savings + discount);
    document.getElementById('sumShipping').textContent = cart.shipping === 0 ? 'मोफत' : YugaUI.inr(cart.shipping);
    document.getElementById('sumTotal').textContent    = YugaUI.inr(finalTotal);

    updateFreeShipBar(cart.subtotal);
    loadRelated(cart.items.map(i => i.productId));
    YugaUI.setupReveal();

    itemsEl.querySelectorAll('.cart-row').forEach(row => {
      const itemId = row.dataset.item;
      const qty    = cart.items.find(i => i.itemId == itemId).quantity;
      row.querySelector('[data-act="dec"]').onclick = () => update(itemId, qty - 1);
      row.querySelector('[data-act="inc"]').onclick = () => update(itemId, qty + 1);
      row.querySelector('[data-act="rm"]' ).onclick = () => remove(itemId);
    });
  }

  async function loadRelated(excludeIds) {
    try {
      const all = await YugaAPI.listProducts();
      const picks = all.filter(p => !excludeIds.includes(p.id)).slice(0, 4);
      if (picks.length === 0) { relatedEl.hidden = true; return; }
      relatedEl.hidden = false;
      relatedGrid.innerHTML = picks.map(p => {
        const s500 = p.sizes.find(s => s.size === 500);
        return `
          <a class="related-card" href="/product.html?slug=${encodeURIComponent(p.slug)}">
            <div class="related-media">
              <img src="/frames/001.png" alt="${p.name}" />
            </div>
            <div class="related-name">${p.name}</div>
            <div class="related-price">${YugaUI.inr(s500.price)} <s>${YugaUI.inr(s500.mrp)}</s></div>
          </a>
        `;
      }).join('');
      YugaUI.setupReveal();
    } catch (_) { relatedEl.hidden = true; }
  }

  async function load() {
    try {
      const c = await YugaAPI.getCart();
      render(c);
      YugaUI.refreshCartCount();
    } catch (err) {
      itemsEl.innerHTML = `<p style="padding:24px; color:var(--danger)">त्रुटी: ${err.message}</p>`;
    }
  }

  async function update(itemId, quantity) {
    try {
      const c = await YugaAPI.updateItem(itemId, quantity);
      render(c);
      YugaUI.refreshCartCount();
    } catch (err) { YugaUI.toast(err.message); }
  }
  async function remove(itemId) {
    try {
      const c = await YugaAPI.removeItem(itemId);
      render(c);
      YugaUI.refreshCartCount();
      YugaUI.toast('कार्टमधून काढले');
    } catch (err) { YugaUI.toast(err.message); }
  }

  // Promo code handling
  const promoForm = document.getElementById('promoForm');
  const promoInput = document.getElementById('promoInput');
  const promoMsg = document.getElementById('promoMsg');
  promoForm.addEventListener('submit', async () => {
    const code = (promoInput.value || '').trim().toUpperCase();
    if (!code) return;
    if (PROMO_CODES[code]) {
      appliedPromo = code;
      promoMsg.hidden = false;
      promoMsg.className = 'promo-msg ok';
      promoMsg.innerHTML = `✓ <strong>${code}</strong> लागू केले — ${PROMO_CODES[code]}% अतिरिक्त सूट`;
      load();
    } else {
      appliedPromo = null;
      promoMsg.hidden = false;
      promoMsg.className = 'promo-msg err';
      promoMsg.textContent = 'अवैध प्रोमो कोड. वापरून पहा: YUGA10 किंवा FIRST15';
    }
  });

  load();
})();
