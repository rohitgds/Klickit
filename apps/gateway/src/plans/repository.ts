import {
  calculateCarePlanTotals,
  validateCarePlanStatusTransition,
  validatePlanAcceptance,
  validateTreatmentBundleTier,
  type CarePlanStatus,
  type PlanAcceptanceMethod,
  type TreatmentBundleTier,
} from "@klickit/plans-prescriptions";
import type { DatabasePoolLike } from "../db/client.js";

type DbContext = {
  pool: DatabasePoolLike;
  organizationId: string;
  clinicId: string;
};

async function loadCarePlan(ctx: DbContext, planId: string) {
  const result = await ctx.pool.query<Record<string, unknown>>(
    `SELECT * FROM dentos_data.care_plans WHERE id = $1 AND clinic_id = $2`,
    [planId, ctx.clinicId],
  );
  return result.rows[0] ?? null;
}

async function loadPlanServiceLines(ctx: DbContext, planId: string) {
  const result = await ctx.pool.query<{ proposed_fee: string; discount: string | null; accepted: boolean | null }>(
    `
      SELECT cps.proposed_fee, cps.discount, cps.accepted
      FROM dentos_data.care_plan_services cps
      JOIN dentos_data.care_plan_stages cstage ON cstage.id = cps.care_plan_stage_id
      WHERE cstage.care_plan_id = $1
    `,
    [planId],
  );
  return result.rows;
}

export async function createCarePlan(
  ctx: DbContext,
  input: { patientId: string; planDate?: string; notes?: string; actorUserId: string },
) {
  const id = crypto.randomUUID();
  await ctx.pool.query(
    `
      INSERT INTO dentos_data.care_plans (
        id, patient_id, clinic_id, plan_date, status, notes, created_by, updated_by
      ) VALUES ($1, $2, $3, COALESCE($4::date, CURRENT_DATE), 'draft', $5, $6, $6)
    `,
    [id, input.patientId, ctx.clinicId, input.planDate ?? null, input.notes ?? null, input.actorUserId],
  );
  return { id, status: "draft" as CarePlanStatus };
}

export async function addCarePlanStage(
  ctx: DbContext,
  input: { planId: string; phaseNo: number; name: string; actorUserId: string },
) {
  const plan = await loadCarePlan(ctx, input.planId);
  if (!plan) {
    throw new Error("Care plan not found");
  }
  const id = crypto.randomUUID();
  await ctx.pool.query(
    `
      INSERT INTO dentos_data.care_plan_stages (
        id, care_plan_id, phase_no, name, status, created_by, updated_by
      ) VALUES ($1, $2, $3, $4, 'planned', $5, $5)
    `,
    [id, input.planId, input.phaseNo, input.name, input.actorUserId],
  );
  return { id };
}

export async function addCarePlanService(
  ctx: DbContext,
  input: {
    stageId: string;
    serviceId: string;
    toothCode?: string;
    surfaceCodes?: string[];
    proposedFee: number;
    discount?: number;
    actorUserId: string;
  },
) {
  const stage = await ctx.pool.query<{ care_plan_id: string }>(
    `
      SELECT cstage.care_plan_id
      FROM dentos_data.care_plan_stages cstage
      JOIN dentos_data.care_plans cp ON cp.id = cstage.care_plan_id
      WHERE cstage.id = $1 AND cp.clinic_id = $2
    `,
    [input.stageId, ctx.clinicId],
  );
  if (!stage.rows[0]) {
    throw new Error("Care plan stage not found");
  }
  const service = await ctx.pool.query<{ code: string; description: string }>(
    `SELECT code, description FROM dentos_data.service_catalog WHERE id = $1 AND organization_id = $2 AND active = true`,
    [input.serviceId, ctx.organizationId],
  );
  if (!service.rows[0]) {
    throw new Error("Service not found");
  }
  const id = crypto.randomUUID();
  await ctx.pool.query(
    `
      INSERT INTO dentos_data.care_plan_services (
        id, care_plan_stage_id, service_id, tooth_code, surface_codes, quantity,
        proposed_fee, discount, accepted, status, created_by, updated_by
      ) VALUES ($1, $2, $3, $4, $5, 1, $6, $7, false, 'proposed', $8, $8)
    `,
    [
      id,
      input.stageId,
      input.serviceId,
      input.toothCode ?? null,
      input.surfaceCodes ?? [],
      input.proposedFee,
      input.discount ?? 0,
      input.actorUserId,
    ],
  );
  const planId = stage.rows[0].care_plan_id;
  await refreshCarePlanTotals(ctx, planId);
  return { id, planId };
}

