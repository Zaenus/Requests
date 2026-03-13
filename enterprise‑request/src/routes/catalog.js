const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * @openapi
 * /api/catalog/products:
 *   get:
 *     summary: Public product listing used by the request submission form
 *     tags: [Catalog]
 *     parameters:
 *       - in: query
 *         name: sector_name
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Array of products
 */

// GET /api/catalog/products?sector_name=...
// Public endpoint used by the request submission form (no authentication required).
router.get('/products', (req, res) => {
  const { sector_name } = req.query;
  const params = [];
  let where = '';

  if (sector_name) {
    where = 'WHERE s.name = ?';
    params.push(sector_name);
  }

  db.all(
    `SELECT p.id, p.name, p.unit, p.sector_id, s.name AS sector_name
     FROM products p
     JOIN sectors s ON p.sector_id = s.id
     ${where}
     ORDER BY p.name`,
    params,
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

module.exports = router;
