--
-- PostgreSQL database dump
--

\restrict B4vMTrX8B1hbCHjcHo25zsGEPcgfjZ2qt6rrJi8A855viR3EgehuziWAAOQoT2O

-- Dumped from database version 18.7
-- Dumped by pg_dump version 18.7

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: integration; Type: SCHEMA; Schema: -; Owner: simrs_dev
--

CREATE SCHEMA integration;


ALTER SCHEMA integration OWNER TO simrs_dev;

--
-- Name: reporting; Type: SCHEMA; Schema: -; Owner: simrs_dev
--

CREATE SCHEMA reporting;


ALTER SCHEMA reporting OWNER TO simrs_dev;

--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: api_log; Type: TABLE; Schema: integration; Owner: simrs_dev
--

CREATE TABLE integration.api_log (
    id bigint NOT NULL,
    request_id character varying(64),
    method character varying(10),
    path text,
    status integer,
    duration_ms integer,
    user_id bigint,
    ip character varying(45),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE integration.api_log OWNER TO simrs_dev;

--
-- Name: api_log_id_seq; Type: SEQUENCE; Schema: integration; Owner: simrs_dev
--

ALTER TABLE integration.api_log ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME integration.api_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: inbox; Type: TABLE; Schema: integration; Owner: simrs_dev
--

CREATE TABLE integration.inbox (
    id bigint NOT NULL,
    source text NOT NULL,
    external_ref character varying(100) NOT NULL,
    payload jsonb NOT NULL,
    status text DEFAULT 'RECEIVED'::text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    last_error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    processed_at timestamp with time zone
);


ALTER TABLE integration.inbox OWNER TO simrs_dev;

--
-- Name: inbox_id_seq; Type: SEQUENCE; Schema: integration; Owner: simrs_dev
--

ALTER TABLE integration.inbox ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME integration.inbox_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: outbox; Type: TABLE; Schema: integration; Owner: simrs_dev
--

CREATE TABLE integration.outbox (
    id bigint NOT NULL,
    aggregate_type text NOT NULL,
    aggregate_id bigint NOT NULL,
    event_type text NOT NULL,
    payload jsonb NOT NULL,
    idempotency_key uuid DEFAULT gen_random_uuid() NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    next_retry_at timestamp with time zone DEFAULT now() NOT NULL,
    last_error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    sent_at timestamp with time zone
);


ALTER TABLE integration.outbox OWNER TO simrs_dev;

--
-- Name: outbox_id_seq; Type: SEQUENCE; Schema: integration; Owner: simrs_dev
--

ALTER TABLE integration.outbox ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME integration.outbox_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: simrs_dev
--

CREATE TABLE public.audit_logs (
    id bigint NOT NULL,
    table_name character varying(60) NOT NULL,
    record_id bigint,
    action character varying(20) NOT NULL,
    old_data jsonb,
    new_data jsonb,
    user_id bigint,
    ip character varying(45),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.audit_logs OWNER TO simrs_dev;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: simrs_dev
--

ALTER TABLE public.audit_logs ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.audit_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: auth_assignment; Type: TABLE; Schema: public; Owner: simrs_dev
--

CREATE TABLE public.auth_assignment (
    item_name character varying(64) NOT NULL,
    user_id character varying(64) NOT NULL,
    created_at integer
);


ALTER TABLE public.auth_assignment OWNER TO simrs_dev;

--
-- Name: auth_item; Type: TABLE; Schema: public; Owner: simrs_dev
--

CREATE TABLE public.auth_item (
    name character varying(64) NOT NULL,
    type smallint NOT NULL,
    description text,
    rule_name character varying(64),
    data bytea,
    created_at integer,
    updated_at integer
);


ALTER TABLE public.auth_item OWNER TO simrs_dev;

--
-- Name: auth_item_child; Type: TABLE; Schema: public; Owner: simrs_dev
--

CREATE TABLE public.auth_item_child (
    parent character varying(64) NOT NULL,
    child character varying(64) NOT NULL
);


ALTER TABLE public.auth_item_child OWNER TO simrs_dev;

--
-- Name: auth_rule; Type: TABLE; Schema: public; Owner: simrs_dev
--

CREATE TABLE public.auth_rule (
    name character varying(64) NOT NULL,
    data bytea,
    created_at integer,
    updated_at integer
);


ALTER TABLE public.auth_rule OWNER TO simrs_dev;

--
-- Name: diagnoses; Type: TABLE; Schema: public; Owner: simrs_dev
--

CREATE TABLE public.diagnoses (
    id bigint NOT NULL,
    visit_id bigint NOT NULL,
    medical_record_id bigint,
    icd10_code character varying(10) NOT NULL,
    name character varying(200) NOT NULL,
    type character(1) NOT NULL,
    notes text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT diagnoses_type_check CHECK ((type = ANY (ARRAY['P'::bpchar, 'S'::bpchar])))
);


ALTER TABLE public.diagnoses OWNER TO simrs_dev;

--
-- Name: diagnoses_id_seq; Type: SEQUENCE; Schema: public; Owner: simrs_dev
--

ALTER TABLE public.diagnoses ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.diagnoses_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: dispensings; Type: TABLE; Schema: public; Owner: simrs_dev
--

CREATE TABLE public.dispensings (
    id bigint NOT NULL,
    prescription_id bigint NOT NULL,
    dispensed_by bigint,
    dispensed_at timestamp with time zone DEFAULT now() NOT NULL,
    notes text
);


ALTER TABLE public.dispensings OWNER TO simrs_dev;

--
-- Name: dispensings_id_seq; Type: SEQUENCE; Schema: public; Owner: simrs_dev
--

ALTER TABLE public.dispensings ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.dispensings_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: doctor_schedules; Type: TABLE; Schema: public; Owner: simrs_dev
--

CREATE TABLE public.doctor_schedules (
    id bigint NOT NULL,
    doctor_id bigint NOT NULL,
    poli_id bigint NOT NULL,
    day_of_week integer NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    quota integer DEFAULT 20 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_schedule_time CHECK ((end_time > start_time)),
    CONSTRAINT doctor_schedules_day_of_week_check CHECK (((day_of_week >= 0) AND (day_of_week <= 6))),
    CONSTRAINT doctor_schedules_quota_check CHECK ((quota > 0))
);


ALTER TABLE public.doctor_schedules OWNER TO simrs_dev;

--
-- Name: doctor_schedules_id_seq; Type: SEQUENCE; Schema: public; Owner: simrs_dev
--

ALTER TABLE public.doctor_schedules ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.doctor_schedules_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: doctors; Type: TABLE; Schema: public; Owner: simrs_dev
--

CREATE TABLE public.doctors (
    id bigint NOT NULL,
    str_no character varying(30) NOT NULL,
    name character varying(150) NOT NULL,
    specialization character varying(100),
    phone character varying(20),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.doctors OWNER TO simrs_dev;

--
-- Name: doctors_id_seq; Type: SEQUENCE; Schema: public; Owner: simrs_dev
--

ALTER TABLE public.doctors ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.doctors_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: invoice_items; Type: TABLE; Schema: public; Owner: simrs_dev
--

CREATE TABLE public.invoice_items (
    id bigint NOT NULL,
    invoice_id bigint NOT NULL,
    ref_type character varying(20) NOT NULL,
    ref_id bigint NOT NULL,
    description character varying(200) NOT NULL,
    qty numeric(12,2) DEFAULT 1 NOT NULL,
    unit_price numeric(14,2) NOT NULL,
    amount numeric(14,2) NOT NULL,
    status character varying(10) DEFAULT 'ACTIVE'::character varying NOT NULL,
    void_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT invoice_items_qty_check CHECK ((qty > (0)::numeric)),
    CONSTRAINT invoice_items_status_check CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'VOID'::character varying])::text[]))),
    CONSTRAINT invoice_items_unit_price_check CHECK ((unit_price >= (0)::numeric))
);


