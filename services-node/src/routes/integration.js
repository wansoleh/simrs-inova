const express = require('express');
const { query } = require('../db');
const auth = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');
const { ok, pagination, meta } = require('../utils/response');
const { processOutboxOnce } = require('../services/outboxWorker');
const { syncInboxToYii } = require('../services/inboxService');

const router = express.Router();
router.use(auth('admin'));

router.get('/outbox', asyncHandler(async (req, res) => {
  const { page, perPage, offset } = pagination(req, 50);
  const status = req.query.status || null;
  const count = await query(
    `SELECT count(*)::int AS total FROM integration.outbox WHERE ($1::text IS NULL OR status = $1)`,
    [status]
  );
  const rows = await query(
    `SELECT id, event_type, aggregate_type, aggregate_id, payload, status,
            attempts, next_retry_at, last_error, created_at, sent_at
     FROM integration.outbox
     WHERE ($1::text IS NULL OR status = $1)
     ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
    [status, perPage, offset]
  );
  return ok(res, rows.rows, 'Daftar outbox', meta(count.rows[0].total, page, perPage));
}));

router.post('/outbox/:id/retry', asyncHandler(async (req, res) => {
  const result = await query(
    `UPDATE integration.outbox
     SET status = 'PENDING', attempts = 0, next_retry_at = now(), last_error = NULL
     WHERE id = $1 RETURNING id, event_type, status`,
    [req.params.id]
  );
  if (!result.rows.length) throw require('../middleware/AppError').notFound('Outbox tidak ditemukan');
  return ok(res, result.rows[0], 'Outbox dijadwalkan ulang');
}));

router.post('/outbox/run', asyncHandler(async (_req, res) => {
  const result = await processOutboxOnce();
  return ok(res, result, 'Worker outbox dijalankan');
}));

router.get('/inbox', asyncHandler(async (req, res) => {
  const { page, perPage, offset } = pagination(req, 50);
  const status = req.query.status || null;
  const count = await query(
    `SELECT count(*)::int AS total FROM integration.inbox WHERE ($1::text IS NULL OR status = $1)`,
    [status]
  );
  const rows = await query(
    `SELECT id, source, external_ref, status, attempts, last_error, created_at AS received_at, processed_at
     FROM integration.inbox
     WHERE ($1::text IS NULL OR status = $1)
     ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
    [status, perPage, offset]
  );
  return ok(res, rows.rows, 'Daftar inbox', meta(count.rows[0].total, page, perPage));
}));

router.post('/inbox/:id/retry', asyncHandler(async (req, res) => {
  const result = await syncInboxToYii(Number(req.params.id));
  return ok(res, result, result.synced ? 'Inbox tersinkron' : 'Inbox masih gagal', null, result.synced ? 200 : 502);
}));

module.exports = router;
