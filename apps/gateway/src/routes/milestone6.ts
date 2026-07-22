import type { FastifyInstance } from "fastify";
import type { GatewayDependencies } from "./index.js";
import { evaluateOfflineWritePolicy } from "../sync/engine.js";
import { requirePermission, requireSession } from "../security/middleware.js";
import {
  acceptCarePlan,
  addCarePlanService,
  addCarePlanStage,
  createCarePlan,
  createClinicalCaseForEncounter,
  createTreatmentBundle,
  getCarePlanDetail,
  proposeCarePlan,
} from "../plans/repository.js";
import {
  createDocumentPrintSnapshot,
  createMedicationOrderDraft,
  evaluateMedicationSafety,
  getDocumentPrintTemplate,
  reviseMedicationOrder,
  saveMedicationOrder,
  searchMedicationCatalog,
  signMedicationOrder,
  upsertDoctorSigningPin,
} from "../medication/repository.js";

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

export async function registerMilestone6Routes(app: FastifyInstance, deps: GatewayDependencies) {
  app.post<{ Body: { patientId: string; planDate?: string; notes?: string } }>(
    "/plans/care-plans",
    { preHandler: [requireSession(deps), requirePermission(deps, "care_plan.create")] },
    async (request, reply) => {
      try {
        enforceWriteAllowed(deps);
        return await createCarePlan(dbContext(deps), { ...request.body, actorUserId: actorUserId(request) });
      } catch (error) {
        reply.code(409);
        return { error: error instanceof Error ? error.message : "Care plan rejected" };
      }
    },
  );

  app.get<{ Params: { id: string } }>(
    "/plans/care-plans/:id",
    { preHandler: [requireSession(deps), requirePermission(deps, "care_plan.edit")] },
    async (request, reply) => {
      try {
        return await getCarePlanDetail(dbContext(deps), request.params.id);
      } catch (error) {
        reply.code(404);
        return { error: error instanceof Error ? error.message : "Care plan not found" };
      }
    },
  );

  app.post<{ Params: { id: string }; Body: { phaseNo: number; name: string } }>(
    "/plans/care-plans/:id/stages",
    { preHandler: [requireSession(deps), requirePermission(deps, "care_plan.edit")] },
    async (request, reply) => {
      try {
        enforceWriteAllowed(deps);
        return await addCarePlanStage(dbContext(deps), {
          planId: request.params.id,
          ...request.body,
          actorUserId: actorUserId(request),
        });
      } catch (error) {
        reply.code(409);
        return { error: error instanceof Error ? error.message : "Stage rejected" };
      }
    },
  );

  app.post<{
    Params: { stageId: string };
    Body: { serviceId: string; toothCode?: string; surfaceCodes?: string[]; proposedFee: number; discount?: number };
  }>(
    "/plans/stages/:stageId/services",
    { preHandler: [requireSession(deps), requirePermission(deps, "care_plan.edit")] },
    async (request, reply) => {
      try {
        enforceWriteAllowed(deps);
        return await addCarePlanService(dbContext(deps), {
          stageId: request.params.stageId,
          ...request.body,
          actorUserId: actorUserId(request),
        });
      } catch (error) {
        reply.code(409);
        return { error: error instanceof Error ? error.message : "Service line rejected" };
      }
    },
  );

  app.post<{ Params: { id: string }; Body: { proposedByStaffId: string } }>(
    "/plans/care-plans/:id/propose",
    { preHandler: [requireSession(deps), requirePermission(deps, "care_plan.edit")] },
    async (request, reply) => {
      try {
        enforceWriteAllowed(deps);
        return await proposeCarePlan(dbContext(deps), {
          planId: request.params.id,
          proposedByStaffId: request.body.proposedByStaffId,
          actorUserId: actorUserId(request),
        });
      } catch (error) {
        reply.code(409);
        return { error: error instanceof Error ? error.message : "Proposal rejected" };
      }
    },
  );

  app.post<{
    Params: { id: string };
    Body: {
      method: "staff_confirmed" | "otp" | "signature_upload";
      acceptedTotal: number;
      confirmationCode?: string;
      signatureHash?: string;
      signatureFileId?: string;
      notes?: string;
    };
  }>(
    "/plans/care-plans/:id/accept",
    { preHandler: [requireSession(deps), requirePermission(deps, "care_plan.edit")] },
    async (request, reply) => {
      try {
        enforceWriteAllowed(deps);
        return await acceptCarePlan(dbContext(deps), {
          planId: request.params.id,
          method: request.body.method,
          acceptedTotal: request.body.acceptedTotal,
          confirmationCode: request.body.confirmationCode,
          signatureHash: request.body.signatureHash,
          signatureFileId: request.body.signatureFileId,
          notes: request.body.notes,
          actorUserId: actorUserId(request),
        });
      } catch (error) {
        reply.code(409);
        return { error: error instanceof Error ? error.message : "Acceptance rejected" };
      }
    },
  );

  app.post<{
    Body: {
      patientId: string;
      encounterId: string;
      primaryClinicianId: string;
      secondaryClinicianId: string;
    };
  }>(
    "/plans/clinical-cases",
    { preHandler: [requireSession(deps), requirePermission(deps, "clinical_case.create")] },
    async (request, reply) => {
      try {
        enforceWriteAllowed(deps);
        return await createClinicalCaseForEncounter(dbContext(deps), {
          ...request.body,
          actorUserId: actorUserId(request),
        });
      } catch (error) {
        reply.code(409);
        return { error: error instanceof Error ? error.message : "Clinical case rejected" };
      }
    },
  );

  app.post<{
    Body: {
      clinicalCaseId: string;
      carePlanId: string;
      bundleTier: "primary" | "secondary" | "tertiary";
      sequenceNo: number;
      title: string;
      clinicalRationale: string;
      advisedByStaffId: string;
      carePlanServiceIds: string[];
    };
  }>(
    "/plans/treatment-bundles",
    { preHandler: [requireSession(deps), requirePermission(deps, "treatment_bundle.manage")] },
    async (request, reply) => {
      try {
        enforceWriteAllowed(deps);
        return await createTreatmentBundle(dbContext(deps), {
          ...request.body,
          actorUserId: actorUserId(request),
        });
      } catch (error) {
        reply.code(409);
        return { error: error instanceof Error ? error.message : "Treatment bundle rejected" };
      }
    },
  );

  app.get<{ Querystring: { q: string } }>(
    "/medication/catalog/search",
    { preHandler: [requireSession(deps), requirePermission(deps, "medication_order.view")] },
    async (request) => {
      const rows = await searchMedicationCatalog(dbContext(deps), request.query.q ?? "");
      return { medications: rows };
    },
  );

  app.get<{ Querystring: { patientId: string; medicationId: string } }>(
    "/medication/safety/evaluate",
    { preHandler: [requireSession(deps), requirePermission(deps, "medication_order.view")] },
    async (request) => {
      return evaluateMedicationSafety(dbContext(deps), {
        patientId: request.query.patientId,
        medicationId: request.query.medicationId,
      });
    },
  );

  app.post<{
    Body: { patientId: string; encounterId: string; clinicianStaffId: string; orderDate?: string; notes?: string };
  }>(
    "/medication/orders",
    { preHandler: [requireSession(deps), requirePermission(deps, "medication_order.create")] },
    async (request, reply) => {
      try {
        enforceWriteAllowed(deps);
        return await createMedicationOrderDraft(dbContext(deps), {
          ...request.body,
          actorUserId: actorUserId(request),
        });
      } catch (error) {
        reply.code(409);
        return { error: error instanceof Error ? error.message : "Medication order rejected" };
      }
    },
  );

  app.post<{
    Params: { id: string };
    Body: {
      diagnoses: Array<{
        diagnosisId: string;
        encounterDiagnosisId?: string;
        toothCode?: string;
        sequenceNo: number;
      }>;
      serviceLinks: Array<{
        serviceId: string;
        encounterServiceRecommendationId?: string;
        toothCode?: string;
        sequenceNo: number;
      }>;
      lines: Array<{
        medicationId?: string;
        administrationPatternId?: string;
        takeText: string;
        frequency: string;
        durationValue: number;
        durationPeriod: "days" | "weeks" | "months";
        instructions?: string;
        manualEntryReason?: string;
        sequenceNo: number;
      }>;
    };
  }>(
    "/medication/orders/:id/save",
    { preHandler: [requireSession(deps), requirePermission(deps, "medication_order.edit_draft")] },
    async (request, reply) => {
      try {
        enforceWriteAllowed(deps);
        return await saveMedicationOrder(dbContext(deps), {
          orderId: request.params.id,
          ...request.body,
          actorUserId: actorUserId(request),
        });
      } catch (error) {
        reply.code(409);
        return { error: error instanceof Error ? error.message : "Save rejected" };
      }
    },
  );

  app.post<{ Params: { id: string }; Body: { clinicianStaffId: string; signingPin: string } }>(
    "/medication/orders/:id/sign",
    { preHandler: [requireSession(deps), requirePermission(deps, "medication_order.sign")] },
    async (request, reply) => {
      try {
        enforceWriteAllowed(deps);
        return await signMedicationOrder(dbContext(deps), {
          orderId: request.params.id,
          clinicianStaffId: request.body.clinicianStaffId,
          signingPin: request.body.signingPin,
          actorUserId: actorUserId(request),
        });
      } catch (error) {
        reply.code(409);
        return { error: error instanceof Error ? error.message : "Sign rejected" };
      }
    },
  );

  app.post<{ Params: { id: string }; Body: { reason: string; patientId: string; encounterId: string; clinicianStaffId: string } }>(
    "/medication/orders/:id/revise",
    { preHandler: [requireSession(deps), requirePermission(deps, "medication_order.create")] },
    async (request, reply) => {
      try {
        enforceWriteAllowed(deps);
        return await reviseMedicationOrder(dbContext(deps), {
          orderId: request.params.id,
          ...request.body,
          actorUserId: actorUserId(request),
        });
      } catch (error) {
        reply.code(409);
        return { error: error instanceof Error ? error.message : "Revision rejected" };
      }
    },
  );

  app.put<{ Body: { staffId: string; pin: string } }>(
    "/medication/signing-pins",
    { preHandler: [requireSession(deps), requirePermission(deps, "medication_order.sign")] },
    async (request, reply) => {
      try {
        enforceWriteAllowed(deps);
        return await upsertDoctorSigningPin(dbContext(deps), {
          staffId: request.body.staffId,
          pin: request.body.pin,
          actorUserId: actorUserId(request),
        });
      } catch (error) {
        reply.code(409);
        return { error: error instanceof Error ? error.message : "PIN update rejected" };
      }
    },
  );

  app.get<{ Querystring: { groupCode: string; key: string } }>(
    "/documents/print-templates",
    { preHandler: [requireSession(deps), requirePermission(deps, "fee_statement.print")] },
    async (request) => {
      const template = await getDocumentPrintTemplate(dbContext(deps), {
        groupCode: request.query.groupCode,
        key: request.query.key,
      });
      return { template };
    },
  );

  app.post<{
    Body: {
      documentType: "care_plan" | "medication_order" | "consent";
      sourceEntityType: string;
      sourceEntityId: string;
      templateGroupCode: string;
      templateKey: string;
      templateVersion: number;
      layout: Record<string, unknown>;
      payload: Record<string, unknown>;
      reprintNo?: number;
    };
  }>(
    "/documents/print-snapshots",
    { preHandler: [requireSession(deps), requirePermission(deps, "fee_statement.print")] },
    async (request, reply) => {
      try {
        enforceWriteAllowed(deps);
        return await createDocumentPrintSnapshot(dbContext(deps), {
          ...request.body,
          actorUserId: actorUserId(request),
        });
      } catch (error) {
        reply.code(409);
        return { error: error instanceof Error ? error.message : "Print snapshot rejected" };
      }
    },
  );
}
