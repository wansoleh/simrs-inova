const crypto = require('node:crypto');

function requestId(req, res, next) {
  req.id = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  res.setHeader('Access-Control-Expose-Headers', 'X-Request-Id, Idempotent-Replay, Content-Disposition');
  next();
}

module.exports = requestId;
