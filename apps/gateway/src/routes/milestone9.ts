import type { FastifyInstance } from "fastify";
import type { GatewayDependencies } from "./index.js";
import { evaluateOfflineWritePolicy } from "../sync/engine.js";
import { requirePermission, requireSession } from "../security/middleware.js";
import {
  acceptImportBatch,
  applyImportBatch,
  getImportBatchReport,
} from "../patients/repository.js";
import {
  buildMigrationReportFromBatch,
  describeRuntimeBoundary,
  getRecoveryStatus,
  listBackupRuns,
  listReadinessDrills,
  openGatewayIncident,
  recordBackupRun,
  recordRestoreDrill,
  startReadinessDrill,
} from "../resilience/repository.js";

function dbContext(deps: GatewayDependencies) {
  if (!deps.pool || !deps.bootstrap) {
    throw new Error("Gateway database bootstrap is unavailable");
  }
  return {
    pool: deps.pool,
    organizationId: deps.bootstrap.clinic.organizationId,
    clinicId: deps.bootstrap.clinic.id,
    gatewayId: deps.bootstrap.gateway.id,
  };
}

function enforceWriteAllowed(deps: GatewayDependencies) {
  if (!deps.bootstrap) {
    return;
  }
  const policy = evaluateOfflineWritePolicy(deps.bootstrap.gateway);
  if (!policy.writeAllowed || policy.readOnly) {
    throw new Error("Clinic gateway is read-only after the 72-hour offline limit");
  }
}

function actorUserId(request: { klickitSession?: { userId: string } }): string {
  return request.klickitSession?.userId ?? "00000000-0000-4000-8000-000000000000";
}

export async function registerMilestone9Routes(app: FastifyInstance, deps: GatewayDependencies) {
  app.get(
    "/runtime/boundary",
    { preHandler: [requireSession(deps), requirePermission(deps, "audit.view")] },
    async () => describeRuntimeBoundary(),
  );

  app.post<{ Body: { artifactPath: string; notes?: string } }>(
    "/resilience/backup/run",
    { preHandler: [requireSession(deps), requirePermission(deps, "audit.view")] },
    async (request, reply) => {
      try {
        enforceWriteAllowed(deps);
        return await recordBackupRun(dbContext(deps), {
          ...request.body,
          actorUserId: actorUserId(request),
        });
      } catch (error) {
        reply.code(409);
        return { error: error instanceof Error ? error.message : "Backup rejected" };
      }
    },
  );

  app.get(
    "/resilience/backup/runs",
    { preHandler: [requireSession(deps), requirePermission(deps, "audit.view")] },
    async () => listBackupRuns(dbContext(deps)),
  );

  app.post<{ Body: { backupRunId: string; restoredChecksum: string } }>(
    "/resilience/restore/drill",
    { preHandler: [requireSession(deps), requirePermission(deps, "audit.view")] },
    async (request, reply) => {
      try {
        enforceWriteAllowed(deps);
        return await recordRestoreDrill(dbContext(deps), {
          ...request.body,
          actorUserId: actorUserId(request),
        });
      } catch (error) {
        reply.code(409);
        return { error: error instanceof Error ? error.message : "Restore drill rejected" };
      }
    },
  );

  app.get(
    "/resilience/recovery/status",
    { preHandler: [requireSession(deps), requirePermission(deps, "audit.view")] },
    async () => getRecoveryStatus(dbContext(deps)),
  );

  app.post<{
    Body: {
      incidentType: "spare_activation" | "hardware_failure" | "recovery_drill";
      spareGatewayCode?: string;
      runbookReference: string;
    };
  }>(
    "/resilience/incidents",
    { preHandler: [requireSession(deps), requirePermission(deps, "audit.view")] },
    async (request, reply) => {
      try {
        enforceWriteAllowed(deps);
        return await openGatewayIncident(dbContext(deps), {
          ...request.body,
          actorUserId: actorUserId(request),
        });
      } catch (error) {
        reply.code(409);
        return { error: error instanceof Error ? error.message : "Incident rejected" };
      }
    },
  );

  app.get<{ Params: { id: string } }>(
    "/migration/drklick/batches/:id",
    { preHandler: [requireSession(deps), requirePermission(deps, "patient.view")] },
    async (request, reply) => {
      try {
        const ctx = dbContext(deps);
        const report = await getImportBatchReport(ctx.pool, request.params.id);
        return {
          ...report,
          acceptance: buildMigrationReportFromBatch(report.batch),
        };
      } catch (error) {
        reply.code(404);
        return { error: error instanceof Error ? error.message : "Batch not found" };
      }
    },
  );

  app.post<{ Params: { id: string } }>(
    "/migration/drklick/batches/:id/accept",
    { preHandler: [requireSession(deps), requirePermission(deps, "patient.create")] },
    async (request, reply) => {
      try {
        enforceWriteAllowed(deps);
        return await acceptImportBatch(dbContext(deps).pool, {
          batchId: request.params.id,
          actorUserId: actorUserId(request),
        });
      } catch (error) {
        reply.code(409);
        return { error: error instanceof Error ? error.message : "Accept rejected" };
      }
    },
  );

  app.post<{ Params: { id: string } }>(
    "/migration/drklick/batches/:id/apply",
    { preHandler: [requireSession(deps), requirePermission(deps, "patient.create")] },
    async (request, reply) => {
      try {
        enforceWriteAllowed(deps);
        const ctx = dbContext(deps);
        return await applyImportBatch(ctx.pool, {
          batchId: request.params.id,
          organizationId: ctx.organizationId,
          clinicId: ctx.clinicId,
          actorUserId: actorUserId(request),
        });
      } catch (error) {
        reply.code(409);
        return { error: error instanceof Error ? error.message : "Apply rejected" };
      }
    },
  );

  app.post<{
    Body: {
      drillCode: "OFF-003" | "SYNC-001" | "BCP-001" | "REBUILD-001" | "SEC-001";
      writeBlocked: boolean;
      readsAllowed: boolean;
      duplicateEventsIgnored?: number;
    };
  }>(
    "/readiness/drills",
    { preHandler: [requireSession(deps), requirePermission(deps, "audit.view")] },
    async (request, reply) => {
      try {
        enforceWriteAllowed(deps);
        return await startReadinessDrill(dbContext(deps), {
          ...request.body,
          actorUserId: actorUserId(request),
        });
      } catch (error) {
        reply.code(409);
        return { error: error instanceof Error ? error.message : "Drill rejected" };
      }
    },
  );

  app.get(
    "/readiness/drills",
    { preHandler: [requireSession(deps), requirePermission(deps, "audit.view")] },
    async () => listReadinessDrills(dbContext(deps)),
  );

  app.get(
    "/readiness/portability/status",
    { preHandler: [requireSession(deps), requirePermission(deps, "audit.view")] },
    async () => ({
      environment: deps.config.appEnv,
      stagingOnly: deps.config.appEnv !== "production",
      liveWhatsAppBlocked: true,
      realPatientDataBlocked: deps.config.appEnv !== "production",
    }),
  );
}
