<?php

declare(strict_types=1);

namespace app\modules\api\controllers;

use Yii;

class PatientController extends MasterController
{
    protected string $table = 'patients';
    protected array $fields = ['mrn', 'nik', 'name', 'birth_date', 'gender', 'phone', 'address', 'blood_type', 'allergy'];
    protected array $required = ['name', 'birth_date', 'gender'];
    protected array $searchFields = ['mrn', 'nik', 'name', 'phone'];
    protected string $managePermission = 'patient.manage';
    protected bool $hasActive = false;

    public function actionSearch(): array
    {
        $this->requirePermission('master.view');
        $q = trim((string) $this->query('q', ''));
        $params = [];
        $where = '1=1';
        if ($q !== '') {
            $where = '(name ILIKE :q OR mrn ILIKE :q OR nik ILIKE :q OR phone ILIKE :q)';
            $params[':q'] = '%' . $q . '%';
        }
        $rows = Yii::$app->db->createCommand(
            "SELECT p.*, (SELECT count(*) FROM visits v WHERE v.patient_id = p.id) AS visit_count,
                    (SELECT max(v.visit_date) FROM visits v WHERE v.patient_id = p.id) AS last_visit
             FROM patients p WHERE {$where} ORDER BY name LIMIT 30",
            $params
        )->queryAll();
        return $this->ok($rows, 'Hasil pencarian pasien');
    }

    protected function prepareData(array $data, bool $isUpdate, ?array $existing = null): array
    {
        if (isset($data['gender'])) {
            $data['gender'] = strtoupper((string) $data['gender']);
        }
        if (isset($data['blood_type'])) {
            $data['blood_type'] = strtoupper((string) $data['blood_type']);
        }
        $out = parent::prepareData($data, $isUpdate, $existing);
        if (isset($out['mrn']) && $out['mrn'] === null) {
            unset($out['mrn']);
        }
        return $out;
    }
}
