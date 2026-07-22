import {
  createSessionToken,
  hashPassword,
  hashSessionToken,
  verifyPassword,
  type AuthSessionContext,
} from "@klickit/identity";
import type { DatabasePoolLike } from "../db/client.js";
import { loadPermissionCodes } from "../security/permissions.js";
import { isDeviceApproved } from "../clinic/services.js";

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
    membership_id: string;
  }>(
    `
      SELECT
        u.id AS user_id,
        u.organization_id,
        u.authz_version,
        uc.password_hash,
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
  if (!row || !verifyPassword(input.password, row.password_hash)) {
    return null;
  }

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
      SET revoked_at = clock_timestamp()
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
        device_fingerprint_hash, organization_id, clinic_id, user_id,
        authz_version, permission_codes, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, clock_timestamp() + interval '72 hours')
      ON CONFLICT (device_fingerprint_hash)
      DO UPDATE SET
        user_id = EXCLUDED.user_id,
        authz_version = EXCLUDED.authz_version,
        permission_codes = EXCLUDED.permission_codes,
        cached_at = clock_timestamp(),
        expires_at = EXCLUDED.expires_at
    `,
    [
      input.deviceFingerprintHash,
      input.organizationId,
      input.clinicId,
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
  const snapshot = await pool.query<{ user_id: string; permission_codes: string[]; expires_at: string }>(
    `
      SELECT user_id, permission_codes, expires_at
      FROM dentos_runtime.offline_auth_snapshots
      WHERE clinic_id = $1
        AND device_fingerprint_hash = $2
        AND expires_at > clock_timestamp()
    `,
    [input.clinicId, input.deviceFingerprintHash],
  );
  const cached = snapshot.rows[0];
  if (!cached) {
    return { valid: false, reason: "No offline snapshot for approved device" };
  }

  const userResult = await pool.query<{ password_hash: string; login_name: string }>(
    `
      SELECT uc.password_hash, u.login_name
      FROM dentos_data.users u
      JOIN dentos_data.user_credentials uc ON uc.user_id = u.id
      WHERE u.id = $1 AND u.status = 'active'
    `,
    [cached.user_id],
  );
  const user = userResult.rows[0];
  if (!user || user.login_name.toLowerCase() !== input.loginName.toLowerCase()) {
    return { valid: false, reason: "User not recognized for cached device" };
  }
  if (!verifyPassword(input.password, user.password_hash)) {
    return { valid: false, reason: "Invalid offline credentials" };
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
