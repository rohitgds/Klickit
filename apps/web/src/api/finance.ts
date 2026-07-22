import { buildPatientBalancePath } from "../config/finance.js";
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

export interface FeeStatementDetail {
  id: string;
  status: string;
  patientId?: string;
  patient_id?: string;
  lines?: Array<{ id: string; description?: string; unitFee?: number; unit_fee?: number }>;
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
  },
): Promise<{ id: string }> {
  return apiFetch<{ id: string }>("/finance/fee-statements", { method: "POST", body: JSON.stringify(body) }, token);
}

export async function fetchFeeStatementDetail(token: string, statementId: string): Promise<FeeStatementDetail> {
  return apiFetch<FeeStatementDetail>(`/finance/fee-statements/${encodeURIComponent(statementId)}`, {}, token);
}

export async function issueFeeStatement(token: string, statementId: string): Promise<{ id: string; status: string }> {
  return apiFetch<{ id: string; status: string }>(
    `/finance/fee-statements/${encodeURIComponent(statementId)}/issue`,
    { method: "POST" },
    token,
  );
}
