require('dotenv').config();

// Fail fast — the server must not start without a JWT secret.
if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set. Set it in your .env file before starting the server.');
  process.exit(1);
}

const app = require('./app');
const db = require('./db');
const logger = require('./logger');

const PORT = process.env.PORT || 3020;

app.listen(PORT, () => logger.info(`🚀 Server listening on http://localhost:${PORT}`));

// Close the database gracefully on shutdown so in-flight writes are not lost.
const shutdown = () => {
  db.close(() => {
    logger.info('Database closed.');
    process.exit(0);
  });
};
process.on('SIGTERM', shutdown);
process.on('SIGINT',  shutdown);
