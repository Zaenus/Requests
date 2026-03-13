const express = require('express');
const router = express.Router();
const { z } = require('zod');
const db = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');

const adminOnly = [authenticateToken, requireRole('admin')];

const sectorSchema = z.object({
  name: z.string().min(1, 'name required')
});

/**
 * @openapi
 * /api/sectors:
 *   get:
 *     summary: List all sectors
 *     tags: [Sectors]
 *     responses:
 *       200:
 *         description: Array of sectors
 *   post:
 *     summary: Create a sector (admin only)
 *     tags: [Sectors]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *     responses:
 *       201:
 *         description: Sector created
 *       400:
 *         description: Validation error
 */

// GET /api/sectors — public (needed by the request submission form)
router.get('/', async (req, res) => {
  try {
    const rows = await db.allAsync('SELECT * FROM sectors ORDER BY name', []);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sectors   (Admin only)
router.post('/', adminOnly, async (req, res) => {
  const parsed = sectorSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { name } = parsed.data;

  try {
    const { lastID } = await db.runAsync('INSERT INTO sectors (name) VALUES (?)', [name]);
    res.status(201).json({ id: lastID, name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @openapi
 * /api/sectors/{id}:
 *   put:
 *     summary: Update a sector (admin only)
 *     tags: [Sectors]
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
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *     responses:
 *       200:
 *         description: Sector updated
 *       404:
 *         description: Sector not found
 *   delete:
 *     summary: Delete a sector (admin only)
 *     tags: [Sectors]
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
 *         description: Sector deleted
 *       404:
 *         description: Sector not found
 */

// PUT /api/sectors/:id (Admin only)
router.put('/:id', adminOnly, async (req, res) => {
  const { id } = req.params;
  const parsed = sectorSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { name } = parsed.data;

  try {
    const { changes } = await db.runAsync('UPDATE sectors SET name = ? WHERE id = ?', [name, id]);
    if (changes === 0) return res.status(404).json({ error: 'Sector not found' });
    res.json({ success: true, id, name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/sectors/:id (Admin only)
router.delete('/:id', adminOnly, async (req, res) => {
  const { id } = req.params;

  try {
    const { changes } = await db.runAsync('DELETE FROM sectors WHERE id = ?', [id]);
    if (changes === 0) return res.status(404).json({ error: 'Sector not found' });
    res.status(200).json({ message: 'Sector deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
