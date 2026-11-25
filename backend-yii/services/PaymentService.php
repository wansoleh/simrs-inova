<?php

declare(strict_types=1);

namespace app\services;

use Yii;

class PaymentService
{
    private BillingService $billing;

    public function __construct(?BillingService $billing = null)
    {
        $this->billing = $billing ?: new BillingService();
    }

    public function pay(int $invoiceId, array $data, string $idempotencyKey, array $actor): array
    {
        if (!preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $idempotencyKey)) {
            throw ApiException::unprocessable('Header Idempotency-Key wajib berupa UUID');
        }
        $method = strtoupper((string) ($data['method'] ?? 'CASH'));
        if (!in_array($method, ['CASH', 'QRIS', 'TRANSFER', 'CARD'], true)) {
            throw ApiException::unprocessable('Metode pembayaran tidak valid');
        }
        $amount = round((float) ($data['amount'] ?? 0), 2);
        if ($amount <= 0) {
            throw ApiException::unprocessable('Nominal pembayaran harus lebih dari nol');
        }
        $hash = hash('sha256', json_encode([$invoiceId, $method, number_format($amount, 2, '.', '')]));

        try {
            return Yii::$app->db->transaction(function ($db) use ($invoiceId, $method, $amount, $idempotencyKey, $hash, $actor) {
                $invoice = $db->createCommand('SELECT * FROM invoices WHERE id = :id FOR UPDATE', [':id' => $invoiceId])->queryOne();
                if (!$invoice) {
                    throw ApiException::notFound('Invoice tidak ditemukan');
                }
                $existing = $db->createCommand('SELECT * FROM payments WHERE idempotency_key = :k', [':k' => $idempotencyKey])->queryOne();
                if ($existing) {
                    if ($existing['request_hash'] !== $hash) {
                        throw ApiException::unprocessable('Idempotency-Key sudah dipakai untuk payload yang berbeda');
                    }
                    return [
                        'payment' => $existing,
                        'invoice' => $this->billing->invoiceDetail($invoiceId),
                        'replay' => true,
                    ];
                }

                $remaining = round((float) $invoice['total'] - (float) $invoice['paid_total'], 2);
                if ($amount > $remaining + 0.001) {
                    throw ApiException::unprocessable(
                        'Nominal melebihi sisa tagihan',
                        [['field' => 'amount', 'code' => 'OVERPAYMENT', 'message' => 'Sisa tagihan ' . number_format($remaining, 2, ',', '.')]]
                    );
                }

                $paymentNo = $db->createCommand(
                    "SELECT 'PAY' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('payment_no_seq')::text, 4, '0')"
                )->queryScalar();
                $payment = $db->createCommand(
                    'INSERT INTO payments (payment_no, invoice_id, method, amount, idempotency_key, request_hash, cashier_id)
                     VALUES (:no, :inv, :m, :a, :k, :h, :by) RETURNING *',
                    [
                        ':no' => $paymentNo,
                        ':inv' => $invoiceId,
                        ':m' => $method,
                        ':a' => $amount,
                        ':k' => $idempotencyKey,
                        ':h' => $hash,
                        ':by' => $actor['id'] ?? null,
                    ]
                )->queryOne();

                $paid = round((float) $invoice['paid_total'] + $amount, 2);
                $total = (float) $invoice['total'];
                $status = $paid >= $total ? 'PAID' : 'PARTIAL';
                $db->createCommand(
                    'UPDATE invoices SET paid_total = :p, status = :s, refund_due = 0, updated_at = now() WHERE id = :id',
                    [':p' => $paid, ':s' => $status, ':id' => $invoiceId]
                )->execute();

                if ($status === 'PAID') {
                    $db->createCommand(
                        "UPDATE visits SET status = 'PAID', updated_at = now() WHERE id = :v AND status <> 'CANCELLED'",
                        [':v' => $invoice['visit_id']]
                    )->execute();
                } else {
                    $db->createCommand(
                        "UPDATE visits SET status = 'BILLING', updated_at = now() WHERE id = :v AND status IN ('EXAM_DONE','BILLING')",
                        [':v' => $invoice['visit_id']]
                    )->execute();
                }

                AuditService::log('payments', (int) $payment['id'], 'CREATE', null, $payment, $actor['id'] ?? null);
                return [
                    'payment' => $payment,
                    'invoice' => $this->billing->invoiceDetail($invoiceId),
                    'replay' => false,
                ];
            });
        } catch (\yii\db\IntegrityException $e) {
            if (str_contains($e->getMessage(), '23505')) {
                $existing = Yii::$app->db->createCommand('SELECT * FROM payments WHERE idempotency_key = :k', [':k' => $idempotencyKey])->queryOne();
                if ($existing) {
                    if ($existing['request_hash'] !== $hash) {
                        throw ApiException::unprocessable('Idempotency-Key sudah dipakai untuk payload yang berbeda');
                    }
                    return [
                        'payment' => $existing,
                        'invoice' => $this->billing->invoiceDetail((int) $existing['invoice_id']),
                        'replay' => true,
                    ];
                }
            }
            throw $e;
        }
    }

    public function listByInvoice(int $invoiceId): array
    {
        return Yii::$app->db->createCommand(
            'SELECT p.*, u.full_name AS cashier_name FROM payments p LEFT JOIN users u ON u.id = p.cashier_id
             WHERE p.invoice_id = :id ORDER BY p.paid_at',
            [':id' => $invoiceId]
        )->queryAll();
    }
}
