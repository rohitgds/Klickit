import {
  calculateContinuityDueDate,
  validateContinuityTaskTransition,
  type ContinuityTaskStatus,
} from "@klickit/comms";
import type { DatabasePoolLike } from "../db/client.js";

type DbContext = {
  pool: DatabasePoolLike;
  organizationId: string;
  clinicId: string;
};

export async function listContinuityPolicies(ctx: DbContext) {
  const result = await ctx.pool.query(
    `
      SELECT *
      FROM dentos_data.continuity_policies
      WHERE organization_id = $1 AND (clinic_id IS NULL OR clinic_id = $2) AND active = true
      ORDER BY name
    `,
    [ctx.organizationId, ctx.clinicId],
  );
  return { policies: result.rows };
}

export async function createContinuityPolicy(
  ctx: DbContext,
  input: {
    name: string;
    triggerEvent: string;
    intervalValue: number;
    intervalUnit: "day" | "week" | "month" | "year";
    serviceId?: string;
    sendWhatsapp?: boolean;
    whatsappTemplateId?: string;
    actorUserId: string;
  },
) {
  const id = crypto.randomUUID();
  await ctx.pool.query(
    `
      INSERT INTO dentos_data.continuity_policies (
        id, organization_id, clinic_id, name, trigger_event, interval_value, interval_unit,
        send_whatsapp, whatsapp_template_id, active, created_by, updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, $10, $10)
    `,
    [
      id,
      ctx.organizationId,
      ctx.clinicId,
      input.name,
      input.triggerEvent,
      input.intervalValue,
      input.intervalUnit,
      input.sendWhatsapp ?? false,
      input.whatsappTemplateId ?? null,
      input.actorUserId,
    ],
  );
  return { id };
}

export async function listDueContinuityTasks(ctx: DbContext, input?: { asOf?: string }) {
  const result = await ctx.pool.query(
    `
      SELECT *
      FROM dentos_data.continuity_tasks
      WHERE clinic_id = $1
        AND status IN ('scheduled', 'due', 'snoozed')
        AND due_date <= COALESCE($2::date, CURRENT_DATE)
      ORDER BY due_at ASC
    `,
    [ctx.clinicId, input?.asOf ?? null],
  );
  return { tasks: result.rows };
}

export async function createContinuityTask(
  ctx: DbContext,
  input: {
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
    actorUserId: string;
  },
) {
  const due = calculateContinuityDueDate({
    sourceDate: input.sourceDate,
    intervalValue: input.intervalValue,
    intervalUnit: input.intervalUnit,
    dueLocalTime: input.dueLocalTime,
  });
  const id = crypto.randomUUID();
  await ctx.pool.query(
    `
      INSERT INTO dentos_data.continuity_tasks (
        id, organization_id, clinic_id, patient_id, continuity_policy_id, source_type, source_id,
        date_mode, due_date, due_local_time, due_at, interval_value_snapshot, interval_unit_snapshot,
        task_type, reason_code, status, send_whatsapp, whatsapp_template_id, created_by, updated_by
      )
      SELECT
        $1, $2, $3, $4, $5, $6, $7, 'rule', $8::date, $9::time,
        ($8::date + $9::time) AT TIME ZONE c.timezone,
        $10, $11, $12, $13, 'scheduled', $14, $15, $16, $16
      FROM dentos_data.clinics c
      WHERE c.id = $3
    `,
    [
      id,
      ctx.organizationId,
      ctx.clinicId,
      input.patientId,
      input.continuityPolicyId ?? null,
      input.sourceType,
      input.sourceId,
      due.dueDate,
      due.dueLocalTime,
      input.intervalValue,
      input.intervalUnit,
      input.taskType,
      input.reasonCode,
      input.sendWhatsapp ?? false,
      input.whatsappTemplateId ?? null,
      input.actorUserId,
    ],
  );
  await ctx.pool.query(
    `
      UPDATE dentos_data.patients
      SET next_continuity_date = $2, updated_at = clock_timestamp(), updated_by = $3
      WHERE id = $1
    `,
    [input.patientId, due.dueDate, input.actorUserId],
  );
  return { id, dueDate: due.dueDate, status: "scheduled" as ContinuityTaskStatus };
}

export async function snoozeContinuityTask(
  ctx: DbContext,
  input: { taskId: string; snoozedUntil: string; actorUserId: string },
) {
  const task = await loadContinuityTask(ctx, input.taskId);
  if (!task) {
    throw new Error("Continuity task not found");
  }
  const transition = validateContinuityTaskTransition({
    fromStatus: task.status as ContinuityTaskStatus,
    toStatus: "snoozed",
  });
  if (!transition.ok) {
    throw new Error(transition.message);
  }
  await ctx.pool.query(
    `
      UPDATE dentos_data.continuity_tasks
      SET status = 'snoozed', snoozed_until = $2::timestamptz, updated_by = $3, updated_at = clock_timestamp()
      WHERE id = $1
    `,
    [input.taskId, input.snoozedUntil, input.actorUserId],
  );
  return { id: input.taskId, status: "snoozed" };
}

export async function completeContinuityTask(
  ctx: DbContext,
  input: { taskId: string; actorUserId: string },
) {
  const task = await loadContinuityTask(ctx, input.taskId);
  if (!task) {
    throw new Error("Continuity task not found");
  }
  const transition = validateContinuityTaskTransition({
    fromStatus: task.status as ContinuityTaskStatus,
    toStatus: "completed",
  });
  if (!transition.ok) {
    throw new Error(transition.message);
  }
  await ctx.pool.query(
    `
      UPDATE dentos_data.continuity_tasks
      SET status = 'completed', completed_at = clock_timestamp(), completed_by = $2,
          updated_by = $2, updated_at = clock_timestamp()
      WHERE id = $1
    `,
    [input.taskId, input.actorUserId],
  );
  return { id: input.taskId, status: "completed" };
}

async function loadContinuityTask(ctx: DbContext, taskId: string) {
  const result = await ctx.pool.query<{ status: string }>(
    `SELECT status FROM dentos_data.continuity_tasks WHERE id = $1 AND clinic_id = $2`,
    [taskId, ctx.clinicId],
  );
  return result.rows[0] ?? null;
}

export async function createContinuityRecallRecord(
  ctx: DbContext,
  input: {
    patientId: string;
    ruleId: string;
    dueDate: string;
    sourceCareEncounterId?: string;
    actorUserId: string;
  },
) {
  const id = crypto.randomUUID();
  await ctx.pool.query(
    `
      INSERT INTO dentos_data.continuity_recall_records (
        id, clinic_id, patient_id, source_care_encounter_id, rule_id, due_date, status, created_by, updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6::date, 'open', $7, $7)
    `,
    [
      id,
      ctx.clinicId,
      input.patientId,
      input.sourceCareEncounterId ?? null,
      input.ruleId,
      input.dueDate,
      input.actorUserId,
    ],
  );
  return { id, status: "open" };
}