async function refreshCarePlanTotals(ctx: DbContext, planId: string) {
  const lines = await loadPlanServiceLines(ctx, planId);
  const totals = calculateCarePlanTotals(
    lines.map((line) => ({
      proposedFee: Number(line.proposed_fee),
      discount: Number(line.discount ?? 0),
      accepted: Boolean(line.accepted),
    })),
  );
  await ctx.pool.query(
    `
      UPDATE dentos_data.care_plans
      SET estimated_total = $2, displayed_amount = $3, accepted_total = $4, updated_at = clock_timestamp()
      WHERE id = $1
    `,
    [planId, totals.estimatedTotal, totals.displayedAmount, totals.acceptedTotal],
  );
}

export async function getCarePlanDetail(ctx: DbContext, planId: string) {
  const plan = await loadCarePlan(ctx, planId);
  if (!plan) {
    throw new Error("Care plan not found");
  }
  const [stages, bundles] = await Promise.all([
    ctx.pool.query(
      `
        SELECT cstage.*,
          COALESCE(json_agg(cps ORDER BY cps.created_at) FILTER (WHERE cps.id IS NOT NULL), '[]'::json) AS services
        FROM dentos_data.care_plan_stages cstage
        LEFT JOIN dentos_data.care_plan_services cps ON cps.care_plan_stage_id = cstage.id
        WHERE cstage.care_plan_id = $1
        GROUP BY cstage.id
        ORDER BY cstage.phase_no
      `,
      [planId],
    ),
    ctx.pool.query(
      `
        SELECT tb.*
        FROM dentos_data.treatment_bundles tb
        WHERE tb.care_plan_id = $1
        ORDER BY tb.bundle_tier, tb.sequence_no
      `,
      [planId],
    ),
  ]);
  return { plan, stages: stages.rows, bundles: bundles.rows };
}

export async function proposeCarePlan(
  ctx: DbContext,
  input: { planId: string; proposedByStaffId: string; actorUserId: string },
) {
  const plan = await loadCarePlan(ctx, input.planId);
  if (!plan) {
    throw new Error("Care plan not found");
  }
  const transition = validateCarePlanStatusTransition({
    fromStatus: plan.status as CarePlanStatus,
    toStatus: "proposed",
  });
  if (!transition.ok) {
    throw new Error(transition.message);
  }
  await ctx.pool.query(
    `
      UPDATE dentos_data.care_plans
      SET status = 'proposed', proposed_by = $2, proposed_at = clock_timestamp(), updated_by = $3, updated_at = clock_timestamp()
      WHERE id = $1
    `,
    [input.planId, input.proposedByStaffId, input.actorUserId],
  );
  return { id: input.planId, status: "proposed" };
}

