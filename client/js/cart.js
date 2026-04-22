// Cart page
(function () {
  const itemsEl = document.getElementById('cartItems');
  const sumEl   = document.getElementById('summary');

  function renderEmpty() {
    sumEl.style.display = 'none';
    itemsEl.innerHTML = `
      <div class="empty">
        <h2>तुमचे कार्ट रिकामे आहे</h2>
        <p>आमची लाकडी घाण्यावर काढलेली तेले पाहा आणि तुमचे आवडते निवडा.</p>
        <a href="/" class="btn" style="display:inline-flex; width:auto; margin-top:8px;">तेले खरेदी करा</a>
      </div>`;
  }

  function render(cart) {
    if (!cart.items || cart.items.length === 0) return renderEmpty();

    sumEl.style.display = '';
    itemsEl.innerHTML = cart.items.map(it => `
      <div class="cart-row" data-item="${it.itemId}">
        <div class="cart-thumb">
          <img src="/images/${it.image}" alt="${it.name}" />
        </div>
        <div class="cart-meta">
          <h4>${it.name}</h4>
          <small>आकार: ${it.sizeLabel} • प्रत्येकी ${YugaUI.inr(it.price)}</small>
          <span class="line-price">${YugaUI.inr(it.lineTotal)}</span>
        </div>
        <div class="cart-actions">
          <div class="qty-stepper">
            <button data-act="dec">−</button>
            <span>${it.quantity}</span>
            <button data-act="inc">+</button>
          </div>
          <button class="link-danger" data-act="rm">काढून टाका</button>
        </div>
      </div>
    `).join('');

    document.getElementById('sumSubtotal').textContent = YugaUI.inr(cart.subtotal);
    document.getElementById('sumSavings').textContent  = '−' + YugaUI.inr(cart.savings);
    document.getElementById('sumShipping').textContent = cart.shipping === 0 ? 'मोफत' : YugaUI.inr(cart.shipping);
    document.getElementById('sumTotal').textContent    = YugaUI.inr(cart.total);

    itemsEl.querySelectorAll('.cart-row').forEach(row => {
      const itemId = row.dataset.item;
      const qty    = cart.items.find(i => i.itemId == itemId).quantity;
      row.querySelector('[data-act="dec"]').onclick = () => update(itemId, qty - 1);
      row.querySelector('[data-act="inc"]').onclick = () => update(itemId, qty + 1);
      row.querySelector('[data-act="rm"]' ).onclick = () => remove(itemId);
    });
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

  load();
})();
