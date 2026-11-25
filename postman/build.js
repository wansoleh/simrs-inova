'use strict';
// Membangun collection Postman v2.1 dengan JSON.stringify (selalu JSON valid).
const fs = require('fs');
const PW = { admin: 'admin123', pendaftaran: 'pendaftaran123', dokter: 'dokter123', farmasi: 'farmasi123', lab: 'lab123', kasir: 'kasir123' };
const ROLES = Object.keys(PW);
const FMT = "pm.test('format response seragam', () => { const j = pm.response.json(); pm.expect(j).to.have.property('success'); pm.expect(j).to.have.property('message'); });";
const ev = (listen, exec) => ({ listen, script: { type: 'text/javascript', exec } });

function item(name, method, url, o) {
  o = o || {};
  const header = [{ key: 'Content-Type', value: 'application/json' }];
  if (o.role) header.push({ key: 'Authorization', value: 'Bearer {{token_' + o.role + '}}' });
  if (o.headers) header.push(...o.headers);
  const codes = [].concat(o.status);
  const tests = ["pm.test('status " + codes.join(' atau ') + "', () => pm.expect(" + JSON.stringify(codes) + ").to.include(pm.response.code));"];
  if (o.format !== false) tests.push(FMT);
  if (o.tests) tests.push(...o.tests);
  const events = [ev('test', tests)];
  if (o.pre) events.unshift(ev('prerequest', o.pre));
  const req = { method, header, url };
  if (o.body) req.body = { mode: 'raw', raw: JSON.stringify(o.body) };
  return { name, event: events, request: req };
}
const folder = (name, items) => ({ name, item: items });
const col = (name, items) => ({ info: { name, schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' }, item: items });

const loginFolder = folder('Auth: login semua role', ROLES.map((r) => item('login ' + r, 'POST', 'http://127.0.0.1:8088/api/v1/auth/login', {
  body: { username: r, password: PW[r] }, status: 200,
  tests: ["pm.collectionVariables.set('token_" + r + "', pm.response.json().data.access_token);",
    "pm.test('ada access_token', () => pm.expect(pm.response.json().data.access_token).to.be.a('string'));"],
})));

const Y = 'http://127.0.0.1:8088/api/v1';
const N = 'http://127.0.0.1:3101/svc/v1';
const patient = (rm) => ({ no_rkm_medis: rm, nik: '{{nik}}', name: 'PM Test Pasien', birth_date: '1990-01-01', gender: 'L', phone: '081234567890', address: 'Jl. Test', blood_type: 'O', allergy: 'Tidak ada' });

const yii = col('SIMRS Inova - Yii API', [
  loginFolder,
  folder('Auth', [
    item('me (admin)', 'GET', Y + '/auth/me', { role: 'admin', status: 200 }),
    item('TC-01 login salah -> 401', 'POST', Y + '/auth/login', { body: { username: 'admin', password: 'salah' }, status: 401 }),
    item('tanpa token -> 401', 'GET', Y + '/patients', { status: 401 }),
  ]),
  folder('RBAC (TC-02)', [
    item('kasir buka /exams/waiting -> 403', 'GET', Y + '/exams/waiting', { role: 'kasir', status: 403 }),
    item('dokter buka /invoices -> 403', 'GET', Y + '/invoices', { role: 'dokter', status: 403 }),
    item('pendaftaran buka /users -> 403', 'GET', Y + '/users', { role: 'pendaftaran', status: 403 }),
    item('farmasi order lab -> 403', 'POST', Y + '/visits/1/lab-orders', { role: 'farmasi', body: { test_ids: [1] }, status: 403 }),
  ]),
  folder('Master data', ['patients', 'polis', 'doctors', 'procedures', 'medicines', 'lab-tests'].map((p) =>
    item('list ' + p, 'GET', Y + '/' + p, { role: 'admin', status: 200 }))),
  folder('Validasi dan duplikasi (TC-03)', [
    item('pasien tanpa data -> 422', 'POST', Y + '/patients', { role: 'admin', body: {}, status: [400, 422] }),
    item('pasien baru -> 201', 'POST', Y + '/patients', {
      role: 'admin', body: patient('{{rm}}'), status: 201,
      pre: ["pm.collectionVariables.set('nik', '3' + Math.random().toString().slice(2, 17));", "pm.collectionVariables.set('rm', 'RM-PM-' + Date.now());"],
    }),
    item('NIK sama -> ditolak 409/422', 'POST', Y + '/patients', { role: 'admin', body: patient('{{rm}}-2'), status: [409, 422] }),
  ]),
  folder('Billing (baca)', [
    item('kasir daftar invoice', 'GET', Y + '/invoices', { role: 'kasir', status: 200 }),
    item('bayar tanpa Idempotency-Key ditolak', 'POST', Y + '/invoices/1/payments', { role: 'kasir', body: { method: 'CASH', amount: 1000 }, status: [400, 404, 422] }),
  ]),
]);

const node = col('SIMRS Inova - Node API', [
  loginFolder,
  folder('Ops', [item('health', 'GET', 'http://127.0.0.1:3101/health', { status: 200, format: false })]),
  folder('Auth middleware', [
    item('tanpa token -> 401', 'GET', N + '/lab/orders', { status: 401 }),
    item('token sampah -> 401', 'GET', N + '/lab/orders', { status: 401, headers: [{ key: 'Authorization', value: 'Bearer abc.def.ghi' }] }),
    item('dokter input hasil lab -> 403', 'POST', N + '/lab/orders/1/results', { role: 'dokter', body: {}, status: 403 }),
    item('kasir buka lab orders -> 403', 'GET', N + '/lab/orders', { role: 'kasir', status: 403 }),
  ]),
  folder('Lab API', [item('lab daftar order', 'GET', N + '/lab/orders', { role: 'lab', status: 200 })]),
  folder('Dashboard', [
    item('summary periode', 'GET', N + '/dashboard/summary?from=2026-11-01T00:00:00.000Z&to=2026-11-30T23:59:59.000Z', { role: 'admin', status: 200 }),
    item('summary tanpa token -> 401', 'GET', N + '/dashboard/summary', { status: 401 }),
  ]),
]);

fs.writeFileSync(__dirname + '/yii.collection.json', JSON.stringify(yii, null, 2));
fs.writeFileSync(__dirname + '/node.collection.json', JSON.stringify(node, null, 2));
console.log('ok: yii + node collection ditulis');
