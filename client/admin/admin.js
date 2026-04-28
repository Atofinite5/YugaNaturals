// Admin dashboard — list, create, edit, delete products.
// Auth: requires a logged-in user with isAdmin = true.
// First admin can be promoted via POST /api/admin/bootstrap (no admins exist).
(function () {
  const gate         = document.getElementById('adminGate');
  const gateMsg      = document.getElementById('gateMsg');
  const gateActions  = document.getElementById('gateActions');
  const dash         = document.getElementById('adminDash');
  const userLabel    = document.getElementById('adminUser');
  const flash        = document.getElementById('adminFlash');
  const tbody        = document.getElementById('productsBody');
  const search       = document.getElementById('adminSearch');
  const newBtn       = document.getElementById('newProductBtn');
  const logoutBtn    = document.getElementById('logoutBtn');

  const modal        = document.getElementById('editorModal');
  const editorTitle  = document.getElementById('editorTitle');
  const form         = document.getElementById('productForm');
  const cancelBtn    = document.getElementById('cancelBtn');
  const closeBtn     = document.getElementById('editorClose');

  let allProducts = [];
  let editingId   = null;

  // ── Gate / boot ────────────────────────────────────────────────────────
  async function boot() {
    const user = await YugaAPI.auth.me();
    if (!user) {
      gateMsg.textContent = 'Please log in first.';
      gateActions.innerHTML = `
        <a href="/login.html?next=/admin/" class="btn">Login</a>
        <a href="/signup.html" class="btn outline">Create account</a>
      `;
      return;
    }
    userLabel.textContent = user.name + ' · ' + user.email;
    if (user.isAdmin) {
      gate.hidden = true;
      dash.hidden = false;
      loadProducts();
      return;
    }
    // Not yet an admin — offer one-time bootstrap if no admins exist.
    gateMsg.innerHTML = `
      Hi <strong>${user.name}</strong> — your account isn't an admin yet.<br/>
      If no admin exists, you can claim the role now.
    `;
    gateActions.innerHTML = `<button class="btn" id="bootstrapBtn">Promote me to admin</button>`;
    document.getElementById('bootstrapBtn').onclick = async () => {
      try {
        await YugaAPI.admin.bootstrap();
        location.reload();
      } catch (err) {
        gateMsg.innerHTML = `<span style="color:var(--danger)">${err.message}</span><br/>
          Ask an existing admin to promote you, or run:<br/>
          <code>UPDATE users SET is_admin=1 WHERE email='${user.email}';</code>`;
      }
    };
  }

  logoutBtn.onclick = async () => {
    await YugaAPI.auth.logout();
    location.href = '/login.html';
  };

  // ── List ───────────────────────────────────────────────────────────────
  async function loadProducts() {
    tbody.innerHTML = '<tr><td colspan="6" class="muted center">Loading…</td></tr>';
    try {
      allProducts = await YugaAPI.listProducts();
      render();
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" class="center" style="color:var(--danger)">${err.message}</td></tr>`;
    }
  }

  function render() {
    const q = (search.value || '').toLowerCase().trim();
    const list = q
      ? allProducts.filter(p =>
          p.name.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q))
      : allProducts;

    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="muted center">No products${q ? ' match this filter' : ''}.</td></tr>`;
      return;
    }
    tbody.innerHTML = list.map(p => {
      const s500 = p.sizes.find(s => s.size === 500) || p.sizes[0];
      const front = YugaUI.productImageFront(p);
      return `
        <tr data-id="${p.id}">
          <td>
            <div class="row-thumb">
              <div class="row-thumb-img"><img src="${front}" alt=""/></div>
            </div>
          </td>
          <td class="row-name">
            <strong>${p.name}</strong>
            <code>${p.slug}</code>
          </td>
          <td class="row-price">
            <strong>${YugaUI.inr(s500.price)}</strong><s>${YugaUI.inr(s500.mrp)}</s>
          </td>
          <td>${p.stock ?? 0}</td>
          <td>${p.rating ? p.rating.toFixed(1) : '—'}</td>
          <td>
            <div class="admin-row-actions">
              <button class="edit" data-act="edit">Edit</button>
              <button class="del"  data-act="del">Delete</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  search.addEventListener('input', render);

  tbody.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const id  = Number(btn.closest('tr').dataset.id);
    const product = allProducts.find(p => p.id === id);
    if (!product) return;

    if (btn.dataset.act === 'edit') openEditor(product);
    else if (btn.dataset.act === 'del') {
      if (!confirm(`Delete "${product.name}"?`)) return;
      try {
        await YugaAPI.admin.deleteProduct(id);
        flashMsg(`Deleted ${product.name}`, 'ok');
        loadProducts();
      } catch (err) { flashMsg(err.message); }
    }
  });

  // ── Editor ─────────────────────────────────────────────────────────────
  newBtn.onclick   = () => openEditor(null);
  cancelBtn.onclick = closeEditor;
  closeBtn.onclick  = closeEditor;
  modal.addEventListener('click', e => { if (e.target === modal) closeEditor(); });
  document.addEventListener('keydown', e => { if (!modal.hidden && e.key === 'Escape') closeEditor(); });

  function openEditor(product) {
    editingId = product?.id || null;
    editorTitle.textContent = product ? `Edit · ${product.name}` : 'New product';
    form.reset();
    form.querySelector('[data-msg]').textContent = '';
    form.querySelector('[data-msg]').className = 'auth-msg';

    if (product) {
      const s = (n) => product.sizes.find(x => x.size === n) || {};
      const s500  = s(500);
      const s1000 = s(1000);
      const s2000 = s(2000);
      setVal('slug',         product.slug);
      setVal('name',         product.name);
      setVal('shortDesc',    product.shortDesc);
      setVal('longDesc',     product.longDesc);
      setVal('woodType',     product.woodType);
      setVal('sourceRegion', product.sourceRegion);
      setVal('image',        product.image);
      setVal('imageHover',   product.imageHover);
      setVal('badge',        product.badge);
      setVal('rating',       product.rating);
      setVal('reviewCount',  product.reviewCount);
      setVal('stock',        product.stock);
      setVal('price500',     s500.price);
      setVal('price1000',    s1000.price);
      setVal('price2000',    s2000.price);
      setVal('mrp500',       s500.mrp);
      setVal('mrp1000',      s1000.mrp);
      setVal('mrp2000',      s2000.mrp);
    }
    refreshPreviews();
    modal.hidden = false;
    requestAnimationFrame(() => modal.classList.add('open'));
  }

  function closeEditor() {
    modal.classList.remove('open');
    setTimeout(() => { modal.hidden = true; }, 180);
  }

  function setVal(name, v) {
    const el = form.elements[name];
    if (!el) return;
    el.value = (v === null || v === undefined) ? '' : v;
  }

  // Live preview of image inputs
  const NUM_FIELDS = ['rating','reviewCount','stock','price500','price1000','price2000','mrp500','mrp1000','mrp2000'];
  function refreshPreviews() {
    document.querySelectorAll('.image-preview').forEach(box => {
      const field = box.dataset.preview;
      const url = (form.elements[field].value || '').trim();
      const fallback = field === 'imageHover' ? '/frames/250.png' : '/frames/001.png';
      const src = YugaUI.resolveImage(url, fallback);
      const existing = box.querySelector('img');
      if (existing) existing.remove();
      const img = document.createElement('img');
      img.src = src;
      img.onerror = () => { box.classList.remove('has-img'); img.remove(); };
      img.onload  = () => { box.classList.add('has-img'); };
      box.appendChild(img);
    });
  }
  ['image','imageHover'].forEach(name => {
    form.elements[name].addEventListener('input', refreshPreviews);
  });

  // ── Local file upload buttons ──────────────────────────────────────────
  form.querySelectorAll('.upload-btn').forEach(btn => {
    const target    = btn.dataset.target;
    const fileInput = form.querySelector(`[data-uploads="${target}"]`);
    btn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files[0];
      if (!file) return;
      const original = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Uploading…';
      try {
        const url = await YugaAPI.admin.uploadImage(file);
        form.elements[target].value = url;
        refreshPreviews();
        flashMsg(`Uploaded ${file.name}`, 'ok');
      } catch (err) {
        const msg = form.querySelector('[data-msg]');
        msg.className = 'auth-msg err';
        msg.textContent = `Upload failed: ${err.message}`;
      } finally {
        btn.disabled = false;
        btn.textContent = original;
        fileInput.value = '';   // allow re-selecting the same file
      }
    });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const payload = {};
    fd.forEach((value, key) => {
      let v = String(value).trim();
      if (v === '') return;
      if (NUM_FIELDS.includes(key)) v = Number(v);
      payload[key] = v;
    });
    const msg = form.querySelector('[data-msg]');
    msg.className = 'auth-msg'; msg.textContent = '';

    try {
      if (editingId) {
        await YugaAPI.admin.updateProduct(editingId, payload);
        flashMsg(`Updated ${payload.name || 'product'}`, 'ok');
      } else {
        await YugaAPI.admin.createProduct(payload);
        flashMsg(`Created ${payload.name}`, 'ok');
      }
      closeEditor();
      loadProducts();
    } catch (err) {
      msg.className = 'auth-msg err';
      msg.textContent = err.message;
    }
  });

  function flashMsg(text, kind) {
    flash.hidden = false;
    flash.className = 'admin-flash' + (kind === 'ok' ? ' ok' : '');
    flash.textContent = text;
    clearTimeout(flashMsg._t);
    flashMsg._t = setTimeout(() => { flash.hidden = true; }, 3500);
  }

  boot();
})();
