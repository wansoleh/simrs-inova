<?php

declare(strict_types=1);

namespace app\components;

use app\services\ApiException;
use Yii;
use yii\base\UserException;
use yii\db\IntegrityException;
use yii\web\ErrorHandler;
use yii\web\HttpException;
use yii\web\Response;

class ApiErrorHandler extends ErrorHandler
{
    protected function renderException($exception): void
    {
        while (ob_get_level() > 0) {
            ob_end_clean();
        }
        $response = Yii::$app->response;
        $response->isSent = false;
        $response->stream = null;
        $response->data = null;
        $response->content = null;
        $response->format = Response::FORMAT_JSON;
        $status = 500;
        $code = 'INTERNAL_ERROR';
        $message = 'Terjadi kesalahan pada server';
        $errors = [];

        if ($exception instanceof ApiException) {
            $status = $exception->statusCode;
            $code = $exception->errorCode;
            $message = $exception->getMessage();
            $errors = $exception->errors;
        } elseif ($exception instanceof HttpException) {
            $status = $exception->statusCode;
            $code = $status === 404 ? 'NOT_FOUND' : ($status === 403 ? 'FORBIDDEN' : 'HTTP_ERROR');
            $message = $exception->getMessage() ?: 'Permintaan tidak dapat diproses';
        } elseif ($exception instanceof IntegrityException) {
            $status = 409;
            $code = 'CONFLICT';
            $message = 'Data bertentangan dengan data lain (duplikasi/relasi)';
            if (YII_DEBUG) {
                $errors[] = ['field' => null, 'code' => 'DB_INTEGRITY', 'message' => $exception->getMessage()];
            }
        } elseif ($exception instanceof UserException) {
            $status = 422;
            $code = 'UNPROCESSABLE';
            $message = $exception->getMessage();
        }

        if (YII_DEBUG && $status >= 500) {
            $message = $exception->getMessage() ?: $message;
            $errors[] = [
                'field' => null,
                'code' => 'DEBUG',
                'message' => get_class($exception) . ' at ' . $exception->getFile() . ':' . $exception->getLine(),
            ];
        }

        $requestId = Yii::$app->params['requestId'] ?? Yii::$app->request->headers->get('X-Request-Id') ?? bin2hex(random_bytes(8));
        $response->statusCode = $status;
        $response->data = [
            'success' => false,
            'message' => $message,
            'data' => null,
            'meta' => null,
            'errors' => $errors,
            'request_id' => $requestId,
            'code' => $code,
        ];
        $response->send();
    }
}
