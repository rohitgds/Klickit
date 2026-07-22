import {
  createSessionToken,
  hashPassword,
  hashSessionToken,
  verifyPassword,
  PASSWORD_ALGORITHM_ARGON2ID,
  PASSWORD_ALGORITHM_LEGACY_SCRYPT,
  type AuthSessionContext,
} from "@klickit/identity";
import type { DatabasePoolLike } from "../db/client.js";
import { loadPermissionCodes } from "../security/permissions.js";
import { isDeviceApproved } from "../clinic/services.js";

async function upgradeLegacyCredentialIfNeeded(
  pool: DatabasePoolLike,
  input: { userId: string; password: string; passwordAlgorithm: string; passwordHash: string },
): Promise<void> {
  if (input.passwordAlgorithm !== PASSWORD_ALGORITHM_LEGACY_SCRYPT) {
    return;
  }
  const valid = await verifyPassword(input.password, input.passwordHash, input.passwordAlgorithm);
  if (!valid) {
    return;
  }
  const upgraded = await hashPassword(input.password);
  await pool.query(
    `
      UPDATE dentos_data.user_credentials
      SET password_hash = $2,
          password_algorithm = $3,
          password_changed_at = clock_timestamp(),
          updated_at = clock_timestamp()
      WHERE user_id = $1
    `,
    [input.userId, upgraded.hash, upgraded.algorithm],
  );
}

export async function loginOnline(input: {
  pool: DatabasePoolLike;
  clinicId: string;
  loginName: string;
  password: string;
  deviceFingerprintHash?: string;
}): Promise<{ token: string; session: AuthSessionContext; expiresAt: string } | null> {
  const userResult = await input.pool.query<{
    user_id: string;
    organization_id: string;
    authz_version: string;
    password_hash: string;
    password_algorithm: string;
    membership_id: string;
  }>(
    `
      SELECT
        u.id AS user_id,
        u.organization_id,
        u.authz_version,
        uc.password_hash,
        uc.password_algorithm,
        cm.id AS membership_id
      FROM dentos_data.users u
      JOIN dentos_data.user_credentials uc ON uc.user_id = u.id
      JOIN dentos_data.clinic_memberships cm ON cm.user_id = u.id AND cm.clinic_id = $1 AND cm.active = true
      WHERE lower(u.login_name) = lower($2)
        AND u.status = 'active'
      LIMIT 1
    `,
    [input.clinicId, input.loginName],
  );
  const row = userResult.rows[0];
  if (!row) {
    return null;
  }
  const passwordValid = await verifyPassword(input.password, row.password_hash, row.password_algorithm);
  if (!passwordValid) {
    return null;
  }

  await upgradeLegacyCredentialIfNeeded(input.pool, {
    userId: row.user_id,
    password: input.password,
    passwordAlgorithm: row.password_algorithm,
    passwordHash: row.password_hash,
  });

  if (input.deviceFingerprintHash) {
    const approved = await isDeviceApproved(input.pool, input.clinicId, input.deviceFingerprintHash);
    if (!approved) {
      return null;
    }
  }

  const token = createSessionToken();
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
  const sessionId = crypto.randomUUID();
  await input.pool.query(
    `
      INSERT INTO dentos_data.user_sessions (
        id, user_id, token_hash, authz_version, created_at, expires_at
      ) VALUES ($1, $2, $3, $4, clock_timestamp(), $5::timestamptz)
    `,
    [sessionId, row.user_id, tokenHash, row.authz_version, expiresAt],
  );

  const permissionCodes = await loadPermissionCodes(input.pool, row.membership_id);
  const session: AuthSessionContext = {
    userId: row.user_id,
    organizationId: row.organization_id,
    clinicId: input.clinicId,
    membershipId: row.membership_id,
    authzVersion: Number(row.authz_version),
    permissionCodes,
  };

  if (input.deviceFingerprintHash) {
    await cacheOfflineSnapshot(input.pool, {
      clinicId: input.clinicId,
      organizationId: row.organization_id,
      userId: row.user_id,
      authzVersion: Number(row.authz_version),
      permissionCodes,
      deviceFingerprintHash: input.deviceFingerprintHash,
    });
  }

  return { token, session, expiresAt };
}

export async function logoutSession(pool: DatabasePoolLike, tokenHash: string): Promise<void> {
  await pool.query(
    `
      UPDATE dentos_data.user_sessions
      SET revoked_at = clock_timestamp(),
          revoked_reason = 'logout'
      WHERE token_hash = $1 AND revoked_at IS NULL
    `,
    [tokenHash],
  );
}

