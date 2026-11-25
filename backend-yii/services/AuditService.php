<?php

declare(strict_types=1);

namespace app\services;

use Yii;

class AuditService
{
    public static function log(
        string $table,
        ?int $recordId,
        string $action,
        ?array $oldData,
        ?array $newData,
        ?int $userId = null
    ): void {
        $ip = null;
        if (Yii::$app->has('request') && Yii::$app->request instanceof \yii\web\Request) {
            $ip = Yii::$app->request->userIP;
        }
        Yii::$app->db->createCommand(
            'INSERT INTO audit_logs (table_name, record_id, action, old_data, new_data, user_id, ip)
             VALUES (:t, :r, :a, :o, :n, :u, :i)',
            [
                ':t' => $table,
                ':r' => $recordId,
                ':a' => $action,
                ':o' => $oldData === null ? null : json_encode($oldData, JSON_UNESCAPED_UNICODE),
                ':n' => $newData === null ? null : json_encode($newData, JSON_UNESCAPED_UNICODE),
                ':u' => $userId,
                ':i' => $ip,
            ]
        )->execute();
    }
}