export async function acceptCarePlan(
  ctx: DbContext,
  input: {
    planId: string;
    method: PlanAcceptanceMethod;
    acceptedTotal: number;
    confirmationCode?: string;
    signatureHash?: string;
    signatureFileId?: string;
    notes?: string;
    actorUserId: string;
  },
) {
  const plan = await loadCarePlan(ctx, input.planId);
  if (!plan) {
    throw new Error("Care plan not found");
  }
  const targetStatus: CarePlanStatus =
    input.acceptedTotal >= Number(plan.estimated_total ?? 0) ? "accepted" : "partially_accepted";
  const transition = validateCarePlanStatusTransition({
    fromStatus: plan.status as CarePlanStatus,
    toStatus: targetStatus,
  });
  if (!transition.ok) {
    throw new Error(transition.message);
  }
  const acceptance = validatePlanAcceptance({
    method: input.method,
    acceptedTotal: input.acceptedTotal,
    confirmationCode: input.confirmationCode,
    signatureHash: input.signatureHash,
  });
  if (!acceptance.ok) {
    throw new Error(acceptance.message);
  }
  const recordId = crypto.randomUUID();
  await ctx.pool.query(
    `
      INSERT INTO dentos_data.care_plan_acceptance_records (
        id, care_plan_id, acceptance_method, accepted_total, confirmation_code,
        signature_file_id, signature_hash, accepted_by, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $8)
    `,
    [
      recordId,
      input.planId,
      input.method,
      input.acceptedTotal,
      input.confirmationCode ?? null,
      input.signatureFileId ?? null,
      input.signatureHash ?? null,
      input.actorUserId,
      input.notes ?? null,
    ],
  );
  await ctx.pool.query(
    `
      UPDATE dentos_data.care_plans
      SET status = $2, accepted_total = $3, updated_by = $4, updated_at = clock_timestamp()
      WHERE id = $1
    `,
    [input.planId, targetStatus, input.acceptedTotal, input.actorUserId],
  );
  return { id: input.planId, status: targetStatus, acceptanceRecordId: recordId };
}

export async function createClinicalCaseForEncounter(
  ctx: DbContext,
  input: {
    patientId: string;
    encounterId: string;
    primaryClinicianId: string;
    secondaryClinicianId: string;
    actorUserId: string;
  },
) {
  const encounter = await ctx.pool.query<{ patient_id: string }>(
    `SELECT patient_id FROM dentos_data.care_encounters WHERE id = $1 AND clinic_id = $2`,
    [input.encounterId, ctx.clinicId],
  );
  if (!encounter.rows[0] || encounter.rows[0].patient_id !== input.patientId) {
    throw new Error("Encounter not found for patient");
  }
  const patient = await ctx.pool.query<{ intent_tier: string }>(
    `SELECT intent_tier FROM dentos_data.patients WHERE id = $1 AND organization_id = $2`,
    [input.patientId, ctx.organizationId],
  );
  if (!patient.rows[0]) {
    throw new Error("Patient not found");
  }
  const caseId = crypto.randomUUID();
  const consultationId = crypto.randomUUID();
  const caseNo = `CASE-${caseId.slice(0, 8).toUpperCase()}`;
  await ctx.pool.query(`BEGIN`);
  try {
    await ctx.pool.query(`SET CONSTRAINTS ALL DEFERRED`);
    await ctx.pool.query(
      `
        INSERT INTO dentos_data.clinical_cases (
          id, organization_id, clinic_id, case_no, patient_id, initial_consultation_id,
          intent_tier_snapshot, execution_state, state_changed_at, state_changed_by,
          state_change_source, created_by, updated_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'not_started', clock_timestamp(), $8, 'consultation_close', $8, $8)
      `,
      [
        caseId,
        ctx.organizationId,
        ctx.clinicId,
        caseNo,
        input.patientId,
        consultationId,
        patient.rows[0].intent_tier,
        input.actorUserId,
      ],
    );
    await ctx.pool.query(
      `
        INSERT INTO dentos_data.case_consultations (
          id, clinical_case_id, care_encounter_id, consultation_kind, consulted_at,
          primary_consult_clinician_id, secondary_review_clinician_id, consultation_objective,
          status, created_by, updated_by
        ) VALUES ($1, $2, $3, 'initial', clock_timestamp(), $4, $5, 'Initial consultation', 'draft', $6, $6)
      `,
      [
        consultationId,
        caseId,
        input.encounterId,
        input.primaryClinicianId,
        input.secondaryClinicianId,
        input.actorUserId,
      ],
    );
    await ctx.pool.query(`COMMIT`);
  } catch (error) {
    await ctx.pool.query(`ROLLBACK`);
    throw error;
  }
  return { clinicalCaseId: caseId, consultationId };
}

