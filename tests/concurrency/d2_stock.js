'use strict';
// D.2: serah obat paralel tidak boleh membuat stok negatif atau terpotong dua kali.
const L = require('./lib');

async function race(cfg) {
  const t = await L.tokens(['admin', 'pendaftaran', 'dokter', 'farmasi']);
  const med = await L.api('POST', '/medicines', t.admin, { code: 'TST' + L.rnd(10), name: 'Obat Uji ' + L.rnd(4), unit: 'tablet', price: 1000, category: 'TEST' });
  if (med.status !== 201) throw new Error('Buat obat gagal: ' + med.status + ' ' + JSON.stringify(med.body));
  const medId = med.body.data.id;
  const adj = await L.api('POST', `/medicines/${medId}/stock-adjust`, t.admin, { qty_change: cfg.stock, reason: 'Stok awal uji D.2' });
  if (adj.status !== 200) throw new Error('Stock-adjust gagal: ' + adj.status + ' ' + JSON.stringify(adj.body));

  const { date } = L.freshSlot();
  const rxIds = [];
  for (let i = 0; i < cfg.n; i++) {
    const { visitId } = await L.makeVisit(t.pendaftaran, date, 'rx' + i);
    const rx = await L.api('POST', `/visits/${visitId}/prescriptions`, t.dokter,
      { items: [{ medicine_id: medId, qty: cfg.qty, dose: '1 tablet', frequency: '3x sehari' }], notes: 'uji D.2' });
    if (rx.status !== 201) throw new Error('Buat resep gagal: ' + rx.status + ' ' + JSON.stringify(rx.body));
    const d = rx.body.data || {};
    const rxId = d.id || (d.prescription && d.prescription.id);
    if (!rxId) throw new Error('ID resep tidak ditemukan: ' + JSON.stringify(rx.body).slice(0, 300));
    const pr = await L.api('POST', `/prescriptions/${rxId}/process`, t.farmasi);
    if (pr.status !== 200) throw new Error('Process resep gagal: ' + pr.status + ' ' + JSON.stringify(pr.body));
    rxIds.push(rxId);
  }

  const calls = [];
  for (const id of rxIds) for (let k = 0; k < (cfg.repeat || 1); k++) calls.push(L.api('POST', `/prescriptions/${id}/dispense`, t.farmasi));
  const rs = await Promise.all(calls);
  const ok = rs.filter((r) => r.status === 200).length;
  const stock = Number(L.sql(`SELECT stock FROM medicines WHERE id=${medId}`));
  const moves = Number(L.sql(`SELECT count(*) FROM stock_movements WHERE medicine_id=${medId} AND qty_change<0`));
  const disp = Number(L.sql(`SELECT count(*) FROM prescriptions p JOIN prescription_items pi ON pi.prescription_id=p.id WHERE pi.medicine_id=${medId} AND p.status='DISPENSED'`));
  const wantStock = cfg.stock - cfg.expectOk * cfg.qty;
  console.log(`  obat ${medId} | stok awal ${cfg.stock} | ${cfg.n} resep x qty ${cfg.qty} x ${cfg.repeat || 1} panggilan`);
  console.log('  respons:', JSON.stringify(L.tally(rs)));
  console.log(`  stok akhir=${stock} (harapan ${wantStock}), mutasi stok=${moves}, resep DISPENSED=${disp} (harapan ${cfg.expectOk})`);
  return {
    pass: ok === cfg.expectOk && stock === wantStock && stock >= 0 && moves === cfg.expectOk && disp === cfg.expectOk,
    detail: `sukses=${ok}/${cfg.expectOk}, stok akhir=${stock}/${wantStock}, mutasi=${moves}, dispensed=${disp}`,
  };
}

L.runAll([
  ['stock_race_2_resep (stok 5, 2 resep qty 5)', () => race({ stock: 5, n: 2, qty: 5, expectOk: 1 })],
  ['stock_race_8_resep (stok 3, 8 resep qty 1)', () => race({ stock: 3, n: 8, qty: 1, expectOk: 3 })],
  ['double_dispense (1 resep diserahkan 5x paralel)', () => race({ stock: 10, n: 1, qty: 4, repeat: 5, expectOk: 1 })],
]);
