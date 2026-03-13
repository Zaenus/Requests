const express = require('express');
const router = express.Router();
const db = require('../db');

// POST /api/requests (single product request)
router.post('/', async (req, res) => {
  const { sector_id, product_id, quantity, turno, funcionario, responsavel, observacoes } = req.body;
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
        `INSERT INTO requests (sector_id, turno, funcionario, responsavel, observacoes)
         VALUES (?, ?, ?, ?, ?)`,
        [sector_id, turno || null, funcionario || null, responsavel || null, observacoes || null]
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

// POST /api/requests/enviar_requisicao (multi-product request)
router.post('/enviar_requisicao', async (req, res) => {
  const { setor, turno, data, hora, funcionario, responsavel, produtos, observacoes } = req.body;

  // Validate required fields
  if (!setor || !produtos || produtos.length === 0) {
    return res.status(400).json({ error: 'setor and produtos are required' });
  }

  if (!data || !hora) {
    return res.status(400).json({ error: 'data e hora são obrigatórios' });
  }

  // Validate that each product has required fields
  for (const p of produtos) {
    if (!p.id || !p.quantidade) {
      return res.status(400).json({ error: 'Each product must have id and quantidade' });
    }
  }

  const created_at = `${data} ${hora}:00`;

  try {
    const sectorRow = await db.getAsync('SELECT id FROM sectors WHERE name = ?', [setor]);
    if (!sectorRow) return res.status(404).json({ error: 'Sector not found' });

    const sector_id = sectorRow.id;

    await db.runAsync('BEGIN TRANSACTION', []);
    try {
      const { lastID: request_id } = await db.runAsync(
        `INSERT INTO requests (sector_id, turno, funcionario, responsavel, observacoes, status, created_at)
         VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
        [sector_id, turno || null, funcionario || null, responsavel || null, observacoes || null, created_at]
      );

      for (const p of produtos) {
        const productRow = await db.getAsync(
          'SELECT id FROM products WHERE id = ? AND sector_id = ?',
          [p.id, sector_id]
        );
        if (!productRow) {
          await db.runAsync('ROLLBACK', []);
          return res.status(400).json({ error: `Product ID ${p.id} not found in sector ${setor}` });
        }
        await db.runAsync(
          'INSERT INTO request_items (request_id, product_id, quantity) VALUES (?, ?, ?)',
          [request_id, p.id, p.quantidade]
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
