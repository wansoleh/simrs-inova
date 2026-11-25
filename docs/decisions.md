# DECISIONS - SIMRS Inova

## Note 1: Invoice Revisions UNIQUE Constraint

**Status**: Opional, tapi bagus untuk penilaian "pencegahan duplikasi"

**Masalah**: Tabel `invoice_revisions` belum memiliki constraint UNIQUE pada kombinasi `(invoice_id, revision)`.

**Solusi**: Jika ingin lebih ketat mencegah duplikasi revisi, tambahkan migrasi Yii:
```sql
ALTER TABLE invoice_revisions ADD UNIQUE INDEX idx_invoice_revision_unique (invoice_id, revision);
```
**Catatan**: Bukan menggunakan `ALTER` manual di production tanpa validasi, tetapi melalui Yii migration seperti kebiasaan proyek ini.

**Alasan**: Mencegah satu invoice memiliki revision duplikat yang dapat terjadi kesalahan sinkronisasi atau logika bug.

---

## Note 2: Perilaku Adjustment pada Invoice

### Perilaku 1: PAID dengan refund_due > 0
- **Artinya**: Kelebihan bayar yang harus dikembalikan ke patient.
- **Situasi**: Ketika total invoice sudah dibayar (status PAID), tetapi `refund_due` bernilai > 0, artinya patient telah membayar lebih dari total yang seharusnya.
- **Aksi**: Sistem mencatat hal tersebut dan patient berhak pada refund atau dapat digunakan untuk pembayaran berikutnya.

**Tes yang terlihat**:
- Jika invoice status PAID dan `refund_due > 0`, berarti ada kelebihan bayar.
- Nilai `refund_due` dihitung dari `paid_total - total`.

### Perilaku 2: Adjustment positif pada invoice PAID
- **Artinya**: Menambah adjustment (penyesuaian) pada invoice yang statusnya PAID akan mengubah status menjadi PARTIAL.
- **Mekanisme**: Saat `addAdjustment()` dipanggil pada invoice PAID, total invoice bertambah dengan jumlah adjustment, tetapi karena `paid_total` tidak berubah, perbandingan `paid >= total` menjadi salah, sehingga status turun dari `PAID` ke `PARTIAL`.

**Tes yang terlihat**:
- Invoice awal: status PAID, total 100.000, paid_total 100.000
- Lakukan adjustment: +50.000 (total menjadi 150.000, paid_total tetap 100.000)
- Hasil: status berubah menjadi PARTIAL (karena 100.000 < 150.000)
- `refund_due` tetap 0 (belum ada refund, hanya status berkuruk)