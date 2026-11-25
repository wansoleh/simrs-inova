<?php

declare(strict_types=1);

namespace app\modules\api\controllers;

use app\services\ApiException;
use app\services\RegistrationService;

class VisitController extends BaseApiController
{
    private RegistrationService $service;

    public function init(): void
    {
        parent::init();
        $this->service = new RegistrationService();
    }

    public function actionIndex(): array
    {
        $this->requirePermission('master.view');
        [$page, $perPage] = $this->pagination();
        $result = $this->service->list([
            'date' => $this->query('date'),
            'status' => $this->query('status'),
            'poli_id' => $this->query('poli_id'),
            'doctor_id' => $this->query('doctor_id'),
            'q' => $this->query('q'),
            'active' => $this->query('active'),
        ], $page, $perPage);
        return $this->ok($result['rows'], 'Daftar kunjungan', 200, $this->meta($result['total'], $page, $perPage));
    }

    public function actionView($id): array
    {
        $this->requirePermission('master.view');
        return $this->ok($this->service->detail((int) $id), 'Detail kunjungan');
    }

    public function actionCreate(): array
    {
        $this->requirePermission('visit.register');
        $result = $this->service->create($this->body(), $this->actor());
        return $this->created($result, 'Pendaftaran berhasil');
    }

    public function actionCheckin($id): array
    {
        $this->requirePermission('visit.register');
        return $this->ok($this->service->checkin((int) $id, $this->actor()), 'Pasien masuk daftar tunggu');
    }

    public function actionCancel($id): array
    {
        $this->requirePermission('visit.register');
        $body = $this->body();
        $reason = (string) ($body['reason'] ?? $this->query('reason', ''));
        return $this->ok($this->service->cancel((int) $id, $reason, $this->actor()), 'Kunjungan dibatalkan');
    }

    public function actionBoard(): array
    {
        $this->requirePermission('master.view');
        $date = (string) $this->query('date', date('Y-m-d'));
        $poliId = $this->query('poli_id');
        return $this->ok($this->service->queueBoard($date, $poliId ? (int) $poliId : null), 'Papan antrean');
    }
}
