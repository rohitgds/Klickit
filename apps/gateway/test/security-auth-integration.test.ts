import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { hashSessionToken } from "@klickit/identity";
import { buildServer } from "../src/server.ts";
import { loadGatewayConfig } from "../src/config.ts";
import { createDatabasePool, resolveDatabaseUrl } from "../src/db/client.ts";
import type { DatabasePoolLike } from "../src/db/client.ts";
import { loginOnline, cacheOfflineSnapshot, verifyOfflineLogin } from "../src/auth/service.ts";
import { resolveSession } from "../src/security/middleware.ts";
import { membershipHasPermission } from "../src/security/permissions.ts";
import { createServiceLifecycle } from "../src/lifecycle.ts";
import { TEST_BOOTSTRAP } from "./helpers.ts";

const CLINIC_ID = TEST_BOOTSTRAP.clinic.id;
const ORG_ID = TEST_BOOTSTRAP.clinic.organizationId;
const DEV_PASSWORD = "DevPass123!";
const DEVICE_HASH = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const DEVICE_HASH_B = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

async function canConnect(pool: DatabasePoolLike): Promise<boolean> {
  try {
    await pool.query("SELECT 1 AS ok");
    return true;
  } catch {
    return false;
  }
}

async function approveTestDevice(pool: DatabasePoolLike, fingerprint: string): Promise<void> {
  await pool.query(
    `
      INSERT INTO dentos_runtime.approved_devices (
        id, organization_id, clinic_id, gateway_id,
        device_label, device_fingerprint_hash, approved_by, approved_at, active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, clock_timestamp(), true)
      ON CONFLICT (clinic_id, device_fingerprint_hash)
      DO UPDATE SET active = true, revoked_at = NULL, updated_at = clock_timestamp()
    `,
    [
      crypto.randomUUID(),
      ORG_ID,
      CLINIC_ID,
      TEST_BOOTSTRAP.gateway.id,
      "security-test-device",
      fingerprint,
      "55555555-5555-4555-8555-555555555555",
    ],
  );
}

