<?php

declare(strict_types=1);

namespace app\services;

use Yii;

class JwtService
{
    public const ACCESS_TTL = 8 * 3600;
    public const REFRESH_TTL = 7 * 24 * 3600;

    public function issueAccessToken(array $user): string
    {
        return $this->encode($this->baseClaims($user) + [
            'type' => 'access',
            'exp' => time() + self::ACCESS_TTL,
        ]);
    }

    public function issueRefreshToken(array $user): string
    {
        return $this->encode($this->baseClaims($user) + [
            'type' => 'refresh',
            'exp' => time() + self::REFRESH_TTL,
        ]);
    }

    public function verify(string $token): array
    {
        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            throw ApiException::unauthorized();
        }
        [$header, $payload, $signature] = $parts;
        $publicKey = openssl_pkey_get_public($this->publicKey());
        if ($publicKey === false) {
            throw ApiException::unauthorized('Kunci publik JWT tidak dapat dibaca');
        }
        $ok = openssl_verify($header . '.' . $payload, $this->b64decode($signature), $publicKey, OPENSSL_ALGO_SHA256);
        if ($ok !== 1) {
            throw ApiException::unauthorized();
        }
        $claims = json_decode($this->b64decode($payload), true);
        if (!is_array($claims)) {
            throw ApiException::unauthorized();
        }
        if (($claims['exp'] ?? 0) < time()) {
            throw ApiException::unauthorized('Token sudah kedaluwarsa');
        }
        return $claims;
    }

    public function verifyRefresh(string $token): array
    {
        $claims = $this->verify($token);
        if (($claims['type'] ?? null) !== 'refresh') {
            throw ApiException::unauthorized('Token refresh tidak valid');
        }
        return $claims;
    }

    private function baseClaims(array $user): array
    {
        return [
            'iss' => 'simrs-inova',
            'sub' => (string) $user['id'],
            'username' => $user['username'],
            'name' => $user['full_name'],
            'role' => $user['role'],
            'permissions' => AuthService::permissionsForRole($user['role']),
            'iat' => time(),
            'jti' => bin2hex(random_bytes(16)),
        ];
    }

    private function encode(array $payload): string
    {
        $header = ['alg' => 'RS256', 'typ' => 'JWT'];
        $segments = [
            $this->b64encode(json_encode($header, JSON_UNESCAPED_SLASHES)),
            $this->b64encode(json_encode($payload, JSON_UNESCAPED_SLASHES)),
        ];
        $data = implode('.', $segments);
        $privateKey = openssl_pkey_get_private($this->privateKey());
        if ($privateKey === false) {
            throw new \RuntimeException('Kunci privat JWT tidak dapat dibaca');
        }
        openssl_sign($data, $signature, $privateKey, OPENSSL_ALGO_SHA256);
        return $data . '.' . $this->b64encode($signature);
    }

    private function b64encode(string $value): string
    {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }

    private function b64decode(string $value): string
    {
        return base64_decode(strtr($value, '-_', '+/') . str_repeat('=', (4 - strlen($value) % 4) % 4)) ?: '';
    }

    private function privateKey(): string
    {
        return $this->readKey('JWT_PRIVATE_KEY_PATH', '@app/keys/jwt_private.pem');
    }

    private function publicKey(): string
    {
        return $this->readKey('JWT_PUBLIC_KEY_PATH', '@app/keys/jwt_public.pem');
    }

    private function readKey(string $env, string $alias): string
    {
        $path = getenv($env) ?: Yii::getAlias($alias);
        if (!is_file($path)) {
            throw new \RuntimeException("File kunci tidak ditemukan: {$path}");
        }
        return (string) file_get_contents($path);
    }
}
