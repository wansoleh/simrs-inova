<?php

declare(strict_types=1);

namespace app\modules\api\controllers;

use app\services\ApiException;
use app\services\AuditService;
use app\services\AuthService;
use Yii;

class UserController extends BaseApiController
{
    public function actionIndex(): array
    {
        $this->requirePermission('user.manage');
        $rows = Yii::$app->db->createCommand(
            'SELECT id, username, full_name, role, is_active, last_login_at, created_at FROM users ORDER BY id'
        )->queryAll();
        return $this->ok($rows, 'Daftar pengguna');
    }

    public function actionCreate(): array
    {
        $this->requirePermission('user.manage');
        $body = $this->body();
        $username = trim((string) ($body['username'] ?? ''));
        $password = (string) ($body['password'] ?? '');
        $fullName = trim((string) ($body['full_name'] ?? ''));
        $role = (string) ($body['role'] ?? '');
        if ($username === '' || $password === '' || $fullName === '' || $role === '') {
            throw ApiException::unprocessable('username, password, full_name, dan role wajib diisi');
        }
        if (!isset(AuthService::ROLE_LABELS[$role])) {
            throw ApiException::unprocessable('Role tidak valid');
        }
        if (strlen($password) < 6) {
            throw ApiException::unprocessable('Password minimal 6 karakter');
        }
        $exists = Yii::$app->db->createCommand('SELECT id FROM users WHERE lower(username) = lower(:u)', [':u' => $username])->queryOne();
        if ($exists) {
            throw ApiException::conflict('Username sudah dipakai');
        }
        $hash = (new AuthService())->hashPassword($password);
        $row = Yii::$app->db->createCommand(
            'INSERT INTO users (username, password_hash, full_name, role, is_active)
             VALUES (:u, :p, :f, :r, :a) RETURNING id, username, full_name, role, is_active, created_at',
            [
                ':u' => $username,
                ':p' => $hash,
                ':f' => $fullName,
                ':r' => $role,
                ':a' => $this->toBool($body['is_active'] ?? true),
            ]
        )->queryOne();
        $this->syncRole((int) $row['id'], $role);
        AuditService::log('users', (int) $row['id'], 'CREATE', null, $row, $this->actor()['id']);
        return $this->created($row, 'Pengguna dibuat');
    }

    public function actionUpdate($id): array
    {
        $this->requirePermission('user.manage');
        $old = Yii::$app->db->createCommand('SELECT id, username, full_name, role, is_active FROM users WHERE id = :id', [':id' => (int) $id])->queryOne();
        if (!$old) {
            throw ApiException::notFound('Pengguna tidak ditemukan');
        }
        $body = $this->body();
        $sets = [];
        $params = [':id' => (int) $id];
        if (array_key_exists('full_name', $body) && trim((string) $body['full_name']) !== '') {
            $sets[] = 'full_name = :f';
            $params[':f'] = trim((string) $body['full_name']);
        }
        if (array_key_exists('is_active', $body)) {
            $sets[] = 'is_active = :a';
            $params[':a'] = $this->toBool($body['is_active']);
        }
        if (!empty($body['password'])) {
            if (strlen((string) $body['password']) < 6) {
                throw ApiException::unprocessable('Password minimal 6 karakter');
            }
            $sets[] = 'password_hash = :p';
            $params[':p'] = (new AuthService())->hashPassword((string) $body['password']);
        }
        if (!empty($body['role'])) {
            if (!isset(AuthService::ROLE_LABELS[$body['role']])) {
                throw ApiException::unprocessable('Role tidak valid');
            }
            $sets[] = 'role = :r';
            $params[':r'] = $body['role'];
        }
        if (!$sets) {
            throw ApiException::unprocessable('Tidak ada perubahan');
        }
        $sets[] = 'updated_at = now()';
        $row = Yii::$app->db->createCommand(
            'UPDATE users SET ' . implode(', ', $sets) . ' WHERE id = :id
             RETURNING id, username, full_name, role, is_active, updated_at',
            $params
        )->queryOne();
        if (!empty($body['role'])) {
            $this->syncRole((int) $id, (string) $body['role']);
        }
        AuditService::log('users', (int) $id, 'UPDATE', $old, $row, $this->actor()['id']);
        return $this->ok($row, 'Pengguna diperbarui');
    }

    public function actionRoles($id): array
    {
        $this->requirePermission('user.manage');
        $body = $this->body();
        $role = (string) ($body['role'] ?? '');
        if (!isset(AuthService::ROLE_LABELS[$role])) {
            throw ApiException::unprocessable('Role tidak valid');
        }
        $old = Yii::$app->db->createCommand('SELECT id, role FROM users WHERE id = :id', [':id' => (int) $id])->queryOne();
        if (!$old) {
            throw ApiException::notFound('Pengguna tidak ditemukan');
        }
        Yii::$app->db->createCommand('UPDATE users SET role = :r, updated_at = now() WHERE id = :id', [':r' => $role, ':id' => (int) $id])->execute();
        $this->syncRole((int) $id, $role);
        AuditService::log('users', (int) $id, 'SET_ROLE', $old, ['role' => $role], $this->actor()['id']);
        return $this->ok(['id' => (int) $id, 'role' => $role, 'role_label' => AuthService::ROLE_LABELS[$role]], 'Role pengguna diperbarui');
    }

    public function actionRolesList(): array
    {
        $this->requirePermission('user.manage');
        $roles = [];
        foreach (AuthService::ROLE_LABELS as $key => $label) {
            $roles[] = [
                'key' => $key,
                'label' => $label,
                'permissions' => AuthService::permissionsForRole($key),
            ];
        }
        return $this->ok($roles, 'Daftar role dan izin');
    }

    private function syncRole(int $userId, string $role): void
    {
        try {
            $auth = Yii::$app->authManager;
            $auth->revokeAll((string) $userId);
            $item = $auth->getRole($role);
            if ($item) {
                $auth->assign($item, (string) $userId);
            }
        } catch (\Throwable $e) {
            Yii::warning('RBAC sync gagal: ' . $e->getMessage(), __METHOD__);
        }
    }

    private function toBool($value): bool
    {
        if (is_bool($value)) {
            return $value;
        }
        return in_array(strtolower((string) $value), ['1', 'true', 'yes', 'ya'], true);
    }
}
