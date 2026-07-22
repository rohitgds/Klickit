import {
  buildFeeStatementReconcilePath,
  buildPatientBalancePath,
} from "../config/finance.js";
import { apiFetch } from "./client.js";

export interface FinanceMasters {
  taxCodes: unknown[];
  collectionMethods: Array<{ id: string; code?: string; description?: string }>;
  feeScheduleItems: Array<{
    fee_schedule_id: string;
    service_id: string;
    service_name?: string;
    service_code?: string;
  }>;
}

export interface PatientBalance {
  openExposure: number;
  unappliedCollections: number;
}

export interface FeeStatementLine {
  id: string;
  description?: string;
  unit_fee?: number;
  unitFee?: number;
  line_total?: number;
  lineTotal?: number;
}

export interface FeeStatementDetail {
  id: string;
  status: string;
  patientId: string;
  grandTotal?: number;
  outstandingTotal?: number;
  lines: FeeStatementLine[];
}

export interface CollectionReceiptResult {
  id: string;
  grossCollected: number;
  unappliedTotal: number;
  tenders: Array<{ id: string; collectionMethodId: string; amount: number }>;
}

export interface ReconcileResult {
  statementId: string;
  variance: number;
  ok: boolean;
}

export interface DailyReconciliation {
  reconciliation_date: string;
  source_total_minor: number;
  output_total_minor: number;
  variance_minor: number;
  status: string;
}

function normalizeStatement(raw: {
  statement: Record<string, unknown>;
  lines: Array<Record<string, unknown>>;
}): FeeStatementDetail {
  const statement = raw.statement;
  return {
    id: String(statement.id),
    status: String(statement.status),
    patientId: String(statement.patient_id ?? statement.patientId ?? ""),
    grandTotal: statement.grand_total !== undefined ? Number(statement.grand_total) : undefined,
    outstandingTotal:
      statement.outstanding_total !== undefined ? Number(statement.outstanding_total) : undefined,
    lines: raw.lines.map((line) => ({
      id: String(line.id),
      description: line.description ? String(line.description) : undefined,
      unitFee: line.unit_fee !== undefined ? Number(line.unit_fee) : undefined,
      lineTotal: line.line_total !== undefined ? Number(line.line_total) : undefined,
    })),
  };
}

export async function fetchFinanceMasters(token: string): Promise<FinanceMasters> {
  return apiFetch<FinanceMasters>("/finance/masters", {}, token);
}

export async function fetchPatientBalance(token: string, patientId: string): Promise<PatientBalance> {
  return apiFetch<PatientBalance>(buildPatientBalancePath(patientId), {}, token);
}

export async function createFeeStatementDraft(
  token: string,
  body: {
    patientId: string;
    careEncounterId?: string;
    statementReference: string;
    feeScheduleId: string;
    dueDate?: string;
  },
): Promise<{ id: string }> {
  return apiFetch<{ id: string }>("/finance/fee-statements", { method: "POST", body: JSON.stringify(body) }, token);
}

export async function addFeeStatementLine(
  token: string,
  statementId: string,
  body: {
    serviceId: string;
    leadClinicianId: string;
    quantity: number;
    unitFee: number;
    sequenceNo: number;
    description?: string;
  },
): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(
    `/finance/fee-statements/${encodeURIComponent(statementId)}/lines`,
    { method: "POST", body: JSON.stringify(body) },
    token,
  );
}

export async function fetchFeeStatementDetail(token: string, statementId: string): Promise<FeeStatementDetail> {
  const raw = await apiFetch<{ statement: Record<string, unknown>; lines: Array<Record<string, unknown>> }>(
    `/finance/fee-statements/${encodeURIComponent(statementId)}`,
    {},
    token,
  );
  return normalizeStatement(raw);
}

export async function issueFeeStatement(token: string, statementId: string): Promise<{ id: string; status: string }> {
  return apiFetch<{ id: string; status: string }>(
    `/finance/fee-statements/${encodeURIComponent(statementId)}/issue`,
    { method: "POST" },
    token,
  );
}

export async function createCollection(
  token: string,
  body: {
    patientId: string;
    collectionReference: string;
    leadClinicianId: string;
    collectionOperatorId: string;
    tenders: Array<{ collectionMethodId: string; amount: number; referenceNo?: string }>;
    notes?: string;
  },
): Promise<CollectionReceiptResult> {
  return apiFetch<CollectionReceiptResult>("/finance/collections", { method: "POST", body: JSON.stringify(body) }, token);
}

export async function createAllocation(
  token: string,
  body: {
    collectionReceiptId: string;
    feeStatementId: string;
    amount: number;
    lineSplits: Array<{ feeStatementLineId: string; amount: number }>;
    tenderSplits: Array<{ collectionTenderId: string; amount: number }>;
  },
): Promise<{ id: string; statementStatus: string }> {
  return apiFetch<{ id: string; statementStatus: string }>(
    "/finance/allocations",
    { method: "POST", body: JSON.stringify(body) },
    token,
  );
}

export async function reconcileFeeStatement(token: string, statementId: string): Promise<ReconcileResult> {
  return apiFetch<ReconcileResult>(buildFeeStatementReconcilePath(statementId), {}, token);
}

export async function fetchDailyReconciliations(token: string): Promise<{ reconciliations: DailyReconciliation[] }> {
  return apiFetch<{ reconciliations: DailyReconciliation[] }>("/pilot/reconciliation/daily", {}, token);
}

export async function recordDailyReconciliation(
  token: string,
  body: {
    reconciliationDate: string;
    sourceTotalMinor: number;
    outputTotalMinor: number;
    notes?: string;
  },
): Promise<{ status: string }> {
  return apiFetch<{ status: string }>(
    "/pilot/reconciliation/daily",
    { method: "POST", body: JSON.stringify(body) },
    token,
  );
}
