export const VISIT_STATUS = {
  REGISTERED: { label: 'Terdaftar', color: 'blue' },
  WAITING: { label: 'Menunggu', color: 'gold' },
  IN_EXAM: { label: 'Diperiksa', color: 'processing' },
  EXAM_DONE: { label: 'Selesai Periksa', color: 'cyan' },
  BILLING: { label: 'Menunggu Bayar', color: 'orange' },
  PAID: { label: 'Lunas', color: 'green' },
  CANCELLED: { label: 'Dibatalkan', color: 'red' },
}

export const INVOICE_STATUS = {
  UNPAID: { label: 'Belum Bayar', color: 'red' },
  PARTIAL: { label: 'Sebagian', color: 'orange' },
  PAID: { label: 'Lunas', color: 'green' },
  CANCELLED: { label: 'Dibatalkan', color: 'default' },
  REFUND: { label: 'Refund', color: 'purple' },
}

export const RX_STATUS = {
  SUBMITTED: { label: 'Baru', color: 'blue' },
  PROCESSING: { label: 'Disiapkan', color: 'gold' },
  DISPENSED: { label: 'Diserahkan', color: 'green' },
  CANCELLED: { label: 'Dibatalkan', color: 'red' },
}

export const LAB_STATUS = {
  ORDERED: { label: 'Menunggu', color: 'blue' },
  RESULT_PARTIAL: { label: 'Sebagian', color: 'gold' },
  DONE: { label: 'Selesai', color: 'green' },
  CANCELLED: { label: 'Dibatalkan', color: 'red' },
}

export const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Tunai' },
  { value: 'QRIS', label: 'QRIS' },
  { value: 'TRANSFER', label: 'Transfer Bank' },
  { value: 'CARD', label: 'Kartu Debit/Kredit' },
]

export const GUARANTORS = [
  { value: 'UMUM', label: 'Umum' },
  { value: 'BPJS', label: 'BPJS Kesehatan' },
  { value: 'ASURANSI', label: 'Asuransi Swasta' },
]

export const GENDERS = [
  { value: 'L', label: 'Laki-laki' },
  { value: 'P', label: 'Perempuan' },
]

export const BLOOD_TYPES = ['A', 'B', 'AB', 'O', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((v) => ({
  value: v,
  label: v,
}))

export const DAYS = [
  { value: 0, label: 'Minggu' },
  { value: 1, label: 'Senin' },
  { value: 2, label: 'Selasa' },
  { value: 3, label: 'Rabu' },
  { value: 4, label: 'Kamis' },
  { value: 5, label: 'Jumat' },
  { value: 6, label: 'Sabtu' },
]

export const ROLE_LABELS = {
  admin: 'Administrator',
  pendaftaran: 'Pendaftaran',
  dokter: 'Dokter',
  farmasi: 'Farmasi',
  lab: 'Petugas Lab',
  kasir: 'Kasir',
}
