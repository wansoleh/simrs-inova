const express = require('express');
const { query } = require('../db');
const auth = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');
const { ok, pagination, meta } = require('../utils/response');

const router = express.Router();
router.use(auth());

function dateRange(req) {
  return [
    req.query.from || null,
    req.query.to || null,
  ];
}

router.get('/summary', asyncHandler(async (req, res) => {
  const [from, to] = dateRange(req);
  const summary = await query(
    `SELECT count(*)::int AS visits,
            count(*) FILTER (WHERE status = 'PAID')::int AS paid_visits,
            COALESCE(SUM(total), 0)::numeric AS billed,
            COALESCE(SUM(paid_total), 0)::numeric AS collected,
            COALESCE(SUM(total - paid_total), 0)::numeric AS outstanding
     FROM reporting.v_visits
     WHERE status <> 'CANCELLED'
       AND ($1::date IS NULL OR visit_date >= $1::date)
       AND ($2::date IS NULL OR visit_date <= $2::date)`,
    [from, to]
  );
  const patients = await query('SELECT count(*)::int AS total FROM patients');
  const poli = await query(
    `SELECT count(DISTINCT poli_id)::int AS total FROM reporting.v_visits
     WHERE status <> 'CANCELLED'
       AND ($1::date IS NULL OR visit_date >= $1::date)
       AND ($2::date IS NULL OR visit_date <= $2::date)`,
    [from, to]
  );
  return ok(res, {
    ...summary.rows[0],
    patients: patients.rows[0].total,
    polis: poli.rows[0].total,
    from: from || null,
    to: to || null,
    role: req.user.role,
  }, 'Ringkasan dashboard');
}));

router.get('/visits-by-poli', asyncHandler(async (req, res) => {
  const [from, to] = dateRange(req);
  const result = await query(
    `SELECT poli_name, count(*)::int AS visits,
            count(*) FILTER (WHERE status = 'PAID')::int AS paid_visits,
            COALESCE(SUM(total), 0)::numeric AS billed
     FROM reporting.v_visits
     WHERE status <> 'CANCELLED'
       AND ($1::date IS NULL OR visit_date >= $1::date)
       AND ($2::date IS NULL OR visit_date <= $2::date)
     GROUP BY poli_name ORDER BY visits DESC`,
    [from, to]
  );
  return ok(res, result.rows, 'Kunjungan per poli');
}));

router.get('/procedures', asyncHandler(async (req, res) => {
  const [from, to] = dateRange(req);
  const result = await query(
    `SELECT procedure_name, SUM(qty)::int AS qty, SUM(amount)::numeric AS amount
     FROM reporting.v_procedures
     WHERE status = 'ACTIVE'
       AND ($1::date IS NULL OR visit_date >= $1::date)
       AND ($2::date IS NULL OR visit_date <= $2::date)
     GROUP BY procedure_name ORDER BY amount DESC LIMIT 15`,
    [from, to]
  );
  return ok(res, result.rows, 'Tindakan teratas');
}));

router.get('/revenue', asyncHandler(async (req, res) => {
  const [from, to] = dateRange(req);
  const result = await query(
    `SELECT visit_date, SUM(total)::numeric AS billed, SUM(paid_total)::numeric AS collected
     FROM reporting.v_revenue
     WHERE ($1::date IS NULL OR visit_date >= $1::date)
       AND ($2::date IS NULL OR visit_date <= $2::date)
     GROUP BY visit_date ORDER BY visit_date`,
    [from, to]
  );
  return ok(res, result.rows, 'Pendapatan harian');
}));

router.get('/medicine-usage', asyncHandler(async (req, res) => {
  const [from, to] = dateRange(req);
  const result = await query(
    `SELECT m.name AS medicine_name, m.unit,
            SUM(pi.qty)::int AS qty,
            SUM(pi.qty * pi.unit_price)::numeric AS revenue
     FROM prescription_items pi
     JOIN prescriptions r ON r.id = pi.prescription_id AND r.status = 'DISPENSED'
     JOIN visits v ON v.id = r.visit_id
     JOIN medicines m ON m.id = pi.medicine_id
     WHERE ($1::date IS NULL OR v.visit_date >= $1::date)
       AND ($2::date IS NULL OR v.visit_date <= $2::date)
     GROUP BY m.name, m.unit ORDER BY qty DESC LIMIT 15`,
    [from, to]
  );
  return ok(res, result.rows, 'Pemakaian obat');
}));

