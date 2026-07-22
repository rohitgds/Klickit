import {
  buildAcceptanceEvidence,
  describeShalimarExpansionPlan,
  evaluateDailyReconciliation,
  evaluateGoLiveChecklist,
  GO_LIVE_CHECKLIST_ITEMS,
  OPERATING_RUNBOOKS,
  type GoLiveChecklistState,
  validateProductionGate,
} from "@klickit/pilot";
import type { DatabasePoolLike } from "../db/client.js";

type DbContext = {
  pool: DatabasePoolLike;
  organizationId: string;
  clinicId: string;
};

function defaultChecklist(): GoLiveChecklistState {
  return Object.fromEntries(GO_LIVE_CHECKLIST_ITEMS.map((item) => [item, false])) as GoLiveChecklistState;
}

export async function createReleaseCandidate(
  ctx: DbContext,
  input: { releaseCode: string; actorUserId: string; rollbackPlanReference?: string },
) {
  const id = crypto.randomUUID();
  await ctx.pool.query(
    `
      INSERT INTO dentos_runtime.pilot_release_candidates (
        id, organization_id, clinic_id, release_code, status, checklist_json, rollback_plan_reference, created_by
      ) VALUES ($1, $2, $3, $4, 'draft', $5::jsonb, $6, $7)
    `,
    [
      id,
      ctx.organizationId,
      ctx.clinicId,
      input.releaseCode,
      JSON.stringify(defaultChecklist()),
      input.rollbackPlanReference ?? "docs/runbooks/rohini-rollback.md",
      input.actorUserId,
    ],
  );
  return { id, status: "draft", checklist: defaultChecklist() };
}

