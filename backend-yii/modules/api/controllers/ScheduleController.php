<?php

declare(strict_types=1);

namespace app\modules\api\controllers;

class ScheduleController extends MasterController
{
    protected string $table = 'doctor_schedules';
    protected array $fields = ['doctor_id', 'poli_id', 'day_of_week', 'start_time', 'end_time', 'quota', 'is_active'];
    protected array $required = ['doctor_id', 'poli_id', 'day_of_week', 'start_time', 'end_time'];
    protected array $searchFields = [];
    protected array $filterable = ['doctor_id', 'poli_id', 'day_of_week'];
    protected array $intFields = ['doctor_id', 'poli_id', 'day_of_week', 'quota'];
    protected array $boolFields = ['is_active'];
    protected array $selectColumns = ['t.*', 'd.name AS doctor_name', 'po.name AS poli_name'];
    protected array $joins = [
        'JOIN doctors d ON d.id = t.doctor_id',
        'JOIN polis po ON po.id = t.poli_id',
    ];
    protected string $orderBy = 't.day_of_week ASC, t.start_time ASC';
}
