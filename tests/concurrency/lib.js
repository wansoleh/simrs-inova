'use strict';
// Pustaka bersama untuk skrip uji konkurensi D.2 dan D.3.
const { execFileSync } = require('child_process');

const BASE = process.env.YII_URL || 'http://127.0.0.1:8088/api/v1';
const PSQL = process.env.PSQL || '/www/server/pgsql/bin/psql';
const DB = process.env.DB_NAME || 'simrs_dev';
const DB_USER = process.env.DB_USER || 'simrs_dev';
const DOCTOR = Number(process.env.DOCTOR_ID || 6);
const POLI = Number(process.env.POLI_ID || 1);
const PASSWORDS = { admin: 'admin123', pendaftaran: 'pendaftaran123', dokter: 'dokter123', farmasi: 'farmasi123', kasir: 'kasir123' };

const sql = (q) => execFileSync(PSQL, ['-h', '127.0.0.1', '-U', DB_USER, '-d', DB, '-At', '-c', q], { encoding: 'utf8' }).trim();
const rnd = (n) => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join('');

async function api(method, path, token, body, extraHeaders) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(extraHeaders || {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch (e) { /* bukan JSON */ }
  return { status: res.status, body: json, replay: res.headers.get('idempotent-replay') };
}

async function login(user) {
  const r = await api('POST', '/auth/login', null, { username: user, password: PASSWORDS[user] });
  const t = r.body && r.body.data && r.body.data.access_token;
  if (!t) throw new Error('Login ' + user + ' gagal: ' + r.status + ' ' + JSON.stringify(r.body));
  return t;
}
async function tokens(users) { const t = {}; for (const u of users) t[u] = await login(u); return t; }

async function newPatient(token, tag) {
  const r = await api('POST', '/patients', token, {
    no_rkm_medis: 'RM-TEST-' + rnd(8), nik: '3' + rnd(15), name: 'TEST-' + tag + '-' + rnd(6),
    birth_date: '1990-01-01', gender: 'L', phone: '081234567890', address: 'Jl. TEST', blood_type: 'O', allergy: 'Tidak ada',
  });
  if (r.status !== 201) throw new Error('Buat pasien gagal: ' + r.status + ' ' + JSON.stringify(r.body));
  return r.body.data.id;
}

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

async function makeVisit(token, date, tag) {
  const pid = await newPatient(token, tag);
  const r = await register(token, pid, date);
  if (r.status !== 201) throw new Error('Daftar kunjungan gagal: ' + r.status + ' ' + JSON.stringify(r.body));
  const visitId = Number(sql(`SELECT id FROM visits WHERE patient_id=${pid} AND visit_date='${date}' AND status<>'CANCELLED'`));
  return { pid, visitId };
}

function tally(rs) {
  const m = {};
  for (const r of rs) {
    const k = r.status + (r.status === 200 || r.status === 201 ? '' : ' ' + ((r.body && r.body.message) || ''));
    m[k] = (m[k] || 0) + 1;
  }
  return m;
}

async function runAll(tests) {
  const summary = [];
  for (const [name, fn] of tests) {
    console.log('\n== ' + name + ' ==');
    let r;
    try { r = await fn(); } catch (e) { r = { pass: false, detail: 'ERROR: ' + e.message }; }
    console.log((r.pass ? '[PASS] ' : '[FAIL] ') + name + ' - ' + r.detail);
    summary.push([name, r]);
  }
  console.log('\n===== RINGKASAN (' + new Date().toISOString() + ') =====');
  for (const [name, r] of summary) console.log((r.pass ? 'PASS  ' : 'FAIL  ') + name + '  ' + r.detail);
  process.exit(summary.every(([, r]) => r.pass) ? 0 : 1);
}

module.exports = { api, tokens, newPatient, freshSlot, makeVisit, tally, runAll, sql, rnd };
