# YugaNaturals — Wood Cold-Pressed Oils

A small e-commerce storefront for a fictional cold-pressed oils brand.
The client and server are fully separate; the server also serves the static client for convenience.

## Structure

```
YugaNaturals/
├── client/                 # Static front-end (HTML/CSS/JS, no build step)
│   ├── index.html          # Collection page
│   ├── product.html        # Product detail
│   ├── cart.html           # Cart
│   ├── css/styles.css
│   ├── js/
│   │   ├── api.js          # Fetch helpers + cart id in localStorage
│   │   ├── main.js         # Collection page logic
│   │   ├── product.js      # Product detail logic
│   │   └── cart.js         # Cart page logic
│   └── images/             # Product SVG illustrations
└── server/                 # Node/Express + SQLite REST API
    ├── package.json
    ├── db.js               # SQLite schema (better-sqlite3)
    ├── seed.js             # Inserts 8 sample products
    ├── server.js           # REST API + static file serving
    └── yuga.db             # SQLite file (created on first run)
```

## Quick start

```bash
cd server
npm install
npm run seed        # populates yuga.db with 8 products
npm start           # http://localhost:4000
```

Then open **http://localhost:4000** in your browser.

## API endpoints

| Method | Path                                | Purpose                          |
| ------ | ----------------------------------- | -------------------------------- |
| GET    | `/api/health`                       | Health check                     |
| GET    | `/api/products`                     | List all products (`?q=` search) |
| GET    | `/api/products/:slug`               | Single product by slug           |
| POST   | `/api/cart`                         | Create a new cart                |
| GET    | `/api/cart/:cartId`                 | Fetch cart with totals           |
| POST   | `/api/cart/:cartId/items`           | Add item `{productId, size, quantity}` |
| PATCH  | `/api/cart/:cartId/items/:itemId`   | Update quantity (0 removes)      |
| DELETE | `/api/cart/:cartId/items/:itemId`   | Remove item                      |

Cart id is stored in `localStorage` under the key `yuga_cart_id`, so the same cart
persists between tabs for the same browser.

## Tech choices

- **Front-end** — plain HTML/CSS/JS (no framework, no build step) to keep things easy to read and modify.
- **Back-end** — Node.js + Express.
- **Database** — SQLite via `better-sqlite3` (synchronous, zero-setup).
- **Fonts** — Fraunces + Inter from Google Fonts for an editorial, earthy look.

## Notes

- All product copy, branding, and visuals in this project are original to YugaNaturals and are *inspired by* the general layout patterns of modern Indian cold-pressed oil stores, not copied from any specific site.
- Checkout is intentionally a stub — the button just shows an alert. Wire up your payment gateway (Razorpay, Stripe, etc.) there when ready.

## License

Your own — treat this as a starter you can freely modify.
