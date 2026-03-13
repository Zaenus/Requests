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
const app = require('../src/app');

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
