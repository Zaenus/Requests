const express = require('express');
const router = express.Router();
const db = require('../db');

// Helper to parse the JSON products array returned by json_group_array,
// filtering out the null sentinel row produced by a LEFT JOIN with no items.
const parseProducts = (raw) =>
  JSON.parse(raw || '[]').filter(p => p.id != null);

// Products CRUD
router.get('/products', async (req, res) => {
  try {
    const rows = await db.allAsync(
      `SELECT p.*, s.name as sector_name
       FROM products p
       JOIN sectors s ON p.sector_id = s.id
       ORDER BY p.name`,
      []
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/products-sector_id', async (req, res) => {
  const { sector_id } = req.query;
  try {
    const rows = await db.allAsync(
      `SELECT p.*, s.name as sector_name
       FROM products p
       JOIN sectors s ON p.sector_id = s.id
       WHERE p.sector_id = ?
       ORDER BY s.name, p.name`,
      [sector_id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/products', async (req, res) => {
  const { sector_id, name, unit } = req.body;
  if (!sector_id || !name || !unit) {
    return res.status(400).json({ error: 'sector_id, name and unit required' });
  }

  try {
    const { lastID } = await db.runAsync(
      'INSERT INTO products (sector_id, name, unit) VALUES (?, ?, ?)',
      [sector_id, name, unit]
    );
    res.status(201).json({ id: lastID, sector_id, name, unit });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/products/:id', async (req, res) => {
  const { id } = req.params;
  const { sector_id, name, unit } = req.body;
  if (!name || !unit) {
    return res.status(400).json({ error: 'name and unit required' });
  }

  try {
    const { changes } = await db.runAsync(
      'UPDATE products SET sector_id = ?, name = ?, unit = ? WHERE id = ?',
      [sector_id || null, name, unit, id]
    );
    if (changes === 0) return res.status(404).json({ error: 'Product not found' });
    res.json({ success: true, id, sector_id, name, unit });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/products/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const { changes } = await db.runAsync('DELETE FROM products WHERE id = ?', [id]);
    if (changes === 0) return res.status(404).json({ error: 'Product not found' });
    res.status(200).json({ message: 'Product deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Requests CRUD
// Products are returned as a JSON array of objects { id, name, quantity, unit }
// so that a comma in a product name cannot break parsing on the frontend.
router.get('/requests', async (req, res) => {
  const { status } = req.query;
  const sql = `
    SELECT r.id, r.sector_id, s.name as sector_name, r.created_at, r.status,
           r.shift, r.employee, r.supervisor, r.notes,
           json_group_array(
             json_object('id', ri.product_id, 'name', p.name, 'quantity', ri.quantity, 'unit', p.unit)
           ) as products
    FROM requests r
    JOIN sectors s ON r.sector_id = s.id
    LEFT JOIN request_items ri ON r.id = ri.request_id
    LEFT JOIN products p ON ri.product_id = p.id
    ${status ? 'WHERE r.status = ?' : ''}
    GROUP BY r.id
    ORDER BY r.created_at DESC
  `;
  const params = status ? [status] : [];

  try {
    const rows = await db.allAsync(sql, params);
    res.json(rows.map(row => ({ ...row, products: parseProducts(row.products) })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/requests/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const request = await db.getAsync(
      `SELECT r.*, s.name as sector_name,
              json_group_array(
                json_object('id', ri.product_id, 'name', p.name, 'quantity', ri.quantity, 'unit', p.unit)
              ) as products
       FROM requests r
       JOIN sectors s ON r.sector_id = s.id
       LEFT JOIN request_items ri ON r.id = ri.request_id
       LEFT JOIN products p ON ri.product_id = p.id
       WHERE r.id = ?
       GROUP BY r.id`,
      [id]
    );
    if (!request) return res.status(404).json({ error: 'Request not found' });
    res.json({
      id: request.id,
      sector_name: request.sector_name,
      created_at: request.created_at,
      status: request.status,
      shift: request.shift,
      employee: request.employee,
      supervisor: request.supervisor,
      notes: request.notes,
      products: parseProducts(request.products)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/requests/:id', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'status required' });

  try {
    const { changes } = await db.runAsync(
      'UPDATE requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, id]
    );
    if (changes === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true, id, status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Request Items CRUD
router.put('/request_items/:request_id/:product_id', async (req, res) => {
  const { request_id, product_id } = req.params;
  const { quantity } = req.body;
  if (!quantity || quantity < 0) {
    return res.status(400).json({ error: 'quantity required and must be non-negative' });
  }

  try {
    const { changes } = await db.runAsync(
      'UPDATE request_items SET quantity = ? WHERE request_id = ? AND product_id = ?',
      [quantity, request_id, product_id]
    );
    if (changes === 0) return res.status(404).json({ error: 'Request item not found' });
    res.json({ success: true, request_id, product_id, quantity });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/request_items/:request_id/:product_id', async (req, res) => {
  const { request_id, product_id } = req.params;

  try {
    const { changes } = await db.runAsync(
      'DELETE FROM request_items WHERE request_id = ? AND product_id = ?',
      [request_id, product_id]
    );
    if (changes === 0) return res.status(404).json({ error: 'Request item not found' });
    res.status(200).json({ message: 'Request item deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
