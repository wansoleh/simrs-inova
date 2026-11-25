<?php

declare(strict_types=1);

namespace app\modules\api\controllers;

class ProcedureController extends MasterController
{
    protected string $table = 'procedures';
    protected array $fields = ['code', 'name', 'price', 'category', 'is_active'];
    protected array $required = ['code', 'name', 'price'];
    protected array $searchFields = ['code', 'name', 'category'];
    protected array $numericFields = ['price'];
    protected array $boolFields = ['is_active'];
}
