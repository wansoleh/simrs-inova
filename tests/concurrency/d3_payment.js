'use strict';
// D.3: pembayaran dengan Idempotency-Key tidak boleh tercatat ganda.
const crypto = require('crypto');
const L = require('./lib');

const pay = (token, invId, key, amount) =>
  L.api('POST', `/invoices/${invId}/payments`, token, { method: 'CASH', amount }, key === null ? {} : { 'Idempotency-Key': key });

async function newInvoice() {
  const t = await L.tokens(['pendaftaran', 'kasir']);
  const { date } = L.freshSlot();
  const { visitId } = await L.makeVisit(t.pendaftaran, date, 'pay');
  const invId = Number(L.sql(`SELECT id FROM invoices WHERE visit_id=${visitId}`));
  return { kasir: t.kasir, invId };
}
function stat(invId) {
  const [c, s] = L.sql(`SELECT count(*) || ',' || coalesce(sum(amount),0) FROM payments WHERE invoice_id=${invId}`).split(',');
  return { count: Number(c), sum: Number(s) };
}
const invRow = (invId) => L.sql(`SELECT row_to_json(i) FROM invoices i WHERE id=${invId}`);

async function sameKeyParallel() {
  const { kasir, invId } = await newInvoice();
  console.log('  invoice sebelum:', invRow(invId));
  const key = crypto.randomUUID();
  const rs = await Promise.all(Array.from({ length: 10 }, () => pay(kasir, invId, key, 1000)));
  const ok = rs.filter((r) => r.status === 200).length;
  const fresh = rs.filter((r) => r.replay === 'false').length;
  const replay = rs.filter((r) => r.replay === 'true').length;
  const s = stat(invId);
  console.log('  respons:', JSON.stringify(L.tally(rs)), '| baru:', fresh, '| replay:', replay);
  console.log('  invoice sesudah:', invRow(invId));
  return { pass: ok === 10 && fresh === 1 && replay === 9 && s.count === 1 && s.sum === 1000,
    detail: `200=${ok}/10, baru=${fresh}, replay=${replay}, baris payments=${s.count}, total=${s.sum} (harapan 1 baris, 1000)` };
}

async function differentPayloadSameKey() {
  const { kasir, invId } = await newInvoice();
  const key = crypto.randomUUID();
  const a = await pay(kasir, invId, key, 1000);
  const b = await pay(kasir, invId, key, 2000);
  const s = stat(invId);
  console.log('  pertama:', a.status, '| key sama, nominal beda:', b.status, (b.body && b.body.message) || '');
  return { pass: a.status === 200 && b.status === 422 && s.count === 1 && s.sum === 1000,
    detail: `pertama=${a.status}, nominal-beda=${b.status} (harapan 200 lalu 422), baris=${s.count}, total=${s.sum}` };
}

async function invalidKey() {
  const { kasir, invId } = await newInvoice();
  const a = await pay(kasir, invId, 'bukan-uuid', 1000);
  const b = await pay(kasir, invId, null, 1000);
  const s = stat(invId);
  console.log('  key tidak valid:', a.status, '| tanpa header:', b.status);
  return { pass: a.status === 422 && b.status === 422 && s.count === 0,
    detail: `tidak-valid=${a.status}, tanpa-header=${b.status} (harapan 422/422), baris payments=${s.count} (harapan 0)` };
}

L.runAll([
  ['same_key_parallel (10x key sama)', sameKeyParallel],
  ['different_payload_same_key', differentPayloadSameKey],
  ['invalid_or_missing_key', invalidKey],
]);
