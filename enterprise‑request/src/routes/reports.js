const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/approved-items', (req, res) => {
  const { sector_id, start, end, product } = req.query;

  // Build WHERE clauses safely
  const where = ["r.status IN ('done', 'printed')"];
  const params = [];

  if (sector_id) {
    where.push('r.sector_id = ?');
    params.push(sector_id);
  }
  if (start) {
    where.push('DATE(r.created_at) >= DATE(?)');
    params.push(start);
  }
  if (end) {
    where.push('DATE(r.created_at) <= DATE(?)');
    params.push(end);
  }
  if (product) {
    where.push('p.name LIKE ?');
    params.push(`%${product}%`);
  }

  const whereSQL = 'WHERE ' + where.join(' AND ');

  const sql = `
    SELECT
      r.id               AS request_id,
      s.name             AS setor,
      r.created_at,
      p.name             AS produto,
      ri.quantity        AS quantidade,
      r.status
    FROM requests r
    JOIN sectors   s  ON r.sector_id = s.id
    JOIN request_items ri ON r.id = ri.request_id
    JOIN products  p  ON ri.product_id = p.id
    ${whereSQL}
    ORDER BY r.created_at DESC, r.id
  `;

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

router.get('/product-by-sector', (req, res) => {
  const { product, start, end } = req.query;

  if (!product) return res.status(400).json({ error: 'product parameter required' });

  const where = ["r.status IN ('done', 'printed')", 'p.name = ?'];
  const params = [product];

  if (start) {
    where.push('DATE(r.created_at) >= DATE(?)');
    params.push(start);
  }
  if (end) {
    where.push('DATE(r.created_at) <= DATE(?)');
    params.push(end);
  }

  const sql = `
    SELECT
      s.name             AS setor,
      SUM(ri.quantity)   AS total
    FROM requests r
    JOIN sectors   s  ON r.sector_id = s.id
    JOIN request_items ri ON r.id = ri.request_id
    JOIN products  p  ON ri.product_id = p.id
    WHERE ${where.join(' AND ')}
    GROUP BY s.id, s.name
    ORDER BY total DESC
  `;

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

module.exports = router;