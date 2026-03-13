require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const { authenticateToken, requireRole } = require('./middleware/auth');
const logger = require('./logger');

const app = express();
const PORT = process.env.PORT || 3020;

// HTTP request logging via morgan — skip during testing to keep test output clean
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined', {
    stream: { write: (msg) => logger.info(msg.trim()) }
  }));
}

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || `http://localhost:${PORT}`,
  credentials: true
}));
app.use(cookieParser());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/images', express.static(path.join(__dirname, '..', 'public', 'images')));

// --- Rate limiting ---

// Strict limiter for the login endpoint — 10 attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' }
});

// General limiter for all mutation (write) endpoints
const mutationLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute window
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' }
});

// --- Swagger / OpenAPI documentation ---
const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Enterprise Request System API',
      version: '1.0.0',
      description: 'REST API for the Enterprise Request System'
    },
    servers: [{ url: `http://localhost:${PORT}` }],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'token'
        }
      }
    }
  },
  apis: [path.join(__dirname, 'routes', '*.js')]
});

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Unprotected static page routes
app.get('/deposit',       (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'deposit.html')));
app.get('/adm',         (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'admin.html')));
app.get('/authorization', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'authorization.html')));
app.get('/sectors',      (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'products.html')));
app.get('/reports',      (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'reports.html')));
app.get('/product-entry', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'product-entry.html')));

// API routes — authentication & health are always public
app.use('/api/authentication', loginLimiter, require('./routes/authentication'));
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Current-user endpoint — requires a valid token
app.get('/api/me', authenticateToken, (req, res) => {
  res.json({ id: req.user.id, username: req.user.username, role: req.user.role });
});

// Public catalog — used by the request submission form without login
app.use('/api/catalog', require('./routes/catalog'));

// Sectors — GET is public (needed by request form); mutations are admin-only
app.use('/api/sectors', mutationLimiter, require('./routes/sectors'));

// Admin routes — require authentication + admin role
app.use('/api/admin',   mutationLimiter, authenticateToken, requireRole('admin'), require('./routes/admin'));

// Request submission — no authentication required (employees submit requests)
app.use('/api/requests', mutationLimiter, require('./routes/requests'));

// Reports — admin-only
app.use('/api/reports',  authenticateToken, requireRole('admin'), require('./routes/reports'));

module.exports = app;