ALTER TABLE public.invoice_items OWNER TO simrs_dev;

--
-- Name: invoice_items_id_seq; Type: SEQUENCE; Schema: public; Owner: simrs_dev
--

ALTER TABLE public.invoice_items ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.invoice_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: invoice_no_seq; Type: SEQUENCE; Schema: public; Owner: simrs_dev
--

CREATE SEQUENCE public.invoice_no_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.invoice_no_seq OWNER TO simrs_dev;

--
-- Name: invoice_revisions; Type: TABLE; Schema: public; Owner: simrs_dev
--

CREATE TABLE public.invoice_revisions (
    id bigint NOT NULL,
    invoice_id bigint NOT NULL,
    revision integer NOT NULL,
    snapshot jsonb NOT NULL,
    reason text,
    created_by bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.invoice_revisions OWNER TO simrs_dev;

--
-- Name: invoice_revisions_id_seq; Type: SEQUENCE; Schema: public; Owner: simrs_dev
--

ALTER TABLE public.invoice_revisions ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.invoice_revisions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: invoices; Type: TABLE; Schema: public; Owner: simrs_dev
--

CREATE TABLE public.invoices (
    id bigint NOT NULL,
    invoice_no character varying(30) NOT NULL,
    visit_id bigint NOT NULL,
    status character varying(10) DEFAULT 'UNPAID'::character varying NOT NULL,
    total numeric(14,2) DEFAULT 0 NOT NULL,
    paid_total numeric(14,2) DEFAULT 0 NOT NULL,
    refund_due numeric(14,2) DEFAULT 0 NOT NULL,
    revision integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT invoices_status_check CHECK (((status)::text = ANY ((ARRAY['UNPAID'::character varying, 'PARTIAL'::character varying, 'PAID'::character varying])::text[])))
);


ALTER TABLE public.invoices OWNER TO simrs_dev;

--
-- Name: invoices_id_seq; Type: SEQUENCE; Schema: public; Owner: simrs_dev
--

ALTER TABLE public.invoices ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.invoices_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: lab_order_items; Type: TABLE; Schema: public; Owner: simrs_dev
--

CREATE TABLE public.lab_order_items (
    id bigint NOT NULL,
    lab_order_id bigint NOT NULL,
    lab_test_id bigint NOT NULL,
    unit_price numeric(14,2) NOT NULL,
    status character varying(15) DEFAULT 'ORDERED'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT lab_order_items_status_check CHECK (((status)::text = ANY ((ARRAY['ORDERED'::character varying, 'DONE'::character varying, 'CANCELLED'::character varying])::text[]))),
    CONSTRAINT lab_order_items_unit_price_check CHECK ((unit_price >= (0)::numeric))
);


ALTER TABLE public.lab_order_items OWNER TO simrs_dev;

--
-- Name: lab_order_items_id_seq; Type: SEQUENCE; Schema: public; Owner: simrs_dev
--

ALTER TABLE public.lab_order_items ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.lab_order_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: lab_order_no_seq; Type: SEQUENCE; Schema: public; Owner: simrs_dev
--

CREATE SEQUENCE public.lab_order_no_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.lab_order_no_seq OWNER TO simrs_dev;

--
-- Name: lab_orders; Type: TABLE; Schema: public; Owner: simrs_dev
--

CREATE TABLE public.lab_orders (
    id bigint NOT NULL,
    order_no character varying(30) NOT NULL,
    visit_id bigint NOT NULL,
    status character varying(15) DEFAULT 'ORDERED'::character varying NOT NULL,
    ordered_by bigint,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT lab_orders_status_check CHECK (((status)::text = ANY ((ARRAY['ORDERED'::character varying, 'RESULT_PARTIAL'::character varying, 'DONE'::character varying, 'CANCELLED'::character varying])::text[])))
);


ALTER TABLE public.lab_orders OWNER TO simrs_dev;

--
-- Name: lab_orders_id_seq; Type: SEQUENCE; Schema: public; Owner: simrs_dev
--

ALTER TABLE public.lab_orders ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.lab_orders_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: lab_results; Type: TABLE; Schema: public; Owner: simrs_dev
--

CREATE TABLE public.lab_results (
    id bigint NOT NULL,
    lab_order_item_id bigint NOT NULL,
    external_ref character varying(100) NOT NULL,
    result_value text,
    unit character varying(30),
    ref_range character varying(100),
    flag character varying(10),
    verified_by bigint,
    verified_at timestamp with time zone DEFAULT now() NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.lab_results OWNER TO simrs_dev;

--
-- Name: lab_results_id_seq; Type: SEQUENCE; Schema: public; Owner: simrs_dev
--

ALTER TABLE public.lab_results ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.lab_results_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: lab_tests; Type: TABLE; Schema: public; Owner: simrs_dev
--

CREATE TABLE public.lab_tests (
    id bigint NOT NULL,
    code character varying(30) NOT NULL,
    name character varying(150) NOT NULL,
    unit character varying(30),
    ref_range character varying(100),
    price numeric(14,2) NOT NULL,
    category character varying(50),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT lab_tests_price_check CHECK ((price >= (0)::numeric))
);


ALTER TABLE public.lab_tests OWNER TO simrs_dev;

--
-- Name: lab_tests_id_seq; Type: SEQUENCE; Schema: public; Owner: simrs_dev
--

ALTER TABLE public.lab_tests ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.lab_tests_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: medical_record_revisions; Type: TABLE; Schema: public; Owner: simrs_dev
--

CREATE TABLE public.medical_record_revisions (
    id bigint NOT NULL,
    medical_record_id bigint NOT NULL,
    visit_id bigint NOT NULL,
    revision integer NOT NULL,
    snapshot jsonb NOT NULL,
    reason text,
    created_by bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.medical_record_revisions OWNER TO simrs_dev;

--
-- Name: medical_record_revisions_id_seq; Type: SEQUENCE; Schema: public; Owner: simrs_dev
--

ALTER TABLE public.medical_record_revisions ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.medical_record_revisions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: medical_records; Type: TABLE; Schema: public; Owner: simrs_dev
--

CREATE TABLE public.medical_records (
    id bigint NOT NULL,
    visit_id bigint NOT NULL,
    anamnesis text,
    blood_pressure character varying(20),
    temperature numeric(4,1),
    pulse integer,
    respiration integer,
    weight numeric(5,1),
    height numeric(5,1),
    physical_exam text,
    notes text,
    revision integer DEFAULT 1 NOT NULL,
    created_by bigint,
    updated_by bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.medical_records OWNER TO simrs_dev;

--
-- Name: medical_records_id_seq; Type: SEQUENCE; Schema: public; Owner: simrs_dev
--

ALTER TABLE public.medical_records ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.medical_records_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: medicines; Type: TABLE; Schema: public; Owner: simrs_dev
--

CREATE TABLE public.medicines (
    id bigint NOT NULL,
    code character varying(30) NOT NULL,
    name character varying(150) NOT NULL,
    unit character varying(20) NOT NULL,
    price numeric(14,2) NOT NULL,
    stock integer DEFAULT 0 NOT NULL,
    category character varying(50),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_medicines_stock CHECK ((stock >= 0)),
    CONSTRAINT medicines_price_check CHECK ((price >= (0)::numeric))
);


ALTER TABLE public.medicines OWNER TO simrs_dev;

--
-- Name: medicines_id_seq; Type: SEQUENCE; Schema: public; Owner: simrs_dev
--

ALTER TABLE public.medicines ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.medicines_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: migration; Type: TABLE; Schema: public; Owner: simrs_dev
--

CREATE TABLE public.migration (
    version character varying(180) NOT NULL,
    apply_time integer
);


ALTER TABLE public.migration OWNER TO simrs_dev;

--
-- Name: mrn_seq; Type: SEQUENCE; Schema: public; Owner: simrs_dev
--

CREATE SEQUENCE public.mrn_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.mrn_seq OWNER TO simrs_dev;

--
-- Name: patients; Type: TABLE; Schema: public; Owner: simrs_dev
--

CREATE TABLE public.patients (
    id bigint NOT NULL,
    mrn character varying(20) DEFAULT ('RM-'::text || lpad((nextval('public.mrn_seq'::regclass))::text, 6, '0'::text)) NOT NULL,
    nik character varying(16),
    name character varying(150) NOT NULL,
    birth_date date NOT NULL,
    gender character(1) NOT NULL,
    phone character varying(20),
    address text,
    blood_type character varying(3),
    allergy text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT patients_gender_check CHECK ((gender = ANY (ARRAY['L'::bpchar, 'P'::bpchar])))
);


ALTER TABLE public.patients OWNER TO simrs_dev;

--
-- Name: patients_id_seq; Type: SEQUENCE; Schema: public; Owner: simrs_dev
--

ALTER TABLE public.patients ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.patients_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: payment_no_seq; Type: SEQUENCE; Schema: public; Owner: simrs_dev
--

CREATE SEQUENCE public.payment_no_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.payment_no_seq OWNER TO simrs_dev;

--
-- Name: payments; Type: TABLE; Schema: public; Owner: simrs_dev
--

CREATE TABLE public.payments (
    id bigint NOT NULL,
    payment_no character varying(30) NOT NULL,
    invoice_id bigint NOT NULL,
    method character varying(12) NOT NULL,
    amount numeric(14,2) NOT NULL,
    idempotency_key uuid NOT NULL,
    request_hash character(64) NOT NULL,
    paid_at timestamp with time zone DEFAULT now() NOT NULL,
    cashier_id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT payments_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT payments_method_check CHECK (((method)::text = ANY ((ARRAY['CASH'::character varying, 'QRIS'::character varying, 'TRANSFER'::character varying, 'CARD'::character varying])::text[])))
);


ALTER TABLE public.payments OWNER TO simrs_dev;

--
-- Name: payments_id_seq; Type: SEQUENCE; Schema: public; Owner: simrs_dev
--

ALTER TABLE public.payments ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.payments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: polis; Type: TABLE; Schema: public; Owner: simrs_dev
--

CREATE TABLE public.polis (
    id bigint NOT NULL,
    code character varying(20) NOT NULL,
    name character varying(100) NOT NULL,
    registration_fee numeric(14,2) DEFAULT 0 NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT polis_registration_fee_check CHECK ((registration_fee >= (0)::numeric))
);


ALTER TABLE public.polis OWNER TO simrs_dev;

--
-- Name: polis_id_seq; Type: SEQUENCE; Schema: public; Owner: simrs_dev
--

ALTER TABLE public.polis ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.polis_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: prescription_items; Type: TABLE; Schema: public; Owner: simrs_dev
--

CREATE TABLE public.prescription_items (
    id bigint NOT NULL,
    prescription_id bigint NOT NULL,
    medicine_id bigint NOT NULL,
    dose character varying(50),
    frequency character varying(50),
    qty integer NOT NULL,
    unit_price numeric(14,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT prescription_items_qty_check CHECK ((qty > 0)),
    CONSTRAINT prescription_items_unit_price_check CHECK ((unit_price >= (0)::numeric))
);


ALTER TABLE public.prescription_items OWNER TO simrs_dev;

--
-- Name: prescription_items_id_seq; Type: SEQUENCE; Schema: public; Owner: simrs_dev
--

ALTER TABLE public.prescription_items ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.prescription_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: prescription_no_seq; Type: SEQUENCE; Schema: public; Owner: simrs_dev
--

CREATE SEQUENCE public.prescription_no_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.prescription_no_seq OWNER TO simrs_dev;

--
-- Name: prescriptions; Type: TABLE; Schema: public; Owner: simrs_dev
--

CREATE TABLE public.prescriptions (
    id bigint NOT NULL,
    prescription_no character varying(30) NOT NULL,
    visit_id bigint NOT NULL,
    status character varying(12) DEFAULT 'DRAFT'::character varying NOT NULL,
    notes text,
    created_by bigint,
    processed_by bigint,
    dispensed_by bigint,
    submitted_at timestamp with time zone,
    processed_at timestamp with time zone,
    dispensed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT prescriptions_status_check CHECK (((status)::text = ANY ((ARRAY['DRAFT'::character varying, 'SUBMITTED'::character varying, 'PROCESSING'::character varying, 'DISPENSED'::character varying, 'CANCELLED'::character varying])::text[])))
);


ALTER TABLE public.prescriptions OWNER TO simrs_dev;

--
-- Name: prescriptions_id_seq; Type: SEQUENCE; Schema: public; Owner: simrs_dev
--

ALTER TABLE public.prescriptions ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.prescriptions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: procedures; Type: TABLE; Schema: public; Owner: simrs_dev
--

CREATE TABLE public.procedures (
    id bigint NOT NULL,
    code character varying(30) NOT NULL,
    name character varying(150) NOT NULL,
    price numeric(14,2) NOT NULL,
    category character varying(50),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT procedures_price_check CHECK ((price >= (0)::numeric))
);


ALTER TABLE public.procedures OWNER TO simrs_dev;

--
-- Name: procedures_id_seq; Type: SEQUENCE; Schema: public; Owner: simrs_dev
--

ALTER TABLE public.procedures ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.procedures_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: queue_counters; Type: TABLE; Schema: public; Owner: simrs_dev
--

CREATE TABLE public.queue_counters (
    doctor_id bigint NOT NULL,
    visit_date date NOT NULL,
    last_no integer NOT NULL
);


ALTER TABLE public.queue_counters OWNER TO simrs_dev;

--
-- Name: stock_movements; Type: TABLE; Schema: public; Owner: simrs_dev
--

CREATE TABLE public.stock_movements (
    id bigint NOT NULL,
    medicine_id bigint NOT NULL,
    qty_change integer NOT NULL,
    stock_after integer NOT NULL,
    ref_type character varying(20) NOT NULL,
    ref_id bigint,
    reason text,
    created_by bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.stock_movements OWNER TO simrs_dev;

--
-- Name: stock_movements_id_seq; Type: SEQUENCE; Schema: public; Owner: simrs_dev
--

ALTER TABLE public.stock_movements ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.stock_movements_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: simrs_dev
--

CREATE TABLE public.users (
    id bigint NOT NULL,
    username character varying(50) NOT NULL,
    password_hash character varying(255) NOT NULL,
    full_name character varying(150) NOT NULL,
    role character varying(20) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    last_login_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT users_role_check CHECK (((role)::text = ANY ((ARRAY['admin'::character varying, 'pendaftaran'::character varying, 'dokter'::character varying, 'farmasi'::character varying, 'lab'::character varying, 'kasir'::character varying])::text[])))
);


ALTER TABLE public.users OWNER TO simrs_dev;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: simrs_dev
--

ALTER TABLE public.users ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: visit_no_seq; Type: SEQUENCE; Schema: public; Owner: simrs_dev
--

CREATE SEQUENCE public.visit_no_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.visit_no_seq OWNER TO simrs_dev;

--
-- Name: visit_procedures; Type: TABLE; Schema: public; Owner: simrs_dev
--

CREATE TABLE public.visit_procedures (
    id bigint NOT NULL,
    visit_id bigint NOT NULL,
    procedure_id bigint NOT NULL,
    qty integer DEFAULT 1 NOT NULL,
    unit_price numeric(14,2) NOT NULL,
    status character varying(10) DEFAULT 'ACTIVE'::character varying NOT NULL,
    void_reason text,
    created_by bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT visit_procedures_qty_check CHECK ((qty > 0)),
    CONSTRAINT visit_procedures_status_check CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'VOID'::character varying])::text[]))),
    CONSTRAINT visit_procedures_unit_price_check CHECK ((unit_price >= (0)::numeric))
);


ALTER TABLE public.visit_procedures OWNER TO simrs_dev;

--
-- Name: visit_procedures_id_seq; Type: SEQUENCE; Schema: public; Owner: simrs_dev
--

ALTER TABLE public.visit_procedures ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.visit_procedures_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: visits; Type: TABLE; Schema: public; Owner: simrs_dev
--

CREATE TABLE public.visits (
    id bigint NOT NULL,
    visit_no character varying(30) NOT NULL,
    patient_id bigint NOT NULL,
    doctor_id bigint NOT NULL,
    poli_id bigint NOT NULL,
    visit_date date NOT NULL,
    queue_no integer NOT NULL,
    guarantor_type character varying(10) DEFAULT 'UMUM'::character varying NOT NULL,
    status character varying(12) DEFAULT 'REGISTERED'::character varying NOT NULL,
    complaint text,
    cancel_reason text,
    created_by bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT visits_guarantor_type_check CHECK (((guarantor_type)::text = ANY ((ARRAY['UMUM'::character varying, 'BPJS'::character varying, 'ASURANSI'::character varying])::text[]))),
    CONSTRAINT visits_status_check CHECK (((status)::text = ANY ((ARRAY['REGISTERED'::character varying, 'WAITING'::character varying, 'IN_EXAM'::character varying, 'EXAM_DONE'::character varying, 'BILLING'::character varying, 'PAID'::character varying, 'CANCELLED'::character varying])::text[])))
);


ALTER TABLE public.visits OWNER TO simrs_dev;

--
-- Name: visits_id_seq; Type: SEQUENCE; Schema: public; Owner: simrs_dev
--

ALTER TABLE public.visits ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.visits_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: mv_daily_summary; Type: MATERIALIZED VIEW; Schema: reporting; Owner: simrs_dev
--

CREATE MATERIALIZED VIEW reporting.mv_daily_summary AS
 SELECT v.visit_date,
    v.poli_id,
    count(*) AS visits,
    count(*) FILTER (WHERE ((v.status)::text = 'PAID'::text)) AS paid_visits,
    COALESCE(sum(i.total), (0)::numeric) AS billed,
    COALESCE(sum(i.paid_total), (0)::numeric) AS collected
   FROM (public.visits v
     LEFT JOIN public.invoices i ON ((i.visit_id = v.id)))
  WHERE ((v.status)::text <> 'CANCELLED'::text)
  GROUP BY v.visit_date, v.poli_id
  WITH NO DATA;


ALTER MATERIALIZED VIEW reporting.mv_daily_summary OWNER TO simrs_dev;

--
-- Name: v_medicine_usage; Type: VIEW; Schema: reporting; Owner: simrs_dev
--

CREATE VIEW reporting.v_medicine_usage AS
 SELECT m.id AS medicine_id,
    m.code,
    m.name AS medicine_name,
    m.unit,
    COALESCE(sum(pi.qty), (0)::bigint) AS qty_prescribed,
    COALESCE(sum(((pi.qty)::numeric * pi.unit_price)), (0)::numeric) AS revenue
   FROM ((public.medicines m
     LEFT JOIN public.prescription_items pi ON ((pi.medicine_id = m.id)))
     LEFT JOIN public.prescriptions r ON (((r.id = pi.prescription_id) AND ((r.status)::text = 'DISPENSED'::text))))
  GROUP BY m.id, m.code, m.name, m.unit;


ALTER VIEW reporting.v_medicine_usage OWNER TO simrs_dev;

--
-- Name: v_payment_status; Type: VIEW; Schema: reporting; Owner: simrs_dev
--

CREATE VIEW reporting.v_payment_status AS
 SELECT status,
    count(*) AS invoice_count,
    COALESCE(sum(total), (0)::numeric) AS total,
    COALESCE(sum(paid_total), (0)::numeric) AS paid_total
   FROM public.invoices i
  GROUP BY status;


ALTER VIEW reporting.v_payment_status OWNER TO simrs_dev;

--
-- Name: v_procedures; Type: VIEW; Schema: reporting; Owner: simrs_dev
--

CREATE VIEW reporting.v_procedures AS
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
    ((vp.qty)::numeric * vp.unit_price) AS amount,
    vp.status,
    vp.created_at
   FROM (((public.visit_procedures vp
     JOIN public.visits v ON ((v.id = vp.visit_id)))
     JOIN public.polis po ON ((po.id = v.poli_id)))
     JOIN public.procedures pr ON ((pr.id = vp.procedure_id)));


ALTER VIEW reporting.v_procedures OWNER TO simrs_dev;

--
-- Name: v_revenue; Type: VIEW; Schema: reporting; Owner: simrs_dev
--

CREATE VIEW reporting.v_revenue AS
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
   FROM ((public.invoices i
     JOIN public.visits v ON ((v.id = i.visit_id)))
     JOIN public.polis po ON ((po.id = v.poli_id)))
  WHERE ((v.status)::text <> 'CANCELLED'::text);


ALTER VIEW reporting.v_revenue OWNER TO simrs_dev;

--
-- Name: v_visits; Type: VIEW; Schema: reporting; Owner: simrs_dev
--

CREATE VIEW reporting.v_visits AS
 SELECT v.id,
    v.visit_no,
    v.visit_date,
    v.status,
    v.queue_no,
    v.guarantor_type,
    v.created_at,
    p.id AS patient_id,
    p.mrn,
    p.name AS patient_name,
    p.gender,
    p.birth_date,
    d.id AS doctor_id,
    d.name AS doctor_name,
    po.id AS poli_id,
    po.code AS poli_code,
    po.name AS poli_name,
    i.id AS invoice_id,
    i.invoice_no,
    i.status AS invoice_status,
    i.total,
    i.paid_total,
    i.revision
   FROM ((((public.visits v
     JOIN public.patients p ON ((p.id = v.patient_id)))
     JOIN public.doctors d ON ((d.id = v.doctor_id)))
     JOIN public.polis po ON ((po.id = v.poli_id)))
     LEFT JOIN public.invoices i ON ((i.visit_id = v.id)));


ALTER VIEW reporting.v_visits OWNER TO simrs_dev;

--
-- Name: api_log api_log_pkey; Type: CONSTRAINT; Schema: integration; Owner: simrs_dev
--

ALTER TABLE ONLY integration.api_log
    ADD CONSTRAINT api_log_pkey PRIMARY KEY (id);


--
-- Name: inbox inbox_external_ref_key; Type: CONSTRAINT; Schema: integration; Owner: simrs_dev
--

ALTER TABLE ONLY integration.inbox
    ADD CONSTRAINT inbox_external_ref_key UNIQUE (external_ref);


--
-- Name: inbox inbox_pkey; Type: CONSTRAINT; Schema: integration; Owner: simrs_dev
--

ALTER TABLE ONLY integration.inbox
    ADD CONSTRAINT inbox_pkey PRIMARY KEY (id);


--
-- Name: outbox outbox_idempotency_key_key; Type: CONSTRAINT; Schema: integration; Owner: simrs_dev
--

ALTER TABLE ONLY integration.outbox
    ADD CONSTRAINT outbox_idempotency_key_key UNIQUE (idempotency_key);


--
-- Name: outbox outbox_pkey; Type: CONSTRAINT; Schema: integration; Owner: simrs_dev
--

ALTER TABLE ONLY integration.outbox
    ADD CONSTRAINT outbox_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: simrs_dev
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: auth_assignment auth_assignment_pkey; Type: CONSTRAINT; Schema: public; Owner: simrs_dev
--

ALTER TABLE ONLY public.auth_assignment
    ADD CONSTRAINT auth_assignment_pkey PRIMARY KEY (item_name, user_id);


--
-- Name: auth_item_child auth_item_child_pkey; Type: CONSTRAINT; Schema: public; Owner: simrs_dev
--

ALTER TABLE ONLY public.auth_item_child
    ADD CONSTRAINT auth_item_child_pkey PRIMARY KEY (parent, child);


--
-- Name: auth_item auth_item_pkey; Type: CONSTRAINT; Schema: public; Owner: simrs_dev
--

ALTER TABLE ONLY public.auth_item
    ADD CONSTRAINT auth_item_pkey PRIMARY KEY (name);


--
-- Name: auth_rule auth_rule_pkey; Type: CONSTRAINT; Schema: public; Owner: simrs_dev
--

ALTER TABLE ONLY public.auth_rule
    ADD CONSTRAINT auth_rule_pkey PRIMARY KEY (name);


--
-- Name: diagnoses diagnoses_pkey; Type: CONSTRAINT; Schema: public; Owner: simrs_dev
--

ALTER TABLE ONLY public.diagnoses
    ADD CONSTRAINT diagnoses_pkey PRIMARY KEY (id);


--
-- Name: dispensings dispensings_pkey; Type: CONSTRAINT; Schema: public; Owner: simrs_dev
--

ALTER TABLE ONLY public.dispensings
    ADD CONSTRAINT dispensings_pkey PRIMARY KEY (id);


--
-- Name: doctor_schedules doctor_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: simrs_dev
--

ALTER TABLE ONLY public.doctor_schedules
    ADD CONSTRAINT doctor_schedules_pkey PRIMARY KEY (id);


--
-- Name: doctors doctors_pkey; Type: CONSTRAINT; Schema: public; Owner: simrs_dev
--

ALTER TABLE ONLY public.doctors
    ADD CONSTRAINT doctors_pkey PRIMARY KEY (id);


--
-- Name: doctors doctors_str_no_key; Type: CONSTRAINT; Schema: public; Owner: simrs_dev
--

ALTER TABLE ONLY public.doctors
    ADD CONSTRAINT doctors_str_no_key UNIQUE (str_no);


--
-- Name: invoice_items invoice_items_pkey; Type: CONSTRAINT; Schema: public; Owner: simrs_dev
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_pkey PRIMARY KEY (id);


--
-- Name: invoice_revisions invoice_revisions_pkey; Type: CONSTRAINT; Schema: public; Owner: simrs_dev
--

ALTER TABLE ONLY public.invoice_revisions
    ADD CONSTRAINT invoice_revisions_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_invoice_no_key; Type: CONSTRAINT; Schema: public; Owner: simrs_dev
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_invoice_no_key UNIQUE (invoice_no);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: simrs_dev
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_visit_id_key; Type: CONSTRAINT; Schema: public; Owner: simrs_dev
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_visit_id_key UNIQUE (visit_id);


--
-- Name: lab_order_items lab_order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: simrs_dev
--

ALTER TABLE ONLY public.lab_order_items
    ADD CONSTRAINT lab_order_items_pkey PRIMARY KEY (id);


--
-- Name: lab_orders lab_orders_order_no_key; Type: CONSTRAINT; Schema: public; Owner: simrs_dev
--

ALTER TABLE ONLY public.lab_orders
    ADD CONSTRAINT lab_orders_order_no_key UNIQUE (order_no);


--
-- Name: lab_orders lab_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: simrs_dev
--

ALTER TABLE ONLY public.lab_orders
    ADD CONSTRAINT lab_orders_pkey PRIMARY KEY (id);


--
-- Name: lab_results lab_results_external_ref_key; Type: CONSTRAINT; Schema: public; Owner: simrs_dev
--

ALTER TABLE ONLY public.lab_results
    ADD CONSTRAINT lab_results_external_ref_key UNIQUE (external_ref);


--
-- Name: lab_results lab_results_pkey; Type: CONSTRAINT; Schema: public; Owner: simrs_dev
--

ALTER TABLE ONLY public.lab_results
    ADD CONSTRAINT lab_results_pkey PRIMARY KEY (id);


--
-- Name: lab_tests lab_tests_code_key; Type: CONSTRAINT; Schema: public; Owner: simrs_dev
--

ALTER TABLE ONLY public.lab_tests
    ADD CONSTRAINT lab_tests_code_key UNIQUE (code);


--
-- Name: lab_tests lab_tests_pkey; Type: CONSTRAINT; Schema: public; Owner: simrs_dev
--

ALTER TABLE ONLY public.lab_tests
    ADD CONSTRAINT lab_tests_pkey PRIMARY KEY (id);


--
-- Name: medical_record_revisions medical_record_revisions_pkey; Type: CONSTRAINT; Schema: public; Owner: simrs_dev
--

ALTER TABLE ONLY public.medical_record_revisions
    ADD CONSTRAINT medical_record_revisions_pkey PRIMARY KEY (id);


--
-- Name: medical_records medical_records_pkey; Type: CONSTRAINT; Schema: public; Owner: simrs_dev
--

ALTER TABLE ONLY public.medical_records
    ADD CONSTRAINT medical_records_pkey PRIMARY KEY (id);


--
-- Name: medical_records medical_records_visit_id_key; Type: CONSTRAINT; Schema: public; Owner: simrs_dev
--

ALTER TABLE ONLY public.medical_records
    ADD CONSTRAINT medical_records_visit_id_key UNIQUE (visit_id);


--
-- Name: medicines medicines_code_key; Type: CONSTRAINT; Schema: public; Owner: simrs_dev
--

ALTER TABLE ONLY public.medicines
    ADD CONSTRAINT medicines_code_key UNIQUE (code);


--
-- Name: medicines medicines_pkey; Type: CONSTRAINT; Schema: public; Owner: simrs_dev
--

ALTER TABLE ONLY public.medicines
    ADD CONSTRAINT medicines_pkey PRIMARY KEY (id);


--
-- Name: migration migration_pkey; Type: CONSTRAINT; Schema: public; Owner: simrs_dev
--

ALTER TABLE ONLY public.migration
    ADD CONSTRAINT migration_pkey PRIMARY KEY (version);


--
-- Name: patients patients_mrn_key; Type: CONSTRAINT; Schema: public; Owner: simrs_dev
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_mrn_key UNIQUE (mrn);


--
-- Name: patients patients_pkey; Type: CONSTRAINT; Schema: public; Owner: simrs_dev
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_pkey PRIMARY KEY (id);


--
-- Name: payments payments_payment_no_key; Type: CONSTRAINT; Schema: public; Owner: simrs_dev
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_payment_no_key UNIQUE (payment_no);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: simrs_dev
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: polis polis_code_key; Type: CONSTRAINT; Schema: public; Owner: simrs_dev
--

ALTER TABLE ONLY public.polis
    ADD CONSTRAINT polis_code_key UNIQUE (code);


--
-- Name: polis polis_pkey; Type: CONSTRAINT; Schema: public; Owner: simrs_dev
--

ALTER TABLE ONLY public.polis
    ADD CONSTRAINT polis_pkey PRIMARY KEY (id);


--
-- Name: prescription_items prescription_items_pkey; Type: CONSTRAINT; Schema: public; Owner: simrs_dev
--

ALTER TABLE ONLY public.prescription_items
    ADD CONSTRAINT prescription_items_pkey PRIMARY KEY (id);


--
-- Name: prescriptions prescriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: simrs_dev
--

ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT prescriptions_pkey PRIMARY KEY (id);


--
-- Name: prescriptions prescriptions_prescription_no_key; Type: CONSTRAINT; Schema: public; Owner: simrs_dev
--

ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT prescriptions_prescription_no_key UNIQUE (prescription_no);


--
-- Name: procedures procedures_code_key; Type: CONSTRAINT; Schema: public; Owner: simrs_dev
--

ALTER TABLE ONLY public.procedures
    ADD CONSTRAINT procedures_code_key UNIQUE (code);


--
-- Name: procedures procedures_pkey; Type: CONSTRAINT; Schema: public; Owner: simrs_dev
--

ALTER TABLE ONLY public.procedures
    ADD CONSTRAINT procedures_pkey PRIMARY KEY (id);


--
-- Name: queue_counters queue_counters_pkey; Type: CONSTRAINT; Schema: public; Owner: simrs_dev
--

ALTER TABLE ONLY public.queue_counters
    ADD CONSTRAINT queue_counters_pkey PRIMARY KEY (doctor_id, visit_date);


--
-- Name: stock_movements stock_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: simrs_dev
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: simrs_dev
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: simrs_dev
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: payments ux_payments_idem; Type: CONSTRAINT; Schema: public; Owner: simrs_dev
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT ux_payments_idem UNIQUE (idempotency_key);


--
-- Name: doctor_schedules ux_schedule; Type: CONSTRAINT; Schema: public; Owner: simrs_dev
--

ALTER TABLE ONLY public.doctor_schedules
    ADD CONSTRAINT ux_schedule UNIQUE (doctor_id, poli_id, day_of_week, start_time);


--
-- Name: visits ux_visit_queue; Type: CONSTRAINT; Schema: public; Owner: simrs_dev
--

ALTER TABLE ONLY public.visits
    ADD CONSTRAINT ux_visit_queue UNIQUE (doctor_id, visit_date, queue_no);


--
-- Name: visit_procedures visit_procedures_pkey; Type: CONSTRAINT; Schema: public; Owner: simrs_dev
--

ALTER TABLE ONLY public.visit_procedures
    ADD CONSTRAINT visit_procedures_pkey PRIMARY KEY (id);


--
-- Name: visits visits_pkey; Type: CONSTRAINT; Schema: public; Owner: simrs_dev
--

ALTER TABLE ONLY public.visits
    ADD CONSTRAINT visits_pkey PRIMARY KEY (id);


--
-- Name: visits visits_visit_no_key; Type: CONSTRAINT; Schema: public; Owner: simrs_dev
--

ALTER TABLE ONLY public.visits
    ADD CONSTRAINT visits_visit_no_key UNIQUE (visit_no);


--
-- Name: ix_outbox_pending; Type: INDEX; Schema: integration; Owner: simrs_dev
--

CREATE INDEX ix_outbox_pending ON integration.outbox USING btree (next_retry_at) WHERE (status = ANY (ARRAY['PENDING'::text, 'FAILED'::text]));


--
-- Name: idx-auth_assignment-user_id; Type: INDEX; Schema: public; Owner: simrs_dev
--

CREATE INDEX "idx-auth_assignment-user_id" ON public.auth_assignment USING btree (user_id);


--
-- Name: idx-auth_item-type; Type: INDEX; Schema: public; Owner: simrs_dev
--

CREATE INDEX "idx-auth_item-type" ON public.auth_item USING btree (type);


--
-- Name: ix_audit_record; Type: INDEX; Schema: public; Owner: simrs_dev
--

CREATE INDEX ix_audit_record ON public.audit_logs USING btree (table_name, record_id, created_at DESC);


--
-- Name: ix_laborder_visit; Type: INDEX; Schema: public; Owner: simrs_dev
--

CREATE INDEX ix_laborder_visit ON public.lab_orders USING btree (visit_id);


--
-- Name: ix_patients_name_trgm; Type: INDEX; Schema: public; Owner: simrs_dev
--

CREATE INDEX ix_patients_name_trgm ON public.patients USING gin (name public.gin_trgm_ops);


--
-- Name: ix_payments_invoice; Type: INDEX; Schema: public; Owner: simrs_dev
--

CREATE INDEX ix_payments_invoice ON public.payments USING btree (invoice_id);


--
-- Name: ix_payments_paid_at; Type: INDEX; Schema: public; Owner: simrs_dev
--

CREATE INDEX ix_payments_paid_at ON public.payments USING btree (paid_at);


--
-- Name: ix_rx_status; Type: INDEX; Schema: public; Owner: simrs_dev
--

CREATE INDEX ix_rx_status ON public.prescriptions USING btree (status);


--
-- Name: ix_rx_visit; Type: INDEX; Schema: public; Owner: simrs_dev
--

CREATE INDEX ix_rx_visit ON public.prescriptions USING btree (visit_id);


--
-- Name: ix_rxitem_rx; Type: INDEX; Schema: public; Owner: simrs_dev
--

CREATE INDEX ix_rxitem_rx ON public.prescription_items USING btree (prescription_id);


--
-- Name: ix_stock_med; Type: INDEX; Schema: public; Owner: simrs_dev
--

CREATE INDEX ix_stock_med ON public.stock_movements USING btree (medicine_id, created_at DESC);


--
-- Name: ix_visits_date_poli; Type: INDEX; Schema: public; Owner: simrs_dev
--

CREATE INDEX ix_visits_date_poli ON public.visits USING btree (visit_date, poli_id, status);


--
-- Name: ix_visits_doctor_q; Type: INDEX; Schema: public; Owner: simrs_dev
--

CREATE INDEX ix_visits_doctor_q ON public.visits USING btree (doctor_id, visit_date, status);


--
-- Name: ix_visits_patient; Type: INDEX; Schema: public; Owner: simrs_dev
--

CREATE INDEX ix_visits_patient ON public.visits USING btree (patient_id, visit_date DESC);


--
-- Name: ix_vproc_visit; Type: INDEX; Schema: public; Owner: simrs_dev
--

CREATE INDEX ix_vproc_visit ON public.visit_procedures USING btree (visit_id) WHERE ((status)::text = 'ACTIVE'::text);


--
-- Name: ux_diagnosis_primary; Type: INDEX; Schema: public; Owner: simrs_dev
--

CREATE UNIQUE INDEX ux_diagnosis_primary ON public.diagnoses USING btree (visit_id) WHERE ((type = 'P'::bpchar) AND is_active);


--
-- Name: ux_invoice_item_ref; Type: INDEX; Schema: public; Owner: simrs_dev
--

CREATE UNIQUE INDEX ux_invoice_item_ref ON public.invoice_items USING btree (invoice_id, ref_type, ref_id) WHERE ((status)::text = 'ACTIVE'::text);


--
-- Name: ux_patients_nik; Type: INDEX; Schema: public; Owner: simrs_dev
--

CREATE UNIQUE INDEX ux_patients_nik ON public.patients USING btree (nik) WHERE (nik IS NOT NULL);


--
-- Name: ux_visit_patient_doctor_day; Type: INDEX; Schema: public; Owner: simrs_dev
--

CREATE UNIQUE INDEX ux_visit_patient_doctor_day ON public.visits USING btree (patient_id, doctor_id, visit_date) WHERE ((status)::text <> 'CANCELLED'::text);


--
-- Name: ux_mv_daily_summary; Type: INDEX; Schema: reporting; Owner: simrs_dev
--

CREATE UNIQUE INDEX ux_mv_daily_summary ON reporting.mv_daily_summary USING btree (visit_date, poli_id);


--
-- Name: auth_assignment auth_assignment_item_name_fkey; Type: FK CONSTRAINT; Schema: public; Owner: simrs_dev
--

ALTER TABLE ONLY public.auth_assignment
    ADD CONSTRAINT auth_assignment_item_name_fkey FOREIGN KEY (item_name) REFERENCES public.auth_item(name) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: auth_item_child auth_item_child_child_fkey; Type: FK CONSTRAINT; Schema: public; Owner: simrs_dev
--

ALTER TABLE ONLY public.auth_item_child
    ADD CONSTRAINT auth_item_child_child_fkey FOREIGN KEY (child) REFERENCES public.auth_item(name) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: auth_item_child auth_item_child_parent_fkey; Type: FK CONSTRAINT; Schema: public; Owner: simrs_dev
--

ALTER TABLE ONLY public.auth_item_child
    ADD CONSTRAINT auth_item_child_parent_fkey FOREIGN KEY (parent) REFERENCES public.auth_item(name) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: auth_item auth_item_rule_name_fkey; Type: FK CONSTRAINT; Schema: public; Owner: simrs_dev
--

ALTER TABLE ONLY public.auth_item
    ADD CONSTRAINT auth_item_rule_name_fkey FOREIGN KEY (rule_name) REFERENCES public.auth_rule(name) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: diagnoses diagnoses_medical_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: simrs_dev
--

ALTER TABLE ONLY public.diagnoses
    ADD CONSTRAINT diagnoses_medical_record_id_fkey FOREIGN KEY (medical_record_id) REFERENCES public.medical_records(id);


--
-- Name: diagnoses diagnoses_visit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: simrs_dev
--

ALTER TABLE ONLY public.diagnoses
    ADD CONSTRAINT diagnoses_visit_id_fkey FOREIGN KEY (visit_id) REFERENCES public.visits(id);


--
-- Name: dispensings dispensings_prescription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: simrs_dev
--

ALTER TABLE ONLY public.dispensings
    ADD CONSTRAINT dispensings_prescription_id_fkey FOREIGN KEY (prescription_id) REFERENCES public.prescriptions(id);


--
-- Name: doctor_schedules doctor_schedules_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: simrs_dev
--

ALTER TABLE ONLY public.doctor_schedules
    ADD CONSTRAINT doctor_schedules_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.doctors(id);


--
-- Name: doctor_schedules doctor_schedules_poli_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: simrs_dev
--

ALTER TABLE ONLY public.doctor_schedules
    ADD CONSTRAINT doctor_schedules_poli_id_fkey FOREIGN KEY (poli_id) REFERENCES public.polis(id);


--
-- Name: invoice_items invoice_items_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: simrs_dev
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id);


