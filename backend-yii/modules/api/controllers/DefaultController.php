<?php

declare(strict_types=1);

namespace app\modules\api\controllers;

use Yii;

class DefaultController extends BaseApiController
{
    protected array $publicActions = ['health'];

    public function actionHealth(): array
    {
        $dbOk = true;
        try {
            Yii::$app->db->createCommand('SELECT 1')->queryScalar();
        } catch (\Throwable $e) {
            $dbOk = false;
        }
        return $this->ok([
            'service' => 'yii-api',
            'status' => $dbOk ? 'ok' : 'degraded',
            'time' => date(DATE_ATOM),
            'database' => $dbOk,
        ]);
    }
}
