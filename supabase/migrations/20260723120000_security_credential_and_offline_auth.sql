-- Security Remediation 1: offline snapshot per user, password algorithm constraint, authz invalidation triggers

SET search_path = dentos_runtime, dentos_data, public;

ALTER TABLE dentos_data.user_credentials
  DROP CONSTRAINT IF EXISTS ck_user_credentials_password_algorithm;

ALTER TABLE dentos_data.user_credentials
  ADD CONSTRAINT ck_user_credentials_password_algorithm
  CHECK (password_algorithm IN ('argon2id', 'legacy-scrypt-v1'));

ALTER TABLE dentos_runtime.offline_auth_snapshots
  DROP CONSTRAINT offline_auth_snapshots_pkey;

ALTER TABLE dentos_runtime.offline_auth_snapshots
  ADD CONSTRAINT pk_offline_auth_snapshots
  PRIMARY KEY (clinic_id, device_fingerprint_hash, user_id);

CREATE OR REPLACE FUNCTION dentos_runtime.bump_user_authz_version_from_membership()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_user_id uuid;
  target_membership_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'membership_roles' THEN
    target_membership_id := COALESCE(NEW.membership_id, OLD.membership_id);
  ELSIF TG_TABLE_NAME = 'membership_permission_overrides' THEN
    target_membership_id := COALESCE(NEW.membership_id, OLD.membership_id);
  ELSIF TG_TABLE_NAME = 'clinic_memberships' THEN
    target_membership_id := COALESCE(NEW.id, OLD.id);
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT cm.user_id
  INTO target_user_id
  FROM dentos_data.clinic_memberships cm
  WHERE cm.id = target_membership_id;

  IF target_user_id IS NOT NULL THEN
    UPDATE dentos_data.users
    SET authz_version = authz_version + 1,
        updated_at = clock_timestamp()
    WHERE id = target_user_id;

    UPDATE dentos_data.user_sessions
    SET revoked_at = clock_timestamp(),
        revoked_reason = 'authz_change'
    WHERE user_id = target_user_id
      AND revoked_at IS NULL;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION dentos_runtime.revoke_sessions_on_user_status_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'active' THEN
    UPDATE dentos_data.user_sessions
    SET revoked_at = clock_timestamp(),
        revoked_reason = 'user_status_change'
    WHERE user_id = NEW.id
      AND revoked_at IS NULL;

    NEW.authz_version := OLD.authz_version + 1;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_membership_roles_authz_invalidate ON dentos_data.membership_roles;
CREATE TRIGGER trg_membership_roles_authz_invalidate
AFTER INSERT OR UPDATE OR DELETE ON dentos_data.membership_roles
FOR EACH ROW EXECUTE FUNCTION dentos_runtime.bump_user_authz_version_from_membership();

DROP TRIGGER IF EXISTS trg_membership_permission_overrides_authz_invalidate ON dentos_data.membership_permission_overrides;
CREATE TRIGGER trg_membership_permission_overrides_authz_invalidate
AFTER INSERT OR UPDATE OR DELETE ON dentos_data.membership_permission_overrides
FOR EACH ROW EXECUTE FUNCTION dentos_runtime.bump_user_authz_version_from_membership();

DROP TRIGGER IF EXISTS trg_clinic_memberships_authz_invalidate ON dentos_data.clinic_memberships;
CREATE TRIGGER trg_clinic_memberships_authz_invalidate
AFTER UPDATE OF active ON dentos_data.clinic_memberships
FOR EACH ROW
WHEN (OLD.active IS DISTINCT FROM NEW.active)
EXECUTE FUNCTION dentos_runtime.bump_user_authz_version_from_membership();

DROP TRIGGER IF EXISTS trg_users_status_authz_invalidate ON dentos_data.users;
CREATE TRIGGER trg_users_status_authz_invalidate
BEFORE UPDATE OF status ON dentos_data.users
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION dentos_runtime.revoke_sessions_on_user_status_change();
