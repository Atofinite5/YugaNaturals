// Collection page — renders the product grid with filter & sort
(function () {
  const grid     = document.getElementById('productGrid');
  const countLbl = document.getElementById('countLabel');
  const search   = document.getElementById('searchInput');
  const sortSel  = document.getElementById('sortSelect');
  const regionSel= document.getElementById('regionSelect');

  let all = [];

  function renderCard(p) {
    const s500 = p.sizes.find(s => s.size === 500);
    const price = s500.price, mrp = s500.mrp;
    const save  = YugaUI.pct(mrp, price);
    const badge = p.badge
      ? `<span class="badge${/premium/i.test(p.badge) ? ' gold' : ''}">${p.badge}</span>`
      : '';
    return `
      <article class="card">
        <a href="/product.html?slug=${encodeURIComponent(p.slug)}" class="card-media" aria-label="${p.name}">
          ${badge}
          ${YugaUI.productImage(p)}
        </a>
        <div class="card-body">
          <div class="card-region">${p.sourceRegion || ''}</div>
          <h3><a href="/product.html?slug=${encodeURIComponent(p.slug)}">${p.name}</a></h3>
          <p class="desc">${p.shortDesc || ''}</p>
          <div class="rating">★★★★★ <span>(${p.reviewCount || 0})</span></div>
          <div class="price-row">
            <span class="price">${YugaUI.inr(price)}</span>
            <span class="mrp">${YugaUI.inr(mrp)}</span>
            <span class="save">−${save}%</span>
          </div>
          <button class="btn" data-id="${p.id}">५०० मिली जोडा · ${YugaUI.inr(price)}</button>
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

    grid.innerHTML = list.map(renderCard).join('') ||
      `<p style="grid-column:1/-1; text-align:center; color:var(--muted); padding:40px 0;">तुमच्या शोधाशी जुळणारे कोणतेही तेल नाही.</p>`;
    countLbl.textContent = `${list.length} तेल`;

    // Attach add-to-cart handlers
    grid.querySelectorAll('button[data-id]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        btn.disabled = true;
        const prev = btn.textContent;
        btn.textContent = 'जोडत आहे…';
        try {
          await YugaAPI.addItem(Number(btn.dataset.id), 500, 1);
          YugaUI.toast('कार्टमध्ये जोडले');
          YugaUI.refreshCartCount();
          btn.textContent = '✓ जोडले';
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
