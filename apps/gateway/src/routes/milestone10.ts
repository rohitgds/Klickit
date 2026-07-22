import type { FastifyInstance } from "fastify";
import type { GatewayDependencies } from "./index.js";
import { evaluateOfflineWritePolicy } from "../sync/engine.js";
import { requirePermission, requireSession } from "../security/middleware.js";
import type { GoLiveChecklistState } from "@klickit/pilot";
import {
  approveProductionRelease,
  createReleaseCandidate,
  createUnresolvedIssue,
  getHandoverSummary,
  getLatestReleaseCandidate,
  getProductionGateStatus,
  initiateRollback,
  listAcceptanceRecords,
  listDailyReconciliations,
  listUnresolvedIssues,
  recordAcceptance,
  recordDailyReconciliation,
  updateReleaseChecklist,
} from "../pilot/repository.js";
import { describeShalimarExpansionPlan } from "@klickit/pilot";

function dbContext(deps: GatewayDependencies) {
  if (!deps.pool || !deps.bootstrap) {
    throw new Error("Gateway database bootstrap is unavailable");
  }
  return {
    pool: deps.pool,
    organizationId: deps.bootstrap.clinic.organizationId,
    clinicId: deps.bootstrap.clinic.id,
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

export async function registerMilestone10Routes(app: FastifyInstance, deps: GatewayDependencies) {
  app.get(
    "/pilot/release-candidate",
    { preHandler: [requireSession(deps), requirePermission(deps, "pilot.view")] },
    async () => {
      const candidate = await getLatestReleaseCandidate(dbContext(deps));
      return candidate ?? { status: "none" };
    },
  );

  app.post<{ Body: { releaseCode: string; rollbackPlanReference?: string } }>(
    "/pilot/release-candidate",
    { preHandler: [requireSession(deps), requirePermission(deps, "pilot.manage")] },
    async (request, reply) => {
      try {
        enforceWriteAllowed(deps);
        return await createReleaseCandidate(dbContext(deps), {
          ...request.body,
          actorUserId: actorUserId(request),
        });
      } catch (error) {
        reply.code(409);
        return { error: error instanceof Error ? error.message : "Release candidate rejected" };
      }
    },
  );

  app.put<{ Body: { releaseId: string; checklist: GoLiveChecklistState } }>(
    "/pilot/release-candidate/checklist",
    { preHandler: [requireSession(deps), requirePermission(deps, "pilot.manage")] },
    async (request, reply) => {
      try {
        enforceWriteAllowed(deps);
        return await updateReleaseChecklist(dbContext(deps), {
          ...request.body,
          actorUserId: actorUserId(request),
        });
      } catch (error) {
        reply.code(409);
        return { error: error instanceof Error ? error.message : "Checklist update rejected" };
      }
    },
  );

  app.post<{ Body: { releaseId: string } }>(
    "/pilot/release-candidate/approve-production",
    { preHandler: [requireSession(deps), requirePermission(deps, "pilot.manage")] },
    async (request, reply) => {
      try {
        enforceWriteAllowed(deps);
        return await approveProductionRelease(dbContext(deps), {
          releaseId: request.body.releaseId,
          actorUserId: actorUserId(request),
          appEnv: deps.config.appEnv,
        });
      } catch (error) {
        reply.code(409);
        return { error: error instanceof Error ? error.message : "Production approval rejected" };
      }
    },
  );

  app.get(
    "/pilot/production-gate",
    { preHandler: [requireSession(deps), requirePermission(deps, "pilot.view")] },
    async () => {
      const candidate = await getLatestReleaseCandidate(dbContext(deps));
      return getProductionGateStatus(
        deps.config.appEnv,
        candidate?.productionApproved ?? false,
        candidate?.checklistEvaluation.ready ?? false,
      );
    },
  );

  app.post<{
    Body: {
      reconciliationDate: string;
      sourceTotalMinor: number;
      outputTotalMinor: number;
      notes?: string;
    };
  }>(
    "/pilot/reconciliation/daily",
    { preHandler: [requireSession(deps), requirePermission(deps, "pilot.manage")] },
    async (request, reply) => {
      try {
        enforceWriteAllowed(deps);
        return await recordDailyReconciliation(dbContext(deps), {
          ...request.body,
          actorUserId: actorUserId(request),
        });
      } catch (error) {
        reply.code(409);
        return { error: error instanceof Error ? error.message : "Reconciliation rejected" };
      }
    },
  );

  app.get(
    "/pilot/reconciliation/daily",
    { preHandler: [requireSession(deps), requirePermission(deps, "pilot.view")] },
    async () => listDailyReconciliations(dbContext(deps)),
  );

  app.post<{
    Body: {
      acceptanceType: "pilot_report" | "handover" | "sale_readiness";
      scenariosPassed: number;
      scenariosTotal: number;
      unresolvedSeverity12: number;
      evidence?: Record<string, unknown>;
    };
  }>(
    "/pilot/acceptance",
    { preHandler: [requireSession(deps), requirePermission(deps, "pilot.manage")] },
    async (request, reply) => {
      try {
        enforceWriteAllowed(deps);
        return await recordAcceptance(dbContext(deps), {
          ...request.body,
          actorUserId: actorUserId(request),
        });
      } catch (error) {
        reply.code(409);
        return { error: error instanceof Error ? error.message : "Acceptance rejected" };
      }
    },
  );

  app.get(
    "/pilot/acceptance",
    { preHandler: [requireSession(deps), requirePermission(deps, "pilot.view")] },
    async () => listAcceptanceRecords(dbContext(deps)),
  );

  app.post<{ Body: { severity: number; title: string; description?: string } }>(
    "/pilot/issues",
    { preHandler: [requireSession(deps), requirePermission(deps, "pilot.manage")] },
    async (request, reply) => {
      try {
        enforceWriteAllowed(deps);
        return await createUnresolvedIssue(dbContext(deps), {
          ...request.body,
          actorUserId: actorUserId(request),
        });
      } catch (error) {
        reply.code(409);
        return { error: error instanceof Error ? error.message : "Issue rejected" };
      }
    },
  );

  app.get(
    "/pilot/issues",
    { preHandler: [requireSession(deps), requirePermission(deps, "pilot.view")] },
    async () => listUnresolvedIssues(dbContext(deps)),
  );

  app.post<{ Body: { releaseId: string; reason: string } }>(
    "/pilot/rollback",
    { preHandler: [requireSession(deps), requirePermission(deps, "pilot.manage")] },
    async (request, reply) => {
      try {
        enforceWriteAllowed(deps);
        return await initiateRollback(dbContext(deps), {
          ...request.body,
          actorUserId: actorUserId(request),
        });
      } catch (error) {
        reply.code(409);
        return { error: error instanceof Error ? error.message : "Rollback rejected" };
      }
    },
  );

  app.get(
    "/pilot/handover/summary",
    { preHandler: [requireSession(deps), requirePermission(deps, "pilot.view")] },
    async () => getHandoverSummary(),
  );

  app.get(
    "/pilot/expansion/shalimar",
    { preHandler: [requireSession(deps), requirePermission(deps, "pilot.view")] },
    async () => describeShalimarExpansionPlan(),
  );
}
