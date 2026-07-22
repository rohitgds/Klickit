import {
  WHATSAPP_AUTOMATIONS,
  buildMessageDeduplicationKey,
  hashRecipient,
  validateAutomationSend,
  validateMessageConsent,
  validateTemplateApproval,
  validateWebhookDedup,
} from "@klickit/comms";
import type { DatabasePoolLike } from "../db/client.js";
import { createPabblyMessagingAdapter } from "@klickit/providers";

type DbContext = {
  pool: DatabasePoolLike;
  organizationId: string;
  clinicId: string;
};

const messagingAdapter = createPabblyMessagingAdapter({ mode: "development" });

export async function listMessageTemplates(ctx: DbContext, input?: { channel?: string }) {
  const result = await ctx.pool.query(
    `
      SELECT *
      FROM dentos_data.message_templates
      WHERE organization_id = $1 AND active = true
        AND ($2::varchar IS NULL OR channel = $2)
      ORDER BY route_type, name, template_version DESC
    `,
    [ctx.organizationId, input?.channel ?? null],
  );
  return { templates: result.rows };
}

export async function createMessageTemplate(
  ctx: DbContext,
  input: {
    channel: "sms" | "whatsapp" | "email";
    purpose: "care" | "transactional" | "marketing" | "otp";
    routeType: string;
    name: string;
    body: string;
    actorUserId: string;
  },
) {
  const id = crypto.randomUUID();
  await ctx.pool.query(
    `
      INSERT INTO dentos_data.message_templates (
        id, organization_id, channel, purpose, route_type, name, body, approval_status, active, created_by, updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft', true, $8, $8)
    `,
    [
      id,
      ctx.organizationId,
      input.channel,
      input.purpose,
      input.routeType,
      input.name,
      input.body,
      input.actorUserId,
    ],
  );
  return { id, approvalStatus: "draft" };
}

export async function approveMessageTemplate(
  ctx: DbContext,
  input: { templateId: string; actorUserId: string },
) {
  await ctx.pool.query(
    `
      UPDATE dentos_data.message_templates
      SET approval_status = 'approved', approved_at = clock_timestamp(), approved_by = $2,
          updated_by = $2, updated_at = clock_timestamp()
      WHERE id = $1 AND organization_id = $3
    `,
    [input.templateId, input.actorUserId, ctx.organizationId],
  );
  return { id: input.templateId, approvalStatus: "approved" };
}

export async function upsertCommunicationPreference(
  ctx: DbContext,
  input: {
    patientId: string;
    channel: "sms" | "whatsapp" | "email";
    purpose: "care" | "transactional" | "marketing" | "otp";
    status: "opted_in" | "opted_out" | "unknown";
    source: string;
    actorUserId: string;
  },
) {
  const id = crypto.randomUUID();
  await ctx.pool.query(
    `
      INSERT INTO dentos_data.communication_preferences (
        id, patient_id, channel, purpose, status, source, changed_at, changed_by, created_by, updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, clock_timestamp(), $7, $7, $7)
      ON CONFLICT (patient_id, channel, purpose)
      DO UPDATE SET status = EXCLUDED.status, source = EXCLUDED.source, changed_at = clock_timestamp(),
                    changed_by = EXCLUDED.changed_by, updated_by = EXCLUDED.updated_by, updated_at = clock_timestamp()
    `,
    [id, input.patientId, input.channel, input.purpose, input.status, input.source, input.actorUserId],
  );
  return { patientId: input.patientId, channel: input.channel, purpose: input.purpose, status: input.status };
}

