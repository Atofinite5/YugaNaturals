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
`);

module.exports = db;
