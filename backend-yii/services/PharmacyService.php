<?php

declare(strict_types=1);

namespace app\services;

use Yii;

class PharmacyService
{
    private BillingService $billing;

    public function __construct(?BillingService $billing = null)
    {
        $this->billing = $billing ?: new BillingService();
    }

    public function createPrescription(int $visitId, array $items, array $actor, ?string $notes = null): array
    {
        if (empty($items)) {
            throw ApiException::unprocessable('Resep harus memiliki minimal satu obat');
        }
        return Yii::$app->db->transaction(function ($db) use ($visitId, $items, $actor, $notes) {
            $visit = $db->createCommand("SELECT id, status FROM visits WHERE id = :id", [':id' => $visitId])->queryOne();
            if (!$visit) {
                throw ApiException::notFound('Kunjungan tidak ditemukan');
            }
            if (in_array($visit['status'], ['CANCELLED', 'PAID'], true)) {
                throw ApiException::unprocessable('Kunjungan tidak dapat diberi resep pada status ini');
            }
            $invoice = $db->createCommand('SELECT * FROM invoices WHERE visit_id = :v FOR UPDATE', [':v' => $visitId])->queryOne();
            if ($invoice && $invoice['status'] === 'PAID') {
                throw ApiException::unprocessable('Invoice sudah lunas. Gunakan adjustment dengan alasan.');
            }
            $no = $db->createCommand(
                "SELECT 'RX' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('prescription_no_seq')::text, 4, '0')"
            )->queryScalar();
            $rx = $db->createCommand(
                "INSERT INTO prescriptions (prescription_no, visit_id, status, notes, created_by, submitted_at)
                 VALUES (:no, :v, 'SUBMITTED', :n, :by, now()) RETURNING *",
                [':no' => $no, ':v' => $visitId, ':n' => $notes, ':by' => $actor['id'] ?? null]
            )->queryOne();

            foreach ($items as $item) {
                $medicineId = (int) ($item['medicine_id'] ?? 0);
                $qty = (int) ($item['qty'] ?? 0);
                if ($qty <= 0) {
                    throw ApiException::unprocessable('Jumlah obat harus lebih dari nol');
                }
                $medicine = $db->createCommand('SELECT id, name, price FROM medicines WHERE id = :id AND is_active = true', [':id' => $medicineId])->queryOne();
                if (!$medicine) {
                    throw ApiException::unprocessable("Obat dengan id {$medicineId} tidak ditemukan/aktif");
                }
                $db->createCommand(
                    'INSERT INTO prescription_items (prescription_id, medicine_id, dose, frequency, qty, unit_price)
                     VALUES (:rx, :m, :dose, :freq, :qty, :price)',
                    [
                        ':rx' => $rx['id'],
                        ':m' => $medicineId,
                        ':dose' => $item['dose'] ?? null,
                        ':freq' => $item['frequency'] ?? null,
                        ':qty' => $qty,
                        ':price' => $medicine['price'],
                    ]
                )->execute();
            }
            AuditService::log('prescriptions', (int) $rx['id'], 'CREATE', null, $rx, $actor['id'] ?? null);
            return $this->detail((int) $rx['id']);
        });
    }

    public function process(int $rxId, array $actor): array
    {
        $n = Yii::$app->db->createCommand(
            "UPDATE prescriptions SET status = 'PROCESSING', processed_by = :u, processed_at = now(), updated_at = now()
             WHERE id = :id AND status = 'SUBMITTED'",
            [':u' => $actor['id'] ?? null, ':id' => $rxId]
        )->execute();
        if ($n === 0) {
            throw ApiException::unprocessable('Resep tidak dalam status SUBMITTED');
        }
        AuditService::log('prescriptions', $rxId, 'PROCESS', null, ['status' => 'PROCESSING'], $actor['id'] ?? null);
        return $this->detail($rxId);
    }

