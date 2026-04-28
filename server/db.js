// SQLite setup for YugaNaturals
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.YUGA_DB_PATH || path.join(__dirname, 'yuga.db');
const db = new Database(dbPath);

// Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    short_desc TEXT,
    long_desc TEXT,
    wood_type TEXT,
    source_region TEXT,
    price_500 INTEGER,
    price_1000 INTEGER,
    price_2000 INTEGER,
    mrp_500 INTEGER,
    mrp_1000 INTEGER,
    mrp_2000 INTEGER,
    image TEXT,
    badge TEXT,
    rating REAL DEFAULT 4.7,
    review_count INTEGER DEFAULT 0,
    stock INTEGER DEFAULT 100,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS carts (
    id TEXT PRIMARY KEY,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS cart_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cart_id TEXT NOT NULL,
    product_id INTEGER NOT NULL,
    size INTEGER NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
  );

  -- Users / auth.  password_hash is currently SHA-256(password + salt) — backend
  -- dev should swap this for bcrypt / argon2 before any real launch.
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    password_hash TEXT NOT NULL,
    address_line1 TEXT,
    address_line2 TEXT,
    city TEXT,
    state TEXT,
    pincode TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Bearer-token sessions.  Replace with signed JWTs if preferred — keep the
  -- /api/auth response shape ({ user, token }) so the client doesn't change.
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'placed',     -- placed | packed | shipped | delivered | cancelled
    subtotal INTEGER NOT NULL,
    shipping INTEGER NOT NULL DEFAULT 0,
    discount INTEGER NOT NULL DEFAULT 0,
    total INTEGER NOT NULL,
    payment_method TEXT,                        -- upi | card | cod
    payment_status TEXT DEFAULT 'pending',     -- pending | paid | refunded
    shipping_name TEXT,
    shipping_phone TEXT,
    shipping_address TEXT,
    shipping_city TEXT,
    shipping_state TEXT,
    shipping_pincode TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    size INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    price INTEGER NOT NULL,
    mrp INTEGER NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
  );
`);

// ── Lightweight idempotent migrations ─────────────────────────────────────
// Each call ensures a column exists; safe to run on every server boot.
function ensureColumn(table, column, decl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.find(c => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${decl}`);
  }
}
ensureColumn('products', 'image_hover', 'TEXT');
ensureColumn('users',    'is_admin',    'INTEGER NOT NULL DEFAULT 0');

module.exports = db;
