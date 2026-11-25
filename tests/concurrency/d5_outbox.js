'use strict';
// D.5: gangguan integrasi. Dua fase:
//   node d5_outbox.js fail     (Node jalan dengan OUTBOX_FORCE_FAIL aktif)
//   node d5_outbox.js recover  (Node direstart TANPA flag)
const fs = require('fs');
const path = require('path');
const L = require('./lib');

const STATE = path.join(__dirname, '.d5_state.json');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const W = (id) => `aggregate_type='lab_order' AND aggregate_id=${id} AND event_type='lab.order.created'`;
const ob = (id) => {
  const o = L.sql(`SELECT row_to_json(o) FROM (SELECT status, attempts, last_error, sent_at, idempotency_key FROM integration.outbox WHERE ${W(id)}) o`);
  return o ? JSON.parse(o) : null;
};
const cnt = (q) => Number(L.sql(q));
async function waitFor(fn, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) { const v = fn(); if (v) return v; await sleep(2000); }
  return null;
}
const done = (checks) => {
  let ok = true;
  for (const [name, pass, info] of checks) { ok = ok && pass; console.log(`  [${pass ? 'OK' : 'GAGAL'}] ${name}${info ? ' -> ' + info : ''}`); }
  return ok;
};

async function fail() {
  const t = await L.tokens(['pendaftaran', 'dokter']);
  const { date } = L.freshSlot();
  const { visitId } = await L.makeVisit(t.pendaftaran, date, 'd5');
  await L.api('PATCH', `/visits/${visitId}/checkin`, t.pendaftaran);
  await L.api('POST', `/exams/${visitId}/start`, t.dokter);

  const lt = await L.api('GET', '/lab-tests', t.dokter);
  const d = lt.body && lt.body.data;
  const list = Array.isArray(d) ? d : ((d && (d.items || d.rows)) || []);
  if (!list.length) throw new Error('Master lab_tests kosong: ' + lt.status + ' ' + JSON.stringify(lt.body).slice(0, 200));
  const testId = list[0].id;

  let order = null;
  for (const key of ['test_ids', 'lab_test_ids']) {
    const r = await L.api('POST', `/visits/${visitId}/lab-orders`, t.dokter, { [key]: [testId], notes: 'uji D.5' });
    console.log(`  POST lab-orders {${key}}: ${r.status} ${JSON.stringify(r.body).slice(0, 140)}`);
    if (r.status === 201) { order = r.body.data; break; }
  }
  if (!order) throw new Error('Order lab gagal dibuat; sesuaikan nama field body di skrip (lihat respons di atas)');
  const orderId = order.id || (order.order && order.order.id);

  console.log('  menunggu worker (interval 15 detik) ...');
  const f1 = await waitFor(() => { const o = ob(orderId); return o && o.status === 'FAILED' && o.attempts >= 1 ? o : null; }, 70000);
  L.sql(`UPDATE integration.outbox SET next_retry_at = now() WHERE ${W(orderId)}`);
  const f2 = await waitFor(() => { const o = ob(orderId); return o && o.status === 'FAILED' && o.attempts >= 2 ? o : null; }, 70000);

  const ok = done([
    ['order tersimpan walau integrasi gagal', cnt(`SELECT count(*) FROM lab_orders WHERE id=${orderId} AND status='ORDERED'`) === 1],
    ['tepat 1 event outbox untuk order (satu transaksi)', cnt(`SELECT count(*) FROM integration.outbox WHERE ${W(orderId)}`) === 1],
    ['status FAILED + last_error terisi', !!(f1 && f1.last_error), f1 ? f1.last_error : 'tidak pernah FAILED: pastikan Node jalan dengan OUTBOX_FORCE_FAIL aktif'],
    ['attempts naik pada percobaan ulang', !!f2, f2 ? 'attempts=' + f2.attempts : 'attempts tidak naik'],
  ]);
  fs.writeFileSync(STATE, JSON.stringify({ orderId }));
  console.log(`\n[${ok ? 'PASS' : 'FAIL'}] D5 fase fail (order ${orderId}). Lanjut: restart Node TANPA flag, lalu: node tests/concurrency/d5_outbox.js recover`);
  process.exit(ok ? 0 : 1);
}

async function recover() {
  const { orderId } = JSON.parse(fs.readFileSync(STATE, 'utf8'));
  const before = ob(orderId);
  console.log('  sebelum pulih:', JSON.stringify(before));
  L.sql(`UPDATE integration.outbox SET next_retry_at = now() WHERE ${W(orderId)} AND status='FAILED'`);
  const sent = await waitFor(() => { const o = ob(orderId); return o && o.status === 'SENT' ? o : null; }, 80000);
  console.log('  sesudah pulih:', JSON.stringify(ob(orderId)));
  const ok = done([
    ['status berubah FAILED -> SENT otomatis', !!sent],
    ['sent_at terisi, last_error kosong', !!(sent && sent.sent_at && !sent.last_error)],
    ['riwayat attempts tetap tercatat', !!(sent && sent.attempts >= 2), sent ? 'attempts=' + sent.attempts : ''],
    ['tidak ada event ganda (1 baris, 1 idempotency_key)', cnt(`SELECT count(*) FROM integration.outbox WHERE ${W(orderId)}`) === 1],
    ['tidak ada order ganda', cnt(`SELECT count(*) FROM lab_orders WHERE id=${orderId}`) === 1],
  ]);
  console.log(`\n[${ok ? 'PASS' : 'FAIL'}] D5 fase recover (order ${orderId})`);
  process.exit(ok ? 0 : 1);
}

const phase = process.argv[2];
(phase === 'fail' ? fail() : phase === 'recover' ? recover() : Promise.reject(new Error('pakai: fail | recover')))
  .catch((e) => { console.log('[FAIL] ' + e.message); process.exit(1); });
