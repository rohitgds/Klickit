-- Generated from Blueprint 01 — financial operations foundation (Milestone 7)

SET search_path = dentos_data, dentos_runtime, public;

CREATE TABLE dentos_data.tax_codes (
  id uuid NOT NULL CONSTRAINT pk_tax_codes PRIMARY KEY,
  organization_id uuid NOT NULL,
  code character varying,
  cgst_rate numeric(7,4),
  sgst_rate numeric(7,4),
  igst_rate numeric(7,4),
  active boolean,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

CREATE TABLE dentos_data.collection_methods (
  id uuid NOT NULL CONSTRAINT pk_collection_methods PRIMARY KEY,
  organization_id uuid NOT NULL,
  code character varying,
  name character varying,
  requires_reference boolean,
  active boolean,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1,
  CONSTRAINT uq_collection_methods_organization_id_code UNIQUE(organization_id, code)
);

CREATE TABLE dentos_data.fee_schedule_items (
  id uuid NOT NULL CONSTRAINT pk_fee_schedule_items PRIMARY KEY,
  fee_schedule_id uuid NOT NULL,
  service_id uuid NOT NULL,
  fee numeric(14,2),
  tax_code_id uuid,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1,
  CONSTRAINT uq_fee_schedule_items_fee_schedule_id_service_id UNIQUE(fee_schedule_id, service_id)
);

CREATE TABLE dentos_data.fee_statement_categories (
  id uuid NOT NULL CONSTRAINT pk_fee_statement_categories PRIMARY KEY,
  organization_id uuid NOT NULL,
  name character varying,
  active boolean,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

CREATE TABLE dentos_data.ledger_accounts (
  id uuid NOT NULL CONSTRAINT pk_ledger_accounts PRIMARY KEY,
  organization_id uuid NOT NULL,
  code character varying,
  name character varying,
  account_type character varying,
  parent_id uuid,
  active boolean,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

CREATE TABLE dentos_data.fee_statements (
  id uuid NOT NULL CONSTRAINT pk_fee_statements PRIMARY KEY,
  organization_id uuid NOT NULL,
  clinic_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  care_encounter_id uuid,
  statement_reference character varying NOT NULL,
  statement_date date NOT NULL,
  due_date date,
  fee_schedule_id uuid NOT NULL,
  patient_category_id_snapshot uuid,
  status dentos_data.fee_statement_state,
  issued_at timestamptz,
  void_date date,
  voided_at timestamptz,
  subtotal numeric(14,2),
  discount_total numeric(14,2),
  taxable_total numeric(14,2),
  tax_total numeric(14,2),
  round_off numeric(14,2),
  grand_total numeric(14,2),
  applied_total numeric(14,2),
  credit_total numeric(14,2),
  writeoff_total numeric(14,2),
  outstanding_total numeric(14,2),
  void_reason character varying,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1,
  CONSTRAINT uq_fee_statements_clinic_id_statement_reference UNIQUE(clinic_id, statement_reference)
);

CREATE TABLE dentos_data.fee_statement_lines (
  id uuid NOT NULL CONSTRAINT pk_fee_statement_lines PRIMARY KEY,
  fee_statement_id uuid NOT NULL,
  care_delivery_id uuid,
  care_plan_service_id uuid,
  service_id uuid,
  lead_clinician_id uuid NOT NULL,
  description character varying,
  tooth_code character varying,
  quantity numeric(14,3),
  unit_fee numeric(14,2),
  comments character varying,
  gross_amount numeric(14,2),
  discount_amount numeric(14,2),
  taxable_amount numeric(14,2),
  cgst_amount numeric(14,2),
  sgst_amount numeric(14,2),
  igst_amount numeric(14,2),
  line_total numeric(14,2),
  sequence_no smallint,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

CREATE TABLE dentos_data.collection_receipts (
  id uuid NOT NULL CONSTRAINT pk_collection_receipts PRIMARY KEY,
  organization_id uuid NOT NULL,
  clinic_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  care_encounter_id uuid,
  patient_category_id_snapshot uuid,
  lead_clinician_id_snapshot uuid,
  collection_reference character varying NOT NULL,
  collection_date date NOT NULL,
  status dentos_data.collection_receipt_state,
  gross_collected numeric(14,2),
  refunded_total numeric(14,2),
  available_total numeric(14,2),
  applied_total numeric(14,2),
  unapplied_total numeric(14,2),
  collection_operator_id uuid NOT NULL,
  notes character varying,
  void_reason character varying,
  last_modified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1,
  CONSTRAINT uq_collection_receipts_clinic_id_collection_reference UNIQUE(clinic_id, collection_reference)
);

CREATE TABLE dentos_data.collection_tenders (
  id uuid NOT NULL CONSTRAINT pk_collection_tenders PRIMARY KEY,
  collection_receipt_id uuid NOT NULL,
  collection_method_id uuid NOT NULL,
  amount numeric(14,2),
  reference_no character varying,
  bank_name character varying,
  instrument_date date,
  settlement_status character varying,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1,
  CONSTRAINT uq_collection_tenders_collection_receipt_id_id UNIQUE(collection_receipt_id, id)
);

CREATE TABLE dentos_data.fee_allocations (
  id uuid NOT NULL CONSTRAINT pk_fee_allocations PRIMARY KEY,
  clinic_id uuid NOT NULL,
  collection_receipt_id uuid NOT NULL,
  fee_statement_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  allocation_date date NOT NULL,
  amount numeric(14,2),
  status dentos_data.fee_allocation_state,
  applied_by uuid NOT NULL,
  reversed_by uuid,
  reversal_date date,
  reversed_at timestamptz,
  reversal_reason character varying,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

CREATE TABLE dentos_data.allocation_tender_splits (
  id uuid NOT NULL CONSTRAINT pk_allocation_tender_splits PRIMARY KEY,
  fee_allocation_id uuid NOT NULL,
  collection_tender_id uuid NOT NULL,
  amount numeric(14,2),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  CONSTRAINT uq_allocation_tender_splits_fee_allocation_id_collection_tender_ UNIQUE(fee_allocation_id, collection_tender_id)
);

CREATE TABLE dentos_data.allocation_fee_line_splits (
  id uuid NOT NULL CONSTRAINT pk_allocation_fee_line_splits PRIMARY KEY,
  fee_allocation_id uuid NOT NULL,
  fee_statement_line_id uuid NOT NULL,
  amount numeric(14,2),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  CONSTRAINT uq_allocation_fee_line_splits_fee_allocation_id_fee_statement_line_id UNIQUE(fee_allocation_id, fee_statement_line_id)
);

CREATE TABLE dentos_data.clinician_value_allocations (
  id uuid NOT NULL CONSTRAINT pk_clinician_value_allocations PRIMARY KEY,
  fee_allocation_id uuid NOT NULL,
  fee_statement_line_id uuid NOT NULL,
  collection_tender_id uuid NOT NULL,
  amount numeric(14,2),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  CONSTRAINT uq_clinician_value_allocations_fee_allocation_id_fee_statement_line_id UNIQUE(fee_allocation_id, fee_statement_line_id, collection_tender_id)
);

CREATE TABLE dentos_data.fee_credits (
  id uuid NOT NULL CONSTRAINT pk_fee_credits PRIMARY KEY,
  clinic_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  fee_statement_id uuid NOT NULL,
  credit_note_no character varying,
  credit_date date,
  amount numeric(14,2),
  status character varying CONSTRAINT ck_fee_credits_status CHECK (status IN ('active','reversed')),
  reversal_date date,
  reason character varying,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

CREATE TABLE dentos_data.fee_credit_allocations (
  id uuid NOT NULL CONSTRAINT pk_fee_credit_allocations PRIMARY KEY,
  fee_credit_id uuid NOT NULL,
  fee_statement_id uuid NOT NULL,
  allocation_date date,
  amount numeric(14,2),
  status character varying CONSTRAINT ck_fee_credit_allocations_status CHECK (status IN ('active','reversed')),
  reversal_date date,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid
);

CREATE TABLE dentos_data.fee_credit_line_splits (
  id uuid NOT NULL CONSTRAINT pk_fee_credit_line_splits PRIMARY KEY,
  credit_note_fee_allocation_id uuid NOT NULL,
  fee_statement_line_id uuid NOT NULL,
  amount numeric(14,2),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  CONSTRAINT uq_fee_credit_line_splits_credit_note_fee_allocation_id_inv UNIQUE(credit_note_fee_allocation_id, fee_statement_line_id)
);

CREATE TABLE dentos_data.fee_reliefs (
  id uuid NOT NULL CONSTRAINT pk_fee_reliefs PRIMARY KEY,
  fee_statement_id uuid NOT NULL,
  writeoff_date date,
  amount numeric(14,2),
  reason character varying,
  approved_by uuid NOT NULL,
  status character varying CONSTRAINT ck_fee_reliefs_status CHECK (status IN ('active','reversed')),
  reversal_date date,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

CREATE TABLE dentos_data.fee_relief_line_splits (
  id uuid NOT NULL CONSTRAINT pk_fee_relief_line_splits PRIMARY KEY,
  fee_relief_id uuid NOT NULL,
  fee_statement_line_id uuid NOT NULL,
  amount numeric(14,2),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  CONSTRAINT uq_fee_relief_line_splits_fee_relief_id_fee_statement_line_id UNIQUE(fee_relief_id, fee_statement_line_id)
);

CREATE TABLE dentos_data.collection_refunds (
  id uuid NOT NULL CONSTRAINT pk_collection_refunds PRIMARY KEY,
  clinic_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  collection_receipt_id uuid NOT NULL,
  refund_no character varying,
  refund_date date,
  amount numeric(14,2),
  status character varying CONSTRAINT ck_collection_refunds_status CHECK (status IN ('posted','reversed')),
  processed_by uuid NOT NULL,
  approved_by uuid NOT NULL,
  reversal_date date,
  reason character varying,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

CREATE TABLE dentos_data.collection_refund_tenders (
  id uuid NOT NULL CONSTRAINT pk_collection_refund_tenders PRIMARY KEY,
  collection_refund_id uuid NOT NULL,
  original_tender_id uuid,
  collection_method_id uuid NOT NULL,
  amount numeric(14,2),
  reference_no character varying,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid
);

CREATE TABLE dentos_data.legacy_balance_documents (
  id uuid NOT NULL CONSTRAINT pk_legacy_balance_documents PRIMARY KEY,
  clinic_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  balance_date date,
  receivable_amount numeric(14,2),
  advance_amount numeric(14,2),
  status character varying,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

CREATE TABLE dentos_data.journal_entries (
  id uuid NOT NULL CONSTRAINT pk_journal_entries PRIMARY KEY,
  organization_id uuid NOT NULL,
  clinic_id uuid NOT NULL,
  entry_date date,
  source_type character varying,
  source_id uuid,
  status character varying CONSTRAINT ck_journal_entries_status CHECK (status IN ('posted','reversed')),
  reversal_of_id uuid,
  posted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  CONSTRAINT uq_journal_entries_source_type_source_id_status UNIQUE(source_type, source_id, status)
);

CREATE TABLE dentos_data.journal_lines (
  id uuid NOT NULL CONSTRAINT pk_journal_lines PRIMARY KEY,
  journal_entry_id uuid NOT NULL,
  account_id uuid NOT NULL,
  patient_id uuid,
  clinician_id uuid,
  debit numeric(14,2) DEFAULT 0,
  credit numeric(14,2) DEFAULT 0,
  memo character varying,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  CONSTRAINT ck_journal_lines_1 CHECK((debit=0) <> (credit=0))
);

