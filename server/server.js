// YugaNaturals Express API + static client server
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs   = require('fs');
const crypto = require('crypto');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
// Bumped from the default 100kb so admin image uploads (base64-encoded JSON)
// fit. 12mb covers a ~8mb raw image after base64 overhead.
app.use(express.json({ limit: '12mb' }));

// Serve the static client
const clientDir  = path.join(__dirname, '..', 'client');
const uploadsDir = path.join(clientDir, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
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
    image:      row.image,
    imageHover: row.image_hover,
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

// ---------- Auth helpers ----------
// TEMPORARY hash for dev — backend dev: replace with bcrypt or argon2.
const PW_SALT = process.env.YUGA_PW_SALT || 'yuga-salt-v1';
function hashPassword(password) {
  return crypto.createHash('sha256').update(String(password) + PW_SALT).digest('hex');
}
function makeSessionToken() { return crypto.randomBytes(24).toString('hex'); }

function userFromToken(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  const row = db.prepare(`
    SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token = ?
  `).get(token);
  return row || null;
}

function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id, name: u.name, email: u.email, phone: u.phone || null,
    isAdmin: !!u.is_admin,
    address: {
      line1: u.address_line1 || null, line2: u.address_line2 || null,
      city: u.city || null, state: u.state || null, pincode: u.pincode || null
    },
    createdAt: u.created_at
  };
}

function requireAuth(req, res) {
  const u = userFromToken(req);
  if (!u) { res.status(401).json({ error: 'not authenticated' }); return null; }
  return u;
}

function requireAdmin(req, res) {
  const u = requireAuth(req, res);
  if (!u) return null;
  if (!u.is_admin) { res.status(403).json({ error: 'admin access required' }); return null; }
  return u;
}

function getOrder(orderId) {
  const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!o) return null;
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);
  return {
    id: o.id, status: o.status,
    subtotal: o.subtotal, shipping: o.shipping, discount: o.discount, total: o.total,
    paymentMethod: o.payment_method, paymentStatus: o.payment_status,
    shippingAddress: {
      name: o.shipping_name, phone: o.shipping_phone,
      line1: o.shipping_address, city: o.shipping_city,
      state: o.shipping_state, pincode: o.shipping_pincode
    },
    notes: o.notes, createdAt: o.created_at,
    items: items.map(i => ({
      productId: i.product_id, name: i.name, size: i.size,
      quantity: i.quantity, price: i.price, mrp: i.mrp,
      lineTotal: i.price * i.quantity
    }))
  };
}

// ---------- API ----------
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'yuganaturals-api' }));

/**
 * GET /api/search?q=<text>&limit=<n>
 * Lightweight search for the header overlay — returns trimmed product cards.
 * Response: [{ id, slug, name, image, sourceRegion, woodType, price, mrp }]
 */
app.get('/api/search', (req, res) => {
  const q = (req.query.q || '').trim();
  const limit = Math.min(20, Math.max(1, Number(req.query.limit) || 8));
  if (!q) return res.json([]);
  const like = `%${q}%`;
  const rows = db.prepare(`
    SELECT id, slug, name, image, source_region, wood_type, price_500, mrp_500
    FROM products
    WHERE name LIKE ? OR short_desc LIKE ? OR wood_type LIKE ? OR source_region LIKE ?
    ORDER BY rating DESC, review_count DESC
    LIMIT ?
  `).all(like, like, like, like, limit);
  res.json(rows.map(r => ({
    id: r.id, slug: r.slug, name: r.name, image: r.image,
    sourceRegion: r.source_region, woodType: r.wood_type,
    price: r.price_500, mrp: r.mrp_500
  })));
});

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

// =====================================================================
//  AUTH
//  All auth endpoints accept JSON and (for protected routes) a bearer
//  token via the Authorization header:  Authorization: Bearer <token>
//  Errors are returned as { error: "<message>" } with a non-2xx status.
// =====================================================================

/**
 * POST /api/auth/signup
 * Body:     { name: string, email: string, password: string, phone?: string }
 * Response: 201  { user: PublicUser, token: string }
 *           400  { error } — missing fields / weak password
 *           409  { error } — email already registered
 */
app.post('/api/auth/signup', (req, res) => {
  const { name, email, password, phone } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email and password are required' });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: 'password must be at least 6 characters' });
  }
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'email already registered' });

  const info = db.prepare(`
    INSERT INTO users (name, email, password_hash, phone)
    VALUES (?, ?, ?, ?)
  `).run(name, email, hashPassword(password), phone || null);

  const token = makeSessionToken();
  db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, info.lastInsertRowid);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ user: publicUser(user), token });
});

