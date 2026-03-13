const express = require('express');
const router = express.Router();
const { z } = require('zod');
const db = require('../db');

const singleRequestSchema = z.object({
  sector_id: z.number({ coerce: true }).int().positive(),
  product_id: z.number({ coerce: true }).int().positive(),
  quantity: z.number({ coerce: true }).int().positive(),
  shift: z.string().optional(),
  employee: z.string().optional(),
  supervisor: z.string().optional(),
  notes: z.string().optional()
});

const multiRequestSchema = z.object({
  sector: z.string().min(1, 'sector required'),
  date: z.string().min(1, 'date required'),
  time: z.string().min(1, 'time required'),
  shift: z.string().optional(),
  employee: z.string().optional(),
  supervisor: z.string().optional(),
  notes: z.string().optional(),
  products: z.array(z.object({
    id: z.number({ coerce: true }).int().positive(),
    quantity: z.number({ coerce: true }).int().positive()
  })).min(1, 'at least one product required')
});

/**
 * @openapi
 * /api/requests:
 *   post:
 *     summary: Submit a single-product request
 *     tags: [Requests]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sector_id, product_id, quantity]
 *             properties:
 *               sector_id:
 *                 type: integer
 *               product_id:
 *                 type: integer
 *               quantity:
 *                 type: integer
 *               shift:
 *                 type: string
 *               employee:
 *                 type: string
 *               supervisor:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Request created
 *       400:
 *         description: Validation error
 *
 * /api/requests/submit:
 *   post:
 *     summary: Submit a multi-product request
 *     tags: [Requests]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sector, date, time, products]
 *             properties:
 *               sector:
 *                 type: string
 *               date:
 *                 type: string
 *               time:
 *                 type: string
 *               products:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [id, quantity]
 *                   properties:
 *                     id:
 *                       type: integer
 *                     quantity:
 *                       type: integer
 *     responses:
 *       201:
 *         description: Request created
 *       400:
 *         description: Validation error
 */

// POST /api/requests (single product request)
router.post('/', async (req, res) => {
  const parsed = singleRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { sector_id, product_id, quantity, shift, employee, supervisor, notes } = parsed.data;

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
  const parsed = multiRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { sector, shift, date, time, employee, supervisor, products, notes } = parsed.data;

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
