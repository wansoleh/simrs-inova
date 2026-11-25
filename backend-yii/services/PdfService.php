<?php

declare(strict_types=1);

namespace app\services;

use Dompdf\Dompdf;
use Dompdf\Options;

class PdfService
{
    public function invoice(array $invoice): string
    {
        $rows = '';
        foreach ($invoice['items'] as $item) {
            if ($item['status'] !== 'ACTIVE') {
                continue;
            }
            $rows .= '<tr>'
                . '<td>' . $this->e($item['description']) . '</td>'
                . '<td class="center">' . $this->e((string) $item['qty']) . '</td>'
                . '<td class="right">' . $this->money($item['unit_price']) . '</td>'
                . '<td class="right">' . $this->money($item['amount']) . '</td>'
                . '</tr>';
        }
        $html = '<!doctype html><html><head><meta charset="utf-8"><style>'
            . $this->css()
            . '</style></head><body>'
            . $this->header('INVOICE', $invoice['invoice_no'])
            . '<div class="meta">'
            . '<div><strong>Pasien</strong><br>' . $this->e($invoice['patient_name']) . ' (' . $this->e($invoice['mrn']) . ')<br>'
            . $this->e((string) $invoice['phone']) . '</div>'
            . '<div><strong>Kunjungan</strong><br>' . $this->e($invoice['visit_no']) . '<br>'
            . $this->date($invoice['visit_date']) . '</div>'
            . '<div><strong>Dokter / Poli</strong><br>' . $this->e($invoice['doctor_name']) . '<br>' . $this->e($invoice['poli_name']) . '</div>'
            . '<div><strong>Status</strong><br><span class="badge">' . $this->e($invoice['status']) . '</span><br>Revisi ' . (int) $invoice['revision'] . '</div>'
            . '</div>'
            . '<table><thead><tr><th>Uraian</th><th class="center">Qty</th><th class="right">Harga</th><th class="right">Jumlah</th></tr></thead><tbody>'
            . $rows
            . '</tbody></table>'
            . '<div class="totals">'
            . '<div><span>Total</span><strong>' . $this->money($invoice['total']) . '</strong></div>'
            . '<div><span>Dibayar</span><strong>' . $this->money($invoice['paid_total']) . '</strong></div>'
            . '<div><span>Sisa</span><strong>' . $this->money((float) $invoice['total'] - (float) $invoice['paid_total']) . '</strong></div>'
            . '</div>'
            . $this->footer()
            . '</body></html>';
        return $this->render($html);
    }

    public function receipt(array $invoice, array $payment): string
    {
        $html = '<!doctype html><html><head><meta charset="utf-8"><style>'
            . $this->css()
            . '</style></head><body>'
            . $this->header('KWITANSI PEMBAYARAN', $payment['payment_no'])
            . '<div class="meta">'
            . '<div><strong>Pasien</strong><br>' . $this->e($invoice['patient_name']) . ' (' . $this->e($invoice['mrn']) . ')</div>'
            . '<div><strong>Invoice</strong><br>' . $this->e($invoice['invoice_no']) . '</div>'
            . '<div><strong>Metode</strong><br>' . $this->e($payment['method']) . '</div>'
            . '<div><strong>Waktu</strong><br>' . $this->dateTime($payment['paid_at']) . '</div>'
            . '</div>'
            . '<div class="receipt-amount"><span>Jumlah dibayar</span><strong>' . $this->money($payment['amount']) . '</strong></div>'
            . '<div class="totals">'
            . '<div><span>Total tagihan</span><strong>' . $this->money($invoice['total']) . '</strong></div>'
            . '<div><span>Total dibayar</span><strong>' . $this->money($invoice['paid_total']) . '</strong></div>'
            . '<div><span>Status</span><strong>' . $this->e($invoice['status']) . '</strong></div>'
            . '</div>'
            . $this->footer()
            . '</body></html>';
        return $this->render($html);
    }

    private function render(string $html): string
    {
        $options = new Options();
        $options->set('isRemoteEnabled', false);
        $options->set('defaultFont', 'DejaVu Sans');
        $dompdf = new Dompdf($options);
        $dompdf->loadHtml($html, 'UTF-8');
        $dompdf->setPaper('A4', 'portrait');
        $dompdf->render();
        return (string) $dompdf->output();
    }

    private function header(string $title, string $number): string
    {
        return '<div class="header"><div class="brand"><div class="logo">+</div><div>'
            . '<h1>SIMRS Inova</h1><p>Rawat Jalan Terintegrasi</p></div></div>'
            . '<div class="doc"><h2>' . $this->e($title) . '</h2><p>' . $this->e($number) . '</p></div></div>';
    }

    private function footer(): string
    {
        return '<div class="footer">Dokumen dibuat otomatis oleh SIMRS Inova. Terima kasih atas kepercayaan Anda.'
            . '<br>Jl. Kesehatan No. 1, Jakarta · (021) 5000-1234 · halo@simrs-inova.id</div>';
    }

    private function css(): string
    {
        return 'body{font-family:"DejaVu Sans",sans-serif;color:#1f2937;font-size:12px;margin:24px}'
            . '.header{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #0d9488;padding-bottom:14px;margin-bottom:18px}'
            . '.brand{display:flex;gap:10px;align-items:center}.logo{width:38px;height:38px;border-radius:10px;background:#0d9488;color:#fff;font-size:26px;text-align:center;line-height:38px;font-weight:bold}'
            . 'h1{margin:0;font-size:20px;color:#0f766e}h2{margin:0;font-size:16px}p{margin:2px 0;color:#64748b}'
            . '.doc{text-align:right}.meta{display:flex;gap:18px;margin-bottom:18px}.meta>div{flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px;line-height:1.6}'
            . 'table{width:100%;border-collapse:collapse;margin-bottom:16px}th{background:#0f766e;color:#fff;text-align:left;padding:8px;font-size:11px}'
            . 'td{border-bottom:1px solid #e2e8f0;padding:8px}.center{text-align:center}.right{text-align:right}'
            . '.totals{margin-left:auto;width:45%}.totals>div{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px dashed #cbd5e1}'
            . '.receipt-amount{background:#ecfdf5;border:1px solid #99f6e4;border-radius:10px;padding:16px;display:flex;justify-content:space-between;font-size:16px;margin-bottom:16px}'
            . '.badge{display:inline-block;background:#0f766e;color:#fff;border-radius:20px;padding:2px 10px;font-size:10px}'
            . '.footer{margin-top:26px;padding-top:10px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:10px;text-align:center}';
    }

    private function money($value): string
    {
        return 'Rp ' . number_format((float) $value, 2, ',', '.');
    }

    private function date($value): string
    {
        return $value ? date('d/m/Y', strtotime((string) $value)) : '-';
    }

    private function dateTime($value): string
    {
        return $value ? date('d/m/Y H:i', strtotime((string) $value)) : '-';
    }

    private function e($value): string
    {
        return htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8');
    }
}
