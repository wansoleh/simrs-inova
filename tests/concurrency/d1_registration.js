'use strict';
// Uji konkurensi D.1: kunjungan ganda, nomor antrean unik, kuota jadwal.
const { execFileSync } = require('child_process');

const BASE = process.env.YII_URL || 'http://127.0.0.1:8088/api/v1';
const PSQL = process.env.PSQL || '/www/server/pgsql/bin/psql';
const DB = process.env.DB_NAME || 'simrs_dev';
const DB_USER = process.env.DB_USER || 'simrs_dev';
const DOCTOR = Number(process.env.DOCTOR_ID || 6);
const POLI = Number(process.env.POLI_ID || 1);
const USER = process.env.TEST_USER || 'pendaftaran';
const PASS = process.env.TEST_PASS || 'pendaftaran123';

const sql = (q) => execFileSync(PSQL, ['-h', '127.0.0.1', '-U', DB_USER, '-d', DB, '-At', '-c', q], { encoding: 'utf8' }).trim();
const rnd = (n) => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join('');

async function api(method, path, token, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch (e) { /* bukan JSON */ }
  return { status: res.status, body: json };
}

async function login() {
  const r = await api('POST', '/auth/login', null, { username: USER, password: PASS });
  const t = r.body && r.body.data && r.body.data.access_token;
  if (!t) throw new Error('Login gagal: ' + r.status + ' ' + JSON.stringify(r.body));
  return t;
}

async function newPatient(token, tag) {
  const r = await api('POST', '/patients', token, {
    no_rkm_medis: 'RM-TEST-' + rnd(8), nik: '3' + rnd(15), name: 'TEST-' + tag + '-' + rnd(6),
    birth_date: '1990-01-01', gender: 'L', phone: '081234567890', address: 'Jl. TEST', blood_type: 'O', allergy: 'Tidak ada',
  });
  if (r.status !== 201) throw new Error('Buat pasien gagal: ' + r.status + ' ' + JSON.stringify(r.body));
  return r.body.data.id;
}

// Cari tanggal masa depan di hari praktik dokter yang belum punya kunjungan/antrean.
function freshSlot() {
  const rows = sql(`SELECT day_of_week || ':' || quota FROM doctor_schedules WHERE doctor_id=${DOCTOR} AND poli_id=${POLI} AND is_active ORDER BY start_time`).split('\n').filter(Boolean);
  const quotaByDow = {};
  for (const r of rows) { const [d, q] = r.split(':'); if (!(d in quotaByDow)) quotaByDow[d] = Number(q); }
  if (!rows.length) throw new Error('Dokter ' + DOCTOR + ' tidak punya jadwal di poli ' + POLI);
  const now = new Date();
  for (let i = 8; i < 500; i++) {
    const dt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + i));
    if (!(dt.getUTCDay() in quotaByDow)) continue;
    const date = dt.toISOString().slice(0, 10);
    const used = Number(sql(`SELECT (SELECT count(*) FROM visits WHERE doctor_id=${DOCTOR} AND visit_date='${date}') + (SELECT count(*) FROM queue_counters WHERE doctor_id=${DOCTOR} AND visit_date='${date}')`));
    if (used === 0) return { date, quota: quotaByDow[dt.getUTCDay()] };
  }
  throw new Error('Tidak ada tanggal kosong ditemukan');
}

const register = (token, pid, date) => api('POST', '/visits', token,
  { patient_id: pid, poli_id: POLI, doctor_id: DOCTOR, visit_date: date, guarantor_type: 'UMUM' });

function tally(rs) {
  const m = {};
  for (const r of rs) {
    const k = r.status + (r.status === 201 ? '' : ' ' + ((r.body && r.body.message) || ''));
    m[k] = (m[k] || 0) + 1;
  }
  return m;
}
const okCount = (rs) => rs.filter((r) => r.status === 201).length;

async function registerRace(token) {
  const { date } = freshSlot();
  const pid = await newPatient(token, 'race');
  const rs = await Promise.all(Array.from({ length: 20 }, () => register(token, pid, date)));
  const db = Number(sql(`SELECT count(*) FROM visits WHERE patient_id=${pid} AND visit_date='${date}' AND status<>'CANCELLED'`));
  console.log('  tanggal', date, '| respons:', JSON.stringify(tally(rs)));
  return { pass: okCount(rs) === 1 && db === 1, detail: `201=${okCount(rs)}, baris DB=${db} (harapan 1 dan 1)` };
}

async function queueUnique(token) {
  const { date, quota } = freshSlot();
  const n = Math.min(15, quota);
  const ids = [];
  for (let i = 0; i < n; i++) ids.push(await newPatient(token, 'q' + i));
  const rs = await Promise.all(ids.map((id) => register(token, id, date)));
  const got = sql(`SELECT string_agg(queue_no::text, ',' ORDER BY queue_no) FROM visits WHERE doctor_id=${DOCTOR} AND visit_date='${date}' AND patient_id IN (${ids.join(',')})`);
  const want = Array.from({ length: n }, (_, i) => i + 1).join(',');
  console.log('  tanggal', date, '| respons:', JSON.stringify(tally(rs)));
  console.log('  queue_no di DB :', got);
  return { pass: okCount(rs) === n && got === want, detail: `201=${okCount(rs)}/${n}, queue_no 1..${n} unik tanpa lubang: ${got === want}` };
}

async function quotaRace(token) {
  const { date, quota } = freshSlot();
  const n = quota + 10;
  const ids = [];
  for (let i = 0; i < n; i++) ids.push(await newPatient(token, 'k' + i));
  const rs = await Promise.all(ids.map((id) => register(token, id, date)));
  const db = Number(sql(`SELECT count(*) FROM visits WHERE doctor_id=${DOCTOR} AND poli_id=${POLI} AND visit_date='${date}' AND status<>'CANCELLED'`));
  console.log('  tanggal', date, '| kuota', quota, '| pendaftar', n, '| respons:', JSON.stringify(tally(rs)));
  const note = db > quota ? ' -> KUOTA TERLAMPAUI (race condition pada cek kuota)' : '';
  return { pass: okCount(rs) === quota && db === quota, detail: `201=${okCount(rs)}, baris DB=${db} (harapan tepat ${quota})${note}` };
}

(async () => {
  const token = await login();
  const tests = [['register_race', registerRace], ['queue_unique', queueUnique], ['quota_race', quotaRace]];
  const summary = [];
  for (const [name, fn] of tests) {
    console.log('\n== ' + name + ' ==');
    let r;
    try { r = await fn(token); } catch (e) { r = { pass: false, detail: 'ERROR: ' + e.message }; }
    console.log((r.pass ? '[PASS] ' : '[FAIL] ') + name + ' - ' + r.detail);
    summary.push([name, r]);
  }
  console.log('\n===== RINGKASAN (' + new Date().toISOString() + ') =====');
  for (const [name, r] of summary) console.log((r.pass ? 'PASS  ' : 'FAIL  ') + name + '  ' + r.detail);
  process.exit(summary.every(([, r]) => r.pass) ? 0 : 1);
})();
