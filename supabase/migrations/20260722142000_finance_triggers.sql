-- Generated from Blueprint 01 — finance audit triggers

SET search_path = dentos_data, dentos_runtime, public;

CREATE TRIGGER trg_collection_methods_touch BEFORE UPDATE ON dentos_data.collection_methods FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_collection_methods_audit AFTER INSERT OR UPDATE OR DELETE ON dentos_data.collection_methods FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_fee_statement_categories_touch BEFORE UPDATE ON dentos_data.fee_statement_categories FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_fee_statement_categories_audit AFTER INSERT OR UPDATE OR DELETE ON dentos_data.fee_statement_categories FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_fee_schedule_items_touch BEFORE UPDATE ON dentos_data.fee_schedule_items FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_fee_schedule_items_audit AFTER INSERT OR UPDATE OR DELETE ON dentos_data.fee_schedule_items FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_tax_codes_touch BEFORE UPDATE ON dentos_data.tax_codes FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_tax_codes_audit AFTER INSERT OR UPDATE OR DELETE ON dentos_data.tax_codes FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_fee_statements_touch BEFORE UPDATE ON dentos_data.fee_statements FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_fee_statements_audit AFTER INSERT OR UPDATE OR DELETE ON dentos_data.fee_statements FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_fee_statement_lines_touch BEFORE UPDATE ON dentos_data.fee_statement_lines FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_fee_statement_lines_audit AFTER INSERT OR UPDATE OR DELETE ON dentos_data.fee_statement_lines FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_collection_receipts_touch BEFORE UPDATE ON dentos_data.collection_receipts FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_collection_receipts_audit AFTER INSERT OR UPDATE OR DELETE ON dentos_data.collection_receipts FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_collection_tenders_touch BEFORE UPDATE ON dentos_data.collection_tenders FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_collection_tenders_audit AFTER INSERT OR UPDATE OR DELETE ON dentos_data.collection_tenders FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_fee_allocations_touch BEFORE UPDATE ON dentos_data.fee_allocations FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_fee_allocations_audit AFTER INSERT OR UPDATE OR DELETE ON dentos_data.fee_allocations FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_allocation_tender_splits_audit AFTER INSERT ON dentos_data.allocation_tender_splits FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_allocation_fee_line_splits_audit AFTER INSERT ON dentos_data.allocation_fee_line_splits FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_clinician_value_allocations_audit AFTER INSERT ON dentos_data.clinician_value_allocations FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_fee_credits_touch BEFORE UPDATE ON dentos_data.fee_credits FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_fee_credits_audit AFTER INSERT OR UPDATE OR DELETE ON dentos_data.fee_credits FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_fee_credit_allocations_audit AFTER INSERT ON dentos_data.fee_credit_allocations FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_fee_reliefs_touch BEFORE UPDATE ON dentos_data.fee_reliefs FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_fee_reliefs_audit AFTER INSERT OR UPDATE OR DELETE ON dentos_data.fee_reliefs FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_fee_credit_line_splits_audit AFTER INSERT ON dentos_data.fee_credit_line_splits FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_fee_relief_line_splits_audit AFTER INSERT ON dentos_data.fee_relief_line_splits FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_collection_refunds_touch BEFORE UPDATE ON dentos_data.collection_refunds FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_collection_refunds_audit AFTER INSERT OR UPDATE OR DELETE ON dentos_data.collection_refunds FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_collection_refund_tenders_audit AFTER INSERT ON dentos_data.collection_refund_tenders FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_legacy_balance_documents_touch BEFORE UPDATE ON dentos_data.legacy_balance_documents FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_legacy_balance_documents_audit AFTER INSERT OR UPDATE OR DELETE ON dentos_data.legacy_balance_documents FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_ledger_accounts_touch BEFORE UPDATE ON dentos_data.ledger_accounts FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_ledger_accounts_audit AFTER INSERT OR UPDATE OR DELETE ON dentos_data.ledger_accounts FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_journal_entries_audit AFTER INSERT ON dentos_data.journal_entries FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_journal_lines_audit AFTER INSERT ON dentos_data.journal_lines FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();