export async function queueOutboundMessage(
  ctx: DbContext,
  input: {
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
    automationEnabled?: boolean;
    testMode?: boolean;
    testRecipientAllowed?: boolean;
    actorUserId: string;
  },
) {
  if (input.patientId) {
    const consent = await ctx.pool.query<{ status: string }>(
      `
        SELECT status FROM dentos_data.communication_preferences
        WHERE patient_id = $1 AND channel = $2 AND purpose = $3
      `,
      [input.patientId, input.channel, input.purpose],
    );
    const consentCheck = validateMessageConsent({
      channel: input.channel,
      purpose: input.purpose,
      consentStatus: (consent.rows[0]?.status ?? "unknown") as "opted_in" | "opted_out" | "unknown",
    });
    if (!consentCheck.ok) {
      throw new Error(consentCheck.message);
    }
  }

  if (input.templateId) {
    const template = await ctx.pool.query<{ approval_status: string }>(
      `SELECT approval_status FROM dentos_data.message_templates WHERE id = $1`,
      [input.templateId],
    );
    const approvalCheck = validateTemplateApproval({
      approvalStatus: (template.rows[0]?.approval_status ?? "draft") as "draft",
    });
    if (!approvalCheck.ok) {
      throw new Error(approvalCheck.message);
    }
  }

  const automationCheck = validateAutomationSend({
    routeType: input.routeType as (typeof WHATSAPP_AUTOMATIONS)[number]["routeType"],
    automationEnabled: input.automationEnabled ?? true,
    testMode: input.testMode ?? false,
    recipientAllowed: input.testRecipientAllowed ?? true,
  });
  if (!automationCheck.ok) {
    throw new Error(automationCheck.message);
  }

  const recipientHash = hashRecipient(input.recipient);
  const deduplicationKey = buildMessageDeduplicationKey({
    clinicId: ctx.clinicId,
    routeType: input.routeType,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    recipientHash,
  });
  const id = crypto.randomUUID();
  await ctx.pool.query(
    `
      INSERT INTO dentos_data.outbound_messages (
        id, clinic_id, continuity_task_id, patient_id, channel, purpose, route_type, template_id,
        rendered_body, status, source_type, source_id, deduplication_key, created_by, updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'queued', $10, $11, $12, $13, $13)
    `,
    [
      id,
      ctx.clinicId,
      input.continuityTaskId ?? null,
      input.patientId ?? null,
      input.channel,
      input.purpose,
      input.routeType,
      input.templateId ?? null,
      input.renderedBody,
      input.sourceType,
      input.sourceId,
      deduplicationKey,
      input.actorUserId,
    ],
  );
  const providerResult = await messagingAdapter.sendMessage({
    recipient: input.recipient,
    templateId: input.templateId ?? input.routeType,
    body: input.renderedBody,
    deduplicationKey,
  });
  return { id, status: providerResult.queued ? "queued" : "suppressed", provider: providerResult.provider };
}

export async function applyProviderWebhookEvent(
  ctx: DbContext,
  input: {
    outboundMessageId: string;
    providerStatus: "submitted" | "sent" | "delivered" | "failed";
    providerEventId: string;
    payload: Record<string, unknown>;
  },
) {
  const seen = await ctx.pool.query<{ provider_event_id: string }>(
    `
      SELECT provider_event_id
      FROM dentos_data.message_status_events
      WHERE outbound_message_id = $1
    `,
    [input.outboundMessageId],
  );
  const dedup = validateWebhookDedup({
    providerEventId: input.providerEventId,
    seenProviderEventIds: seen.rows.map((row) => row.provider_event_id),
  });
  if (!dedup.ok) {
    return { duplicate: true };
  }
  await ctx.pool.query(
    `
      INSERT INTO dentos_data.message_status_events (
        id, outbound_message_id, provider_status, provider_event_id, payload_json, payload_sha256, created_by
      ) VALUES ($1, $2, $3, $4, $5::jsonb, encode(digest($5::text, 'sha256'), 'hex'), $6)
    `,
    [
      crypto.randomUUID(),
      input.outboundMessageId,
      input.providerStatus,
      input.providerEventId,
      JSON.stringify(input.payload),
      "00000000-0000-4000-8000-000000000000",
    ],
  );
  const mappedStatus =
    input.providerStatus === "delivered"
      ? "delivered"
      : input.providerStatus === "failed"
        ? "failed"
        : input.providerStatus === "sent"
          ? "sent"
          : "submitted";
  await ctx.pool.query(
    `
      UPDATE dentos_data.outbound_messages
      SET status = $2, updated_at = clock_timestamp()
      WHERE id = $1
    `,
    [input.outboundMessageId, mappedStatus],
  );
  return { duplicate: false, status: mappedStatus };
}

export async function listPatientMessages(ctx: DbContext, patientId: string) {
  const result = await ctx.pool.query(
    `
      SELECT *
      FROM dentos_data.outbound_messages
      WHERE clinic_id = $1 AND patient_id = $2
      ORDER BY created_at DESC
      LIMIT 200
    `,
    [ctx.clinicId, patientId],
  );
  return { messages: result.rows };
}

export function listWhatsAppAutomations() {
  return { automations: WHATSAPP_AUTOMATIONS };
}

export async function listPrintTemplates(ctx: DbContext, input?: { groupCode?: string }) {
  const result = await ctx.pool.query(
    `
      SELECT group_code, key, value_json, value_schema_version
      FROM dentos_data.clinic_settings
      WHERE organization_id = $1 AND clinic_id = $2
        AND ($3::varchar IS NULL OR group_code = $3)
      ORDER BY group_code, key
    `,
    [ctx.organizationId, ctx.clinicId, input?.groupCode ?? null],
  );
  return { templates: result.rows };
}
