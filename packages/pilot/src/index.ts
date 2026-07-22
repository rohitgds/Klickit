export const GO_LIVE_CHECKLIST_ITEMS = [
  "backup_drill_passed",
  "restore_drill_passed",
  "readiness_drills_passed",
  "migration_dry_run_accepted",
  "staff_uat_completed",
  "rollback_plan_reviewed",
  "daily_reconciliation_zero",
] as const;

export type GoLiveChecklistItem = (typeof GO_LIVE_CHECKLIST_ITEMS)[number];
export type GoLiveChecklistState = Partial<Record<GoLiveChecklistItem, boolean>>;

export function evaluateGoLiveChecklist(state: GoLiveChecklistState): {
  ready: boolean;
  incomplete: GoLiveChecklistItem[];
} {
  const incomplete = GO_LIVE_CHECKLIST_ITEMS.filter((item) => state[item] !== true);
  return { ready: incomplete.length === 0, incomplete };
}

export function validateProductionGate(input: {
  appEnv: string;
  productionApproved: boolean;
  checklistReady: boolean;
}): { allowed: boolean; reason: string } {
  if (input.appEnv !== "production") {
    return {
      allowed: false,
      reason: "Production operations remain blocked outside the production environment",
    };
  }
  if (!input.checklistReady) {
    return {
      allowed: false,
      reason: "Go-live checklist is incomplete",
    };
  }
  if (!input.productionApproved) {
    return {
      allowed: false,
      reason: "Explicit production approval has not been recorded",
    };
  }
  return { allowed: true, reason: "Production gate open" };
}

export function evaluateDailyReconciliation(input: {
  sourceTotalMinor: number;
  outputTotalMinor: number;
}): { ok: true; varianceMinor: number } | { ok: false; varianceMinor: number; message: string } {
  const varianceMinor = input.outputTotalMinor - input.sourceTotalMinor;
  if (varianceMinor !== 0) {
    return {
      ok: false,
      varianceMinor,
      message: `Daily reconciliation variance is INR ${(varianceMinor / 100).toFixed(2)}; expected INR 0.00`,
    };
  }
  return { ok: true, varianceMinor: 0 };
}

export function buildAcceptanceEvidence(input: {
  milestone: string;
  scenariosPassed: number;
  scenariosTotal: number;
  unresolvedSeverity12: number;
}): { accepted: boolean; summary: string } {
  const accepted =
    input.scenariosPassed === input.scenariosTotal && input.unresolvedSeverity12 === 0;
  return {
    accepted,
    summary: `${input.milestone}: ${input.scenariosPassed}/${input.scenariosTotal} scenarios passed; ${input.unresolvedSeverity12} open severity 1/2 issues`,
  };
}

export function describeShalimarExpansionPlan(): {
  phase: string;
  prerequisites: string[];
  deliverables: string[];
  gate: string[];
} {
  return {
    phase: "Post-Rohini pilot acceptance",
    prerequisites: [
      "Rohini pilot acceptance recorded",
      "No unresolved severity 1 or 2 defects",
      "Daily reconciliation stable at INR 0.00 variance",
    ],
    deliverables: [
      "Second clinic gateway installation",
      "Shalimar clinic configuration and staff registration",
      "Branch-specific patient numbering",
      "Cross-clinic safety-summary replication",
      "Concurrent offline sync UAT",
      "Backup and restore drill for second gateway",
    ],
    gate: [
      "Both clinics operate concurrently",
      "Offline changes synchronize without data loss",
      "Patient identity remains single across branches",
      "Branch financial segregation passes reconciliation",
    ],
  };
}

export const OPERATING_RUNBOOKS = [
  "docs/runbooks/rohini-go-live.md",
  "docs/runbooks/rohini-rollback.md",
  "docs/runbooks/gateway-recovery-drill.md",
  "docs/runbooks/spare-gateway-activation.md",
  "docs/SALE_AND_HANDOVER_CHECKLIST.md",
  "docs/REBUILD_FROM_ZERO_RUNBOOK.md",
  "docs/ACCOUNT_TRANSFER_RUNBOOK.md",
] as const;