    public function dispense(int $rxId, array $actor): array
    {
        return Yii::$app->db->transaction(function ($db) use ($rxId, $actor) {
            $rx = $db->createCommand('SELECT * FROM prescriptions WHERE id = :id FOR UPDATE', [':id' => $rxId])->queryOne();
            if (!$rx) {
                throw ApiException::notFound('Resep tidak ditemukan');
            }
            $claimed = $db->createCommand(
                "UPDATE prescriptions SET status = 'DISPENSED', dispensed_by = :u, dispensed_at = now(), updated_at = now()
                 WHERE id = :id AND status = 'PROCESSING'",
                [':u' => $actor['id'] ?? null, ':id' => $rxId]
            )->execute();
            if ($claimed === 0) {
                throw ApiException::conflict('Resep sudah diserahkan atau tidak dalam proses');
            }

            $items = $db->createCommand(
                'SELECT pi.*, m.name FROM prescription_items pi JOIN medicines m ON m.id = pi.medicine_id
                 WHERE pi.prescription_id = :id ORDER BY pi.medicine_id',
                [':id' => $rxId]
            )->queryAll();

            foreach ($items as $item) {
                $stock = $db->createCommand(
                    'UPDATE medicines SET stock = stock - :q, updated_at = now()
                     WHERE id = :m AND stock >= :q RETURNING stock',
                    [':q' => $item['qty'], ':m' => $item['medicine_id']]
                )->queryScalar();
                if ($stock === false || $stock === null) {
                    throw ApiException::unprocessable(
                        "Stok {$item['name']} tidak cukup",
                        [['field' => 'items', 'code' => 'STOCK_INSUFFICIENT', 'message' => "Tersisa tidak cukup untuk {$item['name']}"]]
                    );
                }
                $db->createCommand(
                    'INSERT INTO stock_movements (medicine_id, qty_change, stock_after, ref_type, ref_id, reason, created_by)
                     VALUES (:m, :q, :after, \'RX\', :ref, :reason, :by)',
                    [
                        ':m' => $item['medicine_id'],
                        ':q' => -((int) $item['qty']),
                        ':after' => $stock,
                        ':ref' => $rxId,
                        ':reason' => 'Penyerahan resep ' . $rx['prescription_no'],
                        ':by' => $actor['id'] ?? null,
                    ]
                )->execute();
            }

            $db->createCommand(
                'INSERT INTO dispensings (prescription_id, dispensed_by, notes) VALUES (:rx, :by, :n)',
                [':rx' => $rxId, ':by' => $actor['id'] ?? null, ':n' => 'Diserahkan oleh ' . ($actor['name'] ?? 'petugas')]
            )->execute();

            $this->billing->syncInvoice((int) $rx['visit_id'], $actor, 'Obat diserahkan');
            AuditService::log('prescriptions', $rxId, 'DISPENSE', $rx, ['status' => 'DISPENSED'], $actor['id'] ?? null);
            return $this->detail($rxId);
        });
    }

    public function detail(int $rxId): array
    {
        $db = Yii::$app->db;
        $rx = $db->createCommand(
            'SELECT r.*, v.visit_no, v.visit_date, v.status AS visit_status, p.mrn, p.name AS patient_name,
                    d.name AS doctor_name, po.name AS poli_name
             FROM prescriptions r
             JOIN visits v ON v.id = r.visit_id
             JOIN patients p ON p.id = v.patient_id
             JOIN doctors d ON d.id = v.doctor_id
             JOIN polis po ON po.id = v.poli_id
             WHERE r.id = :id',
            [':id' => $rxId]
        )->queryOne();
        if (!$rx) {
            throw ApiException::notFound('Resep tidak ditemukan');
        }
        $rx['items'] = $db->createCommand(
            'SELECT pi.*, m.code, m.name, m.unit, m.stock
             FROM prescription_items pi JOIN medicines m ON m.id = pi.medicine_id
             WHERE pi.prescription_id = :id ORDER BY pi.id',
            [':id' => $rxId]
        )->queryAll();
        return $rx;
    }

    public function queue(array $filters = []): array
    {
        $where = ["r.status IN ('SUBMITTED','PROCESSING','DISPENSED')"];
        $params = [];
        if (!empty($filters['status'])) {
            $where = ['r.status = :status'];
            $params[':status'] = $filters['status'];
        }
        if (!empty($filters['date'])) {
            $where[] = 'v.visit_date = :date';
            $params[':date'] = $filters['date'];
        }
        $rows = Yii::$app->db->createCommand(
            'SELECT r.*, v.visit_no, v.visit_date, p.mrn, p.name AS patient_name, d.name AS doctor_name, po.name AS poli_name,
                    (SELECT count(*) FROM prescription_items pi WHERE pi.prescription_id = r.id) AS item_count
             FROM prescriptions r
             JOIN visits v ON v.id = r.visit_id
             JOIN patients p ON p.id = v.patient_id
             JOIN doctors d ON d.id = v.doctor_id
             JOIN polis po ON po.id = v.poli_id
             WHERE ' . implode(' AND ', $where) . '
             ORDER BY r.created_at ASC LIMIT 200',
            $params
        )->queryAll();
        return $rows;
    }

    public function medicationHistory(int $patientId): array
    {
        return Yii::$app->db->createCommand(
            "SELECT r.prescription_no, r.dispensed_at, v.visit_date, d.name AS doctor_name,
                    pi.qty, pi.dose, pi.frequency, m.name AS medicine_name, m.unit
             FROM prescriptions r
             JOIN visits v ON v.id = r.visit_id
             JOIN doctors d ON d.id = v.doctor_id
             JOIN prescription_items pi ON pi.prescription_id = r.id
             JOIN medicines m ON m.id = pi.medicine_id
             WHERE v.patient_id = :p AND r.status = 'DISPENSED'
             ORDER BY r.dispensed_at DESC NULLS LAST, r.id DESC",
            [':p' => $patientId]
        )->queryAll();
    }

    public function stockAdjust(int $medicineId, int $qtyChange, string $reason, array $actor): array
    {
        if ($qtyChange === 0) {
            throw ApiException::unprocessable('Perubahan stok tidak boleh nol');
        }
        if (trim($reason) === '') {
            throw ApiException::unprocessable('Alasan penyesuaian stok wajib diisi');
        }
        return Yii::$app->db->transaction(function ($db) use ($medicineId, $qtyChange, $reason, $actor) {
            $medicine = $db->createCommand('SELECT * FROM medicines WHERE id = :id FOR UPDATE', [':id' => $medicineId])->queryOne();
            if (!$medicine) {
                throw ApiException::notFound('Obat tidak ditemukan');
            }
            $stock = $db->createCommand(
                'UPDATE medicines SET stock = stock + :q, updated_at = now()
                 WHERE id = :id AND stock + :q >= 0 RETURNING stock',
                [':q' => $qtyChange, ':id' => $medicineId]
            )->queryScalar();
            if ($stock === false || $stock === null) {
                throw ApiException::unprocessable('Stok tidak boleh menjadi negatif');
            }
            $db->createCommand(
                'INSERT INTO stock_movements (medicine_id, qty_change, stock_after, ref_type, ref_id, reason, created_by)
                 VALUES (:m, :q, :after, \'ADJUST\', NULL, :reason, :by)',
                [':m' => $medicineId, ':q' => $qtyChange, ':after' => $stock, ':reason' => $reason, ':by' => $actor['id'] ?? null]
            )->execute();
            AuditService::log('medicines', $medicineId, 'STOCK_ADJUST', $medicine, ['qty_change' => $qtyChange, 'stock_after' => $stock, 'reason' => $reason], $actor['id'] ?? null);
            return $db->createCommand('SELECT * FROM medicines WHERE id = :id', [':id' => $medicineId])->queryOne();
        });
    }
}