/**
 * POST /api/auth/login
 * Body:     { email: string, password: string }
 * Response: 200  { user: PublicUser, token: string }
 *           400  { error } — missing fields
 *           401  { error } — invalid credentials
 */
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || user.password_hash !== hashPassword(password)) {
    return res.status(401).json({ error: 'invalid email or password' });
  }
  const token = makeSessionToken();
  db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, user.id);
  res.json({ user: publicUser(user), token });
});

/**
 * POST /api/auth/google
 * Body:     { credential: string }    // Google ID token (JWT) from GIS button
 * Response: 200  { user: PublicUser, token: string }
 *           400  { error } — credential missing
 *           401  { error } — credential could not be decoded / no email
 *
 * BACKEND TODO — replace the unsigned JWT decode below with proper verification:
 *   const { OAuth2Client } = require('google-auth-library');
 *   const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
 *   const ticket = await client.verifyIdToken({
 *     idToken: credential,
 *     audience: process.env.GOOGLE_CLIENT_ID
 *   });
 *   const payload = ticket.getPayload();   // { sub, email, name, picture, ... }
 *
 * The stub below decodes the payload WITHOUT verifying the signature so the
 * dev flow stays unblocked while a Google client ID is being provisioned.
 */
app.post('/api/auth/google', (req, res) => {
  const { credential } = req.body || {};
  if (!credential) return res.status(400).json({ error: 'credential is required' });

  let payload;
  try {
    const part = String(credential).split('.')[1];
    payload = JSON.parse(Buffer.from(part, 'base64').toString('utf8'));
  } catch (_) {
    return res.status(401).json({ error: 'invalid Google credential' });
  }
  if (!payload.email) return res.status(401).json({ error: 'email missing from credential' });

  let user = db.prepare('SELECT * FROM users WHERE email = ?').get(payload.email);
  if (!user) {
    const info = db.prepare(`
      INSERT INTO users (name, email, password_hash)
      VALUES (?, ?, ?)
    `).run(
      payload.name || payload.email.split('@')[0],
      payload.email,
      'oauth-google'   // sentinel — these accounts can't password-login
    );
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  }

  const token = makeSessionToken();
  db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, user.id);
  res.json({ user: publicUser(user), token });
});

/**
 * POST /api/auth/logout
 * Header:   Authorization: Bearer <token>
 * Response: 200  { ok: true }   (idempotent — succeeds even if token missing)
 */
app.post('/api/auth/logout', (req, res) => {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  res.json({ ok: true });
});

/**
 * GET /api/auth/me
 * Header:   Authorization: Bearer <token>
 * Response: 200  { user: PublicUser }
 *           401  { error } — missing / invalid token
 */
app.get('/api/auth/me', (req, res) => {
  const u = requireAuth(req, res); if (!u) return;
  res.json({ user: publicUser(u) });
});

/**
 * PATCH /api/auth/me
 * Header:   Authorization: Bearer <token>
 * Body:     { name?, phone?, address?: { line1?, line2?, city?, state?, pincode? } }
 * Response: 200  { user: PublicUser }   (only provided fields are updated)
 *           401  { error }
 */
app.patch('/api/auth/me', (req, res) => {
  const u = requireAuth(req, res); if (!u) return;
  const { name, phone, address = {} } = req.body || {};
  db.prepare(`
    UPDATE users SET
      name          = COALESCE(?, name),
      phone         = COALESCE(?, phone),
      address_line1 = COALESCE(?, address_line1),
      address_line2 = COALESCE(?, address_line2),
      city          = COALESCE(?, city),
      state         = COALESCE(?, state),
      pincode       = COALESCE(?, pincode)
    WHERE id = ?
  `).run(
    name ?? null,
    phone ?? null,
    address.line1 ?? null,
    address.line2 ?? null,
    address.city ?? null,
    address.state ?? null,
    address.pincode ?? null,
    u.id
  );
  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(u.id);
  res.json({ user: publicUser(updated) });
});

// =====================================================================
//  ORDERS
//  All routes require Authorization: Bearer <token>.
// =====================================================================

/**
 * POST /api/orders
 * Body:     {
 *             cartId: string,
 *             paymentMethod: 'upi' | 'card' | 'cod',
 *             shippingAddress: { name, phone, line1, line2?, city, state, pincode },
 *             notes?: string
 *           }
 * Response: 201  { order: Order }   (cart is emptied on success)
 *           400  { error }          — missing cartId / empty cart
 *           401  { error }
 */