export async function createTreatmentBundle(
  ctx: DbContext,
  input: {
    clinicalCaseId: string;
    carePlanId: string;
    bundleTier: TreatmentBundleTier;
    sequenceNo: number;
    title: string;
    clinicalRationale: string;
    advisedByStaffId: string;
    carePlanServiceIds: string[];
    actorUserId: string;
  },
) {
  if (!validateTreatmentBundleTier(input.bundleTier)) {
    throw new Error("Invalid treatment bundle tier");
  }
  const plan = await loadCarePlan(ctx, input.carePlanId);
  if (!plan) {
    throw new Error("Care plan not found");
  }
  const bundleId = crypto.randomUUID();
  let estimatedValue = 0;
  await ctx.pool.query(
    `
      INSERT INTO dentos_data.treatment_bundles (
        id, clinical_case_id, care_plan_id, bundle_tier, sequence_no, title, clinical_rationale,
        status, estimated_value, advised_at, advised_by, created_by, updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'advised', 0, clock_timestamp(), $8, $9, $9)
    `,
    [
      bundleId,
      input.clinicalCaseId,
      input.carePlanId,
      input.bundleTier,
      input.sequenceNo,
      input.title,
      input.clinicalRationale,
      input.advisedByStaffId,
      input.actorUserId,
    ],
  );
  let sequence = 1;
  for (const serviceLineId of input.carePlanServiceIds) {
    const line = await ctx.pool.query<{
      service_id: string;
      proposed_fee: string;
      tooth_code: string | null;
      surface_codes: string[];
    }>(
      `
        SELECT cps.service_id, cps.proposed_fee, cps.tooth_code, cps.surface_codes
        FROM dentos_data.care_plan_services cps
        JOIN dentos_data.care_plan_stages cstage ON cstage.id = cps.care_plan_stage_id
        WHERE cps.id = $1 AND cstage.care_plan_id = $2
      `,
      [serviceLineId, input.carePlanId],
    );
    const row = line.rows[0];
    if (!row) {
      throw new Error("Care plan service line not found");
    }
    const service = await ctx.pool.query<{
      code: string;
      description: string;
      service_domain_id: string;
    }>(
      `SELECT code, description, service_domain_id FROM dentos_data.service_catalog WHERE id = $1`,
      [row.service_id],
    );
    const serviceRow = service.rows[0];
    if (!serviceRow) {
      throw new Error("Service catalog row missing");
    }
    const amount = Number(row.proposed_fee);
    estimatedValue += amount;
    await ctx.pool.query(
      `
        INSERT INTO dentos_data.treatment_bundle_services (
          id, treatment_bundle_id, care_plan_service_id, service_id, service_domain_id_snapshot,
          service_code_snapshot, service_name_snapshot, tooth_code_snapshot, surface_codes_snapshot,
          sequence_no, proposed_amount_snapshot, advised_at, advised_by, created_by, updated_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, clock_timestamp(), $12, $13, $13)
      `,
      [
        crypto.randomUUID(),
        bundleId,
        serviceLineId,
        row.service_id,
        serviceRow.service_domain_id,
        serviceRow.code,
        serviceRow.description,
        row.tooth_code,
        row.surface_codes ?? [],
        sequence,
        amount,
        input.advisedByStaffId,
        input.actorUserId,
      ],
    );
    sequence += 1;
  }
  await ctx.pool.query(
    `UPDATE dentos_data.treatment_bundles SET estimated_value = $2 WHERE id = $1`,
    [bundleId, estimatedValue],
  );
  return { id: bundleId, bundleTier: input.bundleTier, estimatedValue };
}
