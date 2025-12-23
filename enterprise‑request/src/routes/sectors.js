const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/sectors
router.get('/', (req, res) => {
  db.all('SELECT * FROM sectors ORDER BY name', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// POST /api/sectors   (Admin only)
router.post('/', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });

  db.run(
    'INSERT INTO sectors (name) VALUES (?)',
    [name],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: this.lastID, name });
    }
  );
});

// PUT /api/sectors/:id (Admin only)
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });

  db.run(
    'UPDATE sectors SET name = ? WHERE id = ?',
    [name, id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Sector not found' });
      res.json({ success: true, id, name });
    }
  );
});

// DELETE /api/sectors/:id (Admin only)
router.delete('/:id', (req, res) => {
  const { id } = req.params;

  db.run(
    'DELETE FROM sectors WHERE id = ?',
    [id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Sector not found' });
      res.status(200).json({ message: 'Sector deleted successfully' });
    }
  );
});

module.exports = router;
