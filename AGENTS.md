# Proyek: SIMRS Rawat Jalan Terintegrasi (Real Case Test)
Monorepo: backend-yii (Yii2, PHP 8.4), services-node (Node 22, Express), frontend-react (Vite, TypeScript),
database/, docs/, postman/, tests/concurrency/, deploy/. Database: PostgreSQL 18.7. Web server PROD: Apache.

## Lingkungan (WAJIB dipatuhi)
- Kamu berjalan di VPS Ubuntu 24.04 sebagai user 'dev' (tanpa sudo) di folder ~/simrs-inova (DEV).
- DB DEV: simrs_dev di 127.0.0.1:5432. DB test: simrs_test. DILARANG menyentuh database 'simrs' (PROD).
- DILARANG membaca/mengubah /www/wwwroot/simrs-inova (PROD).
  Deploy hanya dijalankan manusia (deploy/deploy.sh).
- Jangan membuka port baru, jangan mengubah firewall, jangan menjalankan perintah root.
- Port DEV: Yii 8088, Node 3001, Vite 5173, semuanya di 127.0.0.1. Port 8080 dipakai Docker: JANGAN dipakai.
- Jangan membuat/mengubah/membaca file .env. Gunakan .env.example.

## Aturan arsitektur
- Hanya Yii yang menulis tabel inti. Node hanya baca schema reporting dan tulis schema integration.
- Node memverifikasi JWT RS256 (public key); tidak membuat token dan tidak punya tabel user.
- Business logic ada di backend-yii/services/*. Controller tipis. Semua query pakai parameter binding.
- Jangan DELETE data klinis/transaksi: pakai status VOID/CANCELLED + alasan.
  Simpan snapshot harga di baris transaksi.
- Operasi stok, antrean, pembayaran: transaksi DB, UPDATE bersyarat, cek affected rows, dan wajib
  ada test konkurensi di tests/concurrency/.
- Perubahan skema HANYA lewat migrasi Yii. Jangan ALTER manual.
  Ekstensi pg_trgm tersedia (sudah dicek di PostgreSQL 18.7).

## Format response (Yii dan Node sama)
{ success, message, data, meta, errors, request_id }. Kode: 201 buat, 409 duplikasi, 422 aturan bisnis.

## Konvensi
- UI bahasa Indonesia. Kode, tabel, kolom: Inggris snake_case. Uang numeric(14,2). Waktu timestamptz.
- Setiap fitur: tulis test, jalankan test, lalu ringkas perubahan.
  Edit file seperlunya; jangan tulis ulang file besar.
- Commit conventional: feat:, fix:, docs:, test:, chore:. Bekerja di branch develop atau feature/*.
