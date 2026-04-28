// Collection page — renders the product grid with filter & sort
(function () {
  const grid     = document.getElementById('productGrid');
  const countLbl = document.getElementById('countLabel');
  const search   = document.getElementById('searchInput');
  const sortSel  = document.getElementById('sortSelect');
  const regionSel= document.getElementById('regionSelect');

  let all = [];

  function renderCard(p, idx) {
    const s500 = p.sizes.find(s => s.size === 500);
    const price = s500.price, mrp = s500.mrp;
    const save  = YugaUI.pct(mrp, price);
    const isNewLaunch = (p.reviewCount || 0) < 100;
    const link = `/product.html?slug=${encodeURIComponent(p.slug)}`;

    return `
      <article class="card">
        <a href="${link}" class="card-media" aria-label="${p.name}">
          <div class="card-ribbons">
            ${isNewLaunch
              ? '<span class="card-ribbon-new">New Launch</span>'
              : `<span class="card-ribbon-off">${save}% OFF</span>`}
          </div>
          <img class="card-img card-img-front" src="${YugaUI.productImageFront(p)}" alt="${p.name}" loading="lazy" />
          <img class="card-img card-img-back"  src="${YugaUI.productImageHover(p)}" alt="${p.name}" loading="lazy" />
          <div class="card-overlay">
            <button class="card-add" data-id="${p.id}" aria-label="कार्टमध्ये जोडा">
              <span>ADD</span>
              <span class="add-cart-icon">🛒</span>
            </button>
          </div>
        </a>
        <div class="card-body">
          <h3><a href="${link}">${p.name} – ५०० मिली</a></h3>
          <div class="rating">
            <span class="stars">★</span>
            <strong>${p.rating || '—'}</strong>
            <span class="rev">(${p.reviewCount || 0} पुनरावलोकने)</span>
          </div>
          <div class="price-row">
            <span class="price">${YugaUI.inr(price)}</span>
            <span class="mrp">${YugaUI.inr(mrp)}</span>
            <span class="save-tag">${save}% off</span>
          </div>
        </div>
      </article>
    `;
  }

  function applyFilters() {
    const q   = (search.value || '').toLowerCase().trim();
    const reg = regionSel.value;
    let list = all.filter(p => {
      const matchesQ = !q ||
        p.name.toLowerCase().includes(q) ||
        (p.shortDesc || '').toLowerCase().includes(q);
      const matchesR = !reg || p.sourceRegion === reg;
      return matchesQ && matchesR;
    });

    const sort = sortSel.value;
    list = [...list].sort((a, b) => {
      const pa = a.sizes.find(s=>s.size===500).price;
      const pb = b.sizes.find(s=>s.size===500).price;
      if (sort === 'price-asc')  return pa - pb;
      if (sort === 'price-desc') return pb - pa;
      if (sort === 'rating')     return (b.rating||0) - (a.rating||0);
      return 0;
    });

    grid.innerHTML = list.map((p, i) => renderCard(p, i)).join('') ||
      `<p style="grid-column:1/-1; text-align:center; color:var(--muted); padding:40px 0;">तुमच्या शोधाशी जुळणारे कोणतेही तेल नाही.</p>`;
    countLbl.textContent = `${list.length} तेल`;
    YugaUI.setupReveal();

    // Attach add-to-cart handlers
    grid.querySelectorAll('button[data-id]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        btn.disabled = true;
        const prev = btn.textContent;
        btn.textContent = '…';
        try {
          await YugaAPI.addItem(Number(btn.dataset.id), 500, 1);
          YugaUI.toast('कार्टमध्ये जोडले');
          YugaUI.refreshCartCount();
          btn.textContent = '✓';
          setTimeout(() => { btn.textContent = prev; btn.disabled = false; }, 1200);
        } catch (err) {
          YugaUI.toast('जोडता आले नाही — ' + err.message);
          btn.textContent = prev; btn.disabled = false;
        }
      });
    });
  }

  function populateRegions() {
    const regions = [...new Set(all.map(p => p.sourceRegion).filter(Boolean))].sort();
    regionSel.innerHTML = '<option value="">सर्व प्रदेश</option>' +
      regions.map(r => `<option value="${r}">${r}</option>`).join('');
  }

  async function init() {
    try {
      all = await YugaAPI.listProducts();
      populateRegions();
      applyFilters();
    } catch (err) {
      grid.innerHTML = `<p style="grid-column:1/-1; text-align:center; color:var(--danger);">उत्पादने लोड करण्यात अयशस्वी: ${err.message}</p>`;
    }
  }

  search.addEventListener('input', applyFilters);
  sortSel.addEventListener('change', applyFilters);
  regionSel.addEventListener('change', applyFilters);

  init();
})();
