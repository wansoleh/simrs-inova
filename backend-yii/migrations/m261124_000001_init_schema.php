<?php

use yii\db\Migration;

/**
 * Skema inti SIMRS Rawat Jalan.
 * Tiga schema: public (data inti), integration (outbox/inbox), reporting (view dashboard).
 */
class m261124_000001_init_schema extends Migration
{
    public function safeUp(): bool
    {
        $this->execute("CREATE SCHEMA IF NOT EXISTS integration");
        $this->execute("CREATE SCHEMA IF NOT EXISTS reporting");
        $this->execute("CREATE EXTENSION IF NOT EXISTS pg_trgm");

        $this->execute("CREATE SEQUENCE IF NOT EXISTS mrn_seq START 1");
        $this->execute("CREATE SEQUENCE IF NOT EXISTS visit_no_seq START 1");
        $this->execute("CREATE SEQUENCE IF NOT EXISTS invoice_no_seq START 1");
        $this->execute("CREATE SEQUENCE IF NOT EXISTS payment_no_seq START 1");
        $this->execute("CREATE SEQUENCE IF NOT EXISTS prescription_no_seq START 1");
        $this->execute("CREATE SEQUENCE IF NOT EXISTS lab_order_no_seq START 1");

        $this->db->pdo->exec(<<<'SQL'
CREATE TABLE IF NOT EXISTS users (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username varchar(50) NOT NULL UNIQUE,
    password_hash varchar(255) NOT NULL,
    full_name varchar(150) NOT NULL,
    role varchar(20) NOT NULL CHECK (role IN ('admin','pendaftaran','dokter','farmasi','lab','kasir')),
    is_active boolean NOT NULL DEFAULT true,
    last_login_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS patients (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    mrn varchar(20) NOT NULL UNIQUE DEFAULT ('RM-' || lpad(nextval('mrn_seq')::text, 6, '0')),
    nik varchar(16),
    name varchar(150) NOT NULL,
    birth_date date NOT NULL,
    gender char(1) NOT NULL CHECK (gender IN ('L','P')),
    phone varchar(20),
    address text,
    blood_type varchar(3),
    allergy text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_patients_nik ON patients (nik) WHERE nik IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_patients_name_trgm ON patients USING gin (name gin_trgm_ops);

CREATE TABLE IF NOT EXISTS doctors (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    str_no varchar(30) NOT NULL UNIQUE,
    name varchar(150) NOT NULL,
    specialization varchar(100),
    phone varchar(20),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS polis (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code varchar(20) NOT NULL UNIQUE,
    name varchar(100) NOT NULL,
    registration_fee numeric(14,2) NOT NULL DEFAULT 0 CHECK (registration_fee >= 0),
    description text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS doctor_schedules (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    doctor_id bigint NOT NULL REFERENCES doctors(id),
    poli_id bigint NOT NULL REFERENCES polis(id),
    day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time time NOT NULL,
    end_time time NOT NULL,
    quota integer NOT NULL DEFAULT 20 CHECK (quota > 0),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ux_schedule UNIQUE (doctor_id, poli_id, day_of_week, start_time),
    CONSTRAINT chk_schedule_time CHECK (end_time > start_time)
);

CREATE TABLE IF NOT EXISTS procedures (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code varchar(30) NOT NULL UNIQUE,
    name varchar(150) NOT NULL,
    price numeric(14,2) NOT NULL CHECK (price >= 0),
    category varchar(50),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS medicines (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code varchar(30) NOT NULL UNIQUE,
    name varchar(150) NOT NULL,
    unit varchar(20) NOT NULL,
    price numeric(14,2) NOT NULL CHECK (price >= 0),
    stock integer NOT NULL DEFAULT 0,
    category varchar(50),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_medicines_stock CHECK (stock >= 0)
);

CREATE TABLE IF NOT EXISTS stock_movements (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    medicine_id bigint NOT NULL REFERENCES medicines(id),
    qty_change integer NOT NULL,
    stock_after integer NOT NULL,
    ref_type varchar(20) NOT NULL,
    ref_id bigint,
    reason text,
    created_by bigint,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_stock_med ON stock_movements (medicine_id, created_at DESC);

CREATE TABLE IF NOT EXISTS lab_tests (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code varchar(30) NOT NULL UNIQUE,
    name varchar(150) NOT NULL,
    unit varchar(30),
    ref_range varchar(100),
    price numeric(14,2) NOT NULL CHECK (price >= 0),
    category varchar(50),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS visits (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    visit_no varchar(30) NOT NULL UNIQUE,
    patient_id bigint NOT NULL REFERENCES patients(id),
    doctor_id bigint NOT NULL REFERENCES doctors(id),
    poli_id bigint NOT NULL REFERENCES polis(id),
    visit_date date NOT NULL,
    queue_no integer NOT NULL,
    guarantor_type varchar(10) NOT NULL DEFAULT 'UMUM' CHECK (guarantor_type IN ('UMUM','BPJS','ASURANSI')),
    status varchar(12) NOT NULL DEFAULT 'REGISTERED'
        CHECK (status IN ('REGISTERED','WAITING','IN_EXAM','EXAM_DONE','BILLING','PAID','CANCELLED')),
    complaint text,
    cancel_reason text,
    created_by bigint,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ux_visit_queue UNIQUE (doctor_id, visit_date, queue_no)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_visit_patient_doctor_day ON visits (patient_id, doctor_id, visit_date)
    WHERE status <> 'CANCELLED';
CREATE INDEX IF NOT EXISTS ix_visits_date_poli ON visits (visit_date, poli_id, status);
CREATE INDEX IF NOT EXISTS ix_visits_patient ON visits (patient_id, visit_date DESC);
CREATE INDEX IF NOT EXISTS ix_visits_doctor_q ON visits (doctor_id, visit_date, status);

CREATE TABLE IF NOT EXISTS queue_counters (
    doctor_id bigint NOT NULL,
    visit_date date NOT NULL,
    last_no integer NOT NULL,
    PRIMARY KEY (doctor_id, visit_date)
);

CREATE TABLE IF NOT EXISTS medical_records (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    visit_id bigint NOT NULL UNIQUE REFERENCES visits(id),
    anamnesis text,
    blood_pressure varchar(20),
    temperature numeric(4,1),
    pulse integer,
    respiration integer,
    weight numeric(5,1),
    height numeric(5,1),
    physical_exam text,
    notes text,
    revision integer NOT NULL DEFAULT 1,
    created_by bigint,
    updated_by bigint,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS diagnoses (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    visit_id bigint NOT NULL REFERENCES visits(id),
    medical_record_id bigint REFERENCES medical_records(id),
    icd10_code varchar(10) NOT NULL,
    name varchar(200) NOT NULL,
    type char(1) NOT NULL CHECK (type IN ('P','S')),
    notes text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_diagnosis_primary ON diagnoses (visit_id) WHERE type = 'P' AND is_active;

CREATE TABLE IF NOT EXISTS medical_record_revisions (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    medical_record_id bigint NOT NULL REFERENCES medical_records(id),
    visit_id bigint NOT NULL REFERENCES visits(id),
    revision integer NOT NULL,
    snapshot jsonb NOT NULL,
    reason text,
    created_by bigint,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS visit_procedures (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    visit_id bigint NOT NULL REFERENCES visits(id),
    procedure_id bigint NOT NULL REFERENCES procedures(id),
    qty integer NOT NULL DEFAULT 1 CHECK (qty > 0),
    unit_price numeric(14,2) NOT NULL CHECK (unit_price >= 0),
    status varchar(10) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','VOID')),
    void_reason text,
    created_by bigint,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_vproc_visit ON visit_procedures (visit_id) WHERE status = 'ACTIVE';

CREATE TABLE IF NOT EXISTS prescriptions (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    prescription_no varchar(30) NOT NULL UNIQUE,
    visit_id bigint NOT NULL REFERENCES visits(id),
    status varchar(12) NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT','SUBMITTED','PROCESSING','DISPENSED','CANCELLED')),
    notes text,
    created_by bigint,
    processed_by bigint,
    dispensed_by bigint,
    submitted_at timestamptz,
    processed_at timestamptz,
    dispensed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_rx_visit ON prescriptions (visit_id);
CREATE INDEX IF NOT EXISTS ix_rx_status ON prescriptions (status);

CREATE TABLE IF NOT EXISTS prescription_items (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    prescription_id bigint NOT NULL REFERENCES prescriptions(id),
    medicine_id bigint NOT NULL REFERENCES medicines(id),
    dose varchar(50),
    frequency varchar(50),
    qty integer NOT NULL CHECK (qty > 0),
    unit_price numeric(14,2) NOT NULL CHECK (unit_price >= 0),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_rxitem_rx ON prescription_items (prescription_id);

CREATE TABLE IF NOT EXISTS dispensings (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    prescription_id bigint NOT NULL REFERENCES prescriptions(id),
    dispensed_by bigint,
    dispensed_at timestamptz NOT NULL DEFAULT now(),
    notes text
);

CREATE TABLE IF NOT EXISTS lab_orders (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_no varchar(30) NOT NULL UNIQUE,
    visit_id bigint NOT NULL REFERENCES visits(id),
    status varchar(15) NOT NULL DEFAULT 'ORDERED'
        CHECK (status IN ('ORDERED','RESULT_PARTIAL','DONE','CANCELLED')),
    ordered_by bigint,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_laborder_visit ON lab_orders (visit_id);

CREATE TABLE IF NOT EXISTS lab_order_items (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    lab_order_id bigint NOT NULL REFERENCES lab_orders(id),
    lab_test_id bigint NOT NULL REFERENCES lab_tests(id),
    unit_price numeric(14,2) NOT NULL CHECK (unit_price >= 0),
    status varchar(15) NOT NULL DEFAULT 'ORDERED' CHECK (status IN ('ORDERED','DONE','CANCELLED')),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lab_results (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    lab_order_item_id bigint NOT NULL REFERENCES lab_order_items(id),
    external_ref varchar(100) NOT NULL UNIQUE,
    result_value text,
    unit varchar(30),
    ref_range varchar(100),
    flag varchar(10),
    verified_by bigint,
    verified_at timestamptz NOT NULL DEFAULT now(),
    notes text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoices (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    invoice_no varchar(30) NOT NULL UNIQUE,
    visit_id bigint NOT NULL UNIQUE REFERENCES visits(id),
    status varchar(10) NOT NULL DEFAULT 'UNPAID' CHECK (status IN ('UNPAID','PARTIAL','PAID')),
    total numeric(14,2) NOT NULL DEFAULT 0,
    paid_total numeric(14,2) NOT NULL DEFAULT 0,
    refund_due numeric(14,2) NOT NULL DEFAULT 0,
    revision integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoice_items (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    invoice_id bigint NOT NULL REFERENCES invoices(id),
    ref_type varchar(20) NOT NULL,
    ref_id bigint NOT NULL,
    description varchar(200) NOT NULL,
    qty numeric(12,2) NOT NULL DEFAULT 1 CHECK (qty > 0),
    unit_price numeric(14,2) NOT NULL CHECK (unit_price >= 0),
    amount numeric(14,2) NOT NULL,
    status varchar(10) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','VOID')),
    void_reason text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_invoice_item_ref ON invoice_items (invoice_id, ref_type, ref_id) WHERE status = 'ACTIVE';

CREATE TABLE IF NOT EXISTS invoice_revisions (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    invoice_id bigint NOT NULL REFERENCES invoices(id),
    revision integer NOT NULL,
    snapshot jsonb NOT NULL,
    reason text,
    created_by bigint,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payments (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    payment_no varchar(30) NOT NULL UNIQUE,
    invoice_id bigint NOT NULL REFERENCES invoices(id),
    method varchar(12) NOT NULL CHECK (method IN ('CASH','QRIS','TRANSFER','CARD')),
    amount numeric(14,2) NOT NULL CHECK (amount > 0),
    idempotency_key uuid NOT NULL,
    request_hash char(64) NOT NULL,
    paid_at timestamptz NOT NULL DEFAULT now(),
    cashier_id bigint NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ux_payments_idem UNIQUE (idempotency_key)
);
CREATE INDEX IF NOT EXISTS ix_payments_paid_at ON payments (paid_at);
CREATE INDEX IF NOT EXISTS ix_payments_invoice ON payments (invoice_id);

CREATE TABLE IF NOT EXISTS audit_logs (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    table_name varchar(60) NOT NULL,
    record_id bigint,
    action varchar(20) NOT NULL,
    old_data jsonb,
    new_data jsonb,
    user_id bigint,
    ip varchar(45),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_audit_record ON audit_logs (table_name, record_id, created_at DESC);

CREATE TABLE IF NOT EXISTS integration.outbox (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    aggregate_type text NOT NULL,
    aggregate_id bigint NOT NULL,
    event_type text NOT NULL,
    payload jsonb NOT NULL,
    idempotency_key uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    status text NOT NULL DEFAULT 'PENDING',
    attempts int NOT NULL DEFAULT 0,
    next_retry_at timestamptz NOT NULL DEFAULT now(),
    last_error text,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_outbox_pending ON integration.outbox (next_retry_at) WHERE status IN ('PENDING','FAILED');

CREATE TABLE IF NOT EXISTS integration.inbox (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    source text NOT NULL,
    external_ref varchar(100) NOT NULL UNIQUE,
    payload jsonb NOT NULL,
    status text NOT NULL DEFAULT 'RECEIVED',
    attempts int NOT NULL DEFAULT 0,
    last_error text,
    created_at timestamptz NOT NULL DEFAULT now(),
    processed_at timestamptz
);

CREATE TABLE IF NOT EXISTS integration.api_log (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    request_id varchar(64),
    method varchar(10),
    path text,
    status int,
    duration_ms int,
    user_id bigint,
    ip varchar(45),
    created_at timestamptz NOT NULL DEFAULT now()
);
SQL);
        return true;
    }

    public function safeDown(): bool
    {
        $this->execute("DROP SCHEMA IF EXISTS integration CASCADE");
        $this->execute("DROP SCHEMA IF EXISTS reporting CASCADE");
        $this->db->pdo->exec(<<<'SQL'
DROP TABLE IF EXISTS payments, invoice_revisions, invoice_items, invoices,
    lab_results, lab_order_items, lab_orders, dispensings, prescription_items, prescriptions,
    visit_procedures, medical_record_revisions, diagnoses, medical_records,
    queue_counters, visits, lab_tests, stock_movements, medicines, procedures,
    doctor_schedules, polis, doctors, patients, users, audit_logs CASCADE;
SQL);
        return true;
    }
}
