import { buildBackupChecksum, buildMigrationAcceptanceReport, evaluateReadinessDrill, validateRestoreDrill } from "@klickit/resilience";
import type { DatabasePoolLike } from "../db/client.js";

type DbContext = {
  pool: DatabasePoolLike;
  organizationId: string;
  clinicId: string;
  gatewayId?: string;
};

export async function recordBackupRun(
  ctx: DbContext,
  input: { artifactPath: string; actorUserId: string; notes?: string },
) {
  const startedAt = new Date().toISOString();
  const checksum = buildBackupChecksum({
    clinicCode: ctx.clinicId,
    startedAt,
    artifactPath: input.artifactPath,
  });
  const id = crypto.randomUUID();
  await ctx.pool.query(
    `
      INSERT INTO dentos_runtime.backup_runs (
        id, organization_id, clinic_id, gateway_id, backup_type, status, checksum, artifact_path, started_at, completed_at, created_by, notes
      ) VALUES ($1, $2, $3, $4, 'database', 'completed', $5, $6, $7, clock_timestamp(), $8, $9)
    `,
    [
      id,
      ctx.organizationId,
      ctx.clinicId,
      ctx.gatewayId ?? null,
      checksum,
      input.artifactPath,
      startedAt,
      input.actorUserId,
      input.notes ?? null,
    ],
  );
  return { id, status: "completed", checksum };
}

export async function listBackupRuns(ctx: DbContext) {
  const result = await ctx.pool.query(
    `
      SELECT *
      FROM dentos_runtime.backup_runs
      WHERE clinic_id = $1
      ORDER BY started_at DESC
      LIMIT 20
    `,
    [ctx.clinicId],
  );
  return { runs: result.rows };
}

export async function recordRestoreDrill(
  ctx: DbContext,
  input: { backupRunId: string; restoredChecksum: string; actorUserId: string },
) {
  const backup = await ctx.pool.query<{ checksum: string }>(
    `SELECT checksum FROM dentos_runtime.backup_runs WHERE id = $1 AND clinic_id = $2`,
    [input.backupRunId, ctx.clinicId],
  );
  if (!backup.rows[0]) {
    throw new Error("Backup run not found");
  }
  const validation = validateRestoreDrill({
    backupChecksum: backup.rows[0].checksum,
    restoredChecksum: input.restoredChecksum,
  });
  const id = crypto.randomUUID();
  await ctx.pool.query(
    `
      INSERT INTO dentos_runtime.restore_drills (
        id, backup_run_id, clinic_id, status, started_at, completed_at, variance_notes, created_by
      ) VALUES ($1, $2, $3, $4, clock_timestamp(), clock_timestamp(), $5, $6)
    `,
    [
      id,
      input.backupRunId,
      ctx.clinicId,
      validation.ok ? "passed" : "failed",
      validation.ok ? null : validation.message,
      input.actorUserId,
    ],
  );
  return { id, status: validation.ok ? "passed" : "failed" };
}

export async function openGatewayIncident(
  ctx: DbContext,
  input: {
    incidentType: "spare_activation" | "hardware_failure" | "recovery_drill";
    spareGatewayCode?: string;
    runbookReference: string;
    actorUserId: string;
  },
) {
  const id = crypto.randomUUID();
  await ctx.pool.query(
    `
      INSERT INTO dentos_runtime.gateway_incidents (
        id, clinic_id, incident_type, status, spare_gateway_code, runbook_reference, created_by
      ) VALUES ($1, $2, $3, 'open', $4, $5, $6)
    `,
    [id, ctx.clinicId, input.incidentType, input.spareGatewayCode ?? null, input.runbookReference, input.actorUserId],
  );
  return { id, status: "open" };
}

export async function getRecoveryStatus(ctx: DbContext) {
  const [backups, drills, incidents] = await Promise.all([
    ctx.pool.query(
      `SELECT * FROM dentos_runtime.backup_runs WHERE clinic_id = $1 ORDER BY started_at DESC LIMIT 1`,
      [ctx.clinicId],
    ),
    ctx.pool.query(
      `SELECT * FROM dentos_runtime.restore_drills WHERE clinic_id = $1 ORDER BY started_at DESC LIMIT 1`,
      [ctx.clinicId],
    ),
    ctx.pool.query(
      `SELECT * FROM dentos_runtime.gateway_incidents WHERE clinic_id = $1 AND status = 'open' ORDER BY opened_at DESC`,
      [ctx.clinicId],
    ),
  ]);
  return {
    lastBackup: backups.rows[0] ?? null,
    lastRestoreDrill: drills.rows[0] ?? null,
    openIncidents: incidents.rows,
  };
}

export async function startReadinessDrill(
  ctx: DbContext,
  input: {
    drillCode: "OFF-003" | "SYNC-001" | "BCP-001" | "REBUILD-001" | "SEC-001";
    writeBlocked: boolean;
    readsAllowed: boolean;
    duplicateEventsIgnored?: number;
    actorUserId: string;
  },
) {
  const evaluation = evaluateReadinessDrill({
    drillCode: input.drillCode,
    writeBlocked: input.writeBlocked,
    readsAllowed: input.readsAllowed,
    duplicateEventsIgnored: input.duplicateEventsIgnored,
  });
  const id = crypto.randomUUID();
  await ctx.pool.query(
    `
      INSERT INTO dentos_runtime.readiness_drill_runs (
        id, clinic_id, drill_code, status, started_at, completed_at, evidence_json, created_by
      ) VALUES ($1, $2, $3, $4, clock_timestamp(), clock_timestamp(), $5::jsonb, $6)
    `,
    [
      id,
      ctx.clinicId,
      input.drillCode,
      evaluation.ok ? "passed" : "failed",
      JSON.stringify({
        writeBlocked: input.writeBlocked,
        readsAllowed: input.readsAllowed,
        duplicateEventsIgnored: input.duplicateEventsIgnored ?? 0,
        message: evaluation.ok ? null : evaluation.message,
      }),
      input.actorUserId,
    ],
  );
  return { id, status: evaluation.ok ? "passed" : "failed", drillCode: input.drillCode };
}

export async function listReadinessDrills(ctx: DbContext) {
  const result = await ctx.pool.query(
    `
      SELECT *
      FROM dentos_runtime.readiness_drill_runs
      WHERE clinic_id = $1
      ORDER BY started_at DESC
      LIMIT 20
    `,
    [ctx.clinicId],
  );
  return { drills: result.rows };
}

export function buildMigrationReportFromBatch(batch: Record<string, unknown>) {
  return buildMigrationAcceptanceReport({
    sourceCount: Number(batch.row_count ?? 0),
    importedCount: batch.status === "applied" ? Number(batch.valid_count ?? 0) : 0,
    rejectedCount: Number(batch.invalid_count ?? 0),
    duplicateCount: 0,
  });
}

export function describeRuntimeBoundary() {
  return {
    desktopShell: "browser-fallback",
    gatewayService: "fastify-local-postgresql",
    alternateRuntimeSupported: true,
    note: "Tauri shell remains primary; browser fallback is documented for recovery drills only.",
  };
}
