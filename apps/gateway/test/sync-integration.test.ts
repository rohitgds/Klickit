import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import {
  buildSyntheticSyncEvent,
  buildTwoClinicSyncScenario,
  SYNTHETIC_SYNC_CLINIC_A,
  SYNTHETIC_SYNC_CLINIC_B,
} from "@klickit/test-fixtures";
import { buildServer } from "../src/server.ts";
import { createDatabasePool, resolveDatabaseUrl } from "../src/db/client.ts";
import type { DatabasePoolLike } from "../src/db/client.ts";
import {
  applyPushBatchLocally,
  evaluateOfflineWritePolicy,
  getSyncStatusSummary,
  recordPushResults,
  type SyncEngineContext,
} from "../src/sync/engine.ts";
import {
  listOpenConflicts,
  queueDuplicateCandidate,
  reconcileFieldPatches,
} from "../src/sync/conflicts.ts";
import { TEST_BOOTSTRAP } from "./helpers.ts";

const CLINIC_ID = TEST_BOOTSTRAP.clinic.id;
const ORG_ID = TEST_BOOTSTRAP.clinic.organizationId;
const GATEWAY_ID = TEST_BOOTSTRAP.gateway.id;
const TEST_PREFIX = "sync-test-";

async function canConnect(pool: DatabasePoolLike): Promise<boolean> {
  try {
    await pool.query("SELECT 1 AS ok");
    return true;
  } catch {
    return false;
  }
}

function syncContext(pool: DatabasePoolLike, gateway = TEST_BOOTSTRAP.gateway): SyncEngineContext {
  return { pool, gateway };
}

async function cleanupSyncTestArtifacts(pool: DatabasePoolLike): Promise<void> {
  await pool.query(
    `
      DELETE FROM dentos_runtime.sync_dead_letters
      WHERE gateway_id = $1 AND idempotency_key LIKE $2
    `,
    [GATEWAY_ID, `${TEST_PREFIX}%`],
  );
  await pool.query(
    `
      DELETE FROM dentos_runtime.sync_conflict_resolutions
      WHERE conflict_id IN (
        SELECT id FROM dentos_runtime.sync_conflicts
        WHERE clinic_id = $1 AND aggregate_id::text LIKE 'aaaaaaaa%'
      )
    `,
    [CLINIC_ID],
  );
  await pool.query(
    `
      DELETE FROM dentos_runtime.sync_conflicts
      WHERE clinic_id = $1 AND aggregate_id::text LIKE 'aaaaaaaa%'
    `,
    [CLINIC_ID],
  );
  await pool.query(
    `
      DELETE FROM dentos_runtime.sync_outbox_events
      WHERE gateway_id = $1 AND idempotency_key LIKE $2
    `,
    [GATEWAY_ID, `${TEST_PREFIX}%`],
  );
}

