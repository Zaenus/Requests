# Enterprise Request System

A web application for managing product requisitions within a business organisation. Employees submit requests for products across sectors/departments, and administrators review, approve or deny them. The app stores all request history and generates reports with charts.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [API Reference](#api-reference)
- [Known Issues & Improvement Ideas](#known-issues--improvement-ideas)

---

## Overview

**Key features:**

- Multi-user authentication with role-based access (admin / user)
- Product request submission — multiple items per request
- Approval workflow: `pending` → `approved` / `done` / `printed`
- Sector and product catalogue management
- Request reporting with date filtering and monthly summary charts

---

## Architecture

```
Browser (Vanilla HTML/CSS/JS)
        │
        │  HTTP / REST JSON
        ▼
Express 5 server  ──►  SQLite 3 database (enterprise.db)
  └─ JWT auth middleware
  └─ /api/authentication   (login)
  └─ /api/sectors          (sector CRUD)
  └─ /api/admin            (products & request management)
  └─ /api/requests         (request submission)
  └─ /api/reports          (filtered reporting)
```

The database is a single file (`data/enterprise.db`) created automatically on first run.  
Users are managed exclusively through the CLI utility `src/add-user.js`.

---

## Tech Stack

| Layer      | Technology              | Version |
|------------|-------------------------|---------|
| Runtime    | Node.js                 | ≥ 18    |
| Framework  | Express                 | 5.1.0   |
| Database   | SQLite3                 | 5.1.7   |
| Auth       | jsonwebtoken + bcrypt   | 9.0.2 / 6.0.0 |
| Frontend   | Vanilla HTML/CSS/JS     | ES2020+ |
| Dev server | nodemon                 | 3.1.10  |

---

## Getting Started

### 1 — Prerequisites

- Node.js ≥ 18
- npm

### 2 — Install dependencies

```bash
cd enterprise-request
npm install
```

### 3 — Configure environment

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

> **Required:** set `JWT_SECRET` to a long, random string before running in any shared environment.

### 4 — Add the first user

```bash
node src/add-user.js
```

Follow the prompts to set a username, password, and role (`admin` or `user`).

### 5 — Start the server

```bash
# Development (auto-reload on changes)
npm run dev

# Production
npm start
```

The server listens on `http://localhost:3020` by default (configurable via `PORT` in `.env`).

---

## Project Structure

```
enterprise-request/
├── src/
│   ├── server.js           # Express app entry point & auth middleware
│   ├── db.js               # SQLite initialisation & schema
│   ├── add-user.js         # CLI utility to create users
│   └── routes/
│       ├── authentication.js  # POST /api/authentication/login
│       ├── sectors.js         # CRUD for sectors
│       ├── admin.js           # Products & request management
│       ├── requests.js        # Request submission
│       └── reports.js         # Filtered reporting
├── public/
│   ├── index.html          # Request submission form
│   ├── admin.html          # Sector/product administration
│   ├── autorizacao.html    # Approval workflow (requires login)
│   ├── deposit.html        # Fulfilment / inventory view
│   ├── products.html       # Product catalogue
│   ├── reports.html        # Charts & analytics
│   ├── js/                 # One JS file per page
│   └── css/                # One CSS file per page
└── data/
    └── enterprise.db       # Auto-created SQLite database (git-ignored)
```

---

## API Reference

### Authentication

| Method | Path | Body | Description |
|--------|------|------|-------------|
| POST | `/api/authentication/login` | `{ username, password }` | Returns a JWT token |

### Sectors

| Method | Path | Description |
|--------|------|-------------|
| GET    | `/api/sectors` | List all sectors |
| POST   | `/api/sectors` | Create a sector |
| PUT    | `/api/sectors/:id` | Update a sector |
| DELETE | `/api/sectors/:id` | Delete a sector |

### Products (admin)

| Method | Path | Description |
|--------|------|-------------|
| GET    | `/api/admin/products` | List all products |
| GET    | `/api/admin/products-sector_id?sector_id=` | Products in a sector |
| POST   | `/api/admin/products` | Create a product |
| PUT    | `/api/admin/products/:id` | Update a product |
| DELETE | `/api/admin/products/:id` | Delete a product |

### Requests

| Method | Path | Description |
|--------|------|-------------|
| POST   | `/api/requests` | Submit a single-product request |
| POST   | `/api/requests/enviar_requisicao` | Submit a multi-product request |

### Requests (admin)

| Method | Path | Description |
|--------|------|-------------|
| GET    | `/api/admin/requests?status=` | List requests (optionally filter by status) |
| GET    | `/api/admin/requests/:id` | Get a specific request |
| PUT    | `/api/admin/requests/:id` | Update request status |
| PUT    | `/api/admin/request_items/:request_id/:product_id` | Edit an item quantity |
| DELETE | `/api/admin/request_items/:request_id/:product_id` | Remove an item |

### Reports

| Method | Path | Query params | Description |
|--------|------|------|-------------|
| GET    | `/api/reports/approved-items` | `sector_id`, `start`, `end` | Returns approved/printed request items |

### Health check

| Method | Path | Description |
|--------|------|-------------|
| GET    | `/api/health` | Returns `{ ok: true }` |

---

## Known Issues & Improvement Ideas

The following issues were identified during a code review. They are listed by priority.

### ✅ Fixed in this revision

- **SQL syntax error in `reports.js`** — When no optional query filters were provided, `AND r.status IN (...)` was appended without a preceding `WHERE` keyword, producing invalid SQL and a 500 error on every unfiltered report request.
- **Race condition in multi-product request endpoint** (`requests.js`) — A manual counter detected completion of async `db.get` callbacks, but nested `db.run` INSERT calls could still be pending when `COMMIT` was issued, causing insert errors to be silently dropped. Replaced with `Promise.all()`.
- **Missing `.gitignore`** — `node_modules/`, `data/enterprise.db`, and `.env` were not excluded from version control.
- **No `.env.example`** — There was no template documenting required environment variables.

---

### 🔴 Critical — Security

1. **Hardcoded JWT secret fallback** (`server.js` line 10, `authentication.js` line 7)  
   The default `'your_jwt_secret_key'` is used when `JWT_SECRET` is not set in the environment. Any application without a `.env` file is trivially exploitable.  
   *Fix:* Throw a startup error if `JWT_SECRET` is not defined in the environment.

2. **No authentication on most API routes**  
   `authenticateToken` is defined in `server.js` but never applied to `/api/sectors`, `/api/admin`, or `/api/reports`. Any unauthenticated user can list, create, update, or delete products and change request statuses.  
   *Fix:* Apply `authenticateToken` as middleware in `server.js` for all admin/report route groups; update frontend pages to send the `Authorization` header.

3. **No role-based access control (RBAC)**  
   The JWT payload includes a `role` field but it is never checked. Any authenticated user can perform admin operations.  
   *Fix:* Add a role-checking middleware (e.g. `requireRole('admin')`) and apply it to mutation endpoints.

4. **JWT stored in `localStorage`** (`autorizacao.js` line 18)  
   Tokens in `localStorage` are accessible to any JavaScript on the page and are vulnerable to XSS attacks.  
   *Fix:* Use `HttpOnly` cookies to store the JWT.

### 🟠 High Priority — Correctness

5. **Missing database transaction for single-product requests** (`requests.js` lines 17–35)  
   The multi-product endpoint uses a transaction but the single-product path does not. If the `INSERT INTO request_items` fails, an orphaned request record is left in the database.  
   *Fix:* Wrap both inserts in a `BEGIN / COMMIT / ROLLBACK` block.

### 🟡 Medium Priority — Code Quality

6. **Duplicated `fetchJSON` helper**  
   Identical `fetchJSON` functions are copy-pasted into `admin.js`, `deposit.js`, `products.js`, and `autorizacao.js`. Any behaviour change must be made in four places.  
   *Fix:* Extract to `public/js/api.js` and load it as a shared script tag or ES module.

7. **Callback-based async pattern**  
   Most database calls use deeply nested callbacks ("pyramid of doom"), making error handling fragile. Node.js `util.promisify` or the `better-sqlite3` package would allow `async/await` throughout.

8. **GROUP_CONCAT product formatting**  
   Product names and quantities are concatenated as a single string in SQL (`p.name || ' (' || ri.quantity || ' ' || p.unit || ')'`) and then split by commas on the frontend. A comma in a product name would break parsing.  
   *Fix:* Return a JSON array of objects from the query instead.

9. **Inconsistent error response format**  
   Some endpoints return `{ error: 'message' }`, others forward raw SQLite error text. Frontend code assumes JSON but sometimes receives plain text.  
   *Fix:* Standardise on `{ error: 'message' }` for all error responses.

### 🟢 Low Priority — Developer Experience

10. **No tests**  
    The `test` script exits with an error code. There are no unit or integration tests.  
    *Fix:* Add Jest with `supertest` for API route testing.

11. **Minimal logging**  
    Only the startup message is logged. Add `morgan` for HTTP request logging and a logger (e.g. `winston`) for application-level events.

12. **No input validation library**  
    Field validation is done with ad-hoc `if` checks. Consider `zod` or `joi` for declarative schema validation.

13. **No rate limiting**  
    The login endpoint and all mutation endpoints are open to brute-force and flood attacks.  
    *Fix:* Add `express-rate-limit`.

14. **Mixed language naming**  
    File and variable names mix Portuguese (`autorizacao`, `requisicao`, `setor`) and English. Standardising on one language improves maintainability for international contributors.

15. **No API documentation**  
    No OpenAPI/Swagger spec is provided. Adding `swagger-jsdoc` and `swagger-ui-express` would generate interactive docs from JSDoc comments.

16. **Database not closed on shutdown**  
    `db.close()` is never called when the process exits.  
    *Fix:* Add a `process.on('SIGTERM', ...)` / `process.on('SIGINT', ...)` handler to close the database cleanly.

