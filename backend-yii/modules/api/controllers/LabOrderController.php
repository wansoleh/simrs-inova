<?php

declare(strict_types=1);

namespace app\modules\api\controllers;

use app\services\ApiException;
use app\services\LabService;
use Yii;

class LabOrderController extends BaseApiController
{
    private LabService $service;

    public function init(): void
    {
        parent::init();
        $this->service = new LabService();
    }

    public function actionCreate($id): array
    {
        $this->requirePermission('lab.order');
        $body = $this->body();
        $testIds = $body['test_ids'] ?? $body['lab_test_ids'] ?? [];
        if (!is_array($testIds)) {
            $testIds = [$testIds];
        }
        return $this->created(
            $this->service->createOrder((int) $id, $testIds, $this->actor(), $body['notes'] ?? null),
            'Order laboratorium dibuat'
        );
    }

    public function actionResults($id): array
    {
        $this->requirePermission('exam.read');
        return $this->ok($this->service->resultsForVisit((int) $id), 'Hasil laboratorium kunjungan');
    }

    public function actionIndex(): array
    {
        $this->requirePermission('master.view');
        [$page, $perPage] = $this->pagination();
        $result = $this->service->listOrders([
            'status' => $this->query('status'),
            'date' => $this->query('date'),
            'q' => $this->query('q'),
        ], $page, $perPage);
        return $this->ok($result['rows'], 'Daftar order laboratorium', 200, $this->meta($result['total'], $page, $perPage));
    }

    public function actionView($id): array
    {
        $this->requirePermission('master.view');
        return $this->ok($this->service->detail((int) $id), 'Detail order laboratorium');
    }

    public function actionSubmit($id): array
    {
        $this->requirePermission('lab.result.write');
        $body = $this->body();
        $itemId = (int) ($body['lab_order_item_id'] ?? 0);
        if (!$itemId) {
            throw ApiException::unprocessable('lab_order_item_id wajib diisi');
        }
        $order = $this->service->detail((int) $id);
        $valid = false;
        foreach ($order['items'] as $item) {
            if ((int) $item['id'] === $itemId) {
                $valid = true;
                break;
            }
        }
        if (!$valid) {
            throw ApiException::unprocessable('Item bukan bagian dari order ini');
        }
        $result = $this->service->submitResult($itemId, $body, $this->actor());
        Yii::$app->response->headers->set('Idempotent-Replay', $result['replay'] ? 'true' : 'false');
        return $this->ok($result, 'Hasil laboratorium disimpan');
    }
}