app.post('/api/orders', (req, res) => {
  const u = requireAuth(req, res); if (!u) return;
  const { cartId, paymentMethod, shippingAddress = {}, notes } = req.body || {};
  if (!cartId) return res.status(400).json({ error: 'cartId is required' });
  const summary = cartSummary(cartId);
  if (!summary.items.length) return res.status(400).json({ error: 'cart is empty' });

  const tx = db.transaction(() => {
    const orderInfo = db.prepare(`
      INSERT INTO orders (
        user_id, status, subtotal, shipping, discount, total,
        payment_method, shipping_name, shipping_phone, shipping_address,
        shipping_city, shipping_state, shipping_pincode, notes
      ) VALUES (?, 'placed', ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      u.id, summary.subtotal, summary.shipping, summary.total,
      paymentMethod || null,
      shippingAddress.name    || u.name,
      shippingAddress.phone   || u.phone,
      shippingAddress.line1   || u.address_line1,
      shippingAddress.city    || u.city,
      shippingAddress.state   || u.state,
      shippingAddress.pincode || u.pincode,
      notes || null
    );
    const orderId = orderInfo.lastInsertRowid;
    summary.items.forEach(it => {
      db.prepare(`
        INSERT INTO order_items (order_id, product_id, name, size, quantity, price, mrp)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(orderId, it.productId, it.name, it.size, it.quantity, it.price, it.mrp);
    });
    db.prepare('DELETE FROM cart_items WHERE cart_id = ?').run(cartId);
    return orderId;
  });
  const orderId = tx();
  res.status(201).json({ order: getOrder(orderId) });
});

/**
 * GET /api/orders
 * Response: 200  { orders: Order[] }   (most recent first)
 */
app.get('/api/orders', (req, res) => {
  const u = requireAuth(req, res); if (!u) return;
  const ids = db.prepare('SELECT id FROM orders WHERE user_id = ? ORDER BY id DESC').all(u.id);
  res.json({ orders: ids.map(o => getOrder(o.id)) });
});

/**
 * GET /api/orders/:id
 * Response: 200  { order: Order }
 *           404  { error } — not the user's order or doesn't exist
 */
app.get('/api/orders/:id', (req, res) => {
  const u = requireAuth(req, res); if (!u) return;
  const found = db.prepare('SELECT id FROM orders WHERE id = ? AND user_id = ?').get(req.params.id, u.id);
  if (!found) return res.status(404).json({ error: 'order not found' });
  res.json({ order: getOrder(found.id) });
});

// =====================================================================
//  ADMIN
//  All routes require an authenticated user with users.is_admin = 1.
//  Promote a user manually:
//      sqlite3 yuga.db "UPDATE users SET is_admin=1 WHERE email='you@x.com'"
//  …or call POST /api/admin/bootstrap once (only works if NO admins exist).
// =====================================================================

const PRODUCT_FIELDS = [
  ['slug',          'slug'         ],
  ['name',          'name'         ],
  ['shortDesc',     'short_desc'   ],
  ['longDesc',      'long_desc'    ],
  ['woodType',      'wood_type'    ],
  ['sourceRegion',  'source_region'],
  ['image',         'image'        ],
  ['imageHover',    'image_hover'  ],
  ['badge',         'badge'        ],
  ['rating',        'rating'       ],
  ['reviewCount',   'review_count' ],
  ['stock',         'stock'        ],
  ['price500',      'price_500'    ],
  ['price1000',     'price_1000'   ],
  ['price2000',     'price_2000'   ],
  ['mrp500',        'mrp_500'      ],
  ['mrp1000',       'mrp_1000'     ],
  ['mrp2000',       'mrp_2000'     ],
];

/**
 * POST /api/admin/bootstrap
 * Header:   Authorization: Bearer <token>
 * One-shot promotion: marks the requester as admin IFF no admins exist yet.
 * Response: 200 { user }   |   401   |   409 (admins already exist)
 */
app.post('/api/admin/bootstrap', (req, res) => {
  const u = requireAuth(req, res); if (!u) return;
  const adminCount = db.prepare('SELECT COUNT(*) AS n FROM users WHERE is_admin = 1').get().n;
  if (adminCount > 0) return res.status(409).json({ error: 'admins already exist' });
  db.prepare('UPDATE users SET is_admin = 1 WHERE id = ?').run(u.id);
  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(u.id);
  res.json({ user: publicUser(updated) });
});

/**
 * POST /api/admin/products
 * Body:     {
 *   slug, name, shortDesc?, longDesc?, woodType?, sourceRegion?,
 *   image, imageHover?, badge?, rating?, reviewCount?, stock?,
 *   price500, price1000, price2000, mrp500, mrp1000, mrp2000
 * }
 * Response: 201 { product }   |   400 (validation)   |   409 (slug taken)
 */
