<?php

use yii\db\Migration;

class m261124_000002_reporting_views extends Migration
{
    public function safeUp(): bool
    {
        $this->db->pdo->exec(<<<'SQL'
CREATE OR REPLACE VIEW reporting.v_visits AS
SELECT v.id,
       v.visit_no,
       v.visit_date,
       v.status,
       v.queue_no,
       v.guarantor_type,
       v.created_at,
       p.id   AS patient_id,
       p.mrn,
       p.name AS patient_name,
       p.gender,
       p.birth_date,
       d.id   AS doctor_id,
       d.name AS doctor_name,
       po.id  AS poli_id,
       po.code AS poli_code,
       po.name AS poli_name,
       i.id   AS invoice_id,
       i.invoice_no,
       i.status AS invoice_status,
       i.total,
       i.paid_total,
       i.revision
FROM visits v
JOIN patients p ON p.id = v.patient_id
JOIN doctors d ON d.id = v.doctor_id
JOIN polis po ON po.id = v.poli_id
LEFT JOIN invoices i ON i.visit_id = v.id;

CREATE OR REPLACE VIEW reporting.v_procedures AS
SELECT vp.id,
       vp.visit_id,
       v.visit_date,
       v.poli_id,
       po.name AS poli_name,
       vp.procedure_id,
       pr.code AS procedure_code,
       pr.name AS procedure_name,
       vp.qty,
       vp.unit_price,
       (vp.qty * vp.unit_price) AS amount,
       vp.status,
       vp.created_at
FROM visit_procedures vp
JOIN visits v ON v.id = vp.visit_id
JOIN polis po ON po.id = v.poli_id
JOIN procedures pr ON pr.id = vp.procedure_id;

CREATE OR REPLACE VIEW reporting.v_revenue AS
SELECT i.id AS invoice_id,
       i.invoice_no,
       v.visit_date,
       po.id AS poli_id,
       po.name AS poli_name,
       i.status,
       i.total,
       i.paid_total,
       (i.total - i.paid_total) AS outstanding,
       i.revision,
       i.created_at
FROM invoices i
JOIN visits v ON v.id = i.visit_id
JOIN polis po ON po.id = v.poli_id
WHERE v.status <> 'CANCELLED';

CREATE OR REPLACE VIEW reporting.v_medicine_usage AS
SELECT m.id AS medicine_id,
       m.code,
       m.name AS medicine_name,
       m.unit,
       COALESCE(SUM(pi.qty), 0) AS qty_prescribed,
       COALESCE(SUM(pi.qty * pi.unit_price), 0) AS revenue
FROM medicines m
LEFT JOIN prescription_items pi ON pi.medicine_id = m.id
LEFT JOIN prescriptions r ON r.id = pi.prescription_id AND r.status = 'DISPENSED'
GROUP BY m.id, m.code, m.name, m.unit;

CREATE OR REPLACE VIEW reporting.v_payment_status AS
SELECT i.status,
       COUNT(*) AS invoice_count,
       COALESCE(SUM(i.total), 0) AS total,
       COALESCE(SUM(i.paid_total), 0) AS paid_total
FROM invoices i
GROUP BY i.status;

CREATE MATERIALIZED VIEW IF NOT EXISTS reporting.mv_daily_summary AS
SELECT v.visit_date,
       v.poli_id,
       count(*) AS visits,
       count(*) FILTER (WHERE v.status = 'PAID') AS paid_visits,
       coalesce(sum(i.total), 0) AS billed,
       coalesce(sum(i.paid_total), 0) AS collected
FROM visits v
LEFT JOIN invoices i ON i.visit_id = v.id
WHERE v.status <> 'CANCELLED'
GROUP BY v.visit_date, v.poli_id;

CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_daily_summary ON reporting.mv_daily_summary (visit_date, poli_id);
SQL);
        $this->execute("REFRESH MATERIALIZED VIEW reporting.mv_daily_summary");
        return true;
    }

    public function safeDown(): bool
    {
        $this->execute("DROP MATERIALIZED VIEW IF EXISTS reporting.mv_daily_summary");
        $this->execute("DROP VIEW IF EXISTS reporting.v_payment_status, reporting.v_medicine_usage, reporting.v_revenue, reporting.v_procedures, reporting.v_visits CASCADE");
        return true;
    }
}