describe("sync integration (PostgreSQL)", { skip: process.env.KLICKIT_SKIP_PG_TESTS === "1" }, () => {
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
          FROM information_schema.tables
          WHERE table_schema = 'dentos_runtime'
            AND table_name = 'sync_dead_letters'
        ) AS ready
      `,
    );
    if (!schema.rows[0]?.ready) {
      available = false;
      skipReason = "Run npx supabase db reset to apply migration 20260723130000";
      return;
    }

    await cleanupSyncTestArtifacts(pool);
  });

  it("SYNC-001: duplicate idempotency key returns already_applied", async (t) => {
    if (!available) {
      t.skip(skipReason);
      return;
    }

    const event = buildSyntheticSyncEvent({
      clinic: SYNTHETIC_SYNC_CLINIC_A,
      idempotencyKey: `${TEST_PREFIX}001`,
      aggregateId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0001",
      payloadJson: { name: "Replay Patient" },
    });

    const ctx = syncContext(pool);
    const first = await applyPushBatchLocally(ctx, { gatewayId: GATEWAY_ID, clinicId: CLINIC_ID, events: [event] });
    const second = await applyPushBatchLocally(ctx, { gatewayId: GATEWAY_ID, clinicId: CLINIC_ID, events: [event] });

    assert.equal(first.results[0]?.status, "accepted");
    assert.equal(second.results[0]?.status, "already_applied");

    const pending = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM dentos_runtime.sync_outbox_events WHERE idempotency_key = $1`,
      [`${TEST_PREFIX}001`],
    );
    assert.equal(pending.rows[0]?.count, "1");
  });

  it("SYNC-002: same-field conflict opens manual queue row", async (t) => {
    if (!available) {
      t.skip(skipReason);
      return;
    }

    const aggregateId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0002";
    const { merged, conflictIds } = await reconcileFieldPatches(pool, {
      organizationId: ORG_ID,
      clinicId: CLINIC_ID,
      gatewayId: GATEWAY_ID,
      aggregateType: "patient",
      aggregateId,
      base: { name: "Base", phone: "111" },
      localPatch: { phone: "222" },
      cloudPatch: { phone: "333" },
    });

    assert.equal(conflictIds.length, 1);
    assert.equal(merged.phone, "222");

    const conflicts = await listOpenConflicts(pool, CLINIC_ID);
    const row = conflicts.find((c) => c.id === conflictIds[0]);
    assert.ok(row);
    assert.equal(row.fieldName, "phone");
  });

  it("SYNC-003: different-field patches merge without conflict", async (t) => {
    if (!available) {
      t.skip(skipReason);
      return;
    }

    const { merged, conflictIds } = await reconcileFieldPatches(pool, {
      organizationId: ORG_ID,
      clinicId: CLINIC_ID,
      gatewayId: GATEWAY_ID,
      aggregateType: "patient",
      aggregateId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0003",
      base: { name: "Patient" },
      localPatch: { phone: "9000000001" },
      cloudPatch: { email: "sync@example.test" },
    });

    assert.equal(conflictIds.length, 0);
    assert.deepEqual(merged, {
      name: "Patient",
      phone: "9000000001",
      email: "sync@example.test",
    });
  });

  it("SYNC-004: duplicate patients queue conflict without deletion", async (t) => {
    if (!available) {
      t.skip(skipReason);
      return;
    }

    const patientA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0004";
    const patientB = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0005";

    const conflictId = await queueDuplicateCandidate(pool, {
      organizationId: ORG_ID,
      clinicId: CLINIC_ID,
      patientIdA: patientA,
      patientIdB: patientB,
      matchSignals: ["mobile", "name"],
    });

    const conflicts = await listOpenConflicts(pool, CLINIC_ID);
    const row = conflicts.find((c) => c.id === conflictId);
    assert.ok(row);
    assert.equal(row.aggregateType, "patient_duplicate");
    assert.equal(row.fieldName, "duplicate_candidate");
  });

  it("records dead letters for rejected cloud push results", async (t) => {
    if (!available) {
      t.skip(skipReason);
      return;
    }

    const idempotencyKey = `${TEST_PREFIX}dead-letter`;
    const event = buildSyntheticSyncEvent({
      clinic: SYNTHETIC_SYNC_CLINIC_A,
      idempotencyKey,
      aggregateId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0006",
      payloadJson: { name: "Dead Letter Patient" },
    });

    const ctx = syncContext(pool);
    await applyPushBatchLocally(ctx, { gatewayId: GATEWAY_ID, clinicId: CLINIC_ID, events: [event] });
    await recordPushResults(ctx, [{ idempotencyKey, status: "rejected", error: "cloud validation failed" }]);

    const deadLetters = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM dentos_runtime.sync_dead_letters WHERE idempotency_key = $1`,
      [idempotencyKey],
    );
    assert.equal(deadLetters.rows[0]?.count, "1");
  });

  it("OFF-003: 72h offline policy blocks gateway push", async (t) => {
    if (!available) {
      t.skip(skipReason);
      return;
    }

    const readOnlyGateway = {
      ...TEST_BOOTSTRAP.gateway,
      lastSuccessfulCloudSyncAt: new Date(Date.now() - 80 * 60 * 60 * 1000).toISOString(),
      readOnlyAt: new Date().toISOString(),
    };
    const policy = evaluateOfflineWritePolicy(readOnlyGateway);
    assert.equal(policy.readOnly, true);
    assert.equal(policy.writeAllowed, false);

    const { app, close } = await buildServer({
      pool,
      bootstrap: { ...TEST_BOOTSTRAP, gateway: readOnlyGateway },
      closePoolOnClose: false,
    });
    const response = await app.inject({
      method: "POST",
      url: "/sync/push",
      payload: {
        gatewayId: GATEWAY_ID,
        clinicId: CLINIC_ID,
        events: [],
      },
    });
    assert.equal(response.statusCode, 403);
    await close();
  });

  it("exposes sync status summary counts", async (t) => {
    if (!available) {
      t.skip(skipReason);
      return;
    }

    const ctx = syncContext(pool);
    const summary = await getSyncStatusSummary(ctx);
    assert.equal(typeof summary.pendingOutbox, "number");
    assert.equal(typeof summary.failedOutbox, "number");
    assert.equal(typeof summary.openConflicts, "number");
    assert.equal(typeof summary.deadLetters, "number");
    assert.equal(typeof summary.offlinePolicy.offlineHours, "number");
  });

  it("two-clinic fixture produces distinct clinic envelopes", () => {
    const scenario = buildTwoClinicSyncScenario();
    assert.notEqual(scenario.clinicAEvent.clinicId, scenario.clinicBEvent.clinicId);
    assert.equal(scenario.clinicAEvent.clinicId, SYNTHETIC_SYNC_CLINIC_A.clinicId);
    assert.equal(scenario.clinicBEvent.clinicId, SYNTHETIC_SYNC_CLINIC_B.clinicId);
  });
});
