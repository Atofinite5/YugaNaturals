// YugaNaturals Express API + static client server
const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Serve the static client
const clientDir = path.join(__dirname, '..', 'client');
app.use(express.static(clientDir));

// ---------- Helpers ----------
function buildProduct(row) {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    shortDesc: row.short_desc,
    longDesc: row.long_desc,
    woodType: row.wood_type,
    sourceRegion: row.source_region,
    image: row.image,
    badge: row.badge,
    rating: row.rating,
    reviewCount: row.review_count,
    stock: row.stock,
    sizes: [
      { size: 500, label: '५०० मिली', price: row.price_500, mrp: row.mrp_500 },
      { size: 1000, label: '१ लिटर', price: row.price_1000, mrp: row.mrp_1000 },
      { size: 2000, label: '२ लिटर', price: row.price_2000, mrp: row.mrp_2000 }
    ]
  };
}

function ensureCart(cartId) {
  if (!cartId) cartId = crypto.randomUUID();
  const exists = db.prepare('SELECT id FROM carts WHERE id = ?').get(cartId);
  if (!exists) db.prepare('INSERT INTO carts (id) VALUES (?)').run(cartId);
  return cartId;
}

function cartSummary(cartId) {
  const rows = db.prepare(`
    SELECT ci.id AS item_id, ci.quantity, ci.size, p.*
    FROM cart_items ci
    JOIN products p ON p.id = ci.product_id
    WHERE ci.cart_id = ?
    ORDER BY ci.id DESC
  `).all(cartId);

  let subtotal = 0, savings = 0;
  const items = rows.map(r => {
    const sizeField = `price_${r.size}`;
    const mrpField  = `mrp_${r.size}`;
    const price = r[sizeField];
    const mrp   = r[mrpField];
    const lineTotal = price * r.quantity;
    const lineMrp   = mrp * r.quantity;
    subtotal += lineTotal;
    savings  += (lineMrp - lineTotal);
    return {
      itemId: r.item_id,
      productId: r.id,
      slug: r.slug,
      name: r.name,
      image: r.image,
      size: r.size,
      sizeLabel: r.size >= 1000 ? `${r.size/1000 === 1 ? '१' : r.size/1000 === 2 ? '२' : r.size/1000} लिटर` : `${r.size === 500 ? '५००' : r.size} मिली`,
      price, mrp, quantity: r.quantity,
      lineTotal
    };
  });

  const shipping = subtotal > 0 && subtotal < 499 ? 49 : 0;
  const total = subtotal + shipping;

  return { cartId, items, subtotal, savings, shipping, total, count: items.reduce((n,i)=>n+i.quantity,0) };
}

// ---------- API ----------
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'yuganaturals-api' }));

app.get('/api/products', (req, res) => {
  const { q } = req.query;
  let rows;
  if (q) {
    const like = `%${q}%`;
    rows = db.prepare(`
      SELECT * FROM products
      WHERE name LIKE ? OR short_desc LIKE ? OR wood_type LIKE ?
      ORDER BY rating DESC, review_count DESC
    `).all(like, like, like);
  } else {
    rows = db.prepare('SELECT * FROM products ORDER BY id ASC').all();
  }
  res.json(rows.map(buildProduct));
});

app.get('/api/products/:slug', (req, res) => {
  const row = db.prepare('SELECT * FROM products WHERE slug = ?').get(req.params.slug);
  if (!row) return res.status(404).json({ error: 'Product not found' });
  res.json(buildProduct(row));
});

app.post('/api/cart', (req, res) => {
  const cartId = ensureCart(req.body?.cartId);
  res.json(cartSummary(cartId));
});

app.get('/api/cart/:cartId', (req, res) => {
  const cartId = ensureCart(req.params.cartId);
  res.json(cartSummary(cartId));
});

app.post('/api/cart/:cartId/items', (req, res) => {
  const { productId, size, quantity = 1 } = req.body || {};
  if (!productId || !size) return res.status(400).json({ error: 'productId and size required' });
  if (![500, 1000, 2000].includes(Number(size))) return res.status(400).json({ error: 'invalid size' });

  const cartId = ensureCart(req.params.cartId);
  const product = db.prepare('SELECT id FROM products WHERE id = ?').get(productId);
  if (!product) return res.status(404).json({ error: 'product not found' });

  // Merge if item with same size already exists
  const existing = db.prepare(`
    SELECT id, quantity FROM cart_items
    WHERE cart_id = ? AND product_id = ? AND size = ?
  `).get(cartId, productId, size);

  if (existing) {
    db.prepare('UPDATE cart_items SET quantity = ? WHERE id = ?')
      .run(existing.quantity + Number(quantity), existing.id);
  } else {
    db.prepare(`
      INSERT INTO cart_items (cart_id, product_id, size, quantity)
      VALUES (?, ?, ?, ?)
    `).run(cartId, productId, Number(size), Number(quantity));
  }
  res.json(cartSummary(cartId));
});

app.patch('/api/cart/:cartId/items/:itemId', (req, res) => {
  const { quantity } = req.body || {};
  const q = Number(quantity);
  if (!Number.isFinite(q)) return res.status(400).json({ error: 'quantity required' });
  if (q <= 0) {
    db.prepare('DELETE FROM cart_items WHERE id = ? AND cart_id = ?')
      .run(req.params.itemId, req.params.cartId);
  } else {
    db.prepare('UPDATE cart_items SET quantity = ? WHERE id = ? AND cart_id = ?')
      .run(q, req.params.itemId, req.params.cartId);
  }
  res.json(cartSummary(req.params.cartId));
});

app.delete('/api/cart/:cartId/items/:itemId', (req, res) => {
  db.prepare('DELETE FROM cart_items WHERE id = ? AND cart_id = ?')
    .run(req.params.itemId, req.params.cartId);
  res.json(cartSummary(req.params.cartId));
});

// SPA-ish fallback for html pages
app.get(['/product/:slug', '/cart'], (_req, res) => {
  res.sendFile(path.join(clientDir, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`YugaNaturals server running on http://localhost:${PORT}`);
});
