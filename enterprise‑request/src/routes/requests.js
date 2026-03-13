const express = require('express');
const router = express.Router();
const db = require('../db');

// POST /api/requests (single product request)
router.post('/', async (req, res) => {
  const { sector_id, product_id, quantity, shift, employee, supervisor, notes } = req.body;
  if (!sector_id || !product_id || !quantity) {
    return res.status(400).json({ error: 'sector_id, product_id and quantity required' });
  }

  try {
    const productRow = await db.getAsync(
      'SELECT id FROM products WHERE id = ? AND sector_id = ?',
      [product_id, sector_id]
    );
    if (!productRow) {
      return res.status(400).json({ error: `Product ID ${product_id} not found in sector ID ${sector_id}` });
    }

    // Wrap both inserts in a transaction so an orphaned request record is
    // never left behind if the request_items insert fails.
    await db.runAsync('BEGIN TRANSACTION', []);
    try {
      const { lastID: request_id } = await db.runAsync(
        `INSERT INTO requests (sector_id, shift, employee, supervisor, notes)
         VALUES (?, ?, ?, ?, ?)`,
        [sector_id, shift || null, employee || null, supervisor || null, notes || null]
      );
      await db.runAsync(
        'INSERT INTO request_items (request_id, product_id, quantity) VALUES (?, ?, ?)',
        [request_id, product_id, quantity]
      );
      await db.runAsync('COMMIT', []);
      res.status(201).json({ id: request_id, sector_id, product_id, quantity, status: 'pending' });
    } catch (err) {
      await db.runAsync('ROLLBACK', []);
      res.status(500).json({ error: err.message });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/requests/submit (multi-product request)
router.post('/submit', async (req, res) => {
  const { sector, shift, date, time, employee, supervisor, products, notes } = req.body;

  // Validate required fields
  if (!sector || !products || products.length === 0) {
    return res.status(400).json({ error: 'sector and products are required' });
  }

  if (!date || !time) {
    return res.status(400).json({ error: 'date and time are required' });
  }

  // Validate that each product has required fields
  for (const p of products) {
    if (!p.id || !p.quantity) {
      return res.status(400).json({ error: 'Each product must have id and quantity' });
    }
  }

  const created_at = `${date} ${time}:00`;

  try {
    const sectorRow = await db.getAsync('SELECT id FROM sectors WHERE name = ?', [sector]);
    if (!sectorRow) return res.status(404).json({ error: 'Sector not found' });

    const sector_id = sectorRow.id;

    await db.runAsync('BEGIN TRANSACTION', []);
    try {
      const { lastID: request_id } = await db.runAsync(
        `INSERT INTO requests (sector_id, shift, employee, supervisor, notes, status, created_at)
         VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
        [sector_id, shift || null, employee || null, supervisor || null, notes || null, created_at]
      );

      for (const p of products) {
        const productRow = await db.getAsync(
          'SELECT id FROM products WHERE id = ? AND sector_id = ?',
          [p.id, sector_id]
        );
        if (!productRow) {
          await db.runAsync('ROLLBACK', []);
          return res.status(400).json({ error: `Product ID ${p.id} not found in sector ${sector}` });
        }
        await db.runAsync(
          'INSERT INTO request_items (request_id, product_id, quantity) VALUES (?, ?, ?)',
          [request_id, p.id, p.quantity]
        );
      }

      await db.runAsync('COMMIT', []);
      res.status(201).json({ success: true, request_id });
    } catch (err) {
      await db.runAsync('ROLLBACK', []);
      res.status(400).json({ error: err.message });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
