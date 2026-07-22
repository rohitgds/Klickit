import type { FastifyInstance } from "fastify";
import { hashFilePayload, shouldWarnPdfUpload } from "@klickit/clinical";
import type { GatewayDependencies } from "./index.js";
import { evaluateOfflineWritePolicy } from "../sync/engine.js";
import { requirePermission, requireSession } from "../security/middleware.js";
import {
  amendClinicalNote,
  createCareDelivery,
  createClinicalNote,
  createEncounterDiagnosis,
  createOdontogramFinding,
  createServiceRecommendation,
  evaluateClinicalAccess,
  getEncounterWorkspace,
  getFileRecord,
  getFileSyncStatus,
  listClinicalNoteAmendments,
  listClinicalNotes,
  listOdontogramFindings,
  registerPatientFile,
  signClinicalNote,
  transitionCareDelivery,
  verifyFileHash,
} from "../clinical/repository.js";

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

export async function registerMilestone5Routes(app: FastifyInstance, deps: GatewayDependencies) {
  app.get<{ Params: { id: string } }>(
    "/clinical/encounters/:id/workspace",
    { preHandler: [requireSession(deps), requirePermission(deps, "clinical.view")] },
    async (request) => {
      const ctx = dbContext(deps);
      return getEncounterWorkspace(ctx, request.params.id);
    },
  );

  app.get<{ Params: { id: string } }>(
    "/clinical/encounters/:id/odontogram",
    { preHandler: [requireSession(deps), requirePermission(deps, "clinical.view")] },
    async (request) => {
      const ctx = dbContext(deps);
      const findings = await listOdontogramFindings(ctx, request.params.id);
      return { findings };
    },
  );

  app.post<{
    Params: { id: string };
    Body: { patientId: string; toothCode: string; surfaceCodes?: string[]; findingCode: string; notes?: string };
  }>(
    "/clinical/encounters/:id/findings",
    { preHandler: [requireSession(deps), requirePermission(deps, "clinical.edit")] },
    async (request, reply) => {
      try {
        enforceWriteAllowed(deps);
        const ctx = dbContext(deps);
        return await createOdontogramFinding(ctx, {
          encounterId: request.params.id,
          patientId: request.body.patientId,
          toothCode: request.body.toothCode,
          surfaceCodes: request.body.surfaceCodes ?? [],
          findingCode: request.body.findingCode,
          notes: request.body.notes,
          recordedBy: actorUserId(request),
        });
      } catch (error) {
        reply.code(409);
        return { error: error instanceof Error ? error.message : "Finding rejected" };
      }
    },
  );

  app.post<{
    Params: { id: string };
    Body: {
      diagnosisId: string;
      toothCode?: string;
      surfaceCodes?: string[];
      clinicalNote?: string;
    };
  }>(
    "/clinical/encounters/:id/diagnoses",
    { preHandler: [requireSession(deps), requirePermission(deps, "clinical.edit")] },
    async (request, reply) => {
      try {
        enforceWriteAllowed(deps);
        const ctx = dbContext(deps);
        return await createEncounterDiagnosis(ctx, {
          encounterId: request.params.id,
          ...request.body,
          diagnosedBy: actorUserId(request),
        });
      } catch (error) {
        reply.code(409);
        return { error: error instanceof Error ? error.message : "Diagnosis rejected" };
      }
    },
  );

  app.post<{
    Params: { id: string };
    Body: {
      serviceId: string;
      encounterDiagnosisId?: string;
      toothCode?: string;
      surfaceCodes?: string[];
      clinicalNote?: string;
    };
  }>(
    "/clinical/encounters/:id/recommendations",
    { preHandler: [requireSession(deps), requirePermission(deps, "clinical.edit")] },
    async (request, reply) => {
      try {
        enforceWriteAllowed(deps);
        const ctx = dbContext(deps);
        return await createServiceRecommendation(ctx, {
          encounterId: request.params.id,
          ...request.body,
          suggestedBy: actorUserId(request),
        });
      } catch (error) {
        reply.code(409);
        return { error: error instanceof Error ? error.message : "Recommendation rejected" };
      }
    },
  );

  app.post<{
    Params: { id: string };
    Body: {
      patientId: string;
      serviceId: string;
      leadClinicianId: string;
      toothCode?: string;
      surfaceCodes?: string[];
      fee?: number;
    };
  }>(
    "/clinical/encounters/:id/deliveries",
    { preHandler: [requireSession(deps), requirePermission(deps, "clinical.edit")] },
    async (request) => {
      enforceWriteAllowed(deps);
      const ctx = dbContext(deps);
      return createCareDelivery(ctx, {
        encounterId: request.params.id,
        ...request.body,
        createdBy: actorUserId(request),
      });
    },
  );

  app.post<{ Params: { id: string } }>(
    "/clinical/deliveries/:id/start",
    { preHandler: [requireSession(deps), requirePermission(deps, "clinical.edit")] },
    async (request, reply) => {
      try {
        enforceWriteAllowed(deps);
        const ctx = dbContext(deps);
        return await transitionCareDelivery(ctx, {
          deliveryId: request.params.id,
          toStatus: "in_progress",
          changedBy: actorUserId(request),
        });
      } catch (error) {
        reply.code(409);
        return { error: error instanceof Error ? error.message : "Start rejected" };
      }
    },
  );

  app.post<{ Params: { id: string } }>(
    "/clinical/deliveries/:id/complete",
    { preHandler: [requireSession(deps), requirePermission(deps, "clinical.edit")] },
    async (request, reply) => {
      try {
        enforceWriteAllowed(deps);
        const ctx = dbContext(deps);
        return await transitionCareDelivery(ctx, {
          deliveryId: request.params.id,
          toStatus: "completed",
          changedBy: actorUserId(request),
        });
      } catch (error) {
        reply.code(409);
        return { error: error instanceof Error ? error.message : "Complete rejected" };
      }
    },
  );

  app.get<{ Params: { id: string } }>(
    "/clinical/encounters/:id/notes",
    { preHandler: [requireSession(deps), requirePermission(deps, "clinical.view")] },
    async (request) => {
      const ctx = dbContext(deps);
      const notes = await listClinicalNotes(ctx, request.params.id);
      return { notes };
    },
  );

  app.post<{
    Params: { id: string };
    Body: { patientId: string; clinicianId: string; noteType: string; body: string };
  }>(
    "/clinical/encounters/:id/notes",
    { preHandler: [requireSession(deps), requirePermission(deps, "clinical.edit")] },
    async (request) => {
      enforceWriteAllowed(deps);
      const ctx = dbContext(deps);
      return createClinicalNote(ctx, {
        encounterId: request.params.id,
        ...request.body,
        createdBy: actorUserId(request),
      });
    },
  );

  app.post<{ Params: { id: string } }>(
    "/clinical/notes/:id/sign",
    { preHandler: [requireSession(deps), requirePermission(deps, "clinical.edit")] },
    async (request, reply) => {
      try {
        enforceWriteAllowed(deps);
        const ctx = dbContext(deps);
        return await signClinicalNote(ctx, { noteId: request.params.id, signedBy: actorUserId(request) });
      } catch (error) {
        reply.code(409);
        return { error: error instanceof Error ? error.message : "Sign rejected" };
      }
    },
  );

  app.post<{ Params: { id: string }; Body: { amendedBody: string; reason: string } }>(
    "/clinical/notes/:id/amend",
    { preHandler: [requireSession(deps), requirePermission(deps, "clinical.edit")] },
    async (request, reply) => {
      try {
        enforceWriteAllowed(deps);
        const ctx = dbContext(deps);
        return await amendClinicalNote(ctx, {
          noteId: request.params.id,
          ...request.body,
          amendedBy: actorUserId(request),
        });
      } catch (error) {
        reply.code(409);
        return { error: error instanceof Error ? error.message : "Amend rejected" };
      }
    },
  );

  app.get<{ Params: { id: string } }>(
    "/clinical/notes/:id/amendments",
    { preHandler: [requireSession(deps), requirePermission(deps, "clinical.view")] },
    async (request) => {
      const ctx = dbContext(deps);
      const amendments = await listClinicalNoteAmendments(ctx, request.params.id);
      return { amendments };
    },
  );

  app.post<{
    Body: {
      patientId: string;
      encounterId?: string;
      storageKey: string;
      mimeType: string;
      byteSize: number;
      payload: string;
      category?: string;
      caption?: string;
    };
  }>(
    "/clinical/files/register",
    { preHandler: [requireSession(deps), requirePermission(deps, "document.upload")] },
    async (request) => {
      enforceWriteAllowed(deps);
      const ctx = dbContext(deps);
      const payloadHash = hashFilePayload(request.body.payload);
      const result = await registerPatientFile(ctx, {
        patientId: request.body.patientId,
        encounterId: request.body.encounterId,
        storageKey: request.body.storageKey,
        mimeType: request.body.mimeType,
        byteSize: request.body.byteSize,
        payloadHash,
        category: request.body.category,
        caption: request.body.caption,
        createdBy: actorUserId(request),
      });
      return {
        ...result,
        pdfWarning: shouldWarnPdfUpload(request.body.mimeType),
      };
    },
  );

  app.get<{ Params: { id: string } }>(
    "/clinical/files/:id",
    { preHandler: [requireSession(deps), requirePermission(deps, "document.view")] },
    async (request, reply) => {
      const ctx = dbContext(deps);
      const file = await getFileRecord(ctx, request.params.id);
      if (!file) {
        reply.code(404);
        return { error: "File not found" };
      }
      return { file };
    },
  );

  app.get<{ Params: { id: string } }>(
    "/clinical/files/:id/sync-status",
    { preHandler: [requireSession(deps), requirePermission(deps, "document.view")] },
    async (request) => {
      const ctx = dbContext(deps);
      const status = await getFileSyncStatus(ctx, request.params.id);
      return { status };
    },
  );

  app.post<{ Params: { id: string }; Body: { payload: string } }>(
    "/clinical/files/:id/verify-hash",
    { preHandler: [requireSession(deps), requirePermission(deps, "document.view")] },
    async (request, reply) => {
      try {
        const ctx = dbContext(deps);
        return await verifyFileHash(ctx, { fileId: request.params.id, payload: request.body.payload });
      } catch (error) {
        reply.code(404);
        return { error: error instanceof Error ? error.message : "Verify failed" };
      }
    },
  );

  app.get<{ Querystring: { patientId: string; permissionCode?: string } }>(
    "/clinical/access/effective",
    { preHandler: requireSession(deps) },
    async (request) => {
      const ctx = dbContext(deps);
      return evaluateClinicalAccess(ctx, {
        patientId: request.query.patientId,
        encounterClinicId: ctx.clinicId,
        permissionCode: request.query.permissionCode ?? "clinical.view",
        hasCrossClinicGrant: false,
      });
    },
  );
}
