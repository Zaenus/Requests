const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');

const adminOnly = [authenticateToken, requireRole('admin')];

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
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });

  try {
    const { lastID } = await db.runAsync('INSERT INTO sectors (name) VALUES (?)', [name]);
    res.status(201).json({ id: lastID, name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/sectors/:id (Admin only)
router.put('/:id', adminOnly, async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });

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
