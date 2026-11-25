<?php

declare(strict_types=1);

namespace app\modules\api\controllers;

use app\services\ApiException;
use app\services\AuditService;
use Yii;

abstract class MasterController extends BaseApiController
{
    protected string $table = '';
    protected array $fields = [];
    protected array $required = [];
    protected array $searchFields = [];
    protected array $filterable = [];
    protected array $intFields = [];
    protected array $boolFields = [];
    protected array $numericFields = [];
    protected string $orderBy = 't.id DESC';
    protected string $viewPermission = 'master.view';
    protected string $managePermission = 'master.manage';
    protected bool $hasActive = true;
    protected array $selectColumns = ['t.*'];
    protected array $joins = [];

    public function actionIndex(): array
    {
        $this->requirePermission($this->viewPermission);
        [$page, $perPage] = $this->pagination();
        $params = [];
        $where = ['1=1'];

        $q = trim((string) $this->query('q', ''));
        if ($q !== '' && $this->searchFields) {
            $parts = [];
            foreach ($this->searchFields as $i => $field) {
                $key = ':q' . $i;
                $parts[] = "t.{$field} ILIKE {$key}";
                $params[$key] = '%' . $q . '%';
            }
            $where[] = '(' . implode(' OR ', $parts) . ')';
        }
        if ($this->hasActive && $this->query('is_active', null) !== null && $this->query('is_active') !== '') {
            $where[] = 't.is_active = :active';
            $params[':active'] = $this->toBool($this->query('is_active'));
        }
        foreach ($this->filterable as $field) {
            $value = $this->query('filter')[$field] ?? null;
            if ($value !== null && $value !== '') {
                $where[] = "t.{$field} = :f_{$field}";
                $params[':f_' . $field] = $value;
            }
        }

        $whereSql = implode(' AND ', $where);
        $from = $this->table . ' t ' . implode(' ', $this->joins);
        $db = Yii::$app->db;
        $total = (int) $db->createCommand("SELECT count(*) FROM {$from} WHERE {$whereSql}", $params)->queryScalar();
        $order = $this->resolveOrder();
        $rows = $db->createCommand(
            "SELECT " . implode(', ', $this->selectColumns) . " FROM {$from} WHERE {$whereSql} ORDER BY {$order} LIMIT :limit OFFSET :offset",
            $params + [':limit' => $perPage, ':offset' => ($page - 1) * $perPage]
        )->queryAll();

        return $this->ok($rows, 'Daftar ' . $this->table, 200, $this->meta($total, $page, $perPage));
    }

    public function actionView($id): array
    {
        $this->requirePermission($this->viewPermission);
        $row = $this->findRow((int) $id);
        return $this->ok($row, 'Detail ' . $this->table);
    }

    public function actionCreate(): array
    {
        $this->requirePermission($this->managePermission);
        $data = $this->prepareData($this->body(), false);
        foreach ($this->required as $field) {
            if (!isset($data[$field]) || $data[$field] === '' || $data[$field] === null) {
                throw ApiException::unprocessable("Field {$field} wajib diisi", [
                    ['field' => $field, 'code' => 'REQUIRED', 'message' => 'Wajib diisi'],
                ]);
            }
        }
        $columns = array_keys($data);
        $placeholders = array_map(fn ($c) => ':' . $c, $columns);
        $params = [];
        foreach ($data as $key => $value) {
            $params[':' . $key] = $value;
        }
        $sql = sprintf(
            'INSERT INTO %s (%s) VALUES (%s) RETURNING *',
            $this->table,
            implode(', ', $columns),
            implode(', ', $placeholders)
        );
        $row = Yii::$app->db->createCommand($sql, $params)->queryOne();
        $this->afterChange($row, $data, null, 'CREATE');
        return $this->created($row, 'Data berhasil dibuat');
    }

    public function actionUpdate($id): array
    {
        $this->requirePermission($this->managePermission);
        $old = $this->findRow((int) $id);
        $data = $this->prepareData($this->body(), true, $old);
        if (!$data) {
            throw ApiException::unprocessable('Tidak ada field yang diperbarui');
        }
        $sets = [];
        $params = [':id' => (int) $id];
        foreach ($data as $key => $value) {
            $sets[] = "{$key} = :{$key}";
            $params[':' . $key] = $value;
        }
        if ($this->hasActive && !array_key_exists('is_active', $data)) {
            $sets[] = 'updated_at = now()';
        }
        $row = Yii::$app->db->createCommand(
            sprintf('UPDATE %s SET %s WHERE id = :id RETURNING *', $this->table, implode(', ', $sets)),
            $params
        )->queryOne();
        $this->afterChange($row, $data, $old, 'UPDATE');
        return $this->ok($row, 'Data berhasil diperbarui');
    }

    public function actionDelete($id): array
    {
        $this->requirePermission($this->managePermission);
        $old = $this->findRow((int) $id);
        if (!$this->hasActive) {
            throw ApiException::unprocessable('Data ini tidak mendukung penghapusan. Gunakan pembaruan data.');
        }
        $row = Yii::$app->db->createCommand(
            'UPDATE ' . $this->table . ' SET is_active = false, updated_at = now() WHERE id = :id RETURNING *',
            [':id' => (int) $id]
        )->queryOne();
        $this->afterChange($row, ['is_active' => false], $old, 'DEACTIVATE');
        return $this->ok($row, 'Data dinonaktifkan');
    }

    protected function findRow(int $id): array
    {
        $row = Yii::$app->db->createCommand(
            'SELECT t.* FROM ' . $this->table . ' t ' . implode(' ', $this->joins) . ' WHERE t.id = :id',
            [':id' => $id]
        )->queryOne();
        if (!$row) {
            throw ApiException::notFound('Data tidak ditemukan');
        }
        return $row;
    }

    protected function prepareData(array $data, bool $isUpdate, ?array $existing = null): array
    {
        $out = [];
        foreach ($this->fields as $field) {
            if (!array_key_exists($field, $data)) {
                continue;
            }
            $value = $data[$field];
            if (is_string($value)) {
                $value = trim($value);
            }
            if ($value === '') {
                $value = null;
            }
            if ($value !== null && in_array($field, $this->intFields, true)) {
                $value = (int) $value;
            }
            if ($value !== null && in_array($field, $this->numericFields, true)) {
                $value = (float) $value;
            }
            if ($value !== null && in_array($field, $this->boolFields, true)) {
                $value = $this->toBool($value);
            }
            $out[$field] = $value;
        }
        if ($isUpdate && !$out) {
            return [];
        }
        return $out;
    }

    protected function afterChange(array $row, array $data, ?array $old, string $action): void
    {
        AuditService::log($this->table, (int) $row['id'], $action, $old, $data, $this->actor()['id']);
    }

    protected function resolveOrder(): string
    {
        $sort = (string) $this->query('sort', '');
        if ($sort === '') {
            return $this->orderBy;
        }
        $direction = 'ASC';
        if (str_starts_with($sort, '-')) {
            $direction = 'DESC';
            $sort = substr($sort, 1);
        }
        if (!in_array($sort, $this->fields, true) && $sort !== 'id') {
            return $this->orderBy;
        }
        return 't.' . $sort . ' ' . $direction;
    }

    protected function toBool($value): bool
    {
        if (is_bool($value)) {
            return $value;
        }
        return in_array(strtolower((string) $value), ['1', 'true', 'yes', 'ya'], true);
    }
}
