const AppError = require('./AppError');

function notFound(req, _res, next) {
  next(AppError.notFound(`Endpoint ${req.method} ${req.originalUrl} tidak ditemukan`));
}

function errorHandler(err, req, res, _next) {
  const status = err.statusCode || err.status || 500;
  const code = err.code || (status === 500 ? 'INTERNAL_ERROR' : 'ERROR');
  const body = {
    success: false,
    message: status === 500 && configHide() ? 'Terjadi kesalahan pada server' : err.message || 'Terjadi kesalahan',
    data: null,
    meta: null,
    errors: err.errors || [],
    request_id: req.id || null,
    code,
  };
  if (status >= 500) {
    console.error(`[error] ${req.id || '-'} ${req.method} ${req.originalUrl}`, err);
  }
  res.status(status).json(body);
}

function configHide() {
  return process.env.NODE_ENV === 'production';
}

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = { notFound, errorHandler, asyncHandler };
