require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const app = express();
const PORT = process.env.PORT || 3020;
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key'; // Store in .env in production

// Middleware
app.use(cors());
app.use(express.json());               // parse JSON bodies
app.use(express.static(path.join(__dirname, '..', 'public'))); // serve static files
app.use('/images', express.static(path.join(__dirname, '..', 'public', 'images')));

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Acesso negado. Token não fornecido.' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token inválido.' });
    req.user = user;
    next();
  });
};

//Unprotected routes
app.get('/deposito', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'deposit.html')));
app.get('/adm', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'admin.html')));
app.get('/autorizacao', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'autorizacao.html')));
app.get('/setores', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'products.html')));
app.get('/relatorios', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'reports.html')));

// API routes
app.use('/api/sectors', require('./routes/sectors'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/requests', require('./routes/requests'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/authentication', require('./routes/authentication'));

// Simple health endpoint
app.get('/api/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => console.log(`🚀 Server listening on 
http://localhost:${PORT}`));
