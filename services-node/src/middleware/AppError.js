class AppError extends Error {
  constructor(statusCode, code, message, errors = []) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.errors = errors;
  }

  static unauthorized(message = 'Token tidak valid atau sudah kedaluwarsa') {
    return new AppError(401, 'UNAUTHENTICATED', message);
  }

  static forbidden(message = 'Anda tidak berwenang untuk aksi ini') {
    return new AppError(403, 'FORBIDDEN', message);
  }

  static notFound(message = 'Data tidak ditemukan') {
    return new AppError(404, 'NOT_FOUND', message);
  }

  static unprocessable(message, errors = []) {
    return new AppError(422, 'UNPROCESSABLE', message, errors);
  }

  static conflict(message, errors = []) {
    return new AppError(409, 'CONFLICT', message, errors);
  }
}

module.exports = AppError;
