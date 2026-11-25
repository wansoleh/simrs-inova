'use strict';
// D.4: perubahan tindakan/diagnosis setelah invoice dibuat harus konsisten dan tertelusuri.
const crypto = require('crypto');
const L = require('./lib');
const PRICE = 50000;

const inv = (id) => {
  const [total, paid, status, rev, refund] = L.sql(
    `SELECT total||','||paid_total||','||status||','||revision||','||refund_due FROM invoices WHERE id=${id}`).split(',');
  return { total: Number(total), paid: Number(paid), status, rev: Number(rev), refund: Number(refund) };
};
const audit = (v, i) => Number(L.sql(`SELECT count(*) FROM audit_logs WHERE
  (table_name='visit_procedures' AND record_id IN (SELECT id FROM visit_procedures WHERE visit_id=${v}))
  OR (table_name='invoices' AND record_id=${i})`));
const items = (i, cond) => Number(L.sql(`SELECT count(*) FROM invoice_items WHERE invoice_id=${i} AND ${cond}`));

async function setup(tag) {
  const t = await L.tokens(['admin', 'pendaftaran', 'dokter', 'kasir']);
  const p = await L.api('POST', '/procedures', t.admin, { code: 'TP' + L.rnd(8), name: 'Tindakan Uji ' + L.rnd(4), price: PRICE });
  if (p.status !== 201) throw new Error('Buat tindakan gagal: ' + p.status + ' ' + JSON.stringify(p.body));
  const { date } = L.freshSlot();
  const { visitId } = await L.makeVisit(t.pendaftaran, date, tag);
  await L.api('PATCH', `/visits/${visitId}/checkin`, t.pendaftaran);
  await L.api('POST', `/exams/${visitId}/start`, t.dokter);
  const invId = Number(L.sql(`SELECT id FROM invoices WHERE visit_id=${visitId}`));
  return { t, procId: p.body.data.id, visitId, invId };
}
const addProc = (c, qty) => L.api('POST', `/visits/${c.visitId}/procedures`, c.t.dokter, { procedure_id: c.procId, qty: qty || 1 });
const lastPid = (c) => Number(L.sql(`SELECT max(id) FROM visit_procedures WHERE visit_id=${c.visitId}`));
const voidProc = (c, pid, reason) => L.api('DELETE', `/visits/${c.visitId}/procedures/${pid}`, c.t.dokter, reason === undefined ? {} : { reason });
const pay = (c, amount) => L.api('POST', `/invoices/${c.invId}/payments`, c.t.kasir, { method: 'CASH', amount }, { 'Idempotency-Key': crypto.randomUUID() });
const show = (label, r) => console.log(`  ${label}: ${r.status} ${JSON.stringify(r.body).slice(0, 160)}`);

// A. UNPAID: tambah lalu void tindakan
async function unpaid() {
  const c = await setup('d4a');
  const b = inv(c.invId), a0 = audit(c.visitId, c.invId);
  const add = await addProc(c); show('tambah tindakan', add);
  const pid = lastPid(c), x = inv(c.invId), a1 = audit(c.visitId, c.invId);
  const vd = await voidProc(c, pid, 'Salah input (uji D.4)'); show('void tindakan', vd);
  const y = inv(c.invId), a2 = audit(c.visitId, c.invId);
  const rowKept = Number(L.sql(`SELECT count(*) FROM visit_procedures WHERE id=${pid} AND status='VOID'`));
  const itemVoid = items(c.invId, `status='VOID'`);
  console.log(`  total: ${b.total} -> ${x.total} -> ${y.total} | revision: ${b.rev} -> ${x.rev} -> ${y.rev} | audit: ${a0} -> ${a1} -> ${a2}`);
  return { pass: add.status === 201 && x.total === b.total + PRICE && x.rev > b.rev && y.total === b.total && y.rev > x.rev
      && a1 > a0 && a2 > a1 && rowKept === 1 && itemVoid >= 1,
    detail: `total naik ${PRICE} lalu kembali, revision naik tiap perubahan, audit bertambah, baris VOID tersimpan (visit_procedures=${rowKept}, invoice_items VOID=${itemVoid})` };
}

// B. PARTIAL: total turun di bawah paid_total -> refund_due
async function partial() {
  const c = await setup('d4b');
  const b = inv(c.invId);
  await addProc(c);
  const pid = lastPid(c);
  const pr = await pay(c, b.total + 30000); show('bayar sebagian', pr);
  const x = inv(c.invId);
  const vd = await voidProc(c, pid, 'Koreksi tindakan (uji D.4)'); show('void setelah bayar', vd);
  const y = inv(c.invId);
  console.log(`  sebelum void: total=${x.total} paid=${x.paid} status=${x.status} | sesudah: total=${y.total} paid=${y.paid} status=${y.status} refund_due=${y.refund}`);
  return { pass: x.status === 'PARTIAL' && vd.status === 200 && y.total === b.total && y.paid === x.paid && y.refund === 30000,
    detail: `status awal=${x.status} (harapan PARTIAL), refund_due=${y.refund} (harapan 30000), paid_total tidak berubah` };
}

