/**
 * API route tests using Jest + supertest.
 *
 * The app uses a file-based SQLite database.  For tests we set NODE_ENV=test
 * so that morgan logging is suppressed, and we point the database at a
 * temporary in-memory file that is removed after each suite.
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-for-jest';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');

// Generate an admin JWT directly (no DB user needed for auth header usage).
const adminToken = () =>
  jwt.sign({ id: 1, username: 'test-admin', role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });

// Shorthand for authenticated supertest calls.
const asAdmin = (method, url) =>
  request(app)[method](url).set('Authorization', `Bearer ${adminToken()}`);

// ─── Health & public routes ───────────────────────────────────────────────────

describe('GET /api/health', () => {
  it('returns { ok: true }', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});

// ─── Authentication ───────────────────────────────────────────────────────────

describe('POST /api/authentication/login', () => {
  it('rejects missing credentials with 400', async () => {
    const res = await request(app)
      .post('/api/authentication/login')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('rejects wrong credentials with 401', async () => {
    const res = await request(app)
      .post('/api/authentication/login')
      .send({ username: 'nobody', password: 'wrong' });
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });
});

// ─── Protected routes — unauthenticated requests ──────────────────────────────

describe('Admin routes without token', () => {
  it('GET /api/admin/products returns 401', async () => {
    const res = await request(app).get('/api/admin/products');
    expect(res.status).toBe(401);
  });

  it('GET /api/admin/requests returns 401', async () => {
    const res = await request(app).get('/api/admin/requests');
    expect(res.status).toBe(401);
  });

  it('GET /api/reports/approved-items returns 401', async () => {
    const res = await request(app).get('/api/reports/approved-items');
    expect(res.status).toBe(401);
  });
});

// ─── Public endpoints ─────────────────────────────────────────────────────────

describe('GET /api/sectors', () => {
  it('returns an array', async () => {
    const res = await request(app).get('/api/sectors');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('GET /api/catalog/products', () => {
  it('returns an array', async () => {
    const res = await request(app).get('/api/catalog/products');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

// ─── Request submission validation ────────────────────────────────────────────

describe('POST /api/requests', () => {
  it('rejects missing required fields with 400', async () => {
    const res = await request(app)
      .post('/api/requests')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('rejects non-numeric sector_id with 400', async () => {
    const res = await request(app)
      .post('/api/requests')
      .send({ sector_id: 'abc', product_id: 1, quantity: 1 });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });
});

describe('POST /api/requests/submit', () => {
  it('rejects empty body with 400', async () => {
    const res = await request(app)
      .post('/api/requests/submit')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('rejects empty products array with 400', async () => {
    const res = await request(app)
      .post('/api/requests/submit')
      .send({ sector: 'IT', date: '2025-01-01', time: '08:00', products: [] });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });
});

// ─── Swagger docs ─────────────────────────────────────────────────────────────

describe('GET /api/docs', () => {
  it('serves swagger UI (HTML)', async () => {
    const res = await request(app).get('/api/docs/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
  });
});

// ─── Login page ───────────────────────────────────────────────────────────────

describe('GET /login', () => {
  it('serves the login page (HTML)', async () => {
    const res = await request(app).get('/login');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
  });
});

// ─── Product CNPJ field ───────────────────────────────────────────────────────

describe('POST /api/admin/products — supplier_cnpj field', () => {
  let sectorId;

  beforeAll(async () => {
    const res = await asAdmin('post', '/api/sectors')
      .send({ name: `CnpjSector-${Date.now()}` });
    expect(res.status).toBe(201);
    sectorId = res.body.id;
  });

  it('creates a product with a valid formatted CNPJ', async () => {
    const res = await asAdmin('post', '/api/admin/products')
      .send({ sector_id: sectorId, name: 'CNPJ-Product', unit: 'pcs', supplier: 'Acme', supplier_cnpj: '12.345.678/0001-90' });
    expect(res.status).toBe(201);
    expect(res.body.supplier_cnpj).toBe('12.345.678/0001-90');
  });

  it('creates a product with a 14-digit unformatted CNPJ', async () => {
    const res = await asAdmin('post', '/api/admin/products')
      .send({ sector_id: sectorId, name: 'CNPJ-Raw', unit: 'pcs', supplier: 'Acme', supplier_cnpj: '12345678000190' });
    expect(res.status).toBe(201);
    expect(res.body.supplier_cnpj).toBe('12345678000190');
  });

  it('rejects a product with an invalid CNPJ format', async () => {
    const res = await asAdmin('post', '/api/admin/products')
      .send({ sector_id: sectorId, name: 'Bad-CNPJ', unit: 'pcs', supplier_cnpj: 'not-a-cnpj' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('creates a product without a CNPJ (defaults to empty string)', async () => {
    const res = await asAdmin('post', '/api/admin/products')
      .send({ sector_id: sectorId, name: 'No-CNPJ', unit: 'pcs' });
    expect(res.status).toBe(201);
    expect(res.body.supplier_cnpj).toBe('');
  });
});

// ─── Request approval reduces product quantity ────────────────────────────────

describe('PUT /api/admin/requests/:id — quantity reduction on approval', () => {
  let sectorId;

  // Create a shared sector once for all tests in this suite.
  beforeAll(async () => {
    const res = await asAdmin('post', '/api/sectors')
      .send({ name: `TestSector-${Date.now()}` });
    expect(res.status).toBe(201);
    sectorId = res.body.id;
  });

  // Helper: create a product with a given quantity and return its id.
  const createProduct = async (name, quantity) => {
    const res = await asAdmin('post', '/api/admin/products')
      .send({ sector_id: sectorId, name, unit: 'pcs', quantity });
    expect(res.status).toBe(201);
    return res.body.id;
  };

  // Helper: submit a single-product request and return its id.
  const createRequest = async (productId, quantity) => {
    const res = await request(app)
      .post('/api/requests')
      .send({ sector_id: sectorId, product_id: productId, quantity });
    expect(res.status).toBe(201);
    return res.body.id;
  };

  // Helper: fetch a product's current quantity.
  const getProductQuantity = async (productId) => {
    const res = await asAdmin('get', '/api/admin/products');
    expect(res.status).toBe(200);
    const product = res.body.find(p => p.id === productId);
    return product ? product.quantity : null;
  };

  it('reduces product quantity when request is approved', async () => {
    const productId = await createProduct('Widget-A', 100);
    const requestId = await createRequest(productId, 30);

    const res = await asAdmin('put', `/api/admin/requests/${requestId}`)
      .send({ status: 'approved' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(await getProductQuantity(productId)).toBe(70); // 100 - 30
  });

  it('returns 409 when product quantity is insufficient', async () => {
    const productId = await createProduct('Rare-Item', 5);
    const requestId = await createRequest(productId, 10); // request more than available

    const res = await asAdmin('put', `/api/admin/requests/${requestId}`)
      .send({ status: 'approved' });

    expect(res.status).toBe(409);
    expect(res.body).toHaveProperty('error');
    // Product quantity must remain unchanged after a failed approval.
    expect(await getProductQuantity(productId)).toBe(5);
  });

  it('does not reduce quantity again when an approved request moves to done', async () => {
    const productId = await createProduct('Widget-B', 50);
    const requestId = await createRequest(productId, 20);

    // First approval — should reduce by 20.
    await asAdmin('put', `/api/admin/requests/${requestId}`)
      .send({ status: 'approved' });
    expect(await getProductQuantity(productId)).toBe(30);

    // Transition to done — must NOT reduce again.
    const res = await asAdmin('put', `/api/admin/requests/${requestId}`)
      .send({ status: 'done' });
    expect(res.status).toBe(200);
    expect(await getProductQuantity(productId)).toBe(30); // still 30, not 10
  });

  it('does not reduce quantity when the same request is approved twice', async () => {
    const productId = await createProduct('Widget-C', 80);
    const requestId = await createRequest(productId, 15);

    // First approval.
    await asAdmin('put', `/api/admin/requests/${requestId}`)
      .send({ status: 'approved' });
    expect(await getProductQuantity(productId)).toBe(65);

    // Calling approve again on an already-approved request should not re-reduce.
    const res = await asAdmin('put', `/api/admin/requests/${requestId}`)
      .send({ status: 'approved' });
    expect(res.status).toBe(200);
    expect(await getProductQuantity(productId)).toBe(65); // unchanged
  });
});