app.post('/api/admin/products', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const body = req.body || {};
  if (!body.slug || !body.name) return res.status(400).json({ error: 'slug and name are required' });
  if (db.prepare('SELECT id FROM products WHERE slug = ?').get(body.slug)) {
    return res.status(409).json({ error: 'a product with this slug already exists' });
  }

  const cols = PRODUCT_FIELDS.map(([_, db_col]) => db_col).join(', ');
  const placeholders = PRODUCT_FIELDS.map(() => '?').join(', ');
  const values = PRODUCT_FIELDS.map(([api_key]) => body[api_key] ?? null);

  const info = db.prepare(`INSERT INTO products (${cols}) VALUES (${placeholders})`).run(...values);
  const created = db.prepare('SELECT * FROM products WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ product: buildProduct(created) });
});

/**
 * PATCH /api/admin/products/:id
 * Body:     any subset of the create-product fields.  Only provided fields are updated.
 * Response: 200 { product }   |   404   |   409 (slug collision)
 */
app.patch('/api/admin/products/:id', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'product not found' });
  const body = req.body || {};

  if (body.slug && body.slug !== existing.slug) {
    const clash = db.prepare('SELECT id FROM products WHERE slug = ? AND id != ?').get(body.slug, id);
    if (clash) return res.status(409).json({ error: 'another product already uses this slug' });
  }

  const sets = [];
  const values = [];
  PRODUCT_FIELDS.forEach(([api_key, db_col]) => {
    if (Object.prototype.hasOwnProperty.call(body, api_key)) {
      sets.push(`${db_col} = ?`);
      values.push(body[api_key]);
    }
  });
  if (sets.length) {
    values.push(id);
    db.prepare(`UPDATE products SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  }
  const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  res.json({ product: buildProduct(updated) });
});

/**
 * DELETE /api/admin/products/:id
 * Response: 200 { ok: true }   |   404
 */
app.delete('/api/admin/products/:id', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const id = Number(req.params.id);
  const found = db.prepare('SELECT id FROM products WHERE id = ?').get(id);
  if (!found) return res.status(404).json({ error: 'product not found' });
  db.prepare('DELETE FROM products WHERE id = ?').run(id);
  res.json({ ok: true });
});

/**
 * POST /api/admin/uploads
 * Body:     { filename: string, dataUrl: string }
 *           dataUrl is a browser FileReader.readAsDataURL output:
 *           "data:image/png;base64,iVBORw0KGgo..."
 * Response: 201 { url: '/uploads/<saved-file>' }   — admin pastes this into the
 *                                                    image / imageHover field
 *           400 (validation)   413 (too large)   401/403 (auth)
 *
 * Files are saved under client/uploads/ and served via the existing static
 * middleware. No new npm deps required.
 */
const UPLOAD_MAX_BYTES = 8 * 1024 * 1024;   // 8 MB raw image
const ALLOWED_MIMES = {
  'image/png':  'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif':  'gif',
  'image/svg+xml': 'svg'
};
app.post('/api/admin/uploads', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { filename, dataUrl } = req.body || {};
  if (!dataUrl) return res.status(400).json({ error: 'dataUrl is required' });

  const m = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/);
  if (!m) return res.status(400).json({ error: 'invalid data URL' });
  const mime = m[1].toLowerCase();
  const ext  = ALLOWED_MIMES[mime];
  if (!ext) return res.status(400).json({ error: 'only png / jpg / webp / gif / svg are allowed' });

  let buf;
  try { buf = Buffer.from(m[2], 'base64'); }
  catch (_) { return res.status(400).json({ error: 'failed to decode image' }); }
  if (buf.length === 0)            return res.status(400).json({ error: 'empty image' });
  if (buf.length > UPLOAD_MAX_BYTES) return res.status(413).json({ error: `image too large (${UPLOAD_MAX_BYTES/1024/1024} MB max)` });

  // Sanitize filename: strip path, allow only [a-z0-9._-], cap length, ensure extension
  const base   = String(filename || '').split(/[\\/]/).pop().replace(/\.[^.]+$/, '');
  const safe   = base.replace(/[^a-z0-9._-]/gi, '_').slice(0, 60) || 'upload';
  const final  = `${Date.now()}-${crypto.randomBytes(3).toString('hex')}-${safe}.${ext}`;
  fs.writeFileSync(path.join(uploadsDir, final), buf);
  res.status(201).json({ url: '/uploads/' + final, bytes: buf.length });
});

// SPA-ish fallback for html pages
app.get(['/product/:slug', '/cart'], (_req, res) => {
  res.sendFile(path.join(clientDir, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`YugaNaturals server running on http://localhost:${PORT}`);
});
