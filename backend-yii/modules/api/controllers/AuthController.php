<?php

declare(strict_types=1);

namespace app\modules\api\controllers;

use app\services\ApiException;
use app\services\AuditService;
use app\services\AuthService;
use Yii;

class AuthController extends BaseApiController
{
    protected array $publicActions = ['login', 'refresh'];

    public function actionLogin(): array
    {
        $body = $this->body();
        $username = trim((string) ($body['username'] ?? ''));
        $password = (string) ($body['password'] ?? '');
        if ($username === '' || $password === '') {
            throw ApiException::unprocessable('Username dan password wajib diisi');
        }
        $result = (new AuthService())->login($username, $password);
        return $this->ok($result, 'Login berhasil');
    }

    public function actionRefresh(): array
    {
        $body = $this->body();
        $token = (string) ($body['refresh_token'] ?? '');
        if ($token === '') {
            throw ApiException::unprocessable('refresh_token wajib diisi');
        }
        $result = (new AuthService())->refresh($token);
        return $this->ok($result, 'Token diperbarui');
    }

    public function actionLogout(): array
    {
        return $this->ok(null, 'Logout berhasil. Hapus token di sisi klien.');
    }

    public function actionChangePassword(): array
    {
        $body = $this->body();
        $current = (string) ($body['current_password'] ?? '');
        $new = (string) ($body['new_password'] ?? '');
        if ($current === '' || $new === '') {
            throw ApiException::unprocessable('current_password dan new_password wajib diisi');
        }
        if (strlen($new) < 6) {
            throw ApiException::unprocessable('Password baru minimal 6 karakter');
        }
        if ($current === $new) {
            throw ApiException::unprocessable('Password baru harus berbeda dari password saat ini');
        }
        $userId = (int) ($this->claims['sub'] ?? 0);
        $row = Yii::$app->db->createCommand(
            'SELECT id, password_hash FROM users WHERE id = :id',
            [':id' => $userId]
        )->queryOne();
        if (!$row || !password_verify($current, $row['password_hash'])) {
            throw ApiException::unprocessable('Password saat ini salah');
        }
        Yii::$app->db->createCommand(
            'UPDATE users SET password_hash = :p, updated_at = now() WHERE id = :id',
            [':p' => (new AuthService())->hashPassword($new), ':id' => $userId]
        )->execute();
        AuditService::log('users', $userId, 'CHANGE_PASSWORD', null, ['self' => true], $userId);
        return $this->ok(null, 'Password berhasil diperbarui');
    }

    public function actionMe(): array
    {
        $claims = $this->claims;
        $user = $claims['user'] ?? [];
        return $this->ok([
            'id' => (int) ($claims['sub'] ?? 0),
            'username' => $claims['username'] ?? null,
            'full_name' => $claims['name'] ?? null,
            'role' => $claims['role'] ?? null,
            'role_label' => AuthService::ROLE_LABELS[$claims['role']] ?? $claims['role'],
            'permissions' => $claims['permissions'] ?? [],
            'last_login_at' => $user['last_login_at'] ?? null,
        ], 'Profil pengguna');
    }
}
