-- Generated from Blueprint 01 — audit triggers for identity tables

SET search_path = dentos_data, dentos_runtime, public;

CREATE TRIGGER trg_organizations_touch BEFORE UPDATE ON dentos_data.organizations FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_organizations_audit AFTER INSERT OR UPDATE OR DELETE ON dentos_data.organizations FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_clinics_touch BEFORE UPDATE ON dentos_data.clinics FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_clinics_audit AFTER INSERT OR UPDATE OR DELETE ON dentos_data.clinics FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_users_touch BEFORE UPDATE ON dentos_data.users FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_users_audit AFTER INSERT OR UPDATE OR DELETE ON dentos_data.users FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_user_credentials_touch BEFORE UPDATE ON dentos_data.user_credentials FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_user_credentials_audit AFTER INSERT OR UPDATE OR DELETE ON dentos_data.user_credentials FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_password_reset_tokens_audit AFTER INSERT ON dentos_data.password_reset_tokens FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_user_sessions_audit AFTER INSERT ON dentos_data.user_sessions FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_staff_touch BEFORE UPDATE ON dentos_data.staff FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_staff_audit AFTER INSERT OR UPDATE OR DELETE ON dentos_data.staff FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_staff_clinics_touch BEFORE UPDATE ON dentos_data.staff_clinics FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_staff_clinics_audit AFTER INSERT OR UPDATE OR DELETE ON dentos_data.staff_clinics FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_staff_user_links_touch BEFORE UPDATE ON dentos_data.staff_user_links FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_staff_user_links_audit AFTER INSERT OR UPDATE OR DELETE ON dentos_data.staff_user_links FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_clinic_memberships_touch BEFORE UPDATE ON dentos_data.clinic_memberships FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_clinic_memberships_audit AFTER INSERT OR UPDATE OR DELETE ON dentos_data.clinic_memberships FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_roles_touch BEFORE UPDATE ON dentos_data.roles FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_roles_audit AFTER INSERT OR UPDATE OR DELETE ON dentos_data.roles FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_permissions_touch BEFORE UPDATE ON dentos_data.permissions FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_permissions_audit AFTER INSERT OR UPDATE OR DELETE ON dentos_data.permissions FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_role_permissions_touch BEFORE UPDATE ON dentos_data.role_permissions FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_role_permissions_audit AFTER INSERT OR UPDATE OR DELETE ON dentos_data.role_permissions FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_membership_roles_touch BEFORE UPDATE ON dentos_data.membership_roles FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_membership_roles_audit AFTER INSERT OR UPDATE OR DELETE ON dentos_data.membership_roles FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_membership_permission_overrides_touch BEFORE UPDATE ON dentos_data.membership_permission_overrides FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_membership_permission_overrides_audit AFTER INSERT OR UPDATE OR DELETE ON dentos_data.membership_permission_overrides FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();

