<?php

declare(strict_types=1);

namespace app\modules\api\controllers;

class DoctorController extends MasterController
{
    protected string $table = 'doctors';
    protected array $fields = ['str_no', 'name', 'specialization', 'phone', 'is_active'];
    protected array $required = ['str_no', 'name'];
    protected array $searchFields = ['str_no', 'name', 'specialization'];
    protected array $boolFields = ['is_active'];
}
