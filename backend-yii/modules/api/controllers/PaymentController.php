<?php

declare(strict_types=1);

namespace app\modules\api\controllers;

use app\services\ApiException;
use app\services\BillingService;
use app\services\PdfService;
use Yii;

class PaymentController extends BaseApiController
{
    public function actionReceipt($id): string
    {
        $this->requirePermission('billing.read');
        $payment = Yii::$app->db->createCommand('SELECT * FROM payments WHERE id = :id', [':id' => (int) $id])->queryOne();
        if (!$payment) {
            throw ApiException::notFound('Pembayaran tidak ditemukan');
        }
        $invoice = (new BillingService())->invoiceDetail((int) $payment['invoice_id']);
        $pdf = (new PdfService())->receipt($invoice, $payment);
        $response = Yii::$app->response;
        $response->format = \yii\web\Response::FORMAT_RAW;
        $response->headers->set('Content-Type', 'application/pdf');
        $response->headers->set('Content-Disposition', 'inline; filename="kwitansi-' . $payment['payment_no'] . '.pdf"');
        return $pdf;
    }
}
