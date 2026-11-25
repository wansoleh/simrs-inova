const express = require('express');
const { query } = require('../db');
const auth = require('../middleware/auth');
const AppError = require('../middleware/AppError');
const { asyncHandler } = require('../middleware/error');
const { ok } = require('../utils/response');

const router = express.Router();

router.get('/satusehat/encounters/:visitId/bundle', auth('admin', 'dokter', 'pendaftaran'), asyncHandler(async (req, res) => {
  const visit = await query(
    `SELECT v.*, p.mrn, p.name AS patient_name, p.gender, p.birth_date,
            d.name AS doctor_name, po.name AS poli_name, i.invoice_no
     FROM visits v
     JOIN patients p ON p.id = v.patient_id
     JOIN doctors d ON d.id = v.doctor_id
     JOIN polis po ON po.id = v.poli_id
     LEFT JOIN invoices i ON i.visit_id = v.id
     WHERE v.id = $1`,
    [req.params.visitId]
  );
  if (!visit.rows.length) throw AppError.notFound('Kunjungan tidak ditemukan');
  const v = visit.rows[0];
  const diagnoses = await query(
    'SELECT icd10_code, name, type FROM diagnoses WHERE visit_id = $1 ORDER BY type DESC, id',
    [v.id]
  );
  const bundle = {
    resourceType: 'Bundle',
    type: 'collection',
    timestamp: new Date().toISOString(),
    entry: [
      {
        resource: {
          resourceType: 'Patient',
          identifier: [{ system: 'urn:simrs:mrn', value: v.mrn }],
          name: [{ text: v.patient_name }],
          gender: v.gender === 'L' ? 'male' : 'female',
          birthDate: v.birth_date,
        },
      },
      {
        resource: {
          resourceType: 'Encounter',
          identifier: [{ system: 'urn:simrs:visit', value: v.visit_no }],
          status: v.status === 'CANCELLED' ? 'cancelled' : 'finished',
          class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB', display: 'ambulatory' },
          subject: { reference: `Patient?identifier=${v.mrn}` },
          period: { start: v.created_at },
          serviceProvider: { display: v.poli_name },
          participant: [{ individual: { display: v.doctor_name } }],
        },
      },
      ...diagnoses.rows.map((d) => ({
        resource: {
          resourceType: 'Condition',
          code: { coding: [{ system: 'http://hl7.org/fhir/sid/icd-10', code: d.icd10_code, display: d.name }] },
          subject: { reference: `Patient?identifier=${v.mrn}` },
          encounter: { reference: `Encounter?identifier=${v.visit_no}` },
          category: [{ text: d.type === 'P' ? 'primary' : 'secondary' }],
        },
      })),
    ],
  };
  return ok(res, bundle, 'FHIR Bundle encounter');
}));

router.post('/bpjs/sep/mock', auth('admin', 'pendaftaran'), asyncHandler(async (req, res) => {
  const { visit_id } = req.body || {};
  if (!visit_id) throw AppError.unprocessable('visit_id wajib diisi');
  const visit = await query('SELECT id, visit_no, patient_id FROM visits WHERE id = $1', [visit_id]);
  if (!visit.rows.length) throw AppError.notFound('Kunjungan tidak ditemukan');
  const sep = `SEP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(visit_id).padStart(6, '0')}`;
  return ok(res, {
    sep_number: sep,
    visit_id: Number(visit_id),
    visit_no: visit.rows[0].visit_no,
    note: 'Mock integrasi BPJS untuk demo, bukan nomor SEP resmi.',
  }, 'SEP mock dibuat', null, 201);
}));

module.exports = router;
