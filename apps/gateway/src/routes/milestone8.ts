import type { FastifyInstance } from "fastify";
import type { GatewayDependencies } from "./index.js";
import { evaluateOfflineWritePolicy } from "../sync/engine.js";
import { requirePermission, requireSession } from "../security/middleware.js";
import {
  completeContinuityTask,
  createContinuityPolicy,
  createContinuityRecallRecord,
  createContinuityTask,
  listContinuityPolicies,
  listDueContinuityTasks,
  snoozeContinuityTask,
} from "../continuity/repository.js";
import {
  applyProviderWebhookEvent,
  approveMessageTemplate,
  createMessageTemplate,
  listMessageTemplates,
  listPatientMessages,
  listPrintTemplates,
  listWhatsAppAutomations,
  queueOutboundMessage,
  upsertCommunicationPreference,
} from "../messaging/repository.js";
import { createDocumentPrintSnapshot, getDocumentPrintTemplate } from "../medication/repository.js";
import { validatePrintDocumentType } from "@klickit/comms";

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

export async function registerMilestone8Routes(app: FastifyInstance, deps: GatewayDependencies) {
  app.get(
    "/continuity/policies",
    { preHandler: [requireSession(deps), requirePermission(deps, "clinical.view")] },
    async () => listContinuityPolicies(dbContext(deps)),
  );

  app.post<{
    Body: {
      name: string;
      triggerEvent: string;
      intervalValue: number;
      intervalUnit: "day" | "week" | "month" | "year";
      serviceId?: string;
      sendWhatsapp?: boolean;
      whatsappTemplateId?: string;
    };
  }>(
    "/continuity/policies",
    { preHandler: [requireSession(deps), requirePermission(deps, "clinical.edit")] },
    async (request, reply) => {
      try {
        enforceWriteAllowed(deps);
        return await createContinuityPolicy(dbContext(deps), { ...request.body, actorUserId: actorUserId(request) });
      } catch (error) {
        reply.code(409);
        return { error: error instanceof Error ? error.message : "Policy rejected" };
      }
    },
  );

  app.get<{ Querystring: { asOf?: string } }>(
    "/continuity/tasks/due",
    { preHandler: [requireSession(deps), requirePermission(deps, "clinical.view")] },
    async (request) => listDueContinuityTasks(dbContext(deps), { asOf: request.query.asOf }),
  );

  app.post<{
    Body: {
      patientId: string;
      continuityPolicyId?: string;
      sourceType: string;
      sourceId: string;
      taskType: string;
      reasonCode: string;
      sourceDate: string;
      intervalValue: number;
      intervalUnit: "day" | "week" | "month" | "year";
      dueLocalTime?: string;
      sendWhatsapp?: boolean;
      whatsappTemplateId?: string;
    };
  }>(
    "/continuity/tasks",
    { preHandler: [requireSession(deps), requirePermission(deps, "clinical.edit")] },
    async (request, reply) => {
      try {
        enforceWriteAllowed(deps);
        return await createContinuityTask(dbContext(deps), { ...request.body, actorUserId: actorUserId(request) });
      } catch (error) {
        reply.code(409);
        return { error: error instanceof Error ? error.message : "Task rejected" };
      }
    },
  );

  app.post<{ Params: { id: string }; Body: { snoozedUntil: string } }>(
    "/continuity/tasks/:id/snooze",
    { preHandler: [requireSession(deps), requirePermission(deps, "clinical.edit")] },
    async (request, reply) => {
      try {
        enforceWriteAllowed(deps);
        return await snoozeContinuityTask(dbContext(deps), {
          taskId: request.params.id,
          snoozedUntil: request.body.snoozedUntil,
          actorUserId: actorUserId(request),
        });
      } catch (error) {
        reply.code(409);
        return { error: error instanceof Error ? error.message : "Snooze rejected" };
      }
    },
  );

  app.post<{ Params: { id: string } }>(
    "/continuity/tasks/:id/complete",
    { preHandler: [requireSession(deps), requirePermission(deps, "clinical.edit")] },
    async (request, reply) => {
      try {
        enforceWriteAllowed(deps);
        return await completeContinuityTask(dbContext(deps), {
          taskId: request.params.id,
          actorUserId: actorUserId(request),
        });
      } catch (error) {
        reply.code(409);
        return { error: error instanceof Error ? error.message : "Completion rejected" };
      }
    },
  );

  app.post<{
    Body: { patientId: string; ruleId: string; dueDate: string; sourceCareEncounterId?: string };
  }>(
    "/continuity/recalls",
    { preHandler: [requireSession(deps), requirePermission(deps, "clinical.edit")] },
    async (request, reply) => {
      try {
        enforceWriteAllowed(deps);
        return await createContinuityRecallRecord(dbContext(deps), {
          ...request.body,
          actorUserId: actorUserId(request),
        });
      } catch (error) {
        reply.code(409);
        return { error: error instanceof Error ? error.message : "Recall rejected" };
      }
    },
  );

  app.get<{ Querystring: { channel?: string } }>(
    "/messaging/templates",
    { preHandler: [requireSession(deps), requirePermission(deps, "message.view")] },
    async (request) => listMessageTemplates(dbContext(deps), { channel: request.query.channel }),
  );

  app.post<{
    Body: {
      channel: "sms" | "whatsapp" | "email";
      purpose: "care" | "transactional" | "marketing" | "otp";
      routeType: string;
      name: string;
      body: string;
    };
  }>(
    "/messaging/templates",
    { preHandler: [requireSession(deps), requirePermission(deps, "message.send")] },
    async (request, reply) => {
      try {
        enforceWriteAllowed(deps);
        return await createMessageTemplate(dbContext(deps), { ...request.body, actorUserId: actorUserId(request) });
      } catch (error) {
        reply.code(409);
        return { error: error instanceof Error ? error.message : "Template rejected" };
      }
    },
  );

  app.post<{ Params: { id: string } }>(
    "/messaging/templates/:id/approve",
    { preHandler: [requireSession(deps), requirePermission(deps, "message.bulk_send")] },
    async (request, reply) => {
      try {
        enforceWriteAllowed(deps);
        return await approveMessageTemplate(dbContext(deps), {
          templateId: request.params.id,
          actorUserId: actorUserId(request),
        });
      } catch (error) {
        reply.code(409);
        return { error: error instanceof Error ? error.message : "Approval rejected" };
      }
    },
  );

  app.put<{
    Body: {
      patientId: string;
      channel: "sms" | "whatsapp" | "email";
      purpose: "care" | "transactional" | "marketing" | "otp";
      status: "opted_in" | "opted_out" | "unknown";
      source: string;
    };
  }>(
    "/messaging/preferences",
    { preHandler: [requireSession(deps), requirePermission(deps, "message.send")] },
    async (request, reply) => {
      try {
        enforceWriteAllowed(deps);
        return await upsertCommunicationPreference(dbContext(deps), {
          ...request.body,
          actorUserId: actorUserId(request),
        });
      } catch (error) {
        reply.code(409);
        return { error: error instanceof Error ? error.message : "Preference rejected" };
      }
    },
  );

  app.post<{
    Body: {
      patientId?: string;
      channel: "sms" | "whatsapp" | "email";
      purpose: "care" | "transactional" | "marketing" | "otp";
      routeType: string;
      recipient: string;
      templateId?: string;
      renderedBody: string;
      sourceType: string;
      sourceId: string;
      continuityTaskId?: string;
      testMode?: boolean;
      testRecipientAllowed?: boolean;
    };
  }>(
    "/messaging/outbound",
    { preHandler: [requireSession(deps), requirePermission(deps, "message.send")] },
    async (request, reply) => {
      try {
        enforceWriteAllowed(deps);
        return await queueOutboundMessage(dbContext(deps), { ...request.body, actorUserId: actorUserId(request) });
      } catch (error) {
        reply.code(409);
        return { error: error instanceof Error ? error.message : "Outbound message rejected" };
      }
    },
  );

  app.post<{
    Body: {
      outboundMessageId: string;
      providerStatus: "submitted" | "sent" | "delivered" | "failed";
      providerEventId: string;
      payload: Record<string, unknown>;
    };
  }>(
    "/messaging/provider/webhook",
    async (request, reply) => {
      try {
        if (!deps.pool || !deps.bootstrap) {
          reply.code(503);
          return { error: "Gateway database bootstrap is unavailable" };
        }
        return await applyProviderWebhookEvent(dbContext(deps), request.body);
      } catch (error) {
        reply.code(409);
        return { error: error instanceof Error ? error.message : "Webhook rejected" };
      }
    },
  );

  app.get<{ Params: { patientId: string } }>(
    "/messaging/patients/:patientId/messages",
    { preHandler: [requireSession(deps), requirePermission(deps, "message.view")] },
    async (request) => listPatientMessages(dbContext(deps), request.params.patientId),
  );

  app.get(
    "/messaging/automations",
    { preHandler: [requireSession(deps), requirePermission(deps, "message.view")] },
    async () => listWhatsAppAutomations(),
  );

  app.get<{ Querystring: { groupCode?: string } }>(
    "/documents/print-catalog",
    { preHandler: [requireSession(deps), requirePermission(deps, "fee_statement.print")] },
    async (request) => listPrintTemplates(dbContext(deps), { groupCode: request.query.groupCode }),
  );

  app.get<{ Querystring: { groupCode: string; key: string; documentType?: string } }>(
    "/documents/print-templates/extended",
    { preHandler: [requireSession(deps), requirePermission(deps, "fee_statement.print")] },
    async (request, reply) => {
      if (request.query.documentType) {
        const typeCheck = validatePrintDocumentType(request.query.documentType);
        if (!typeCheck.ok) {
          reply.code(409);
          return { error: typeCheck.message };
        }
      }
      const template = await getDocumentPrintTemplate(dbContext(deps), {
        groupCode: request.query.groupCode,
        key: request.query.key,
      });
      if (!template) {
        reply.code(404);
        return { error: "Print template not found" };
      }
      return template;
    },
  );

  app.post<{
    Body: {
      documentType: string;
      sourceEntityType: string;
      sourceEntityId: string;
      templateGroupCode: string;
      templateKey: string;
      templateVersion: number;
      layoutJson: Record<string, unknown>;
      payloadJson: Record<string, unknown>;
    };
  }>(
    "/documents/print-snapshots/extended",
    { preHandler: [requireSession(deps), requirePermission(deps, "fee_statement.print")] },
    async (request, reply) => {
      try {
        enforceWriteAllowed(deps);
        const typeCheck = validatePrintDocumentType(request.body.documentType);
        if (!typeCheck.ok) {
          reply.code(409);
          return { error: typeCheck.message };
        }
        return await createDocumentPrintSnapshot(dbContext(deps), {
          documentType: typeCheck.documentType,
          sourceEntityType: request.body.sourceEntityType,
          sourceEntityId: request.body.sourceEntityId,
          templateGroupCode: request.body.templateGroupCode,
          templateKey: request.body.templateKey,
          templateVersion: request.body.templateVersion,
          layout: request.body.layoutJson,
          payload: request.body.payloadJson,
          actorUserId: actorUserId(request),
        });
      } catch (error) {
        reply.code(409);
        return { error: error instanceof Error ? error.message : "Print snapshot rejected" };
      }
    },
  );
}
