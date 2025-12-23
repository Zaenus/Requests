const express = require('express');
const router = express.Router();
const db = require('../db');

// Products CRUD
router.get('/products', (req, res) => {
  db.all(
    `SELECT p.*, s.name as sector_name
     FROM products p
     JOIN sectors s ON p.sector_id = s.id
     ORDER BY p.name`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

router.get('/products-sector_id', (req, res) => {
  const { sector_id } = req.query;
  db.all(
    `SELECT p.*, s.name as sector_name
     FROM products p
     JOIN sectors s ON p.sector_id = s.id
     WHERE p.sector_id = ?
     ORDER BY s.name, p.name`,
    [sector_id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

router.post('/products', (req, res) => {
  const { sector_id, name, unit } = req.body;
  if (!sector_id || !name || !unit) {
    return res.status(400).json({ error: `sector_id, name and unit required` });
  }

  db.run(
    'INSERT INTO products (sector_id, name, unit) VALUES (?, ?, ?)',
    [sector_id, name, unit],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: this.lastID, sector_id, name, unit });
    }
  );
});

router.put('/products/:id', (req, res) => {
  const { id } = req.params;
  const { sector_id, name, unit } = req.body;
  if (!name || !unit) {
    return res.status(400).json({ error: 'name and unit required' });
  }

  db.run(
    'UPDATE products SET sector_id = ?, name = ?, unit = ? WHERE id = ?',
    [sector_id || null, name, unit, id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Product not found' });
      res.json({ success: true, id, sector_id, name, unit });
    }
  );
});

router.delete('/products/:id', (req, res) => {
  const { id } = req.params;

  db.run('DELETE FROM products WHERE id = ?', [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Product not found' });
    res.status(200).json({ message: 'Product deleted successfully' });
  });
});

// Requests CRUD
router.get('/requests', (req, res) => {
  const { status } = req.query;
  const sql = `
    SELECT r.id, r.sector_id, s.name as sector_name, r.created_at, r.status,
           r.turno, r.funcionario, r.responsavel, r.observacoes,
           GROUP_CONCAT(p.name || ' (' || ri.quantity || ' ' || p.unit || ')') as products,
           GROUP_CONCAT(ri.product_id) as product_ids
    FROM requests r
    JOIN sectors s ON r.sector_id = s.id
    LEFT JOIN request_items ri ON r.id = ri.request_id
    LEFT JOIN products p ON ri.product_id = p.id
    ${status ? 'WHERE r.status = ?' : ''}
    GROUP BY r.id
    ORDER BY r.created_at DESC
  `;
  const params = status ? [status] : [];

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.map(row => ({
      ...row,
      product_ids: row.product_ids ? row.product_ids.split(',').map(Number) : []
    }
  )));
  });
});

router.get('/requests/:id', (req, res) => {
  const { id } = req.params;
  db.get(
    `SELECT r.*, s.name as sector_name,
            GROUP_CONCAT(p.name || ' (' || ri.quantity || ' ' || p.unit || ')') as products,
            GROUP_CONCAT(ri.product_id) as product_ids
     FROM requests r
     JOIN sectors s ON r.sector_id = s.id
     LEFT JOIN request_items ri ON r.id = ri.request_id
     LEFT JOIN products p ON ri.product_id = p.id
     WHERE r.id = ?
     GROUP BY r.id`,
    [id],
    (err, request) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!request) return res.status(404).json({ error: 'Request not found' });
      res.json({
        id: request.id,
        sector_name: request.sector_name,
        created_at: request.created_at,
        status: request.status,
        turno: request.turno,
        funcionario: request.funcionario,
        responsavel: request.responsavel,
        observacoes: request.observacoes,
        products: request.products ? request.products.split(',') : [],
        product_ids: request.product_ids ? request.product_ids.split(',').map(Number) : []
      });
    }
  );
});

router.put('/requests/:id', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'status required' });

  db.run(
    `UPDATE requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [status, id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: `Not found` });
      res.json({ success: true, id, status });
    }
  );
});

// Request Items CRUD
router.put('/request_items/:request_id/:product_id', (req, res) => {
  const { request_id, product_id } = req.params;
  const { quantity } = req.body;
  if (!quantity || quantity < 0) {
    return res.status(400).json({ error: 'quantity required and must be non-negative' });
  }

  db.run(
    `UPDATE request_items SET quantity = ? WHERE request_id = ? AND product_id = ?`,
    [quantity, request_id, product_id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Request item not found' });
      res.json({ success: true, request_id, product_id, quantity });
    }
  );
});

router.delete('/request_items/:request_id/:product_id', (req, res) => {
  const { request_id, product_id } = req.params;

  db.run(
    `DELETE FROM request_items WHERE request_id = ? AND product_id = ?`,
    [request_id, product_id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Request item not found' });
      res.status(200).json({ message: 'Request item deleted successfully' });
    }
  );
});

module.exports = router;