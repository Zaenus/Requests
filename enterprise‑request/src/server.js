require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');

// Fail fast — the server must not start without a JWT secret.
if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set. Set it in your .env file before starting the server.');
  process.exit(1);
}

const { authenticateToken, requireRole } = require('./middleware/auth');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3020;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || `http://localhost:${PORT}`,
  credentials: true
}));
app.use(cookieParser());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/images', express.static(path.join(__dirname, '..', 'public', 'images')));

// Unprotected static page routes
app.get('/deposit',       (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'deposit.html')));
app.get('/adm',         (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'admin.html')));
app.get('/authorization', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'authorization.html')));
app.get('/sectors',      (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'products.html')));
app.get('/reports',      (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'reports.html')));

// API routes — authentication & health are always public
app.use('/api/authentication', require('./routes/authentication'));
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Current-user endpoint — requires a valid token
app.get('/api/me', authenticateToken, (req, res) => {
  res.json({ id: req.user.id, username: req.user.username, role: req.user.role });
});

// Public catalog — used by the request submission form without login
app.use('/api/catalog', require('./routes/catalog'));

// Sectors — GET is public (needed by request form); mutations are admin-only
app.use('/api/sectors', require('./routes/sectors'));

// Admin routes — require authentication + admin role
app.use('/api/admin',   authenticateToken, requireRole('admin'), require('./routes/admin'));

// Request submission — no authentication required (employees submit requests)
app.use('/api/requests', require('./routes/requests'));

// Reports — admin-only
app.use('/api/reports',  authenticateToken, requireRole('admin'), require('./routes/reports'));

app.listen(PORT, () => console.log(`🚀 Server listening on http://localhost:${PORT}`));

// Close the database gracefully on shutdown so in-flight writes are not lost.
const shutdown = () => {
  db.close(() => {
    console.log('Database closed.');
    process.exit(0);
  });
};
process.on('SIGTERM', shutdown);
process.on('SIGINT',  shutdown);
