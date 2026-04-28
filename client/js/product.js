// Product detail page
(function () {
  const params = new URLSearchParams(location.search);
  const slug = params.get('slug');
  const media  = document.getElementById('pdMedia');
  const thumbs = document.getElementById('pdThumbs');
  const info   = document.getElementById('pdInfo');
  const tabs   = document.getElementById('pdTabs');
  const crumb  = document.getElementById('crumbName');

  if (!slug) {
    info.innerHTML = '<p>उत्पादन निर्दिष्ट केलेले नाही.</p>';
    return;
  }

  // Deterministic "delivery in N days" derived from product id
  function deliveryDays(product) {
    const base = 2 + ((product.id || 1) % 3);
    return base + ' – ' + (base + 1);
  }

  let product, selectedSize = 1000, qty = 1, activeTab = 'desc';

  function renderMedia() {
    const img = YugaUI.productImage(product);
    media.innerHTML = `
      <div class="pd-media-frame">
        ${product.badge ? `<span class="badge gold">${product.badge}</span>` : ''}
        ${img || '<div class="pd-ph">तेल</div>'}
      </div>
    `;
    const views = ['bottle', 'label', 'seed', 'pour'];
    thumbs.innerHTML = views.map((v, i) => `
      <button class="pd-thumb ${i === 0 ? 'active' : ''}" data-view="${v}" aria-label="${v}">
        ${img || ''}
      </button>
    `).join('');
    thumbs.querySelectorAll('.pd-thumb').forEach(b => {
      b.addEventListener('click', () => {
        thumbs.querySelectorAll('.pd-thumb').forEach(t => t.classList.remove('active'));
        b.classList.add('active');
      });
    });
  }

  function renderInfo() {
    const sz = product.sizes.find(s => s.size === selectedSize) || product.sizes[1];
    const save = YugaUI.pct(sz.mrp, sz.price);
    const stars = '★'.repeat(Math.round(product.rating)) + '☆'.repeat(5 - Math.round(product.rating));

    info.innerHTML = `
      <div class="kicker">${product.sourceRegion} • लाकडी घाण्यावर काढलेले</div>
      <h1>${product.name}</h1>

      <div class="pd-rating">
        <span class="stars">${stars}</span>
        <strong>${product.rating}</strong>
        <span class="pd-rating-sub">${product.reviewCount} पुनरावलोकने</span>
        <span class="dot">•</span>
        <span class="pd-rating-sub">${product.stock > 0 ? 'स्टॉकमध्ये' : 'उपलब्ध नाही'}</span>
      </div>

      <p class="desc">${product.shortDesc}</p>

      <div class="meta-row">
        <span class="chip">🪵 ${product.woodType}</span>
        <span class="chip">📍 ${product.sourceRegion}</span>
        <span class="chip">🧪 अनरिफाइंड</span>
      </div>

      <div class="pd-price-card">
        <div class="price-row">
          <span class="price">${YugaUI.inr(sz.price)}</span>
          <span class="mrp">${YugaUI.inr(sz.mrp)}</span>
          <span class="save">−${save}%</span>
        </div>
        <div class="pd-tax-note">सर्व करांसह • ${YugaUI.inr(sz.mrp - sz.price)} वाचवा</div>
      </div>

      <div class="size-picker">
        <div class="label">आकार निवडा</div>
        <div class="size-options">
          ${product.sizes.map((s, i) => `
            <button class="size-option ${s.size === selectedSize ? 'active' : ''}" data-size="${s.size}">
              ${i === 1 ? '<span class="size-tag">लोकप्रिय</span>' : ''}
              <strong>${s.label}</strong>
              <div class="size-price-row">
                <span class="sp">${YugaUI.inr(s.price)}</span>
                <span class="sm">${YugaUI.inr(s.mrp)}</span>
              </div>
              <div class="size-unit">${Math.round((s.price / s.size) * 100)} प्रति १०० मिली</div>
            </button>
          `).join('')}
        </div>
      </div>

      <div class="qty-row">
        <div class="qty-stepper" aria-label="प्रमाण">
          <button id="qDown" aria-label="कमी करा">−</button>
          <span id="qVal">${qty}</span>
          <button id="qUp" aria-label="वाढवा">+</button>
        </div>
        <button class="btn wide" id="addBtn">
          <span>कार्टमध्ये जोडा</span>
          <span class="btn-price">· ${YugaUI.inr(sz.price * qty)}</span>
        </button>
      </div>
      <button class="btn outline wide" id="buyBtn">आता खरेदी करा →</button>

      <div class="pd-trust">
        <div class="pd-trust-item">
          <span class="pd-trust-icon">🚚</span>
          <div><strong>${deliveryDays(product)} दिवसांत</strong><small>मोफत शिपिंग · ₹४९९+</small></div>
        </div>
        <div class="pd-trust-item">
          <span class="pd-trust-icon">↺</span>
          <div><strong>७ दिवसांत</strong><small>सोपी परतफेड</small></div>
        </div>
        <div class="pd-trust-item">
          <span class="pd-trust-icon">🌾</span>
          <div><strong>लहान बॅच</strong><small>या आठवड्यात काढलेले</small></div>
        </div>
      </div>
    `;

    info.querySelectorAll('.size-option').forEach(b => {
      b.addEventListener('click', () => {
        selectedSize = Number(b.dataset.size);
        renderInfo();
      });
    });
    document.getElementById('qDown').onclick = () => { qty = Math.max(1, qty - 1); renderInfo(); };
    document.getElementById('qUp').onclick   = () => { qty = Math.min(10, qty + 1); renderInfo(); };

    document.getElementById('addBtn').onclick = async () => {
      const btn = document.getElementById('addBtn');
      btn.disabled = true;
      btn.innerHTML = '<span>जोडत आहे…</span>';
      try {
        await YugaAPI.addItem(product.id, selectedSize, qty);
        YugaUI.toast(`कार्टमध्ये ${qty} × ${sz.label} जोडले`);
        YugaUI.refreshCartCount();
        btn.innerHTML = '<span>✓ कार्टमध्ये जोडले</span>';
        setTimeout(renderInfo, 1400);
      } catch (err) {
        YugaUI.toast('त्रुटी — ' + err.message);
        renderInfo();
      }
    };
    document.getElementById('buyBtn').onclick = async () => {
      try {
        await YugaAPI.addItem(product.id, selectedSize, qty);
        location.href = '/cart.html';
      } catch (err) { YugaUI.toast('त्रुटी — ' + err.message); }
    };
  }

  function renderTabs() {
    tabs.hidden = false;
    const panes = {
      desc: `<p>${product.longDesc || product.shortDesc}</p>`,
      process: `
        <ol class="pd-steps">
          <li><strong>निवड</strong><span>लहान शेतकऱ्यांकडून उन्हात वाळवलेल्या बियांची हाताने निवड.</span></li>
          <li><strong>घाणी</strong><span>${product.woodType} — &lt; ४२°C तापमानावर हळूवार फिरणारी घाणी.</span></li>
          <li><strong>गाळणी</strong><span>कापडातून नैसर्गिक गाळणी, कोणतेही रसायन नाही.</span></li>
          <li><strong>बाटलीबंद</strong><span>काचेच्या बाटलीत हवाबंद सीलसह, त्याच आठवड्यात पाठवले.</span></li>
        </ol>`,
      use: `
        <ul class="pd-usage">
          <li><strong>तळणी</strong> — उच्च तापमान सहनशील; पुरी, भजी, पकोडे.</li>
          <li><strong>फोडणी</strong> — मोहरी, कढीपत्ता आणि हिंगासह रोजच्या जेवणासाठी.</li>
          <li><strong>कच्चे वापर</strong> — कोशिंबीर, चटणी, पोळी लावण्यासाठी उत्तम.</li>
          <li><strong>साठवण</strong> — थंड, कोरड्या जागी बंद बाटलीत; सूर्यप्रकाशापासून दूर.</li>
        </ul>`,
      reviews: `
        <div class="pd-reviews-summary">
          <div class="pd-rev-avg">
            <div class="pd-rev-num">${product.rating}</div>
            <div class="stars big">${'★'.repeat(Math.round(product.rating))}${'☆'.repeat(5 - Math.round(product.rating))}</div>
            <small>${product.reviewCount} पुनरावलोकनांवर आधारित</small>
          </div>
          <div class="pd-rev-bars">
            ${[5,4,3,2,1].map(n => {
              const pctBar = n === 5 ? 78 : n === 4 ? 16 : n === 3 ? 4 : n === 2 ? 1 : 1;
              return `<div class="pd-rev-bar"><span>${n}★</span><div class="bar"><i style="width:${pctBar}%"></i></div><em>${pctBar}%</em></div>`;
            }).join('')}
          </div>
        </div>
        <div class="pd-review">
          <div class="pd-review-head"><strong>मीरा पाटील</strong><span>पुणे</span><span class="stars">★★★★★</span></div>
          <p>"आजीच्या जेवणातली तीच खमंग चव. रोजच्या फोडणीत फरक लगेच जाणवला."</p>
        </div>
        <div class="pd-review">
          <div class="pd-review-head"><strong>अर्जुन शर्मा</strong><span>बंगलोर</span><span class="stars">★★★★★</span></div>
          <p>"पॅकिंग उत्तम, सुगंध ताजा. तळणीसाठी वापरला आणि फरक जाणवला."</p>
        </div>`
    };
    tabs.innerHTML = `
      <div class="pd-tabs-head" role="tablist">
        <button class="pd-tab ${activeTab==='desc'?'active':''}" data-tab="desc">वर्णन</button>
        <button class="pd-tab ${activeTab==='process'?'active':''}" data-tab="process">घाण्याची प्रक्रिया</button>
        <button class="pd-tab ${activeTab==='use'?'active':''}" data-tab="use">कसे वापरावे</button>
        <button class="pd-tab ${activeTab==='reviews'?'active':''}" data-tab="reviews">पुनरावलोकने (${product.reviewCount})</button>
      </div>
      <div class="pd-tab-pane">${panes[activeTab]}</div>
    `;
    tabs.querySelectorAll('.pd-tab').forEach(t => {
      t.addEventListener('click', () => {
        activeTab = t.dataset.tab;
        renderTabs();
      });
    });
  }

  function render() {
    document.title = product.name + ' — YugaNaturals';
    crumb.textContent = product.name;
    renderMedia();
    renderInfo();
    renderTabs();
    YugaUI.setupReveal();
  }

  YugaAPI.getProduct(slug).then(p => {
    product = p;
    render();
  }).catch(err => {
    info.innerHTML = `<p style="color:var(--danger)">उत्पादन लोड करता आले नाही: ${err.message}</p>`;
  });
})();