--
-- Name: invoice_revisions invoice_revisions_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: simrs_dev
--

ALTER TABLE ONLY public.invoice_revisions
    ADD CONSTRAINT invoice_revisions_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id);


--
-- Name: lab_order_items lab_order_items_lab_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: simrs_dev
--

ALTER TABLE ONLY public.lab_order_items
    ADD CONSTRAINT lab_order_items_lab_order_id_fkey FOREIGN KEY (lab_order_id) REFERENCES public.lab_orders(id);


--
-- Name: lab_order_items lab_order_items_lab_test_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: simrs_dev
--

ALTER TABLE ONLY public.lab_order_items
    ADD CONSTRAINT lab_order_items_lab_test_id_fkey FOREIGN KEY (lab_test_id) REFERENCES public.lab_tests(id);


--
-- Name: lab_orders lab_orders_visit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: simrs_dev
--

ALTER TABLE ONLY public.lab_orders
    ADD CONSTRAINT lab_orders_visit_id_fkey FOREIGN KEY (visit_id) REFERENCES public.visits(id);


--
-- Name: lab_results lab_results_lab_order_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: simrs_dev
--

ALTER TABLE ONLY public.lab_results
    ADD CONSTRAINT lab_results_lab_order_item_id_fkey FOREIGN KEY (lab_order_item_id) REFERENCES public.lab_order_items(id);