export async function cacheOfflineSnapshot(
  pool: DatabasePoolLike,
  input: {
    organizationId: string;
    clinicId: string;
    userId: string;
    authzVersion: number;
    permissionCodes: readonly string[];
    deviceFingerprintHash: string;
  },
): Promise<void> {
  await pool.query(
    `
      INSERT INTO dentos_runtime.offline_auth_snapshots (
        clinic_id, device_fingerprint_hash, organization_id, user_id,
        authz_version, permission_codes, expires_at
      ) VALUES ($2, $1, $3, $4, $5, $6::jsonb, clock_timestamp() + interval '72 hours')
      ON CONFLICT (clinic_id, device_fingerprint_hash, user_id)
      DO UPDATE SET
        authz_version = EXCLUDED.authz_version,
        permission_codes = EXCLUDED.permission_codes,
        cached_at = clock_timestamp(),
        expires_at = EXCLUDED.expires_at
    `,
    [
      input.deviceFingerprintHash,
      input.clinicId,
      input.organizationId,
      input.userId,
      input.authzVersion,
      JSON.stringify(input.permissionCodes),
    ],
  );
}

export async function verifyOfflineLogin(
  pool: DatabasePoolLike,
  input: { clinicId: string; deviceFingerprintHash: string; loginName: string; password: string },
): Promise<{ valid: boolean; reason?: string; permissionCodes?: string[] }> {
  const userResult = await pool.query<{
    user_id: string;
    password_hash: string;
    password_algorithm: string;
    authz_version: string;
  }>(
    `
      SELECT u.id AS user_id, uc.password_hash, uc.password_algorithm, u.authz_version
      FROM dentos_data.users u
      JOIN dentos_data.user_credentials uc ON uc.user_id = u.id
      JOIN dentos_data.clinic_memberships cm ON cm.user_id = u.id AND cm.clinic_id = $1 AND cm.active = true
      WHERE lower(u.login_name) = lower($2)
        AND u.status = 'active'
      LIMIT 1
    `,
    [input.clinicId, input.loginName],
  );
  const user = userResult.rows[0];
  if (!user) {
    return { valid: false, reason: "User not recognized for clinic" };
  }

  const passwordValid = await verifyPassword(input.password, user.password_hash, user.password_algorithm);
  if (!passwordValid) {
    return { valid: false, reason: "Invalid offline credentials" };
  }

  const snapshot = await pool.query<{ permission_codes: string[]; expires_at: string; authz_version: string }>(
    `
      SELECT permission_codes, expires_at, authz_version
      FROM dentos_runtime.offline_auth_snapshots
      WHERE clinic_id = $1
        AND device_fingerprint_hash = $2
        AND user_id = $3
        AND expires_at > clock_timestamp()
    `,
    [input.clinicId, input.deviceFingerprintHash, user.user_id],
  );
  const cached = snapshot.rows[0];
  if (!cached) {
    return { valid: false, reason: "No offline snapshot for approved device and user" };
  }

  if (Number(cached.authz_version) !== Number(user.authz_version)) {
    return { valid: false, reason: "Offline snapshot authz version stale" };
  }

  return { valid: true, permissionCodes: cached.permission_codes };
}

export async function createDevSession(
  pool: DatabasePoolLike,
  input: { clinicId: string; loginName: string },
): Promise<{ token: string; session: AuthSessionContext; expiresAt: string } | null> {
  const userResult = await pool.query<{
    user_id: string;
    organization_id: string;
    authz_version: string;
    membership_id: string;
  }>(
    `
      SELECT u.id AS user_id, u.organization_id, u.authz_version, cm.id AS membership_id
      FROM dentos_data.users u
      JOIN dentos_data.clinic_memberships cm ON cm.user_id = u.id AND cm.clinic_id = $1 AND cm.active = true
      WHERE lower(u.login_name) = lower($2) AND u.status = 'active'
      LIMIT 1
    `,
    [input.clinicId, input.loginName],
  );
  const row = userResult.rows[0];
  if (!row) {
    return null;
  }
  const token = createSessionToken();
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
  await pool.query(
    `
      INSERT INTO dentos_data.user_sessions (
        id, user_id, token_hash, authz_version, created_at, expires_at
      ) VALUES ($1, $2, $3, $4, clock_timestamp(), $5::timestamptz)
    `,
    [crypto.randomUUID(), row.user_id, tokenHash, row.authz_version, expiresAt],
  );
  const permissionCodes = await loadPermissionCodes(pool, row.membership_id);
  return {
    token,
    session: {
      userId: row.user_id,
      organizationId: row.organization_id,
      clinicId: input.clinicId,
      membershipId: row.membership_id,
      authzVersion: Number(row.authz_version),
      permissionCodes,
    },
    expiresAt,
  };
}

export { hashPassword };
