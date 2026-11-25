<?php

declare(strict_types=1);

namespace app\services;

use Yii;

class BillingService
{
    public function syncInvoice(int $visitId, ?array $actor = null, ?string $reason = null): array
    {
        return Yii::$app->db->transaction(function ($db) use ($visitId, $actor, $reason) {
            $visit = $db->createCommand(
                'SELECT v.*, p.registration_fee, p.name AS poli_name
                 FROM visits v JOIN polis p ON p.id = v.poli_id
                 WHERE v.id = :id FOR UPDATE OF v',
                [':id' => $visitId]
            )->queryOne();
            if (!$visit) {
                throw ApiException::notFound('Kunjungan tidak ditemukan');
            }

            $invoice = $db->createCommand('SELECT * FROM invoices WHERE visit_id = :v FOR UPDATE', [':v' => $visitId])->queryOne();
            $isNew = false;
            if (!$invoice) {
                $invoiceNo = $db->createCommand(
                    "SELECT 'INV' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('invoice_no_seq')::text, 4, '0')"
                )->queryScalar();
                $invoiceId = $db->createCommand(
                    'INSERT INTO invoices (invoice_no, visit_id, status, total, paid_total, revision)
                     VALUES (:no, :v, \'UNPAID\', 0, 0, 1) RETURNING id',
                    [':no' => $invoiceNo, ':v' => $visitId]
                )->queryScalar();
                $invoice = $db->createCommand('SELECT * FROM invoices WHERE id = :id', [':id' => $invoiceId])->queryOne();
                $isNew = true;
            }

            $oldItems = $db->createCommand(
                "SELECT * FROM invoice_items WHERE invoice_id = :id AND status = 'ACTIVE' ORDER BY id",
                [':id' => $invoice['id']]
            )->queryAll();
            $oldInvoice = $invoice;
            $oldInvoice['items'] = $oldItems;

            $sources = $this->collectSources($db, $visit);
            $existing = [];
            foreach ($oldItems as $item) {
                $existing[$item['ref_type'] . ':' . $item['ref_id']] = $item;
            }

            $changed = false;
            foreach ($sources as $key => $src) {
                $amount = round(((float) $src['qty']) * ((float) $src['unit_price']), 2);
                if (isset($existing[$key])) {
                    $old = $existing[$key];
                    $same = $old['description'] === $src['description']
                        && abs((float) $old['qty'] - (float) $src['qty']) < 0.001
                        && abs((float) $old['unit_price'] - (float) $src['unit_price']) < 0.001;
                    if ($same) {
                        unset($existing[$key]);
                        continue;
                    }
                    $db->createCommand(
                        "UPDATE invoice_items SET status = 'VOID', void_reason = :r, updated_at = now() WHERE id = :id",
                        [':r' => $reason ?: 'Perubahan data klinis', ':id' => $old['id']]
                    )->execute();
                    unset($existing[$key]);
                }
                $db->createCommand(
                    'INSERT INTO invoice_items (invoice_id, ref_type, ref_id, description, qty, unit_price, amount, status)
                     VALUES (:inv, :rt, :rid, :d, :q, :up, :a, \'ACTIVE\')',
                    [
                        ':inv' => $invoice['id'],
                        ':rt' => $src['ref_type'],
                        ':rid' => $src['ref_id'],
                        ':d' => $src['description'],
                        ':q' => $src['qty'],
                        ':up' => $src['unit_price'],
                        ':a' => $amount,
                    ]
                )->execute();
                $changed = true;
            }

            foreach ($existing as $old) {
                if ($old['ref_type'] === 'ADJ') {
                    continue;
                }
                $db->createCommand(
                    "UPDATE invoice_items SET status = 'VOID', void_reason = :r, updated_at = now() WHERE id = :id",
                    [':r' => $reason ?: 'Item tidak lagi relevan dengan data klinis', ':id' => $old['id']]
                )->execute();
                $changed = true;
            }

            $total = (float) $db->createCommand(
                "SELECT COALESCE(SUM(amount), 0) FROM invoice_items WHERE invoice_id = :id AND status = 'ACTIVE'",
                [':id' => $invoice['id']]
            )->queryScalar();
            $total = round($total, 2);
            $paid = (float) $invoice['paid_total'];
            $status = $paid > 0 && $paid >= $total ? 'PAID' : ($paid > 0 ? 'PARTIAL' : 'UNPAID');
            if ($total <= 0 && $paid <= 0) {
                $status = 'UNPAID';
            }
            $refund = max(round($paid - $total, 2), 0);
            $revision = (int) $invoice['revision'];
            if ($changed && !$isNew) {
                $revision++;
            }

            $db->createCommand(
                'UPDATE invoices SET total = :t, status = :s, refund_due = :r, revision = :rev, updated_at = now()
                 WHERE id = :id',
                [':t' => $total, ':s' => $status, ':r' => $refund, ':rev' => $revision, ':id' => $invoice['id']]
            )->execute();

            if ($changed && !$isNew) {
                $db->createCommand(
                    'INSERT INTO invoice_revisions (invoice_id, revision, snapshot, reason, created_by)
                     VALUES (:id, :rev, :snap, :reason, :by)',
                    [
                        ':id' => $invoice['id'],
                        ':rev' => $revision - 1,
                        ':snap' => json_encode($oldInvoice, JSON_UNESCAPED_UNICODE),
                        ':reason' => $reason ?: 'Sinkronisasi tagihan dengan data klinis',
                        ':by' => $actor['id'] ?? null,
                    ]
                )->execute();
            }

            if (in_array($visit['status'], ['EXAM_DONE'], true) && $status !== 'PAID') {
                $db->createCommand("UPDATE visits SET status = 'BILLING', updated_at = now() WHERE id = :id AND status = 'EXAM_DONE'", [':id' => $visitId])->execute();
            }

            if ($changed) {
                AuditService::log('invoices', (int) $invoice['id'], 'SYNC', $oldInvoice, [
                    'invoice' => $invoice,
                    'sources' => array_values($sources),
                    'total' => $total,
                    'revision' => $revision,
                ], $actor['id'] ?? null);
            }

            return $this->invoiceDetail((int) $invoice['id']);
        });
    }

    public function invoiceDetail(int $invoiceId): array
    {
        $db = Yii::$app->db;
        $invoice = $db->createCommand(
            'SELECT i.*, v.visit_no, v.visit_date, v.status AS visit_status, v.guarantor_type,
                    p.mrn, p.name AS patient_name, p.phone, p.address, p.nik,
                    d.name AS doctor_name, po.name AS poli_name
             FROM invoices i
             JOIN visits v ON v.id = i.visit_id
             JOIN patients p ON p.id = v.patient_id
             JOIN doctors d ON d.id = v.doctor_id
             JOIN polis po ON po.id = v.poli_id
             WHERE i.id = :id',
            [':id' => $invoiceId]
        )->queryOne();
        if (!$invoice) {
            throw ApiException::notFound('Invoice tidak ditemukan');
        }
        $invoice['items'] = $db->createCommand(
            'SELECT * FROM invoice_items WHERE invoice_id = :id ORDER BY status, id',
            [':id' => $invoiceId]
        )->queryAll();
        $invoice['payments'] = $db->createCommand(
            'SELECT * FROM payments WHERE invoice_id = :id ORDER BY paid_at',
            [':id' => $invoiceId]
        )->queryAll();
        $invoice['revisions'] = $db->createCommand(
            'SELECT id, revision, reason, created_by, created_at FROM invoice_revisions WHERE invoice_id = :id ORDER BY revision DESC',
            [':id' => $invoiceId]
        )->queryAll();
        return $invoice;
    }

    private function collectSources($db, array $visit): array
    {
        $sources = [];
        $fee = (float) $visit['registration_fee'];
        if ($fee >= 0) {
            $sources['REGISTRATION:' . $visit['poli_id']] = [
                'ref_type' => 'REGISTRATION',
                'ref_id' => (int) $visit['poli_id'],
                'description' => 'Biaya pendaftaran - ' . $visit['poli_name'],
                'qty' => 1,
                'unit_price' => $fee,
            ];
        }

        $procedures = $db->createCommand(
            "SELECT vp.id, vp.qty, vp.unit_price, pr.name
             FROM visit_procedures vp JOIN procedures pr ON pr.id = vp.procedure_id
             WHERE vp.visit_id = :v AND vp.status = 'ACTIVE'",
            [':v' => $visit['id']]
        )->queryAll();
        foreach ($procedures as $row) {
            $sources['PROCEDURE:' . $row['id']] = [
                'ref_type' => 'PROCEDURE',
                'ref_id' => (int) $row['id'],
                'description' => 'Tindakan - ' . $row['name'],
                'qty' => (int) $row['qty'],
                'unit_price' => (float) $row['unit_price'],
            ];
        }

        $medicines = $db->createCommand(
            "SELECT pi.id, pi.qty, pi.unit_price, m.name
             FROM prescription_items pi
             JOIN prescriptions r ON r.id = pi.prescription_id
             JOIN medicines m ON m.id = pi.medicine_id
             WHERE r.visit_id = :v AND r.status = 'DISPENSED'",
            [':v' => $visit['id']]
        )->queryAll();
        foreach ($medicines as $row) {
            $sources['MEDICINE:' . $row['id']] = [
                'ref_type' => 'MEDICINE',
                'ref_id' => (int) $row['id'],
                'description' => 'Obat - ' . $row['name'],
                'qty' => (int) $row['qty'],
                'unit_price' => (float) $row['unit_price'],
            ];
        }

        $labs = $db->createCommand(
            "SELECT loi.id, loi.unit_price, lt.name
             FROM lab_order_items loi
             JOIN lab_orders lo ON lo.id = loi.lab_order_id
             JOIN lab_tests lt ON lt.id = loi.lab_test_id
             WHERE lo.visit_id = :v AND lo.status <> 'CANCELLED' AND loi.status <> 'CANCELLED'",
            [':v' => $visit['id']]
        )->queryAll();
        foreach ($labs as $row) {
            $sources['LAB:' . $row['id']] = [
                'ref_type' => 'LAB',
                'ref_id' => (int) $row['id'],
                'description' => 'Laboratorium - ' . $row['name'],
                'qty' => 1,
                'unit_price' => (float) $row['unit_price'],
            ];
        }

        return $sources;
    }

    public function addAdjustment(int $invoiceId, array $data, array $actor): array
    {
        $reason = trim((string) ($data['reason'] ?? ''));
        $amount = (float) ($data['amount'] ?? 0);
        if ($reason === '') {
            throw ApiException::unprocessable('Alasan penyesuaian wajib diisi');
        }
        if (abs($amount) < 0.01) {
            throw ApiException::unprocessable('Nominal penyesuaian tidak boleh nol');
        }
        return Yii::$app->db->transaction(function ($db) use ($invoiceId, $amount, $reason, $actor, $data) {
            $invoice = $db->createCommand('SELECT * FROM invoices WHERE id = :id FOR UPDATE', [':id' => $invoiceId])->queryOne();
            if (!$invoice) {
                throw ApiException::notFound('Invoice tidak ditemukan');
            }
            if ($invoice['status'] !== 'PAID') {
                throw ApiException::unprocessable('Penyesuaian hanya untuk invoice yang sudah PAID');
            }
            $description = trim((string) ($data['description'] ?? 'Penyesuaian tagihan'));
            $refId = (int) $db->createCommand("SELECT COALESCE(max(ref_id), 0) + 1 FROM invoice_items WHERE invoice_id = :id AND ref_type = 'ADJ'", [':id' => $invoiceId])->queryScalar();
            $db->createCommand(
                "INSERT INTO invoice_items (invoice_id, ref_type, ref_id, description, qty, unit_price, amount, status)
                 VALUES (:inv, 'ADJ', :rid, :d, 1, :up, :a, 'ACTIVE')",
                [
                    ':inv' => $invoiceId,
                    ':rid' => $refId,
                    ':d' => $description,
                    ':up' => abs($amount),
                    ':a' => $amount,
                ]
            )->execute();
            $total = (float) $db->createCommand("SELECT COALESCE(SUM(amount),0) FROM invoice_items WHERE invoice_id = :id AND status = 'ACTIVE'", [':id' => $invoiceId])->queryScalar();
            $paid = (float) $invoice['paid_total'];
            $status = $paid >= $total ? 'PAID' : ($paid > 0 ? 'PARTIAL' : 'UNPAID');
            $refund = max(round($paid - $total, 2), 0);
            $db->createCommand(
                'UPDATE invoices SET total = :t, status = :s, refund_due = :r, revision = revision + 1, updated_at = now() WHERE id = :id',
                [':t' => $total, ':s' => $status, ':r' => $refund, ':id' => $invoiceId]
            )->execute();
            AuditService::log('invoices', $invoiceId, 'ADJUSTMENT', $invoice, ['amount' => $amount, 'reason' => $reason], $actor['id'] ?? null);
            return $this->invoiceDetail($invoiceId);
        });
    }

    public function listInvoices(array $filters, int $page, int $perPage): array
    {
        $where = ['1=1'];
        $params = [];
        if (!empty($filters['status'])) {
            $where[] = 'i.status = :status';
            $params[':status'] = $filters['status'];
        }
        if (!empty($filters['q'])) {
            $where[] = '(i.invoice_no ILIKE :q OR p.name ILIKE :q OR p.mrn ILIKE :q)';
            $params[':q'] = '%' . $filters['q'] . '%';
        }
        if (!empty($filters['date_from'])) {
            $where[] = 'v.visit_date >= :df';
            $params[':df'] = $filters['date_from'];
        }
        if (!empty($filters['date_to'])) {
            $where[] = 'v.visit_date <= :dt';
            $params[':dt'] = $filters['date_to'];
        }
        $whereSql = implode(' AND ', $where);
        $db = Yii::$app->db;
        $total = (int) $db->createCommand(
            "SELECT count(*) FROM invoices i JOIN visits v ON v.id = i.visit_id JOIN patients p ON p.id = v.patient_id WHERE {$whereSql}",
            $params
        )->queryScalar();
        $rows = $db->createCommand(
            "SELECT i.*, v.visit_no, v.visit_date, v.status AS visit_status, p.mrn, p.name AS patient_name,
                    d.name AS doctor_name, po.name AS poli_name
             FROM invoices i
             JOIN visits v ON v.id = i.visit_id
             JOIN patients p ON p.id = v.patient_id
             JOIN doctors d ON d.id = v.doctor_id
             JOIN polis po ON po.id = v.poli_id
             WHERE {$whereSql}
             ORDER BY i.created_at DESC
             LIMIT :limit OFFSET :offset",
            $params + [':limit' => $perPage, ':offset' => ($page - 1) * $perPage]
        )->queryAll();
        return ['rows' => $rows, 'total' => $total, 'page' => $page, 'per_page' => $perPage];
    }
}
