<?php

declare(strict_types=1);

namespace app\modules\api\controllers;

use app\services\ApiException;
use app\services\AuthService;
use Yii;
use yii\filters\Cors;
use yii\web\Controller;
use yii\web\Response;

class BaseApiController extends Controller
{
    public $enableCsrfValidation = false;

    protected array $publicActions = [];
    protected bool $skipAuth = false;
    protected ?array $claims = null;
    protected string $requestId = '';

    public function behaviors(): array
    {
        $behaviors = parent::behaviors();
        $behaviors['cors'] = [
            'class' => Cors::class,
            'cors' => [
                'Origin' => ['*'],
                'Access-Control-Request-Method' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
                'Access-Control-Request-Headers' => ['*'],
                'Access-Control-Allow-Credentials' => false,
                'Access-Control-Max-Age' => 86400,
            ],
        ];
        return $behaviors;
    }

    public function beforeAction($action): bool
    {
        $this->requestId = (string) (Yii::$app->request->headers->get('X-Request-Id') ?: bin2hex(random_bytes(8)));
        Yii::$app->params['requestId'] = $this->requestId;
        Yii::$app->response->format = Response::FORMAT_JSON;
        Yii::$app->response->headers->set('X-Request-Id', $this->requestId);
        Yii::$app->response->headers->set('Access-Control-Expose-Headers', 'X-Request-Id, Idempotent-Replay, Content-Disposition');

        if ($this->skipAuth || in_array($action->id, $this->publicActions, true)) {
            return parent::beforeAction($action);
        }
        $this->claims = (new AuthService())->authenticate(Yii::$app->request->headers->get('Authorization'));
        return parent::beforeAction($action);
    }

    protected function requirePermission(string $permission): void
    {
        $role = $this->claims['role'] ?? null;
        if (!$role || !AuthService::roleCan($role, $permission)) {
            throw ApiException::forbidden('Role Anda tidak memiliki izin ' . $permission);
        }
    }

    protected function actor(): array
    {
        return [
            'id' => isset($this->claims['sub']) ? (int) $this->claims['sub'] : null,
            'name' => $this->claims['name'] ?? null,
            'role' => $this->claims['role'] ?? null,
        ];
    }

    protected function body(): array
    {
        $body = Yii::$app->request->getBodyParams();
        return is_array($body) ? $body : [];
    }

    protected function query(string $key, $default = null)
    {
        return Yii::$app->request->getQueryParam($key, $default);
    }

    protected function pagination(): array
    {
        $page = max(1, (int) ($this->query('page', 1)));
        $perPage = (int) ($this->query('per_page', $this->query('per-page', 20)));
        $perPage = max(1, min(100, $perPage));
        return [$page, $perPage];
    }

    protected function ok($data = null, string $message = 'OK', int $status = 200, ?array $meta = null): array
    {
        Yii::$app->response->statusCode = $status;
        return [
            'success' => true,
            'message' => $message,
            'data' => $data,
            'meta' => $meta,
            'errors' => null,
            'request_id' => $this->requestId,
        ];
    }

    protected function created($data = null, string $message = 'Data berhasil dibuat', ?array $meta = null): array
    {
        return $this->ok($data, $message, 201, $meta);
    }

    protected function meta(int $total, int $page, int $perPage): array
    {
        return [
            'page' => $page,
            'per_page' => $perPage,
            'total' => $total,
            'total_pages' => (int) ceil($total / max($perPage, 1)),
        ];
    }
}
