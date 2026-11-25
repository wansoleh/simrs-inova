<?php

declare(strict_types=1);

namespace app\services;

use Yii;

class ExamService
{
    private BillingService $billing;

    public function __construct(?BillingService $billing = null)
    {
        $this->billing = $billing ?: new BillingService();
    }

    public function start(int $visitId, array $actor): array
    {
        return Yii::$app->db->transaction(function ($db) use ($visitId, $actor) {
            $visit = $db->createCommand('SELECT * FROM visits WHERE id = :id FOR UPDATE', [':id' => $visitId])->queryOne();
            if (!$visit) {
                throw ApiException::notFound('Kunjungan tidak ditemukan');
            }
            if (!in_array($visit['status'], ['REGISTERED', 'WAITING'], true)) {
                throw ApiException::unprocessable('Kunjungan tidak dapat dimulai pada status ini');
            }
            $db->createCommand(
                "UPDATE visits SET status = 'IN_EXAM', updated_at = now() WHERE id = :id",
                [':id' => $visitId]
            )->execute();
            $record = $db->createCommand('SELECT * FROM medical_records WHERE visit_id = :v', [':v' => $visitId])->queryOne();
            if (!$record) {
                $record = $db->createCommand(
                    'INSERT INTO medical_records (visit_id, created_by, updated_by) VALUES (:v, :by, :by) RETURNING *',
                    [':v' => $visitId, ':by' => $actor['id'] ?? null]
                )->queryOne();
            }
            AuditService::log('visits', $visitId, 'START_EXAM', $visit, ['status' => 'IN_EXAM'], $actor['id'] ?? null);
            return ['visit' => (new RegistrationService())->detail($visitId), 'record' => $record];
        });
    }

    public function saveRecord(int $visitId, array $data, array $actor): array
    {
        return Yii::$app->db->transaction(function ($db) use ($visitId, $data, $actor) {
            $visit = $db->createCommand('SELECT * FROM visits WHERE id = :id', [':id' => $visitId])->queryOne();
            if (!$visit) {
                throw ApiException::notFound('Kunjungan tidak ditemukan');
            }
            if ($visit['status'] === 'CANCELLED') {
                throw ApiException::unprocessable('Kunjungan sudah dibatalkan');
            }
            $record = $db->createCommand('SELECT * FROM medical_records WHERE visit_id = :v FOR UPDATE', [':v' => $visitId])->queryOne();
            $fields = ['anamnesis', 'blood_pressure', 'temperature', 'pulse', 'respiration', 'weight', 'height', 'physical_exam', 'notes'];
            $values = [];
            foreach ($fields as $field) {
                $values[$field] = array_key_exists($field, $data) ? ($data[$field] === '' ? null : $data[$field]) : ($record[$field] ?? null);
            }

            if ($record) {
                $diagnoses = $db->createCommand('SELECT * FROM diagnoses WHERE visit_id = :v AND is_active = true ORDER BY id', [':v' => $visitId])->queryAll();
                $snapshot = $record;
                $snapshot['diagnoses'] = $diagnoses;
                $db->createCommand(
                    'INSERT INTO medical_record_revisions (medical_record_id, visit_id, revision, snapshot, reason, created_by)
                     VALUES (:mr, :v, :rev, :snap, :reason, :by)',
                    [
                        ':mr' => $record['id'],
                        ':v' => $visitId,
                        ':rev' => $record['revision'],
                        ':snap' => json_encode($snapshot, JSON_UNESCAPED_UNICODE),
                        ':reason' => $data['reason'] ?? 'Pembaruan rekam medis',
                        ':by' => $actor['id'] ?? null,
                    ]
                )->execute();
                $record = $db->createCommand(
                    'UPDATE medical_records SET anamnesis = :anamnesis, blood_pressure = :blood_pressure,
                        temperature = :temperature, pulse = :pulse, respiration = :respiration,
                        weight = :weight, height = :height, physical_exam = :physical_exam, notes = :notes,
                        revision = revision + 1, updated_by = :by, updated_at = now()
                     WHERE id = :id RETURNING *',
                    $this->bindValues($values) + [':by' => $actor['id'] ?? null, ':id' => $record['id']]
                )->queryOne();
            } else {
                $record = $db->createCommand(
                    'INSERT INTO medical_records (visit_id, anamnesis, blood_pressure, temperature, pulse, respiration, weight, height, physical_exam, notes, created_by, updated_by)
                     VALUES (:visit_id, :anamnesis, :blood_pressure, :temperature, :pulse, :respiration, :weight, :height, :physical_exam, :notes, :by, :by) RETURNING *',
                    $this->bindValues($values) + [':visit_id' => $visitId, ':by' => $actor['id'] ?? null]
                )->queryOne();
            }
            AuditService::log('medical_records', (int) $record['id'], 'UPDATE', null, $record, $actor['id'] ?? null);
            return $record;
        });
    }

