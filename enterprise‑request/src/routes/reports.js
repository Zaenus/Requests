const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * @openapi
 * /api/reports/approved-items:
 *   get:
 *     summary: Returns approved/printed request items
 *     tags: [Reports]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: sector_id
 *         schema:
 *           type: integer
 *       - in: query
 *         name: start
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: end
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: product
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Array of approved/printed request items
 *
 * /api/reports/product-by-sector:
 *   get:
 *     summary: Returns total quantity per sector for a product
 *     tags: [Reports]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: product
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: start
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: end
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Array of sector totals
 *       400:
 *         description: product parameter required
 */

router.get('/approved-items', async (req, res) => {
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
      s.name             AS sector,
      r.created_at,
      p.name             AS product,
      ri.quantity        AS quantity,
      p.cost_per_unit    AS cost_per_unit,
      ROUND(ri.quantity * p.cost_per_unit, 2) AS total_cost,
      p.supplier         AS supplier,
      r.status
    FROM requests r
    JOIN sectors   s  ON r.sector_id = s.id
    JOIN request_items ri ON r.id = ri.request_id
    JOIN products  p  ON ri.product_id = p.id
    ${whereSQL}
    ORDER BY r.created_at DESC, r.id
  `;

  try {
    const rows = await db.allAsync(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/product-by-sector', async (req, res) => {
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
      s.name             AS sector,
      SUM(ri.quantity)   AS total,
      ROUND(SUM(ri.quantity * p.cost_per_unit), 2) AS total_cost
    FROM requests r
    JOIN sectors   s  ON r.sector_id = s.id
    JOIN request_items ri ON r.id = ri.request_id
    JOIN products  p  ON ri.product_id = p.id
    WHERE ${where.join(' AND ')}
    GROUP BY s.id, s.name
    ORDER BY total DESC
  `;

  try {
    const rows = await db.allAsync(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
