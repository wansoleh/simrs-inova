function ok(res, data, message = 'OK', meta = null, status = 200) {
  return res.status(status).json({
    success: true,
    message,
    data,
    meta,
    errors: null,
    request_id: res.getHeader('X-Request-Id') || null,
  });
}

function pagination(req, defaultPerPage = 20) {
  const page = Math.max(1, Number(req.query.page || 1));
  const perPage = Math.max(1, Math.min(100, Number(req.query.per_page || req.query['per-page'] || defaultPerPage)));
  return { page, perPage, offset: (page - 1) * perPage };
}

function meta(total, page, perPage) {
  return {
    page,
    per_page: perPage,
    total,
    total_pages: Math.ceil(total / Math.max(perPage, 1)),
  };
}

module.exports = { ok, pagination, meta };
