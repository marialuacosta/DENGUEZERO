// middleware/auth.js
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
dotenv.config();

const jwtSecret = process.env.JWT_SECRET || 'dev_secret';

function getUserIdMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const parts = authHeader.split(' ');
    const token = parts[1];
    const payload = jwt.verify(token, jwtSecret);
    req.user = { id: payload.id, email: payload.email, name: payload.name, role: payload.role };
    next();
  } catch (err) {
    next();
  }
}

module.exports = getUserIdMiddleware;