    public function saveDiagnoses(int $visitId, array $diagnoses, array $actor): array
    {
        if (empty($diagnoses)) {
            throw ApiException::unprocessable('Minimal satu diagnosis utama wajib diisi');
        }
        $primaryCount = 0;
        foreach ($diagnoses as $d) {
            $type = strtoupper((string) ($d['type'] ?? 'S'));
            if ($type === 'P') {
                $primaryCount++;
            }
            if (empty($d['icd10_code']) || empty($d['name'])) {
                throw ApiException::unprocessable('Kode ICD-10 dan nama diagnosis wajib diisi');
            }
        }
        if ($primaryCount !== 1) {
            throw ApiException::unprocessable('Harus ada tepat satu diagnosis utama (P)');
        }
        return Yii::$app->db->transaction(function ($db) use ($visitId, $diagnoses, $actor) {
            $record = $db->createCommand('SELECT * FROM medical_records WHERE visit_id = :v', [':v' => $visitId])->queryOne();
            if (!$record) {
                $record = $db->createCommand(
                    'INSERT INTO medical_records (visit_id, created_by, updated_by) VALUES (:v, :by, :by) RETURNING *',
                    [':v' => $visitId, ':by' => $actor['id'] ?? null]
                )->queryOne();
            }
            $old = $db->createCommand('SELECT * FROM diagnoses WHERE visit_id = :v AND is_active = true ORDER BY id', [':v' => $visitId])->queryAll();
            $snapshot = $record;
            $snapshot['diagnoses'] = $old;
            $db->createCommand(
                'INSERT INTO medical_record_revisions (medical_record_id, visit_id, revision, snapshot, reason, created_by)
                 VALUES (:mr, :v, :rev, :snap, :reason, :by)',
                [
                    ':mr' => $record['id'],
                    ':v' => $visitId,
                    ':rev' => $record['revision'],
                    ':snap' => json_encode($snapshot, JSON_UNESCAPED_UNICODE),
                    ':reason' => $actor['name'] ?? 'Revisi diagnosis',
                    ':by' => $actor['id'] ?? null,
                ]
            )->execute();
            $db->createCommand('UPDATE diagnoses SET is_active = false WHERE visit_id = :v AND is_active = true', [':v' => $visitId])->execute();
            foreach ($diagnoses as $d) {
                $db->createCommand(
                    'INSERT INTO diagnoses (visit_id, medical_record_id, icd10_code, name, type, notes, is_active)
                     VALUES (:v, :mr, :code, :name, :type, :notes, true)',
                    [
                        ':v' => $visitId,
                        ':mr' => $record['id'],
                        ':code' => $d['icd10_code'],
                        ':name' => $d['name'],
                        ':type' => strtoupper((string) ($d['type'] ?? 'S')),
                        ':notes' => $d['notes'] ?? null,
                    ]
                )->execute();
            }
            $db->createCommand(
                'UPDATE medical_records SET revision = revision + 1, updated_by = :by, updated_at = now() WHERE id = :id',
                [':by' => $actor['id'] ?? null, ':id' => $record['id']]
            )->execute();
            AuditService::log('diagnoses', (int) $record['id'], 'SYNC', $old, $diagnoses, $actor['id'] ?? null);
            return $db->createCommand(
                'SELECT * FROM diagnoses WHERE visit_id = :v AND is_active = true ORDER BY type, id',
                [':v' => $visitId]
            )->queryAll();
        });
    }

    public function finish(int $visitId, array $actor): array
    {
        return Yii::$app->db->transaction(function ($db) use ($visitId, $actor) {
            $visit = $db->createCommand('SELECT * FROM visits WHERE id = :id FOR UPDATE', [':id' => $visitId])->queryOne();
            if (!$visit) {
                throw ApiException::notFound('Kunjungan tidak ditemukan');
            }
            $primary = $db->createCommand(
                "SELECT count(*) FROM diagnoses WHERE visit_id = :v AND type = 'P' AND is_active = true",
                [':v' => $visitId]
            )->queryScalar();
            if ((int) $primary === 0) {
                throw ApiException::unprocessable('Diagnosis utama wajib diisi sebelum menyelesaikan pemeriksaan');
            }
            $n = $db->createCommand(
                "UPDATE visits SET status = 'EXAM_DONE', updated_at = now() WHERE id = :id AND status = 'IN_EXAM'",
                [':id' => $visitId]
            )->execute();
            if ($n === 0 && $visit['status'] !== 'EXAM_DONE') {
                throw ApiException::unprocessable('Pemeriksaan tidak dalam status IN_EXAM');
            }
            $invoice = $this->billing->syncInvoice($visitId, $actor, 'Pemeriksaan selesai');

            $pendingRx = (int) $db->createCommand(
                "SELECT count(*) FROM prescriptions WHERE visit_id = :v AND status IN ('DRAFT','SUBMITTED','PROCESSING')",
                [':v' => $visitId]
            )->queryScalar();
            $pendingLab = (int) $db->createCommand(
                "SELECT count(*) FROM lab_orders WHERE visit_id = :v AND status IN ('ORDERED','RESULT_PARTIAL')",
                [':v' => $visitId]
            )->queryScalar();
            if ($pendingRx === 0 && $pendingLab === 0) {
                $db->createCommand(
                    "UPDATE visits SET status = 'BILLING', updated_at = now() WHERE id = :id AND status = 'EXAM_DONE'",
                    [':id' => $visitId]
                )->execute();
            }
            AuditService::log('visits', $visitId, 'FINISH_EXAM', $visit, ['status' => 'EXAM_DONE'], $actor['id'] ?? null);
            return ['visit' => (new RegistrationService())->detail($visitId), 'invoice' => $invoice];
        });
    }

