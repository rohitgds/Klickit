import type { FastifyInstance } from "fastify";
import { hashSessionToken } from "@klickit/identity";
import { scoreDuplicateCandidate } from "@klickit/patients";
import { loginOnline, logoutSession, verifyOfflineLogin, createDevSession } from "../auth/service.js";
import {
  createStaff,
  linkStaffToUser,
  listClinics,
  listOrganizations,
  listStaff,
  listUsers,
} from "../identity/repository.js";
import {
  createImportBatch,
  getDevPatientMasters,
  getPatientProfile,
  getPatientSafetySummary,
  queuePatientDuplicateReview,
  registerPatient,
  searchPatients,
  stageImportRows,
} from "../patients/repository.js";
import type { GatewayDependencies } from "./index.js";
import { evaluateOfflineWritePolicy } from "../sync/engine.js";
import { requirePermission, requireSession } from "../security/middleware.js";
import { loadPermissionCodes } from "../security/permissions.js";

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

export async function registerMilestone3Routes(app: FastifyInstance, deps: GatewayDependencies) {
  app.post<{ Body: { loginName?: string } }>("/auth/dev/session", async (request, reply) => {
    if (!deps.config.allowDevSessionBootstrap) {
      reply.code(403);
      return { error: "Dev session bootstrap is disabled outside local APP_ENV" };
    }
    const ctx = dbContext(deps);
    const result = await createDevSession(ctx.pool, {
      clinicId: ctx.clinicId,
      loginName: request.body.loginName ?? "dev.admin",
    });
    if (!result) {
      reply.code(404);
      return { error: "Development user not found" };
    }
    return result;
  });

  app.post<{
    Body: { loginName: string; password: string; deviceFingerprintHash?: string };
  }>("/auth/login", async (request, reply) => {
    const ctx = dbContext(deps);
    const result = await loginOnline({
      pool: ctx.pool,
      clinicId: ctx.clinicId,
      loginName: request.body.loginName,
      password: request.body.password,
      deviceFingerprintHash: request.body.deviceFingerprintHash,
    });
    if (!result) {
      reply.code(401);
      return { error: "Invalid credentials or unapproved device" };
    }
    return result;
  });

  app.post("/auth/logout", { preHandler: requireSession(deps) }, async (request) => {
    const token = request.headers["x-session-token"];
    if (typeof token === "string") {
      await logoutSession(deps.pool!, hashSessionToken(token));
    }
    return { ok: true };
  });

  app.post<{
    Body: { loginName: string; password: string; deviceFingerprintHash: string };
  }>("/auth/offline/verify", async (request) => {
    const ctx = dbContext(deps);
    return verifyOfflineLogin(ctx.pool, {
      clinicId: ctx.clinicId,
      loginName: request.body.loginName,
      password: request.body.password,
      deviceFingerprintHash: request.body.deviceFingerprintHash,
    });
  });

  app.get("/auth/session", { preHandler: requireSession(deps) }, async (request) => ({
    session: request.klickitSession,
  }));

  app.get(
    "/identity/organization",
    { preHandler: [requireSession(deps), requirePermission(deps, "configuration.practice.view")] },
    async () => {
      const ctx = dbContext(deps);
      const organizations = await listOrganizations(ctx.pool, ctx.organizationId);
      return { organizations };
    },
  );

  app.get(
    "/identity/clinics",
    { preHandler: [requireSession(deps), requirePermission(deps, "configuration.practice.view")] },
    async () => {
      const ctx = dbContext(deps);
      return { clinics: await listClinics(ctx.pool, ctx.organizationId) };
    },
  );

  app.get(
    "/identity/staff",
    { preHandler: [requireSession(deps), requirePermission(deps, "configuration.workforce.view")] },
    async () => {
      const ctx = dbContext(deps);
      return { staff: await listStaff(ctx.pool, ctx.organizationId) };
    },
  );

  app.post<{
    Body: { displayName: string; staffType: string };
  }>(
    "/identity/staff",
    { preHandler: [requireSession(deps), requirePermission(deps, "configuration.workforce.edit")] },
    async (request) => {
      enforceWriteAllowed(deps);
      const ctx = dbContext(deps);
      const created = await createStaff(ctx.pool, {
        organizationId: ctx.organizationId,
        clinicId: ctx.clinicId,
        displayName: request.body.displayName,
        staffType: request.body.staffType,
        createdBy: request.klickitSession!.userId,
      });
      return created;
    },
  );

  app.get(
    "/identity/users",
    { preHandler: [requireSession(deps), requirePermission(deps, "configuration.workforce.view")] },
    async () => {
      const ctx = dbContext(deps);
      return { users: await listUsers(ctx.pool, ctx.organizationId) };
    },
  );

  app.post<{
    Body: { staffId: string; userId: string };
  }>(
    "/identity/staff/link-user",
    { preHandler: [requireSession(deps), requirePermission(deps, "configuration.workforce.edit")] },
    async (request) => {
      enforceWriteAllowed(deps);
      const ctx = dbContext(deps);
      await linkStaffToUser(ctx.pool, {
        organizationId: ctx.organizationId,
        staffId: request.body.staffId,
        userId: request.body.userId,
        linkedBy: request.klickitSession!.userId,
      });
      return { ok: true };
    },
  );

  app.get(
    "/security/permissions/effective",
    { preHandler: requireSession(deps) },
    async (request) => {
      const codes = await loadPermissionCodes(deps.pool!, request.klickitSession!.membershipId);
      return { permissionCodes: codes };
    },
  );

  app.get(
    "/patients/search",
    { preHandler: [requireSession(deps), requirePermission(deps, "patient.view")] },
    async (request) => {
      const ctx = dbContext(deps);
      const query = (request.query as { q?: string; limit?: string; offset?: string }) ?? {};
      return {
        patients: await searchPatients(ctx.pool, {
          organizationId: ctx.organizationId,
          clinicId: ctx.clinicId,
          query: query.q,
          limit: query.limit ? Number(query.limit) : undefined,
          offset: query.offset ? Number(query.offset) : undefined,
        }),
      };
    },
  );

  app.post<{
    Body: {
      firstName: string;
      middleName?: string;
      lastName?: string;
      cellPhone?: string;
      birthDate?: string;
    };
  }>(
    "/patients/register",
    { preHandler: [requireSession(deps), requirePermission(deps, "patient.create")] },
    async (request, reply) => {
      try {
        enforceWriteAllowed(deps);
        const ctx = dbContext(deps);
        const masters = await getDevPatientMasters(ctx.pool, ctx.organizationId, ctx.clinicId);
        if (
          !masters.initialsId ||
          !masters.categoryId ||
          !masters.referralSourceId ||
          !masters.feeScheduleId ||
          !masters.documentSeriesId
        ) {
          reply.code(409);
          return { error: "Patient masters are not seeded for this clinic" };
        }
        return await registerPatient(ctx.pool, {
          organizationId: ctx.organizationId,
          clinicId: ctx.clinicId,
          createdBy: request.klickitSession!.userId,
          masters: {
            initialsId: masters.initialsId,
            categoryId: masters.categoryId,
            referralSourceId: masters.referralSourceId,
            feeScheduleId: masters.feeScheduleId,
            documentSeriesId: masters.documentSeriesId,
          },
          ...request.body,
        });
      } catch (error) {
        reply.code(400);
        return { error: error instanceof Error ? error.message : "Registration failed" };
      }
    },
  );

  app.get<{ Params: { patientId: string } }>(
    "/patients/:patientId/profile",
    { preHandler: [requireSession(deps), requirePermission(deps, "patient.view")] },
    async (request) => {
      const ctx = dbContext(deps);
      return getPatientProfile(ctx.pool, request.params.patientId);
    },
  );

  app.get<{ Params: { patientId: string } }>(
    "/patients/:patientId/safety-summary",
    { preHandler: [requireSession(deps), requirePermission(deps, "patient.view")] },
    async (request) => {
      const ctx = dbContext(deps);
      return getPatientSafetySummary(ctx.pool, request.params.patientId);
    },
  );

  app.post<{
    Body: { patientIdA: string; patientIdB: string };
  }>(
    "/patients/duplicates/review",
    { preHandler: [requireSession(deps), requirePermission(deps, "patient.merge")] },
    async (request) => {
      enforceWriteAllowed(deps);
      const ctx = dbContext(deps);
      const { score, signals } = scoreDuplicateCandidate({
        nameA: request.body.patientIdA,
        nameB: request.body.patientIdB,
      });
      const id = await queuePatientDuplicateReview(ctx.pool, {
        organizationId: ctx.organizationId,
        clinicId: ctx.clinicId,
        patientIdA: request.body.patientIdA,
        patientIdB: request.body.patientIdB,
        signals: signals.length ? signals : [`score:${score}`],
      });
      return { id, score, signals };
    },
  );

  app.post(
    "/migration/drklick/batches",
    { preHandler: [requireSession(deps), requirePermission(deps, "patient.create")] },
    async (request) => {
      enforceWriteAllowed(deps);
      const ctx = dbContext(deps);
      return createImportBatch(ctx.pool, {
        organizationId: ctx.organizationId,
        clinicId: ctx.clinicId,
        createdBy: request.klickitSession!.userId,
      });
    },
  );

  app.post<{
    Params: { batchId: string };
    Body: {
      rows: Array<{
        sourceRowNumber: number;
        sourcePatientKey?: string;
        firstName: string;
        lastName?: string;
        mobile?: string;
        birthDate?: string;
      }>;
    };
  }>(
    "/migration/drklick/batches/:batchId/stage",
    { preHandler: [requireSession(deps), requirePermission(deps, "patient.create")] },
    async (request) => {
      enforceWriteAllowed(deps);
      const ctx = dbContext(deps);
      return stageImportRows(ctx.pool, {
        batchId: request.params.batchId,
        rows: request.body.rows,
      });
    },
  );
}
