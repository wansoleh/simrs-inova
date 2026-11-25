<?php

declare(strict_types=1);

namespace app\modules\api\controllers;

use app\services\ApiException;
use app\services\BillingService;
use app\services\PaymentService;
use app\services\PdfService;
use Yii;

class InvoiceController extends BaseApiController
{
    private BillingService $billing;

    public function init(): void
    {
        parent::init();
        $this->billing = new BillingService();
    }

    public function actionIndex(): array
    {
        $this->requirePermission('billing.read');
        [$page, $perPage] = $this->pagination();
        $result = $this->billing->listInvoices([
            'status' => $this->query('status'),
            'q' => $this->query('q'),
            'date_from' => $this->query('date_from'),
            'date_to' => $this->query('date_to'),
        ], $page, $perPage);
        return $this->ok($result['rows'], 'Daftar invoice', 200, $this->meta($result['total'], $page, $perPage));
    }

    public function actionView($id): array
    {
        $this->requirePermission('billing.read');
        return $this->ok($this->billing->invoiceDetail((int) $id), 'Detail invoice');
    }

    public function actionSync($id): array
    {
        $this->requirePermission('billing.read');
        $body = $this->body();
        return $this->ok(
            $this->billing->syncInvoice((int) $id, $this->actor(), $body['reason'] ?? 'Sinkronisasi manual'),
            'Invoice disinkronkan'
        );
    }

    public function actionPay($id): array
    {
        $this->requirePermission('billing.pay');
        $key = (string) Yii::$app->request->headers->get('Idempotency-Key');
        $result = (new PaymentService())->pay((int) $id, $this->body(), $key, $this->actor());
        Yii::$app->response->headers->set('Idempotent-Replay', $result['replay'] ? 'true' : 'false');
        return $this->ok($result, $result['replay'] ? 'Pembayaran sudah tercatat (replay)' : 'Pembayaran berhasil');
    }

    public function actionPayments($id): array
    {
        $this->requirePermission('billing.read');
        return $this->ok((new PaymentService())->listByInvoice((int) $id), 'Riwayat pembayaran');
    }

    public function actionAdjustment($id): array
    {
        $this->requirePermission('billing.pay');
        return $this->ok($this->billing->addAdjustment((int) $id, $this->body(), $this->actor()), 'Penyesuaian invoice tersimpan');
    }

    public function actionPrint($id): string
    {
        $this->requirePermission('billing.read');
        $invoice = $this->billing->invoiceDetail((int) $id);
        $pdf = (new PdfService())->invoice($invoice);
        $response = Yii::$app->response;
        $response->format = \yii\web\Response::FORMAT_RAW;
        $response->headers->set('Content-Type', 'application/pdf');
        $response->headers->set('Content-Disposition', 'inline; filename="invoice-' . $invoice['invoice_no'] . '.pdf"');
        return $pdf;
    }
}
