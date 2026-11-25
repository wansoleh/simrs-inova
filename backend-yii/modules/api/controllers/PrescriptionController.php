<?php

declare(strict_types=1);

namespace app\modules\api\controllers;

use app\services\PharmacyService;

class PrescriptionController extends BaseApiController
{
    private PharmacyService $service;

    public function init(): void
    {
        parent::init();
        $this->service = new PharmacyService();
    }

    public function actionCreate($id): array
    {
        $this->requirePermission('rx.write');
        $body = $this->body();
        $items = $body['items'] ?? [];
        if (!is_array($items)) {
            $items = [];
        }
        return $this->created(
            $this->service->createPrescription((int) $id, $items, $this->actor(), $body['notes'] ?? null),
            'Resep dibuat'
        );
    }

    public function actionQueue(): array
    {
        $this->requirePermission('rx.read');
        return $this->ok($this->service->queue([
            'status' => $this->query('status'),
            'date' => $this->query('date'),
        ]), 'Antrean farmasi');
    }

    public function actionView($id): array
    {
        $this->requirePermission('rx.read');
        return $this->ok($this->service->detail((int) $id), 'Detail resep');
    }

    public function actionProcess($id): array
    {
        $this->requirePermission('rx.dispense');
        return $this->ok($this->service->process((int) $id, $this->actor()), 'Resep mulai diproses');
    }

    public function actionDispense($id): array
    {
        $this->requirePermission('rx.dispense');
        return $this->ok($this->service->dispense((int) $id, $this->actor()), 'Obat diserahkan');
    }

    public function actionMedicationHistory($id): array
    {
        $this->requirePermission('master.view');
        return $this->ok($this->service->medicationHistory((int) $id), 'Riwayat obat pasien');
    }
}
