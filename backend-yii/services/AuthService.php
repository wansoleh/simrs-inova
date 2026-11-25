<?php

declare(strict_types=1);

namespace app\services;

use Yii;

class AuthService
{
    public const ROLE_PERMISSIONS = [
        'admin' => ['*'],
        'pendaftaran' => ['master.view', 'patient.manage', 'visit.register', 'queue.view', 'dashboard.view'],
        'dokter' => ['master.view', 'exam.read', 'exam.write', 'procedure.write', 'rx.write', 'lab.order', 'dashboard.view'],
        'farmasi' => ['master.view', 'rx.read', 'rx.dispense', 'medicine.view', 'dashboard.view'],
        'lab' => ['master.view', 'lab.result.write', 'dashboard.view'],
        'kasir' => ['billing.read', 'billing.pay', 'invoice.print', 'dashboard.view'],
    ];

    public const ROLE_LABELS = [
        'admin' => 'Administrator',
        'pendaftaran' => 'Pendaftaran',
        'dokter' => 'Dokter',
        'farmasi' => 'Farmasi',
        'lab' => 'Petugas Lab',
        'kasir' => 'Kasir',
    ];

    private JwtService $jwt;

    public function __construct(?JwtService $jwt = null)
    {
        $this->jwt = $jwt ?: new JwtService();
    }

    public static function permissionsForRole(string $role): array
    {
        return self::ROLE_PERMISSIONS[$role] ?? [];
    }

    public static function roleCan(string $role, string $permission): bool
    {
        $perms = self::permissionsForRole($role);
        return in_array('*', $perms, true) || in_array($permission, $perms, true);
    }

    public function login(string $username, string $password): array
    {
        $db = Yii::$app->db;
        $user = $db->createCommand(
            'SELECT id, username, password_hash, full_name, role, is_active FROM users WHERE lower(username) = lower(:u) LIMIT 1',
            [':u' => $username]
        )->queryOne();

        if (!$user || !password_verify($password, $user['password_hash'])) {
            throw ApiException::unauthorized('Username atau password salah');
        }
        if (!$user['is_active']) {
            throw ApiException::forbidden('Akun tidak aktif');
        }
        $db->createCommand('UPDATE users SET last_login_at = now() WHERE id = :id', [':id' => $user['id']])->execute();

        return $this->tokenPayload($user);
    }

    public function refresh(string $refreshToken): array
    {
        $claims = $this->jwt->verifyRefresh($refreshToken);
        $user = $this->findUser((int) $claims['sub']);
        if (!$user || !$user['is_active']) {
            throw ApiException::unauthorized('Akun tidak aktif');
        }
        return $this->tokenPayload($user);
    }

    public function authenticate(?string $authorizationHeader): array
    {
        if (!$authorizationHeader || !preg_match('/^Bearer\s+(.+)$/i', $authorizationHeader, $m)) {
            throw ApiException::unauthorized('Header Authorization Bearer tidak ditemukan');
        }
        $claims = $this->jwt->verify($m[1]);
        if (($claims['type'] ?? null) !== 'access') {
            throw ApiException::unauthorized('Jenis token tidak valid');
        }
        $user = $this->findUser((int) $claims['sub']);
        if (!$user || !$user['is_active']) {
            throw ApiException::unauthorized('Akun tidak aktif atau tidak ditemukan');
        }
        $claims['role'] = $user['role'];
        $claims['permissions'] = self::permissionsForRole($user['role']);
        $claims['name'] = $user['full_name'];
        $claims['username'] = $user['username'];
        $claims['user'] = $user;
        return $claims;
    }

    public function findUser(int $id): ?array
    {
        $row = Yii::$app->db->createCommand(
            'SELECT id, username, full_name, role, is_active, created_at, last_login_at FROM users WHERE id = :id',
            [':id' => $id]
        )->queryOne();
        return $row ?: null;
    }

    public function hashPassword(string $password): string
    {
        return password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
    }

    private function tokenPayload(array $user): array
    {
        $safe = [
            'id' => (int) $user['id'],
            'username' => $user['username'],
            'full_name' => $user['full_name'],
            'role' => $user['role'],
        ];
        return [
            'access_token' => $this->jwt->issueAccessToken($safe),
            'refresh_token' => $this->jwt->issueRefreshToken($safe),
            'token_type' => 'Bearer',
            'expires_in' => JwtService::ACCESS_TTL,
            'user' => $safe + [
                'role_label' => self::ROLE_LABELS[$user['role']] ?? $user['role'],
                'permissions' => self::permissionsForRole($user['role']),
            ],
        ];
    }
}
