const fs = require('node:fs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const AppError = require('./AppError');

let publicKey = null;
function getPublicKey() {
  if (!publicKey) {
    publicKey = fs.readFileSync(config.jwtPublicKeyPath, 'utf8');
  }
  return publicKey;
}

function auth(...roles) {
  return (req, _res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) return next(AppError.unauthorized('Header Authorization Bearer tidak ditemukan'));
    try {
      const payload = jwt.verify(token, getPublicKey(), { algorithms: ['RS256'] });
      if (payload.type !== 'access') return next(AppError.unauthorized('Jenis token tidak valid'));
      if (roles.length && !roles.includes(payload.role)) {
        return next(AppError.forbidden(`Endpoint ini hanya untuk role: ${roles.join(', ')}`));
      }
      req.user = payload;
      return next();
    } catch (err) {
      return next(AppError.unauthorized(err.message));
    }
  };
}

module.exports = auth;
