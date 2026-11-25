<?php

declare(strict_types=1);

namespace app\modules\api\controllers;

use app\services\PharmacyService;

class MedicineController extends MasterController
{
    protected string $table = 'medicines';
    protected array $fields = ['code', 'name', 'unit', 'price', 'category', 'is_active'];
    protected array $required = ['code', 'name', 'unit', 'price'];
    protected array $searchFields = ['code', 'name', 'category'];
    protected array $numericFields = ['price'];
    protected array $boolFields = ['is_active'];

    public function actionStockAdjust($id): array
    {
        $this->requirePermission('medicine.view');
        $body = $this->body();
        $qty = (int) ($body['qty_change'] ?? 0);
        $reason = (string) ($body['reason'] ?? '');
        $medicine = (new PharmacyService())->stockAdjust((int) $id, $qty, $reason, $this->actor());
        return $this->ok($medicine, 'Stok berhasil disesuaikan');
    }
}