export async function getLatestReleaseCandidate(ctx: DbContext) {
  const result = await ctx.pool.query<{
    id: string;
    release_code: string;
    status: string;
    checklist_json: GoLiveChecklistState;
    production_approved: boolean;
    rollback_plan_reference: string;
  }>(
    `
      SELECT id, release_code, status, checklist_json, production_approved, rollback_plan_reference
      FROM dentos_runtime.pilot_release_candidates
      WHERE clinic_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [ctx.clinicId],
  );
  const row = result.rows[0];
  if (!row) {
    return null;
  }
  const checklist = row.checklist_json ?? defaultChecklist();
  const evaluation = evaluateGoLiveChecklist(checklist);
  return {
    id: row.id,
    releaseCode: row.release_code,
    status: row.status,
    checklist,
    checklistEvaluation: evaluation,
    productionApproved: row.production_approved,
    rollbackPlanReference: row.rollback_plan_reference,
  };
}

export async function updateReleaseChecklist(
  ctx: DbContext,
  input: { releaseId: string; checklist: GoLiveChecklistState; actorUserId: string },
) {
  const evaluation = evaluateGoLiveChecklist(input.checklist);
  const status = evaluation.ready ? "candidate" : "draft";
  await ctx.pool.query(
    `
      UPDATE dentos_runtime.pilot_release_candidates
      SET checklist_json = $1::jsonb,
          status = $2,
          updated_at = clock_timestamp()
      WHERE id = $3 AND clinic_id = $4
    `,
    [JSON.stringify(input.checklist), status, input.releaseId, ctx.clinicId],
  );
  return { status, checklistEvaluation: evaluation };
}

export async function approveProductionRelease(
  ctx: DbContext,
  input: { releaseId: string; actorUserId: string; appEnv: string },
) {
  const candidate = await getLatestReleaseCandidate(ctx);
  if (!candidate || candidate.id !== input.releaseId) {
    throw new Error("Release candidate not found");
  }
  if (!candidate.checklistEvaluation.ready) {
    throw new Error("Go-live checklist is incomplete");
  }
  const gate = validateProductionGate({
    appEnv: input.appEnv,
    productionApproved: true,
    checklistReady: candidate.checklistEvaluation.ready,
  });
  if (!gate.allowed && input.appEnv === "production") {
    throw new Error(gate.reason);
  }
  await ctx.pool.query(
    `
      UPDATE dentos_runtime.pilot_release_candidates
      SET status = 'approved',
          production_approved = true,
          production_approved_at = clock_timestamp(),
          approved_by = $1,
          updated_at = clock_timestamp()
      WHERE id = $2 AND clinic_id = $3
    `,
    [input.actorUserId, input.releaseId, ctx.clinicId],
  );
  return {
    status: "approved",
    productionApproved: true,
    gate: validateProductionGate({
      appEnv: input.appEnv,
      productionApproved: true,
      checklistReady: true,
    }),
  };
}

export async function recordDailyReconciliation(
  ctx: DbContext,
  input: {
    reconciliationDate: string;
    sourceTotalMinor: number;
    outputTotalMinor: number;
    actorUserId: string;
    notes?: string;
  },
) {
  const evaluation = evaluateDailyReconciliation({
    sourceTotalMinor: input.sourceTotalMinor,
    outputTotalMinor: input.outputTotalMinor,
  });
  const id = crypto.randomUUID();
  await ctx.pool.query(
    `
      INSERT INTO dentos_runtime.pilot_daily_reconciliations (
        id, clinic_id, reconciliation_date, source_total_minor, output_total_minor, variance_minor, status, notes, recorded_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (clinic_id, reconciliation_date) DO UPDATE
      SET source_total_minor = EXCLUDED.source_total_minor,
          output_total_minor = EXCLUDED.output_total_minor,
          variance_minor = EXCLUDED.variance_minor,
          status = EXCLUDED.status,
          notes = EXCLUDED.notes,
          recorded_at = clock_timestamp(),
          recorded_by = EXCLUDED.recorded_by
    `,
    [
      id,
      ctx.clinicId,
      input.reconciliationDate,
      input.sourceTotalMinor,
      input.outputTotalMinor,
      evaluation.varianceMinor,
      evaluation.ok ? "balanced" : "variance",
      input.notes ?? null,
      input.actorUserId,
    ],
  );
  return { status: evaluation.ok ? "balanced" : "variance", ...evaluation };
}

export async function listDailyReconciliations(ctx: DbContext) {
  const result = await ctx.pool.query(
    `
      SELECT *
      FROM dentos_runtime.pilot_daily_reconciliations
      WHERE clinic_id = $1
      ORDER BY reconciliation_date DESC
      LIMIT 30
    `,
    [ctx.clinicId],
  );
  return { reconciliations: result.rows };
}

export async function recordAcceptance(
  ctx: DbContext,
  input: {
    acceptanceType: "pilot_report" | "handover" | "sale_readiness";
    scenariosPassed: number;
    scenariosTotal: number;
    unresolvedSeverity12: number;
    evidence?: Record<string, unknown>;
    actorUserId: string;
  },
) {
  const evidence = buildAcceptanceEvidence({
    milestone: "Milestone 10",
    scenariosPassed: input.scenariosPassed,
    scenariosTotal: input.scenariosTotal,
    unresolvedSeverity12: input.unresolvedSeverity12,
  });
  const id = crypto.randomUUID();
  await ctx.pool.query(
    `
      INSERT INTO dentos_runtime.pilot_acceptance_records (
        id, clinic_id, acceptance_type, scenarios_passed, scenarios_total, unresolved_severity12, accepted, evidence_json, recorded_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
    `,
    [
      id,
      ctx.clinicId,
      input.acceptanceType,
      input.scenariosPassed,
      input.scenariosTotal,
      input.unresolvedSeverity12,
      evidence.accepted,
      JSON.stringify({ ...evidence, ...(input.evidence ?? {}) }),
      input.actorUserId,
    ],
  );
  return { id, ...evidence };
}

export async function listAcceptanceRecords(ctx: DbContext) {
  const result = await ctx.pool.query(
    `
      SELECT *
      FROM dentos_runtime.pilot_acceptance_records
      WHERE clinic_id = $1
      ORDER BY recorded_at DESC
      LIMIT 20
    `,
    [ctx.clinicId],
  );
  return { records: result.rows };
}

export async function createUnresolvedIssue(
  ctx: DbContext,
  input: { severity: number; title: string; description?: string; actorUserId: string },
) {
  const id = crypto.randomUUID();
  await ctx.pool.query(
    `
      INSERT INTO dentos_runtime.pilot_unresolved_issues (
        id, clinic_id, severity, title, description, status, created_by
      ) VALUES ($1, $2, $3, $4, $5, 'open', $6)
    `,
    [id, ctx.clinicId, input.severity, input.title, input.description ?? null, input.actorUserId],
  );
  return { id, status: "open" };
}

export async function listUnresolvedIssues(ctx: DbContext) {
  const result = await ctx.pool.query(
    `
      SELECT *
      FROM dentos_runtime.pilot_unresolved_issues
      WHERE clinic_id = $1 AND status = 'open'
      ORDER BY severity ASC, opened_at DESC
    `,
    [ctx.clinicId],
  );
  return { issues: result.rows };
}

export async function initiateRollback(
  ctx: DbContext,
  input: { releaseId: string; reason: string; actorUserId: string },
) {
  await ctx.pool.query(
    `
      UPDATE dentos_runtime.pilot_release_candidates
      SET status = 'rolled_back',
          production_approved = false,
          updated_at = clock_timestamp()
      WHERE id = $1 AND clinic_id = $2
    `,
    [input.releaseId, ctx.clinicId],
  );
  return {
    status: "rolled_back",
    reason: input.reason,
    rollbackPlanReference: "docs/runbooks/rohini-rollback.md",
  };
}

export function getProductionGateStatus(appEnv: string, productionApproved: boolean, checklistReady: boolean) {
  return validateProductionGate({ appEnv, productionApproved, checklistReady });
}

export function getHandoverSummary() {
  return {
    operatingRunbooks: [...OPERATING_RUNBOOKS],
    shalimarExpansion: describeShalimarExpansionPlan(),
    saleChecklist: "docs/SALE_AND_HANDOVER_CHECKLIST.md",
  };
}
