<?php

declare(strict_types=1);

namespace app\modules\api\controllers;

use app\services\ExamService;

class ExamController extends BaseApiController
{
    private ExamService $service;

    public function init(): void
    {
        parent::init();
        $this->service = new ExamService();
    }

    public function actionWaiting(): array
    {
        $this->requirePermission('exam.read');
        $doctorId = $this->query('doctor_id');
        $date = $this->query('date');
        return $this->ok($this->service->waiting($doctorId ? (int) $doctorId : null, $date ?: null), 'Daftar tunggu pemeriksaan');
    }

    public function actionDetail($visit): array
    {
        $this->requirePermission('exam.read');
        return $this->ok($this->service->detail((int) $visit), 'Detail pemeriksaan');
    }

    public function actionStart($visit): array
    {
        $this->requirePermission('exam.write');
        return $this->ok($this->service->start((int) $visit, $this->actor()), 'Pemeriksaan dimulai');
    }

    public function actionRecord($visit): array
    {
        $this->requirePermission('exam.write');
        return $this->ok($this->service->saveRecord((int) $visit, $this->body(), $this->actor()), 'Rekam medis tersimpan');
    }

    public function actionDiagnoses($visit): array
    {
        $this->requirePermission('exam.write');
        $body = $this->body();
        $diagnoses = $body['diagnoses'] ?? $body;
        if (!is_array($diagnoses)) {
            $diagnoses = [];
        }
        return $this->ok($this->service->saveDiagnoses((int) $visit, $diagnoses, $this->actor()), 'Diagnosis tersimpan');
    }

    public function actionFinish($visit): array
    {
        $this->requirePermission('exam.write');
        return $this->ok($this->service->finish((int) $visit, $this->actor()), 'Pemeriksaan selesai');
    }

    public function actionHistory($id): array
    {
        $this->requirePermission('exam.read');
        return $this->ok($this->service->history((int) $id), 'Riwayat pasien');
    }
}
