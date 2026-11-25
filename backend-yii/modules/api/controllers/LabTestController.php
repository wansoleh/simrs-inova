<?php

declare(strict_types=1);

namespace app\modules\api\controllers;

class LabTestController extends MasterController
{
    protected string $table = 'lab_tests';
    protected array $fields = ['code', 'name', 'unit', 'ref_range', 'price', 'category', 'is_active'];
    protected array $required = ['code', 'name', 'price'];
    protected array $searchFields = ['code', 'name', 'category'];
    protected array $numericFields = ['price'];
    protected array $boolFields = ['is_active'];
}
