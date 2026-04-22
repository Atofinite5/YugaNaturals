// Product detail page
(function () {
  const params = new URLSearchParams(location.search);
  const slug = params.get('slug');
  const media = document.getElementById('pdMedia');
  const info  = document.getElementById('pdInfo');
  const crumb = document.getElementById('crumbName');

  if (!slug) {
    info.innerHTML = '<p>उत्पादन निर्दिष्ट केलेले नाही.</p>';
    return;
  }

  let product, selectedSize = 1000, qty = 1;

  function render() {
    document.title = product.name + ' — YugaNaturals';
    crumb.textContent = product.name;
    media.innerHTML = YugaUI.productImage(product);

    const sz = product.sizes.find(s => s.size === selectedSize) || product.sizes[1];
    const save = YugaUI.pct(sz.mrp, sz.price);

    info.innerHTML = `
      <div class="kicker">${product.sourceRegion} • लाकडी घाण्यावर काढलेले</div>
      <h1>${product.name}</h1>
      <div class="rating" style="color:var(--gold); margin-bottom:10px;">
        ★★★★★ <span style="color:var(--muted)">${product.rating} (${product.reviewCount} पुनरावलोकन)</span>
      </div>
      <p class="desc">${product.longDesc || product.shortDesc}</p>

      <div class="meta-row">
        <span class="chip">🌿 ${product.woodType}</span>
        <span class="chip">📍 ${product.sourceRegion}</span>
        <span class="chip">🧪 अनरिफाइंड</span>
      </div>

      <div class="price-row" style="margin: 8px 0 4px;">
        <span class="price" style="font-size: 1.8rem;">${YugaUI.inr(sz.price)}</span>
        <span class="mrp">${YugaUI.inr(sz.mrp)}</span>
        <span class="save">−${save}%</span>
      </div>
      <div style="font-size:13px; color:var(--muted);">सर्व करांसह</div>

      <div class="size-picker">
        <div class="label">आकार निवडा</div>
        <div class="size-options">
          ${product.sizes.map(s => `
            <button class="size-option ${s.size === selectedSize ? 'active' : ''}" data-size="${s.size}">
              <strong>${s.label}</strong>
              <div><span class="sp">${YugaUI.inr(s.price)}</span><span class="sm">${YugaUI.inr(s.mrp)}</span></div>
            </button>
          `).join('')}
        </div>
      </div>

      <div class="qty-row">
        <div class="qty-stepper">
          <button id="qDown">−</button>
          <span id="qVal">${qty}</span>
          <button id="qUp">+</button>
        </div>
        <button class="btn wide" id="addBtn" style="flex:1;">कार्टमध्ये जोडा · ${YugaUI.inr(sz.price * qty)}</button>
      </div>
      <button class="btn outline wide" id="buyBtn">आता खरेदी करा</button>

      <div class="pd-benefits">
        <h3>तुम्हाला हे का आवडेल</h3>
        <ul>
          <li>हळूवार, थंड आणि छोट्या बॅचमध्ये घाण्यावर काढलेले — त्यामुळे पोषक घटक टिकून राहतात.</li>
          <li>एकाच शेतापर्यंत मागोवा घेता येतो; याच हंगामात काढलेले.</li>
          <li>अनरिफाइंड, अनब्लीच्ड आणि कोणत्याही प्रिझर्व्हेटिव्हशिवाय.</li>
          <li>हवाबंद आतील सीलसह काचेच्या बाटलीत येते.</li>
        </ul>
      </div>
    `;

    info.querySelectorAll('.size-option').forEach(b => {
      b.addEventListener('click', () => {
        selectedSize = Number(b.dataset.size);
        render();
      });
    });
    document.getElementById('qDown').onclick = () => { qty = Math.max(1, qty - 1); render(); };
    document.getElementById('qUp').onclick   = () => { qty = Math.min(10, qty + 1); render(); };

    document.getElementById('addBtn').onclick = async () => {
      const btn = document.getElementById('addBtn');
      btn.disabled = true;
      btn.textContent = 'जोडत आहे…';
      try {
        await YugaAPI.addItem(product.id, selectedSize, qty);
        YugaUI.toast(`कार्टमध्ये ${qty} × ${sz.label} जोडले`);
        YugaUI.refreshCartCount();
        btn.textContent = '✓ कार्टमध्ये जोडले';
        setTimeout(render, 1400);
      } catch (err) {
        YugaUI.toast('त्रुटी — ' + err.message);
        render();
      }
    };
    document.getElementById('buyBtn').onclick = async () => {
      try {
        await YugaAPI.addItem(product.id, selectedSize, qty);
        location.href = '/cart.html';
      } catch (err) { YugaUI.toast('त्रुटी — ' + err.message); }
    };
  }

  YugaAPI.getProduct(slug).then(p => {
    product = p;
    render();
  }).catch(err => {
    info.innerHTML = `<p style="color:var(--danger)">उत्पादन लोड करता आले नाही: ${err.message}</p>`;
  });
})();