// C. PAID: terkunci, hanya lewat adjustment berasalan
async function paidLocked() {
  const c = await setup('d4c');
  await addProc(c);
  const pid = lastPid(c);
  const full = inv(c.invId);
  await pay(c, full.total);
  const paid = inv(c.invId);
  const r1 = await voidProc(c, pid, 'Coba ubah invoice lunas'); show('void saat PAID', r1);
  const r2 = await addProc(c); show('tambah saat PAID', r2);
  const after = inv(c.invId);
  const origItems = items(c.invId, `ref_type IN ('REGISTRATION','PROCEDURE','LAB','MEDICINE')`);
  const noReason = await L.api('POST', `/invoices/${c.invId}/adjustments`, c.t.admin, { amount: 10000 }); show('adjustment tanpa alasan', noReason);
  const adj = await L.api('POST', `/invoices/${c.invId}/adjustments`, c.t.admin,
    { amount: 10000, description: 'Koreksi uji D.4', reason: 'Koreksi uji D.4' }); show('adjustment berasalan', adj);
  const adjItems = items(c.invId, `ref_type NOT IN ('REGISTRATION','PROCEDURE','LAB','MEDICINE')`);
  const origAfter = items(c.invId, `ref_type IN ('REGISTRATION','PROCEDURE','LAB','MEDICINE')`);
  const fin = inv(c.invId);
  console.log(`  status=${paid.status}, total ${paid.total} -> (setelah tolak) ${after.total} -> (setelah adjustment) ${fin.total}`);
  const blocked = [403, 422].includes(r1.status) && [403, 422].includes(r2.status);
  return { pass: paid.status === 'PAID' && blocked && after.total === paid.total && [403, 422].includes(noReason.status)
      && [200, 201].includes(adj.status) && adjItems === 1 && origAfter === origItems,
    detail: `ubah langsung ditolak (${r1.status}/${r2.status}), adjustment tanpa alasan ${noReason.status}, ADJ=${adjItems}, item asli tetap ${origAfter}/${origItems}` };
}

// D. Diagnosis berubah: revisi RME tersimpan, tagihan tidak berubah
async function diagnosis() {
  const c = await setup('d4d');
  const rec = await L.api('PUT', `/exams/${c.visitId}/record`, c.t.dokter, {
    complaint: 'Demam 2 hari', anamnesis: 'Demam, batuk', physical_exam: 'Faring hiperemis',
    blood_pressure: '120/80', temperature: 38.1, pulse: 88 });
  show('simpan RME', rec);
  const d1 = await L.api('PUT', `/exams/${c.visitId}/diagnoses`, c.t.dokter, { diagnoses: [{ icd10_code: 'J00', name: 'Nasofaringitis akut', type: 'P' }] }); show('diagnosis 1', d1);
  const b = inv(c.invId);
  const d2 = await L.api('PUT', `/exams/${c.visitId}/diagnoses`, c.t.dokter, { diagnoses: [{ icd10_code: 'J06.9', name: 'ISPA, tidak spesifik', type: 'P' }], reason: 'Koreksi diagnosis (uji D.4)' }); show('diagnosis 2', d2);
  const a = inv(c.invId);
  const revs = Number(L.sql(`SELECT count(*) FROM medical_record_revisions r JOIN medical_records m ON m.id=r.medical_record_id WHERE m.visit_id=${c.visitId}`));
  const prim = Number(L.sql(`SELECT count(*) FROM diagnoses WHERE visit_id=${c.visitId} AND type='P' AND is_active`));
  console.log(`  revisi RME=${revs}, diagnosis utama=${prim}, total ${b.total} -> ${a.total}`);
  return { pass: d2.status === 200 && revs >= 1 && prim === 1 && a.total === b.total,
    detail: `revisi RME=${revs} (>=1), diagnosis utama=${prim} (harapan 1), tagihan tetap ${a.total}` };
}

(async () => {
  const cases = [['unpaid_ubah_tindakan', unpaid], ['partial_refund_due', partial], ['paid_terkunci_adjustment', paidLocked], ['ubah_diagnosis', diagnosis]];
  const out = [];
  for (const [name, fn] of cases) {
    console.log(`\n== ${name} ==`);
    try { const r = await fn(); out.push({ name, ...r }); console.log(`[${r.pass ? 'PASS' : 'FAIL'}] ${name} - ${r.detail}`); }
    catch (e) { out.push({ name, pass: false, detail: e.message }); console.log(`[FAIL] ${name} - ${e.message}`); }
  }
  console.log(`\n===== RINGKASAN D4 (${new Date().toISOString()}) =====`);
  out.forEach((r) => console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}  ${r.detail}`));
  process.exit(out.every((r) => r.pass) ? 0 : 1);
})();
