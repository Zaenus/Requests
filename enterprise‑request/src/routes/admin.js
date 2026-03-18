const express = require('express');
const router = express.Router();
const { z } = require('zod');
const db = require('../db');

const productSchema = z.object({
  sector_id: z.number({ coerce: true }).int().positive(),
  name: z.string().min(1, 'name required'),
  unit: z.string().min(1, 'unit required'),
  quantity: z.number({ coerce: true }).nonnegative().optional().default(0),
  cost_per_unit: z.number({ coerce: true }).nonnegative().optional().default(0),
  supplier: z.string().optional().default(''),
  supplier_cnpj: z.string().optional().default('').refine(
    v => v === '' || /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(v) || /^\d{14}$/.test(v),
    { message: 'supplier_cnpj must be a valid CNPJ (e.g. 12.345.678/0001-90 or 14 digits)' }
  ),
  code: z.string().optional().default('')
});

const productUpdateSchema = z.object({
  sector_id: z.number({ coerce: true }).int().positive().optional(),
  name: z.string().min(1, 'name required'),
  unit: z.string().min(1, 'unit required'),
  quantity: z.number({ coerce: true }).nonnegative().optional().default(0),
  cost_per_unit: z.number({ coerce: true }).nonnegative().optional().default(0),
  supplier: z.string().optional().default(''),
  supplier_cnpj: z.string().optional().default('').refine(
    v => v === '' || /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(v) || /^\d{14}$/.test(v),
    { message: 'supplier_cnpj must be a valid CNPJ (e.g. 12.345.678/0001-90 or 14 digits)' }
  ),
  code: z.string().optional().default('')
});

const requestStatusSchema = z.object({
  status: z.enum(['pending', 'approved', 'done', 'printed'], { message: 'status must be one of: pending, approved, done, printed' })
});

const itemQuantitySchema = z.object({
  quantity: z.number({ coerce: true }).int().nonnegative('quantity must be non-negative')
});

const xmlQuantitySchema = z.object({
  items: z.array(z.object({
    code: z.string().min(1, 'code required'),
    quantity: z.number({ coerce: true }).nonnegative('quantity must be non-negative'),
    cost_per_unit: z.number({ coerce: true }).nonnegative('cost_per_unit must be non-negative').optional()
  })).min(1, 'items array must not be empty')
});