    public function waiting(?int $doctorId = null, ?string $date = null): array
    {
        $params = [':date' => $date ?: date('Y-m-d')];
        $doctorSql = '';
        if ($doctorId) {
            $doctorSql = ' AND v.doctor_id = :doctor';
            $params[':doctor'] = $doctorId;
        }
        return Yii::$app->db->createCommand(
            "SELECT v.*, p.mrn, p.name AS patient_name, p.gender, p.birth_date, p.phone,
                    d.name AS doctor_name, po.name AS poli_name,
                    (SELECT count(*) FROM medical_records mr WHERE mr.visit_id = v.id) AS has_record
             FROM visits v
             JOIN patients p ON p.id = v.patient_id
             JOIN doctors d ON d.id = v.doctor_id
             JOIN polis po ON po.id = v.poli_id
             WHERE v.visit_date = :date AND v.status IN ('REGISTERED','WAITING','IN_EXAM','EXAM_DONE')
             {$doctorSql}
             ORDER BY v.queue_no",
            $params
        )->queryAll();
    }

    public function history(int $patientId): array
    {
        $db = Yii::$app->db;
        $visits = $db->createCommand(
            'SELECT v.*, d.name AS doctor_name, po.name AS poli_name
             FROM visits v JOIN doctors d ON d.id = v.doctor_id JOIN polis po ON po.id = v.poli_id
             WHERE v.patient_id = :p ORDER BY v.visit_date DESC, v.id DESC LIMIT 100',
            [':p' => $patientId]
        )->queryAll();
        foreach ($visits as &$visit) {
            $visit['record'] = $db->createCommand('SELECT * FROM medical_records WHERE visit_id = :v', [':v' => $visit['id']])->queryOne();
            $visit['diagnoses'] = $db->createCommand('SELECT * FROM diagnoses WHERE visit_id = :v AND is_active = true ORDER BY type, id', [':v' => $visit['id']])->queryAll();
            $visit['procedures'] = $db->createCommand(
                "SELECT vp.*, pr.name FROM visit_procedures vp JOIN procedures pr ON pr.id = vp.procedure_id
                 WHERE vp.visit_id = :v AND vp.status = 'ACTIVE'",
                [':v' => $visit['id']]
            )->queryAll();
            $visit['prescriptions'] = $db->createCommand(
                'SELECT r.*, (SELECT count(*) FROM prescription_items pi WHERE pi.prescription_id = r.id) AS item_count
                 FROM prescriptions r WHERE r.visit_id = :v ORDER BY r.id',
                [':v' => $visit['id']]
            )->queryAll();
            $visit['lab_orders'] = $db->createCommand(
                'SELECT lo.*, (SELECT count(*) FROM lab_order_items loi WHERE loi.lab_order_id = lo.id) AS item_count
                 FROM lab_orders lo WHERE lo.visit_id = :v ORDER BY lo.id',
                [':v' => $visit['id']]
            )->queryAll();
        }
        return $visits;
    }

    public function detail(int $visitId): array
    {
        $db = Yii::$app->db;
        $visit = (new RegistrationService())->detail($visitId);
        $visit['record'] = $db->createCommand('SELECT * FROM medical_records WHERE visit_id = :v', [':v' => $visitId])->queryOne();
        $visit['diagnoses'] = $db->createCommand('SELECT * FROM diagnoses WHERE visit_id = :v AND is_active = true ORDER BY type, id', [':v' => $visitId])->queryAll();
        $visit['procedures'] = $db->createCommand(
            "SELECT vp.*, pr.code, pr.name FROM visit_procedures vp JOIN procedures pr ON pr.id = vp.procedure_id
             WHERE vp.visit_id = :v ORDER BY vp.id",
            [':v' => $visitId]
        )->queryAll();
        $visit['prescriptions'] = $db->createCommand(
            'SELECT * FROM prescriptions WHERE visit_id = :v ORDER BY id',
            [':v' => $visitId]
        )->queryAll();
        $visit['lab_orders'] = $db->createCommand(
            'SELECT * FROM lab_orders WHERE visit_id = :v ORDER BY id',
            [':v' => $visitId]
        )->queryAll();
        $visit['revisions'] = $db->createCommand(
            'SELECT id, revision, reason, created_at FROM medical_record_revisions WHERE visit_id = :v ORDER BY id DESC',
            [':v' => $visitId]
        )->queryAll();
        return $visit;
    }

    private function bindValues(array $values): array
    {
        $out = [];
        foreach ($values as $key => $value) {
            $out[':' . $key] = $value;
        }
        return $out;
    }
}