--
-- Name: medical_record_revisions medical_record_revisions_medical_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: simrs_dev
--

ALTER TABLE ONLY public.medical_record_revisions
    ADD CONSTRAINT medical_record_revisions_medical_record_id_fkey FOREIGN KEY (medical_record_id) REFERENCES public.medical_records(id);


--
-- Name: medical_record_revisions medical_record_revisions_visit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: simrs_dev
--

ALTER TABLE ONLY public.medical_record_revisions
    ADD CONSTRAINT medical_record_revisions_visit_id_fkey FOREIGN KEY (visit_id) REFERENCES public.visits(id);


--
-- Name: medical_records medical_records_visit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: simrs_dev
--

ALTER TABLE ONLY public.medical_records
    ADD CONSTRAINT medical_records_visit_id_fkey FOREIGN KEY (visit_id) REFERENCES public.visits(id);


--
-- Name: payments payments_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: simrs_dev
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id);


--
-- Name: stock_movements stock_movements_medicine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: simrs_dev
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_medicine_id_fkey FOREIGN KEY (medicine_id) REFERENCES public.medicines(id);


--
-- PostgreSQL database dump complete
--

\unrestrict B4vMTrX8B1hbCHjcHo25zsGEPcgfjZ2qt6rrJi8A855viR3EgehuziWAAOQoT2O

