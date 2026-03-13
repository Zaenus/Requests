const express = require('express');
const router = express.Router();
const db = require('../db');

// POST /api/requests (single product request)
router.post('/', (req, res) => {
  const { sector_id, product_id, quantity, turno, funcionario, responsavel, observacoes } = req.body;
  if (!sector_id || !product_id || !quantity) {
    return res.status(400).json({ error: `sector_id, product_id and quantity required` });
  }

  // Validate product_id and sector_id
  db.get('SELECT id FROM products WHERE id = ? AND sector_id = ?', [product_id, sector_id], (err, productRow) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!productRow) return res.status(400).json({ error: `Product ID ${product_id} not found in sector ID ${sector_id}` });

    // Wrap both inserts in a transaction so an orphaned request record is
    // never left behind if the request_items insert fails.
    db.run('BEGIN TRANSACTION', (err) => {
      if (err) return res.status(500).json({ error: err.message });

      db.run(
        `INSERT INTO requests (sector_id, turno, funcionario, responsavel, observacoes)
         VALUES (?, ?, ?, ?, ?)`,
        [sector_id, turno || null, funcionario || null, responsavel || null, observacoes || null],
        function (err) {
          if (err) {
            db.run('ROLLBACK');
            return res.status(500).json({ error: err.message });
          }
          const request_id = this.lastID;
          db.run(
            `INSERT INTO request_items (request_id, product_id, quantity)
             VALUES (?, ?, ?)`,
            [request_id, product_id, quantity],
            function (err) {
              if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({ error: err.message });
              }
              db.run('COMMIT', (err) => {
                if (err) {
                  db.run('ROLLBACK');
                  return res.status(500).json({ error: err.message });
                }
                res.status(201).json({ id: request_id, sector_id, product_id, quantity, status: 'pending' });
              });
            }
          );
        }
      );
    });
  });
});
// POST /api/requests/enviar_requisicao (multi-product request)
router.post('/enviar_requisicao', (req, res) => {
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

  db.get('SELECT id FROM sectors WHERE name = ?', [setor], (err, sectorRow) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!sectorRow) return res.status(404).json({ error: 'Sector not found' });

    const sector_id = sectorRow.id;

    // Start a transaction
    db.run('BEGIN TRANSACTION', (err) => {
      if (err) return res.status(500).json({ error: err.message });

      // Insert into requests table
      db.run(
        `INSERT INTO requests (sector_id, turno, funcionario, responsavel, observacoes, status, created_at)
         VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
        [sector_id, turno || null, funcionario || null, responsavel || null, observacoes || null, created_at],
        function (err) {
          if (err) {
            db.run('ROLLBACK');
            return res.status(500).json({ error: err.message });
          }
          const request_id = this.lastID;

          // Insert each product into request_items using promises to avoid
          // the race condition where COMMIT could be issued before all
          // INSERT callbacks have completed.
          const insertPromises = produtos.map(p => new Promise((resolve, reject) => {
            db.get('SELECT id FROM products WHERE id = ? AND sector_id = ?', [p.id, sector_id], (err, productRow) => {
              if (err) return reject(err);
              if (!productRow) return reject(new Error(`Product ID ${p.id} not found in sector ${setor}`));

              db.run(
                `INSERT INTO request_items (request_id, product_id, quantity)
                 VALUES (?, ?, ?)`,
                [request_id, p.id, p.quantidade],
                (err) => {
                  if (err) return reject(err);
                  resolve();
                }
              );
            });
          }));

          Promise.all(insertPromises)
            .then(() => {
              db.run('COMMIT', (err) => {
                if (err) {
                  db.run('ROLLBACK');
                  return res.status(500).json({ error: err.message });
                }
                res.status(201).json({ success: true, request_id });
              });
            })
            .catch((err) => {
              db.run('ROLLBACK');
              res.status(400).json({ error: err.message });
            });
        }
      );
    });
  });
});

module.exports = router;