/**
 * @openapi
 * /api/admin/products:
 *   get:
 *     summary: List all products
 *     tags: [Admin - Products]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Array of products
 *   post:
 *     summary: Create a product
 *     tags: [Admin - Products]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sector_id, name, unit]
 *             properties:
 *               sector_id:
 *                 type: integer
 *               name:
 *                 type: string
 *               unit:
 *                 type: string
 *     responses:
 *       201:
 *         description: Product created
 *
 * /api/admin/products-sector_id:
 *   get:
 *     summary: List products by sector
 *     tags: [Admin - Products]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: sector_id
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Array of products
 *
 * /api/admin/products/{id}:
 *   put:
 *     summary: Update a product
 *     tags: [Admin - Products]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Product updated
 *   delete:
 *     summary: Delete a product
 *     tags: [Admin - Products]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Product deleted
 *
 * /api/admin/requests:
 *   get:
 *     summary: List requests (optionally filtered by status)
 *     tags: [Admin - Requests]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Array of requests
 *
 * /api/admin/requests/{id}:
 *   get:
 *     summary: Get a specific request
 *     tags: [Admin - Requests]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Request detail
 *       404:
 *         description: Not found
 *   put:
 *     summary: Update request status
 *     tags: [Admin - Requests]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, approved, done, printed]
 *     responses:
 *       200:
 *         description: Status updated
 *
 * /api/admin/request_items/{request_id}/{product_id}:
 *   put:
 *     summary: Edit an item quantity
 *     tags: [Admin - Requests]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: request_id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: product_id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Item updated
 *   delete:
 *     summary: Remove an item from a request
 *     tags: [Admin - Requests]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: request_id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: product_id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Item removed
 */

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
  const parsed = productSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { sector_id, name, unit, quantity, cost_per_unit, supplier, supplier_cnpj, code } = parsed.data;

  try {
    const { lastID } = await db.runAsync(
      'INSERT INTO products (sector_id, name, unit, quantity, cost_per_unit, supplier, supplier_cnpj, code) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [sector_id, name, unit, quantity, cost_per_unit, supplier, supplier_cnpj, code]
    );
    res.status(201).json({ id: lastID, sector_id, name, unit, quantity, cost_per_unit, supplier, supplier_cnpj, code });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/products/:id', async (req, res) => {
  const { id } = req.params;
  const parsed = productUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { sector_id, name, unit, quantity, cost_per_unit, supplier, supplier_cnpj, code } = parsed.data;

  try {
    const { changes } = await db.runAsync(
      'UPDATE products SET sector_id = ?, name = ?, unit = ?, quantity = ?, cost_per_unit = ?, supplier = ?, supplier_cnpj = ?, code = ? WHERE id = ?',
      [sector_id || null, name, unit, quantity, cost_per_unit, supplier, supplier_cnpj, code, id]
    );
    if (changes === 0) return res.status(404).json({ error: 'Product not found' });
    res.json({ success: true, id, sector_id, name, unit, quantity, cost_per_unit, supplier, supplier_cnpj, code });
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
  const parsed = requestStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { status } = parsed.data;

  try {
    // When approving, reduce product quantities for each requested item.
    // Only trigger when transitioning from 'pending' to 'approved' to avoid
    // double-decrementing if the endpoint is called more than once.
    if (status === 'approved') {
      const current = await db.getAsync('SELECT status FROM requests WHERE id = ?', [id]);
      if (!current) return res.status(404).json({ error: 'Not found' });

      if (current.status === 'pending') {
        const items = await db.allAsync(
          'SELECT product_id, quantity FROM request_items WHERE request_id = ?',
          [id]
        );

        // Verify sufficient quantity for every item before making any change.
        for (const item of items) {
          const product = await db.getAsync(
            'SELECT quantity FROM products WHERE id = ?',
            [item.product_id]
          );
          if (!product) {
            return res.status(400).json({ error: `Product ID ${item.product_id} not found` });
          }
          if (product.quantity < item.quantity) {
            return res.status(409).json({
              error: `Insufficient quantity for product ID ${item.product_id}: available ${product.quantity}, requested ${item.quantity}`
            });
          }
        }

        await db.runAsync('BEGIN TRANSACTION', []);
        try {
          await db.runAsync(
            'UPDATE requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [status, id]
          );
          for (const item of items) {
            await db.runAsync(
              'UPDATE products SET quantity = quantity - ? WHERE id = ?',
              [item.quantity, item.product_id]
            );
          }
          await db.runAsync('COMMIT', []);
        } catch (err) {
          await db.runAsync('ROLLBACK', []);
          throw err;
        }

        return res.json({ success: true, id, status });
      }
    }

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
  const parsed = itemQuantitySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { quantity } = parsed.data;

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

/**
 * @openapi
 * /api/admin/products/xml-quantity:
 *   post:
 *     summary: Bulk-update product quantities from an XML import
 *     tags: [Admin - Products]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [items]
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [code, quantity]
 *                   properties:
 *                     code:
 *                       type: string
 *                     quantity:
 *                       type: number
 *                     cost_per_unit:
 *                       type: number
 *     responses:
 *       200:
 *         description: Summary of updated and not-found products
 *       400:
 *         description: Validation error
 */
router.post('/products/xml-quantity', async (req, res) => {
  const parsed = xmlQuantitySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { items } = parsed.data;

  const updated = [];
  const not_found = [];

  try {
    for (const item of items) {
      const product = await db.getAsync(
        'SELECT id, name FROM products WHERE code = ?',
        [item.code]
      );
      if (!product) {
        not_found.push(item.code);
        continue;
      }
      if (item.cost_per_unit !== undefined) {
        await db.runAsync(
          'UPDATE products SET quantity = ?, cost_per_unit = ? WHERE id = ?',
          [item.quantity, item.cost_per_unit, product.id]
        );
      } else {
        await db.runAsync(
          'UPDATE products SET quantity = ? WHERE id = ?',
          [item.quantity, product.id]
        );
      }
      const entry = { code: item.code, product_id: product.id, name: product.name, new_quantity: item.quantity };
      if (item.cost_per_unit !== undefined) entry.new_cost_per_unit = item.cost_per_unit;
      updated.push(entry);
    }
    res.json({ updated, not_found });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
