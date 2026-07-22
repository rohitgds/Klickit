-- Generated from Blueprint 01 — finance indexes

SET search_path = dentos_data, dentos_runtime, public;

CREATE INDEX ix_collection_methods_scope_lookup ON dentos_data.collection_methods (organization_id, created_at, id);
CREATE INDEX ix_fee_statement_categories_scope_lookup ON dentos_data.fee_statement_categories (organization_id, created_at, id);
CREATE INDEX ix_fee_schedule_items_scope_lookup ON dentos_data.fee_schedule_items (created_at, id);
CREATE INDEX ix_tax_codes_scope_lookup ON dentos_data.tax_codes (organization_id, created_at, id);
CREATE INDEX ix_fee_statements_scope_lookup ON dentos_data.fee_statements (organization_id, clinic_id, patient_id, status);
CREATE INDEX ix_fee_statement_lines_scope_lookup ON dentos_data.fee_statement_lines (created_at, id);
CREATE INDEX ix_collection_receipts_scope_lookup ON dentos_data.collection_receipts (organization_id, clinic_id, patient_id, status);
CREATE INDEX ix_collection_tenders_scope_lookup ON dentos_data.collection_tenders (created_at, id);
CREATE INDEX ix_fee_allocations_scope_lookup ON dentos_data.fee_allocations (patient_id, status, allocation_date, created_at);
CREATE INDEX ix_allocation_tender_splits_scope_lookup ON dentos_data.allocation_tender_splits (created_at, id);
CREATE INDEX ix_allocation_fee_line_splits_scope_lookup ON dentos_data.allocation_fee_line_splits (created_at, id);
CREATE INDEX ix_clinician_value_allocations_scope_lookup ON dentos_data.clinician_value_allocations (created_at, id);
CREATE INDEX ix_fee_credits_scope_lookup ON dentos_data.fee_credits (clinic_id, patient_id, status, created_at);
CREATE INDEX ix_fee_credit_allocations_scope_lookup ON dentos_data.fee_credit_allocations (status, allocation_date, created_at, id);
CREATE INDEX ix_fee_reliefs_scope_lookup ON dentos_data.fee_reliefs (status, created_at, id);
CREATE INDEX ix_fee_credit_line_splits_scope_lookup ON dentos_data.fee_credit_line_splits (created_at, id);
CREATE INDEX ix_fee_relief_line_splits_scope_lookup ON dentos_data.fee_relief_line_splits (created_at, id);
CREATE INDEX ix_collection_refunds_scope_lookup ON dentos_data.collection_refunds (clinic_id, patient_id, status, created_at);
CREATE INDEX ix_collection_refund_tenders_scope_lookup ON dentos_data.collection_refund_tenders (created_at, id);
CREATE INDEX ix_legacy_balance_documents_scope_lookup ON dentos_data.legacy_balance_documents (clinic_id, patient_id, status, created_at);
CREATE INDEX ix_ledger_accounts_scope_lookup ON dentos_data.ledger_accounts (organization_id, created_at, id);
CREATE INDEX ix_journal_entries_scope_lookup ON dentos_data.journal_entries (organization_id, clinic_id, status, created_at);
CREATE INDEX ix_journal_lines_scope_lookup ON dentos_data.journal_lines (patient_id, created_at, id);
CREATE INDEX ix_fee_statement_lines_plan_service ON dentos_data.fee_statement_lines (care_plan_service_id, fee_statement_id, id) WHERE care_plan_service_id IS NOT NULL;
CREATE INDEX ix_fee_statement_pending_age ON dentos_data.fee_statements (clinic_id, statement_date, due_date, patient_id) WHERE status IN ('issued','part_paid','paid');
CREATE INDEX ix_fee_statement_lines_clinician_fee_statement ON dentos_data.fee_statement_lines (lead_clinician_id, fee_statement_id, id);
CREATE INDEX ix_collection_receipts_collection ON dentos_data.collection_receipts (clinic_id, collection_date, collection_operator_id, patient_id) WHERE status IN ('active','part_refunded','refunded');
CREATE INDEX ix_collection_tenders_mode_receipt ON dentos_data.collection_tenders (collection_method_id, collection_receipt_id, id);
CREATE INDEX ix_fee_allocations_date_fee_statement ON dentos_data.fee_allocations (clinic_id, allocation_date, fee_statement_id, status);
CREATE INDEX ix_clinician_value_allocations_line_tender ON dentos_data.clinician_value_allocations (fee_statement_line_id, collection_tender_id, fee_allocation_id);
CREATE INDEX ix_collection_refunds_date_receipt ON dentos_data.collection_refunds (clinic_id, refund_date, collection_receipt_id, status);

