<?php

declare(strict_types=1);

namespace app\modules\api\controllers;

use app\services\ApiException;
use app\services\AuditService;
use app\services\BillingService;
use Yii;

class VisitProcedureController extends BaseApiController
{
    public function actionIndex($id): array
    {
        $this->requirePermission('exam.read');
        $rows = Yii::$app->db->createCommand(
            'SELECT vp.*, pr.code, pr.name, pr.category
             FROM visit_procedures vp JOIN procedures pr ON pr.id = vp.procedure_id
             WHERE vp.visit_id = :v ORDER BY vp.id',
            [':v' => (int) $id]
        )->queryAll();
        return $this->ok($rows, 'Tindakan kunjungan');
    }

    public function actionCreate($id): array
    {
        $this->requirePermission('procedure.write');
        $body = $this->body();
        $procedureId = (int) ($body['procedure_id'] ?? 0);
        $qty = max(1, (int) ($body['qty'] ?? 1));
        if (!$procedureId) {
            throw ApiException::unprocessable('procedure_id wajib diisi');
        }
        $result = Yii::$app->db->transaction(function ($db) use ($id, $procedureId, $qty) {
            $visit = $db->createCommand('SELECT * FROM visits WHERE id = :id', [':id' => (int) $id])->queryOne();
            if (!$visit) {
                throw ApiException::notFound('Kunjungan tidak ditemukan');
            }
            if (in_array($visit['status'], ['CANCELLED', 'PAID'], true)) {
                throw ApiException::unprocessable('Tidak dapat menambah tindakan pada status kunjungan ini');
            }
            $procedure = $db->createCommand('SELECT * FROM procedures WHERE id = :id AND is_active = true', [':id' => $procedureId])->queryOne();
            if (!$procedure) {
                throw ApiException::unprocessable('Tindakan tidak ditemukan/aktif');
            }
            $row = $db->createCommand(
                'INSERT INTO visit_procedures (visit_id, procedure_id, qty, unit_price, status, created_by)
                 VALUES (:v, :p, :q, :price, \'ACTIVE\', :by) RETURNING *',
                [':v' => (int) $id, ':p' => $procedureId, ':q' => $qty, ':price' => $procedure['price'], ':by' => $this->actor()['id']]
            )->queryOne();
            AuditService::log('visit_procedures', (int) $row['id'], 'CREATE', null, $row, $this->actor()['id']);
            (new BillingService())->syncInvoice((int) $id, $this->actor(), 'Tindakan ditambahkan');
            $row['name'] = $procedure['name'];
            $row['code'] = $procedure['code'];
            return $row;
        });
        return $this->created($result, 'Tindakan ditambahkan');
    }

    public function actionDelete($id, $pid): array
    {
        $this->requirePermission('procedure.write');
        $reason = (string) ($this->query('reason', '') ?: ($this->body()['reason'] ?? ''));
        if (trim($reason) === '') {
            throw ApiException::unprocessable('Alasan pembatalan tindakan wajib diisi');
        }
        $result = Yii::$app->db->transaction(function ($db) use ($id, $pid, $reason) {
            $old = $db->createCommand('SELECT * FROM visit_procedures WHERE id = :id AND visit_id = :v', [':id' => (int) $pid, ':v' => (int) $id])->queryOne();
            if (!$old) {
                throw ApiException::notFound('Tindakan tidak ditemukan pada kunjungan ini');
            }
            $n = $db->createCommand(
                "UPDATE visit_procedures SET status = 'VOID', void_reason = :r, updated_at = now()
                 WHERE id = :id AND status = 'ACTIVE'",
                [':r' => $reason, ':id' => (int) $pid]
            )->execute();
            if ($n === 0) {
                throw ApiException::unprocessable('Tindakan sudah dibatalkan');
            }
            AuditService::log('visit_procedures', (int) $pid, 'VOID', $old, ['reason' => $reason], $this->actor()['id']);
            (new BillingService())->syncInvoice((int) $id, $this->actor(), 'Tindakan dibatalkan: ' . $reason);
            return $db->createCommand('SELECT * FROM visit_procedures WHERE id = :id', [':id' => (int) $pid])->queryOne();
        });
        return $this->ok($result, 'Tindakan dibatalkan (VOID)');
    }
}
