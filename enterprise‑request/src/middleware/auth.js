const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Verifies the JWT from an HttpOnly cookie or the Authorization header.
 * The cookie takes precedence (web clients); the header is kept for API clients.
 */
const authenticateToken = (req, res, next) => {
  const token =
    (req.cookies && req.cookies.token) ||
    (req.headers['authorization'] && req.headers['authorization'].split(' ')[1]);

  if (!token) {
    return res.status(401).json({ error: 'Acesso negado. Token não fornecido.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token inválido.' });
    req.user = user;
    next();
  });
};

/**
 * Returns middleware that allows only users whose role matches one of the
 * provided roles. Must be used after authenticateToken.
 */
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Acesso negado. Permissão insuficiente.' });
  }
  next();
};

module.exports = { authenticateToken, requireRole };
