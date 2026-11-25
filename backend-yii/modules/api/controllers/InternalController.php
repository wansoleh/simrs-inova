<?php

declare(strict_types=1);

namespace app\modules\api\controllers;

use app\services\ApiException;
use app\services\LabService;
use Yii;

class InternalController extends BaseApiController
{
    protected bool $skipAuth = true;

    public function actionHealth(): array
    {
        return $this->ok(['service' => 'yii-internal', 'status' => 'ok', 'time' => date(DATE_ATOM)]);
    }

    public function actionLabResults(): array
    {
        $expected = getenv('SERVICE_TOKEN') ?: 'simrs-dev-service-token';
        $provided = (string) Yii::$app->request->headers->get('X-Service-Token');
        if ($provided === '' || !hash_equals($expected, $provided)) {
            throw ApiException::unauthorized('X-Service-Token tidak valid');
        }
        $body = $this->body();
        $itemId = (int) ($body['lab_order_item_id'] ?? 0);
        if (!$itemId) {
            throw ApiException::unprocessable('lab_order_item_id wajib diisi');
        }
        $result = (new LabService())->submitResult($itemId, $body, ['id' => null, 'name' => 'Node service', 'role' => 'lab']);
        Yii::$app->response->headers->set('Idempotent-Replay', $result['replay'] ? 'true' : 'false');
        return $this->ok($result, $result['replay'] ? 'Hasil lab sudah pernah diterima' : 'Hasil lab tersimpan');
    }
}
