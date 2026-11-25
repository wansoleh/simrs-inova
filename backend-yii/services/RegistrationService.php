<?php

declare(strict_types=1);

namespace app\services;

use Yii;

class RegistrationService
{
    private BillingService $billing;

    public function __construct(?BillingService $billing = null)
    {
        $this->billing = $billing ?: new BillingService();
    }

    public function create(array $data, array $actor): array
    {
        $patientId = (int) ($data['patient_id'] ?? 0);
        $doctorId = (int) ($data['doctor_id'] ?? 0);
        $poliId = (int) ($data['poli_id'] ?? 0);
        $visitDate = (string) ($data['visit_date'] ?? date('Y-m-d'));
        $guarantor = strtoupper((string) ($data['guarantor_type'] ?? 'UMUM'));
        $complaint = trim((string) ($data['complaint'] ?? ''));

        if (!$patientId || !$doctorId || !$poliId) {
            throw ApiException::unprocessable('Pasien, dokter, dan poli wajib dipilih');
        }
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $visitDate)) {
            throw ApiException::unprocessable('Tanggal kunjungan tidak valid');
        }
        if (!in_array($guarantor, ['UMUM', 'BPJS', 'ASURANSI'], true)) {
            throw ApiException::unprocessable('Jenis penjamin tidak valid');
        }
        if ($visitDate < date('Y-m-d')) {
            throw ApiException::unprocessable('Tidak dapat mendaftar pada tanggal yang sudah lewat');
        }

        return Yii::$app->db->transaction(function ($db) use ($patientId, $doctorId, $poliId, $visitDate, $guarantor, $complaint, $actor) {
            $patient = $db->createCommand('SELECT id, name FROM patients WHERE id = :id', [':id' => $patientId])->queryOne();
            $doctor = $db->createCommand('SELECT id, name FROM doctors WHERE id = :id AND is_active = true', [':id' => $doctorId])->queryOne();
            $poli = $db->createCommand('SELECT id, name FROM polis WHERE id = :id AND is_active = true', [':id' => $poliId])->queryOne();
            if (!$patient || !$doctor || !$poli) {
                throw ApiException::unprocessable('Pasien, dokter, atau poli tidak valid/aktif');
            }

            $lockKey = crc32($patientId . '|' . $doctorId . '|' . $visitDate);
            $db->createCommand('SELECT pg_advisory_xact_lock(:k)', [':k' => $lockKey])->execute();
            $doctorDayKey = crc32($doctorId . '|' . $visitDate);
            $db->createCommand('SELECT pg_advisory_xact_lock(:k)', [':k' => $doctorDayKey])->execute();

            $existing = $db->createCommand(
                "SELECT id, visit_no, queue_no FROM visits
                 WHERE patient_id = :p AND doctor_id = :d AND visit_date = :t AND status <> 'CANCELLED' LIMIT 1",
                [':p' => $patientId, ':d' => $doctorId, ':t' => $visitDate]
            )->queryOne();
            if ($existing) {
                throw ApiException::conflict(
                    "Pasien sudah terdaftar, antrean {$existing['queue_no']} ({$existing['visit_no']})",
                    [['field' => 'patient_id', 'code' => 'DUPLICATE_VISIT', 'message' => 'Kunjungan sudah ada']]
                );
            }

            $dayOfWeek = (int) date('w', strtotime($visitDate));
            $schedule = $db->createCommand(
                'SELECT * FROM doctor_schedules
                 WHERE doctor_id = :d AND poli_id = :p AND day_of_week = :w AND is_active = true
                 ORDER BY start_time LIMIT 1',
                [':d' => $doctorId, ':p' => $poliId, ':w' => $dayOfWeek]
            )->queryOne();
            if (!$schedule) {
                $dayName = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][$dayOfWeek] ?? '-';
                throw ApiException::unprocessable("Dokter tidak memiliki jadwal praktik di poli ini pada hari {$dayName}");
            }
            if ($visitDate === date('Y-m-d')) {
                $now = date('H:i:s');
                if ($now < $schedule['start_time'] || $now > $schedule['end_time']) {
                    throw ApiException::unprocessable(
                        "Pendaftaran hanya dapat dilakukan pada jam praktik {$schedule['start_time']} - {$schedule['end_time']}"
                    );
                }
            }
            $scheduled = (int) $db->createCommand(
                "SELECT count(*) FROM visits WHERE doctor_id = :d AND poli_id = :p AND visit_date = :t AND status <> 'CANCELLED'",
                [':d' => $doctorId, ':p' => $poliId, ':t' => $visitDate]
            )->queryScalar();
            if ($scheduled >= (int) $schedule['quota']) {
                throw ApiException::unprocessable('Kuota pendaftaran pada jadwal ini sudah penuh');
            }

            $queueNo = (int) $db->createCommand(
                'INSERT INTO queue_counters (doctor_id, visit_date, last_no)
                 VALUES (:d, :t, 1)
                 ON CONFLICT (doctor_id, visit_date)
                 DO UPDATE SET last_no = queue_counters.last_no + 1
                 RETURNING last_no',
                [':d' => $doctorId, ':t' => $visitDate]
            )->queryScalar();

            $visitNo = $db->createCommand(
                "SELECT 'V' || to_char(:t::date, 'YYYYMMDD') || '-' || lpad(nextval('visit_no_seq')::text, 4, '0')",
                [':t' => $visitDate]
            )->queryScalar();

            try {
                $visit = $db->createCommand(
                    'INSERT INTO visits (visit_no, patient_id, doctor_id, poli_id, visit_date, queue_no, guarantor_type, status, complaint, created_by)
                     VALUES (:no, :p, :d, :po, :t, :q, :g, \'REGISTERED\', :c, :by) RETURNING *',
                    [
                        ':no' => $visitNo,
                        ':p' => $patientId,
                        ':d' => $doctorId,
                        ':po' => $poliId,
                        ':t' => $visitDate,
                        ':q' => $queueNo,
                        ':g' => $guarantor,
                        ':c' => $complaint !== '' ? $complaint : null,
                        ':by' => $actor['id'] ?? null,
                    ]
                )->queryOne();
            } catch (\yii\db\IntegrityException $e) {
                if (str_contains($e->getMessage(), '23505')) {
                    throw ApiException::conflict('Pendaftaran bentrok dengan permintaan lain, silakan cek antrean');
                }
                throw $e;
            }

            $invoice = $this->billing->syncInvoice((int) $visit['id'], $actor, 'Tagihan awal pendaftaran');
            AuditService::log('visits', (int) $visit['id'], 'CREATE', null, $visit, $actor['id'] ?? null);

            return [
                'visit' => $this->detail((int) $visit['id']),
                'invoice' => $invoice,
            ];
        });
    }

    public function checkin(int $visitId, array $actor): array
    {
        $n = Yii::$app->db->createCommand(
            "UPDATE visits SET status = 'WAITING', updated_at = now()
             WHERE id = :id AND status = 'REGISTERED'",
            [':id' => $visitId]
        )->execute();
        if ($n === 0) {
            throw ApiException::unprocessable('Status kunjungan tidak memungkinkan check-in');
        }
        AuditService::log('visits', $visitId, 'CHECKIN', null, ['status' => 'WAITING'], $actor['id'] ?? null);
        return $this->detail($visitId);
    }

    public function cancel(int $visitId, string $reason, array $actor): array
    {
        $reason = trim($reason);
        if ($reason === '') {
            throw ApiException::unprocessable('Alasan pembatalan wajib diisi');
        }
        $n = Yii::$app->db->createCommand(
            "UPDATE visits SET status = 'CANCELLED', cancel_reason = :r, updated_at = now()
             WHERE id = :id AND status IN ('REGISTERED','WAITING')",
            [':r' => $reason, ':id' => $visitId]
        )->execute();
        if ($n === 0) {
            throw ApiException::unprocessable('Hanya kunjungan yang belum diperiksa dapat dibatalkan');
        }
        AuditService::log('visits', $visitId, 'CANCEL', null, ['reason' => $reason], $actor['id'] ?? null);
        return $this->detail($visitId);
    }

    public function detail(int $visitId): array
    {
        $db = Yii::$app->db;
        $visit = $db->createCommand(
            'SELECT v.*, p.mrn, p.name AS patient_name, p.nik, p.birth_date, p.gender, p.phone, p.address,
                    d.name AS doctor_name, d.specialization, po.name AS poli_name, po.code AS poli_code,
                    i.id AS invoice_id, i.invoice_no, i.status AS invoice_status, i.total, i.paid_total
             FROM visits v
             JOIN patients p ON p.id = v.patient_id
             JOIN doctors d ON d.id = v.doctor_id
             JOIN polis po ON po.id = v.poli_id
             LEFT JOIN invoices i ON i.visit_id = v.id
             WHERE v.id = :id',
            [':id' => $visitId]
        )->queryOne();
        if (!$visit) {
            throw ApiException::notFound('Kunjungan tidak ditemukan');
        }
        return $visit;
    }

    public function list(array $filters, int $page, int $perPage): array
    {
        $where = ['1=1'];
        $params = [];
        if (!empty($filters['date'])) {
            $where[] = 'v.visit_date = :date';
            $params[':date'] = $filters['date'];
        }
        if (!empty($filters['status'])) {
            $where[] = 'v.status = :status';
            $params[':status'] = $filters['status'];
        }
        if (!empty($filters['poli_id'])) {
            $where[] = 'v.poli_id = :poli';
            $params[':poli'] = (int) $filters['poli_id'];
        }
        if (!empty($filters['doctor_id'])) {
            $where[] = 'v.doctor_id = :doctor';
            $params[':doctor'] = (int) $filters['doctor_id'];
        }
        if (!empty($filters['q'])) {
            $where[] = '(p.name ILIKE :q OR p.mrn ILIKE :q OR v.visit_no ILIKE :q)';
            $params[':q'] = '%' . $filters['q'] . '%';
        }
        if (!empty($filters['active'])) {
            $where[] = "v.status <> 'CANCELLED'";
        }
        $whereSql = implode(' AND ', $where);
        $db = Yii::$app->db;
        $total = (int) $db->createCommand(
            "SELECT count(*) FROM visits v JOIN patients p ON p.id = v.patient_id WHERE {$whereSql}",
            $params
        )->queryScalar();
        $rows = $db->createCommand(
            "SELECT v.*, p.mrn, p.name AS patient_name, p.gender,
                    d.name AS doctor_name, po.name AS poli_name,
                    i.id AS invoice_id, i.status AS invoice_status, i.total, i.paid_total
             FROM visits v
             JOIN patients p ON p.id = v.patient_id
             JOIN doctors d ON d.id = v.doctor_id
             JOIN polis po ON po.id = v.poli_id
             LEFT JOIN invoices i ON i.visit_id = v.id
             WHERE {$whereSql}
             ORDER BY v.visit_date DESC, v.queue_no ASC
             LIMIT :limit OFFSET :offset",
            $params + [':limit' => $perPage, ':offset' => ($page - 1) * $perPage]
        )->queryAll();
        return ['rows' => $rows, 'total' => $total, 'page' => $page, 'per_page' => $perPage];
    }

    public function queueBoard(string $date, ?int $poliId = null): array
    {
        $params = [':date' => $date];
        $poliSql = '';
        if ($poliId) {
            $poliSql = ' AND v.poli_id = :poli';
            $params[':poli'] = $poliId;
        }
        $rows = Yii::$app->db->createCommand(
            "SELECT v.id, v.visit_no, v.queue_no, v.status, v.visit_date, v.guarantor_type,
                    p.mrn, p.name AS patient_name, p.gender,
                    d.name AS doctor_name, po.name AS poli_name
             FROM visits v
             JOIN patients p ON p.id = v.patient_id
             JOIN doctors d ON d.id = v.doctor_id
             JOIN polis po ON po.id = v.poli_id
             WHERE v.visit_date = :date AND v.status <> 'CANCELLED' {$poliSql}
             ORDER BY po.name, d.name, v.queue_no",
            $params
        )->queryAll();
        $waiting = array_values(array_filter($rows, fn ($r) => in_array($r['status'], ['REGISTERED', 'WAITING'], true)));
        $inExam = array_values(array_filter($rows, fn ($r) => in_array($r['status'], ['IN_EXAM', 'EXAM_DONE'], true)));
        $billing = array_values(array_filter($rows, fn ($r) => in_array($r['status'], ['BILLING', 'PAID'], true)));
        return ['all' => $rows, 'waiting' => $waiting, 'in_exam' => $inExam, 'billing' => $billing];
    }
}