describe("security auth integration (PostgreSQL)", { skip: process.env.KLICKIT_SKIP_PG_TESTS === "1" }, () => {
  let pool: DatabasePoolLike;
  let available = false;
  let skipReason = "PostgreSQL unavailable";

  before(async () => {
    pool = await createDatabasePool(resolveDatabaseUrl());
    available = await canConnect(pool);
    if (!available) {
      return;
    }

    const schema = await pool.query<{ ready: boolean }>(
      `
        SELECT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'pk_offline_auth_snapshots'
        ) AS ready
      `,
    );
    if (!schema.rows[0]?.ready) {
      available = false;
      skipReason = "Run npx supabase db reset to apply security migration 20260723120000";
      return;
    }

    const credentials = await pool.query(
      `SELECT 1 FROM dentos_data.user_credentials WHERE user_id = '55555555-5555-4555-8555-555555555555' LIMIT 1`,
    );
    if (!credentials.rows[0]) {
      available = false;
      skipReason = "Synthetic seed credentials missing — run npx supabase db reset";
      return;
    }

    await approveTestDevice(pool, DEVICE_HASH);
    await approveTestDevice(pool, DEVICE_HASH_B);
  });

  after(async () => {
    if (pool) {
      await pool.end();
    }
  });

  it("login success returns token without password hash", async (t) => {
    if (!available) {
      t.skip(skipReason);
      return;
    }
    const result = await loginOnline({
      pool,
      clinicId: CLINIC_ID,
      loginName: "dev.admin",
      password: DEV_PASSWORD,
    });
    assert.ok(result);
    assert.ok(result!.token);
    assert.ok(result!.token.length >= 32);
    const body = JSON.stringify(result);
    assert.doesNotMatch(body, /password_hash/i);
    assert.doesNotMatch(body, /\$argon2id\$/);
  });

  it("disabled user cannot login", async (t) => {
    if (!available) {
      t.skip(skipReason);
      return;
    }
    await pool.query(
      `UPDATE dentos_data.users SET status = 'disabled', disabled_at = clock_timestamp(), disabled_by = id WHERE login_name = 'dev.reception'`,
    );
    const result = await loginOnline({
      pool,
      clinicId: CLINIC_ID,
      loginName: "dev.reception",
      password: DEV_PASSWORD,
    });
    assert.equal(result, null);
    await pool.query(
      `UPDATE dentos_data.users SET status = 'active', disabled_at = NULL, disabled_by = NULL WHERE login_name = 'dev.reception'`,
    );
  });

  it("revoked session fails session resolution", async (t) => {
    if (!available) {
      t.skip(skipReason);
      return;
    }
    const login = await loginOnline({
      pool,
      clinicId: CLINIC_ID,
      loginName: "dev.admin",
      password: DEV_PASSWORD,
    });
    assert.ok(login);
    await pool.query(
      `UPDATE dentos_data.user_sessions SET revoked_at = clock_timestamp(), revoked_reason = 'test' WHERE token_hash = $1`,
      [hashSessionToken(login!.token)],
    );
    const config = loadGatewayConfig({ APP_ENV: "local" });
    const deps = {
      config,
      lifecycle: createServiceLifecycle(),
      pool,
      bootstrap: TEST_BOOTSTRAP,
      databaseConnected: true,
    };
    const session = await resolveSession(deps, {
      headers: { "x-session-token": login!.token },
    } as never);
    assert.equal(session, null);
  });

  it("changed authz_version invalidates existing session", async (t) => {
    if (!available) {
      t.skip(skipReason);
      return;
    }
    const login = await loginOnline({
      pool,
      clinicId: CLINIC_ID,
      loginName: "dev.admin",
      password: DEV_PASSWORD,
    });
    assert.ok(login);
    await pool.query(`UPDATE dentos_data.users SET authz_version = authz_version + 1 WHERE login_name = 'dev.admin'`);
    const config = loadGatewayConfig({ APP_ENV: "local" });
    const deps = {
      config,
      lifecycle: createServiceLifecycle(),
      pool,
      bootstrap: TEST_BOOTSTRAP,
      databaseConnected: true,
    };
    const session = await resolveSession(deps, {
      headers: { "x-session-token": login!.token },
    } as never);
    assert.equal(session, null);
  });

  it("inactive membership blocks login", async (t) => {
    if (!available) {
      t.skip(skipReason);
      return;
    }
    await pool.query(
      `UPDATE dentos_data.clinic_memberships SET active = false WHERE user_id = (SELECT id FROM dentos_data.users WHERE login_name = 'dev.reception')`,
    );
    const result = await loginOnline({
      pool,
      clinicId: CLINIC_ID,
      loginName: "dev.reception",
      password: DEV_PASSWORD,
    });
    assert.equal(result, null);
    await pool.query(
      `UPDATE dentos_data.clinic_memberships SET active = true WHERE user_id = (SELECT id FROM dentos_data.users WHERE login_name = 'dev.reception')`,
    );
  });

  it("deny override wins over role allow", async (t) => {
    if (!available) {
      t.skip(skipReason);
      return;
    }
    const membership = await pool.query<{ id: string }>(
      `
        SELECT cm.id
        FROM dentos_data.clinic_memberships cm
        JOIN dentos_data.users u ON u.id = cm.user_id
        WHERE u.login_name = 'dev.reception' AND cm.clinic_id = $1
      `,
      [CLINIC_ID],
    );
    const membershipId = membership.rows[0]?.id;
    assert.ok(membershipId);
    const permission = await pool.query<{ id: string }>(
      `SELECT id FROM dentos_data.permissions WHERE code = 'patient.view' LIMIT 1`,
    );
    const permissionId = permission.rows[0]?.id;
    assert.ok(permissionId);
    await pool.query(
      `
        INSERT INTO dentos_data.membership_permission_overrides (
          membership_id, permission_id, effect, reason, granted_by, granted_at, created_at, updated_at
        ) VALUES ($1, $2, 'deny', 'security integration test deny override', $3, clock_timestamp(), clock_timestamp(), clock_timestamp())
        ON CONFLICT (membership_id, permission_id)
        DO UPDATE SET effect = 'deny', reason = EXCLUDED.reason, updated_at = clock_timestamp()
      `,
      [membershipId, permissionId, "55555555-5555-4555-8555-555555555555"],
    );
    const allowed = await membershipHasPermission(pool, membershipId!, "patient.view");
    assert.equal(allowed, false);
    await pool.query(
      `DELETE FROM dentos_data.membership_permission_overrides WHERE membership_id = $1 AND permission_id = $2`,
      [membershipId, permissionId],
    );
  });

  it("two offline users on one approved device", async (t) => {
    if (!available) {
      t.skip(skipReason);
      return;
    }
    const admin = await loginOnline({
      pool,
      clinicId: CLINIC_ID,
      loginName: "dev.admin",
      password: DEV_PASSWORD,
      deviceFingerprintHash: DEVICE_HASH,
    });
    const reception = await loginOnline({
      pool,
      clinicId: CLINIC_ID,
      loginName: "dev.reception",
      password: DEV_PASSWORD,
      deviceFingerprintHash: DEVICE_HASH,
    });
    assert.ok(admin);
    assert.ok(reception);

    const adminOffline = await verifyOfflineLogin(pool, {
      clinicId: CLINIC_ID,
      deviceFingerprintHash: DEVICE_HASH,
      loginName: "dev.admin",
      password: DEV_PASSWORD,
    });
    const receptionOffline = await verifyOfflineLogin(pool, {
      clinicId: CLINIC_ID,
      deviceFingerprintHash: DEVICE_HASH,
      loginName: "dev.reception",
      password: DEV_PASSWORD,
    });
    assert.equal(adminOffline.valid, true);
    assert.equal(receptionOffline.valid, true);
    const snapshotCount = await pool.query<{ count: string }>(
      `
        SELECT count(*)::text AS count
        FROM dentos_runtime.offline_auth_snapshots
        WHERE clinic_id = $1 AND device_fingerprint_hash = $2
      `,
      [CLINIC_ID, DEVICE_HASH],
    );
    assert.equal(Number(snapshotCount.rows[0]?.count ?? 0), 2);
  });

  it("expired offline snapshot is rejected", async (t) => {
    if (!available) {
      t.skip(skipReason);
      return;
    }
    const user = await pool.query<{ id: string; authz_version: string }>(
      `SELECT id, authz_version FROM dentos_data.users WHERE login_name = 'dev.admin'`,
    );
    const row = user.rows[0];
    assert.ok(row);
    await cacheOfflineSnapshot(pool, {
      organizationId: ORG_ID,
      clinicId: CLINIC_ID,
      userId: row.id,
      authzVersion: Number(row.authz_version),
      permissionCodes: ["patient.view"],
      deviceFingerprintHash: DEVICE_HASH_B,
    });
    await pool.query(
      `
        UPDATE dentos_runtime.offline_auth_snapshots
        SET expires_at = clock_timestamp() - interval '1 minute'
        WHERE clinic_id = $1 AND device_fingerprint_hash = $2 AND user_id = $3
      `,
      [CLINIC_ID, DEVICE_HASH_B, row.id],
    );
    const offline = await verifyOfflineLogin(pool, {
      clinicId: CLINIC_ID,
      deviceFingerprintHash: DEVICE_HASH_B,
      loginName: "dev.admin",
      password: DEV_PASSWORD,
    });
    assert.equal(offline.valid, false);
  });

  it("unapproved device rejects online login", async (t) => {
    if (!available) {
      t.skip(skipReason);
      return;
    }
    const result = await loginOnline({
      pool,
      clinicId: CLINIC_ID,
      loginName: "dev.admin",
      password: DEV_PASSWORD,
      deviceFingerprintHash: "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
    });
    assert.equal(result, null);
  });

  it("HTTP auth routes never expose password hashes", async (t) => {
    if (!available) {
      t.skip(skipReason);
      return;
    }
    const config = loadGatewayConfig({ APP_ENV: "local", CLINIC_CODE: "DEV", GATEWAY_CODE: "DEV-GW-01" });
    const { app, close } = await buildServer({ config, pool, bootstrap: TEST_BOOTSTRAP, closePoolOnClose: false });
    const login = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { loginName: "dev.admin", password: DEV_PASSWORD },
    });
    assert.equal(login.statusCode, 200);
    const loginBody = login.payload;
    assert.doesNotMatch(loginBody, /password_hash/i);
    assert.doesNotMatch(loginBody, /\$argon2id\$/);
    const token = login.json().token as string;
    const session = await app.inject({
      method: "GET",
      url: "/auth/session",
      headers: { "x-session-token": token },
    });
    assert.equal(session.statusCode, 200);
    assert.doesNotMatch(session.payload, /token_hash/i);
    await close();
  });
});
