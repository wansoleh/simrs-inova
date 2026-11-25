const express = require('express');
const { query, withTransaction } = require('../db');
const auth = require('../middleware/auth');
const AppError = require('../middleware/AppError');
const { asyncHandler } = require('../middleware/error');
const { ok } = require('../utils/response');
const { syncInboxToYii } = require('../services/inboxService');

const router = express.Router();

router.get('/orders', auth('lab', 'admin', 'dokter'), asyncHandler(async (req, res) => {
  const status = req.query.status || null;
  const date = req.query.date || null;
  const result = await query(
    `SELECT lo.id, lo.order_no, lo.visit_id, lo.status, lo.notes, lo.created_at,
            v.visit_no, v.visit_date, v.status AS visit_status,
            p.mrn, p.name AS patient_name, p.gender, p.birth_date,
            d.name AS doctor_name, po.name AS poli_name,
            COALESCE(jsonb_agg(jsonb_build_object(
              'id', li.id, 'test_code', lt.code, 'test_name', lt.name,
              'unit', COALESCE(lr.unit, lt.unit), 'ref_range', COALESCE(lr.ref_range, lt.ref_range),
              'result_value', lr.result_value, 'flag', lr.flag, 'status', li.status
            )) FILTER (WHERE li.id IS NOT NULL), '[]'::jsonb) AS items
     FROM lab_orders lo
     JOIN visits v ON v.id = lo.visit_id
     JOIN patients p ON p.id = v.patient_id
     JOIN doctors d ON d.id = v.doctor_id
     JOIN polis po ON po.id = v.poli_id
     LEFT JOIN lab_order_items li ON li.lab_order_id = lo.id
     LEFT JOIN lab_tests lt ON lt.id = li.lab_test_id
     LEFT JOIN lab_results lr ON lr.lab_order_item_id = li.id
     WHERE ($1::text IS NULL OR lo.status = $1)
       AND ($2::date IS NULL OR v.visit_date = $2::date)
     GROUP BY lo.id, v.id, p.id, d.id, po.id
     ORDER BY lo.created_at DESC LIMIT 100`,
    [status, date]
  );
  return ok(res, result.rows, 'Daftar order laboratorium');
}));

router.get('/orders/:id', auth('lab', 'admin', 'dokter'), asyncHandler(async (req, res) => {
  const order = await query(
    `SELECT lo.*, v.visit_no, v.visit_date, p.mrn, p.name AS patient_name,
            d.name AS doctor_name, po.name AS poli_name
     FROM lab_orders lo
     JOIN visits v ON v.id = lo.visit_id
     JOIN patients p ON p.id = v.patient_id
     JOIN doctors d ON d.id = v.doctor_id
     JOIN polis po ON po.id = v.poli_id
     WHERE lo.id = $1`,
    [req.params.id]
  );
  if (!order.rows.length) throw AppError.notFound('Order laboratorium tidak ditemukan');
  const items = await query(
    `SELECT li.*, lt.code AS test_code, lt.name AS test_name,
            lr.result_value, lr.unit AS result_unit, lr.ref_range AS result_ref_range,
            lr.flag AS result_flag, lr.notes AS result_notes, lr.verified_at
     FROM lab_order_items li
     JOIN lab_tests lt ON lt.id = li.lab_test_id
     LEFT JOIN lab_results lr ON lr.lab_order_item_id = li.id
     WHERE li.lab_order_id = $1 ORDER BY li.id`,
    [req.params.id]
  );
  return ok(res, { ...order.rows[0], items: items.rows }, 'Detail order laboratorium');
}));

router.post('/orders/:id/results', auth('lab', 'admin'), asyncHandler(async (req, res) => {
  const { lab_order_item_id, result_value, unit, ref_range, flag, notes, external_ref } = req.body || {};
  if (!lab_order_item_id || result_value === undefined || result_value === null || String(result_value).trim() === '') {
    throw AppError.unprocessable('lab_order_item_id dan result_value wajib diisi');
  }
  const item = await query(
    `SELECT li.id, li.lab_order_id, lo.order_no, lt.code, lt.name
     FROM lab_order_items li
     JOIN lab_orders lo ON lo.id = li.lab_order_id
     JOIN lab_tests lt ON lt.id = li.lab_test_id
     WHERE li.id = $1 AND li.lab_order_id = $2`,
    [lab_order_item_id, req.params.id]
  );
  if (!item.rows.length) throw AppError.notFound('Item order laboratorium tidak ditemukan');
  const ref = external_ref || `${item.rows[0].order_no}-${lab_order_item_id}`;
  const payload = {
    lab_order_item_id: Number(lab_order_item_id),
    result_value: String(result_value),
    unit: unit || null,
    ref_range: ref_range || null,
    flag: flag || null,
    notes: notes || null,
    external_ref: ref,
  };
  const inserted = await withTransaction(async (client) => {
    const existing = await client.query(
      `SELECT id FROM integration.inbox WHERE source = 'lab' AND external_ref = $1`,
      [ref]
    );
    if (existing.rows.length) return { id: existing.rows[0].id, replay: true };
    const row = await client.query(
      `INSERT INTO integration.inbox (source, external_ref, payload, status)
       VALUES ('lab', $1, $2::jsonb, 'RECEIVED') RETURNING id`,
      [ref, JSON.stringify(payload)]
    );
    return { id: row.rows[0].id, replay: false };
  });
  if (inserted.replay) {
    res.setHeader('Idempotent-Replay', 'true');
    const state = await query('SELECT status, attempts, last_error FROM integration.inbox WHERE id = $1', [inserted.id]);
    return ok(res, { inbox_id: inserted.id, ...state.rows[0] }, 'Hasil sudah pernah dikirim', null, 200);
  }
  const sync = await syncInboxToYii(inserted.id);
  if (!sync.synced) {
    return ok(res, { inbox_id: inserted.id, synced: false, warning: sync.error }, 'Hasil tersimpan, sinkronisasi ke Yii tertunda', null, 202);
  }
  return ok(res, { inbox_id: inserted.id, synced: true, yii: sync.response }, 'Hasil laboratorium tersimpan', null, 201);
}));

router.post('/inbox/:id/retry', auth('admin', 'lab'), asyncHandler(async (req, res) => {
  const sync = await syncInboxToYii(Number(req.params.id));
  return ok(res, sync, sync.synced ? 'Sinkronisasi berhasil' : 'Sinkronisasi masih gagal', null, sync.synced ? 200 : 502);
}));

module.exports = { router, syncInboxToYii };
