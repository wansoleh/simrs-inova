<?php

declare(strict_types=1);

namespace app\services;

use Yii;

class LabService
{
    private BillingService $billing;

    public function __construct(?BillingService $billing = null)
    {
        $this->billing = $billing ?: new BillingService();
    }

    public function createOrder(int $visitId, array $testIds, array $actor, ?string $notes = null): array
    {
        $testIds = array_values(array_unique(array_map('intval', $testIds)));
        if (empty($testIds)) {
            throw ApiException::unprocessable('Pilih minimal satu pemeriksaan laboratorium');
        }
        return Yii::$app->db->transaction(function ($db) use ($visitId, $testIds, $actor, $notes) {
            $visit = $db->createCommand('SELECT * FROM visits WHERE id = :id', [':id' => $visitId])->queryOne();
            if (!$visit) {
                throw ApiException::notFound('Kunjungan tidak ditemukan');
            }
            $tests = $db->createCommand(
                'SELECT * FROM lab_tests WHERE id IN (' . implode(',', array_map('intval', $testIds)) . ') AND is_active = true'
            )->queryAll();
            if (count($tests) !== count($testIds)) {
                throw ApiException::unprocessable('Ada pemeriksaan lab yang tidak valid/aktif');
            }
            $no = $db->createCommand(
                "SELECT 'LAB' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('lab_order_no_seq')::text, 4, '0')"
            )->queryScalar();
            $order = $db->createCommand(
                "INSERT INTO lab_orders (order_no, visit_id, status, ordered_by, notes)
                 VALUES (:no, :v, 'ORDERED', :by, :n) RETURNING *",
                [':no' => $no, ':v' => $visitId, ':by' => $actor['id'] ?? null, ':n' => $notes]
            )->queryOne();
            foreach ($tests as $test) {
                $db->createCommand(
                    'INSERT INTO lab_order_items (lab_order_id, lab_test_id, unit_price, status)
                     VALUES (:o, :t, :price, \'ORDERED\')',
                    [':o' => $order['id'], ':t' => $test['id'], ':price' => $test['price']]
                )->execute();
            }
            $payload = [
                'order_id' => (int) $order['id'],
                'order_no' => $order['order_no'],
                'visit_id' => $visitId,
                'tests' => array_map(fn ($t) => ['code' => $t['code'], 'name' => $t['name']], $tests),
            ];
            $db->createCommand(
                'INSERT INTO integration.outbox (aggregate_type, aggregate_id, event_type, payload)
                 VALUES (\'lab_order\', :id, \'lab.order.created\', :payload)',
                [':id' => $order['id'], ':payload' => json_encode($payload, JSON_UNESCAPED_UNICODE)]
            )->execute();
            $this->billing->syncInvoice($visitId, $actor, 'Order laboratorium dibuat');
            AuditService::log('lab_orders', (int) $order['id'], 'CREATE', null, $payload, $actor['id'] ?? null);
            return $this->detail((int) $order['id']);
        });
    }

    public function listOrders(array $filters, int $page, int $perPage): array
    {
        $where = ['1=1'];
        $params = [];
        if (!empty($filters['status'])) {
            $where[] = 'lo.status = :status';
            $params[':status'] = $filters['status'];
        }
        if (!empty($filters['date'])) {
            $where[] = 'v.visit_date = :date';
            $params[':date'] = $filters['date'];
        }
        if (!empty($filters['q'])) {
            $where[] = '(lo.order_no ILIKE :q OR p.name ILIKE :q OR p.mrn ILIKE :q)';
            $params[':q'] = '%' . $filters['q'] . '%';
        }
        $whereSql = implode(' AND ', $where);
        $db = Yii::$app->db;
        $total = (int) $db->createCommand(
            "SELECT count(*) FROM lab_orders lo JOIN visits v ON v.id = lo.visit_id JOIN patients p ON p.id = v.patient_id WHERE {$whereSql}",
            $params
        )->queryScalar();
        $rows = $db->createCommand(
            "SELECT lo.*, v.visit_no, v.visit_date, p.mrn, p.name AS patient_name, d.name AS doctor_name, po.name AS poli_name,
                    (SELECT count(*) FROM lab_order_items loi WHERE loi.lab_order_id = lo.id) AS item_count,
                    (SELECT count(*) FROM lab_order_items loi WHERE loi.lab_order_id = lo.id AND loi.status = 'DONE') AS done_count
             FROM lab_orders lo
             JOIN visits v ON v.id = lo.visit_id
             JOIN patients p ON p.id = v.patient_id
             JOIN doctors d ON d.id = v.doctor_id
             JOIN polis po ON po.id = v.poli_id
             WHERE {$whereSql}
             ORDER BY lo.created_at DESC
             LIMIT :limit OFFSET :offset",
            $params + [':limit' => $perPage, ':offset' => ($page - 1) * $perPage]
        )->queryAll();
        return ['rows' => $rows, 'total' => $total, 'page' => $page, 'per_page' => $perPage];
    }

    public function detail(int $orderId): array
    {
        $db = Yii::$app->db;
        $order = $db->createCommand(
            'SELECT lo.*, v.visit_no, v.visit_date, p.mrn, p.name AS patient_name, p.gender, p.birth_date,
                    d.name AS doctor_name, po.name AS poli_name
             FROM lab_orders lo
             JOIN visits v ON v.id = lo.visit_id
             JOIN patients p ON p.id = v.patient_id
             JOIN doctors d ON d.id = v.doctor_id
             JOIN polis po ON po.id = v.poli_id
             WHERE lo.id = :id',
            [':id' => $orderId]
        )->queryOne();
        if (!$order) {
            throw ApiException::notFound('Order laboratorium tidak ditemukan');
        }
        $order['items'] = $db->createCommand(
            'SELECT loi.*, lt.code, lt.name, lt.unit, lt.ref_range,
                    lr.external_ref, lr.result_value, lr.flag, lr.verified_at, lr.notes AS result_notes
             FROM lab_order_items loi
             JOIN lab_tests lt ON lt.id = loi.lab_test_id
             LEFT JOIN lab_results lr ON lr.lab_order_item_id = loi.id
             WHERE loi.lab_order_id = :id ORDER BY loi.id',
            [':id' => $orderId]
        )->queryAll();
        return $order;
    }

    public function submitResult(int $itemId, array $data, ?array $actor = null): array
    {
        $externalRef = trim((string) ($data['external_ref'] ?? ''));
        if ($externalRef === '') {
            $externalRef = 'LAB-' . $itemId . '-' . time();
        }
        return Yii::$app->db->transaction(function ($db) use ($itemId, $data, $externalRef, $actor) {
            $item = $db->createCommand('SELECT * FROM lab_order_items WHERE id = :id FOR UPDATE', [':id' => $itemId])->queryOne();
            if (!$item) {
                throw ApiException::notFound('Item laboratorium tidak ditemukan');
            }
            $existing = $db->createCommand('SELECT * FROM lab_results WHERE external_ref = :e', [':e' => $externalRef])->queryOne();
            if ($existing) {
                if ((int) $existing['lab_order_item_id'] !== $itemId) {
                    throw ApiException::conflict('external_ref sudah dipakai item lain');
                }
                return ['result' => $existing, 'order' => $this->detail((int) $item['lab_order_id']), 'replay' => true];
            }
            $result = $db->createCommand(
                'INSERT INTO lab_results (lab_order_item_id, external_ref, result_value, unit, ref_range, flag, verified_by, notes)
                 VALUES (:item, :ref, :value, :unit, :range, :flag, :by, :notes) RETURNING *',
                [
                    ':item' => $itemId,
                    ':ref' => $externalRef,
                    ':value' => $data['result_value'] ?? null,
                    ':unit' => $data['unit'] ?? null,
                    ':range' => $data['ref_range'] ?? null,
                    ':flag' => $data['flag'] ?? 'NORMAL',
                    ':by' => $actor['id'] ?? null,
                    ':notes' => $data['notes'] ?? null,
                ]
            )->queryOne();
            $db->createCommand("UPDATE lab_order_items SET status = 'DONE' WHERE id = :id", [':id' => $itemId])->execute();
            $remaining = (int) $db->createCommand(
                "SELECT count(*) FROM lab_order_items WHERE lab_order_id = :o AND status <> 'DONE'",
                [':o' => $item['lab_order_id']]
            )->queryScalar();
            $orderStatus = $remaining === 0 ? 'DONE' : 'RESULT_PARTIAL';
            $db->createCommand(
                'UPDATE lab_orders SET status = :s, updated_at = now() WHERE id = :id',
                [':s' => $orderStatus, ':id' => $item['lab_order_id']]
            )->execute();
            AuditService::log('lab_results', (int) $result['id'], 'CREATE', null, $result, $actor['id'] ?? null);
            return ['result' => $result, 'order' => $this->detail((int) $item['lab_order_id']), 'replay' => false];
        });
    }

    public function resultsForVisit(int $visitId): array
    {
        return Yii::$app->db->createCommand(
            'SELECT lt.code, lt.name, lr.result_value, lr.unit, lr.ref_range, lr.flag, lr.verified_at
             FROM lab_results lr
             JOIN lab_order_items loi ON loi.id = lr.lab_order_item_id
             JOIN lab_orders lo ON lo.id = loi.lab_order_id
             JOIN lab_tests lt ON lt.id = loi.lab_test_id
             WHERE lo.visit_id = :v ORDER BY lr.verified_at DESC',
            [':v' => $visitId]
        )->queryAll();
    }
}
