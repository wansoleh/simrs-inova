<?php

declare(strict_types=1);

namespace app\modules\api\controllers;

class PoliController extends MasterController
{
    protected string $table = 'polis';
    protected array $fields = ['code', 'name', 'registration_fee', 'description', 'is_active'];
    protected array $required = ['code', 'name', 'registration_fee'];
    protected array $searchFields = ['code', 'name'];
    protected array $numericFields = ['registration_fee'];
    protected array $boolFields = ['is_active'];
}