router.get('/payment-status', asyncHandler(async (_req, res) => {
  const result = await query(
    'SELECT status, invoice_count::int, total, paid_total FROM reporting.v_payment_status ORDER BY status'
  );
  return ok(res, result.rows, 'Status pembayaran');
}));

router.get('/details', asyncHandler(async (req, res) => {
  const { page, perPage, offset } = pagination(req);
  const [from, to] = dateRange(req);
  const type = req.query.type || 'visits';
  const allowed = {
    visits: {
      count: `SELECT count(*)::int AS total FROM reporting.v_visits
              WHERE ($1::date IS NULL OR visit_date >= $1::date) AND ($2::date IS NULL OR visit_date <= $2::date)`,
      rows: `SELECT visit_no, visit_date, patient_name, mrn, doctor_name, poli_name, status, invoice_status, total, paid_total
             FROM reporting.v_visits
             WHERE ($1::date IS NULL OR visit_date >= $1::date) AND ($2::date IS NULL OR visit_date <= $2::date)
             ORDER BY visit_date DESC, queue_no LIMIT $3 OFFSET $4`,
    },
    revenue: {
      count: `SELECT count(*)::int AS total FROM reporting.v_revenue
              WHERE ($1::date IS NULL OR visit_date >= $1::date) AND ($2::date IS NULL OR visit_date <= $2::date)`,
      rows: `SELECT invoice_no, visit_date, poli_name, status, total, paid_total, outstanding
             FROM reporting.v_revenue
             WHERE ($1::date IS NULL OR visit_date >= $1::date) AND ($2::date IS NULL OR visit_date <= $2::date)
             ORDER BY visit_date DESC, invoice_no LIMIT $3 OFFSET $4`,
    },
    procedures: {
      count: `SELECT count(*)::int AS total FROM reporting.v_procedures
              WHERE status = 'ACTIVE' AND ($1::date IS NULL OR visit_date >= $1::date) AND ($2::date IS NULL OR visit_date <= $2::date)`,
      rows: `SELECT visit_id, visit_date, poli_name, procedure_name, qty, unit_price, amount
             FROM reporting.v_procedures
             WHERE status = 'ACTIVE' AND ($1::date IS NULL OR visit_date >= $1::date) AND ($2::date IS NULL OR visit_date <= $2::date)
             ORDER BY visit_date DESC LIMIT $3 OFFSET $4`,
    },
  };
  const target = allowed[type];
  if (!target) return res.status(422).json({ success: false, message: 'type tidak valid', data: null, meta: null, errors: [], request_id: res.getHeader('X-Request-Id') });
  const count = await query(target.count, [from, to]);
  const rows = await query(target.rows, [from, to, perPage, offset]);
  return ok(res, rows.rows, 'Detail dashboard', meta(count.rows[0].total, page, perPage));
}));

router.get('/export', asyncHandler(async (req, res) => {
  const [from, to] = dateRange(req);
  const type = req.query.type || 'revenue';
  let rows = [];
  if (type === 'revenue') {
    const result = await query(
      `SELECT visit_date, poli_name, invoice_no, status, total, paid_total
       FROM reporting.v_revenue
       WHERE ($1::date IS NULL OR visit_date >= $1::date) AND ($2::date IS NULL OR visit_date <= $2::date)
       ORDER BY visit_date DESC`,
      [from, to]
    );
    rows = result.rows;
  } else if (type === 'visits') {
    const result = await query(
      `SELECT visit_date, visit_no, patient_name, mrn, doctor_name, poli_name, status, total, paid_total
       FROM reporting.v_visits
       WHERE ($1::date IS NULL OR visit_date >= $1::date) AND ($2::date IS NULL OR visit_date <= $2::date)
       ORDER BY visit_date DESC`,
      [from, to]
    );
    rows = result.rows;
  } else {
    return res.status(422).json({ success: false, message: 'type export tidak valid', data: null, meta: null, errors: [], request_id: res.getHeader('X-Request-Id') });
  }
  const headers = rows.length ? Object.keys(rows[0]) : ['empty'];
  const csv = [headers.join(',')]
    .concat(rows.map((row) => headers.map((h) => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(',')))
    .join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="dashboard-${type}-${Date.now()}.csv"`);
  return res.send(csv);
}));

module.exports = router;
