<?php

declare(strict_types=1);

namespace app\services;

class ApiException extends \Exception
{
    public int $statusCode;
    public string $errorCode;
    public array $errors;

    public function __construct(int $statusCode, string $errorCode, string $message, array $errors = [])
    {
        parent::__construct($message);
        $this->statusCode = $statusCode;
        $this->errorCode = $errorCode;
        $this->errors = $errors;
    }

    public static function badRequest(string $message, array $errors = []): self
    {
        return new self(400, 'BAD_REQUEST', $message, $errors);
    }

    public static function unauthorized(string $message = 'Token tidak valid atau sudah kedaluwarsa'): self
    {
        return new self(401, 'UNAUTHENTICATED', $message);
    }

    public static function forbidden(string $message = 'Anda tidak berwenang untuk aksi ini'): self
    {
        return new self(403, 'FORBIDDEN', $message);
    }

    public static function notFound(string $message = 'Data tidak ditemukan'): self
    {
        return new self(404, 'NOT_FOUND', $message);
    }

    public static function conflict(string $message, array $errors = []): self
    {
        return new self(409, 'CONFLICT', $message, $errors);
    }

    public static function unprocessable(string $message, array $errors = []): self
    {
        return new self(422, 'UNPROCESSABLE', $message, $errors);
    }
}
