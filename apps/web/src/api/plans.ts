import { apiFetch } from "./client.js";

export interface CarePlanDetail {
  id: string;
  patientId?: string;
  patient_id?: string;
  status: string;
  stages?: Array<{ id: string; phaseNo?: number; phase_no?: number; name: string }>;
}

export async function createCarePlan(
  token: string,
  body: { patientId: string; planDate?: string; notes?: string },
): Promise<{ id: string }> {
  return apiFetch<{ id: string }>("/plans/care-plans", { method: "POST", body: JSON.stringify(body) }, token);
}

export async function fetchCarePlanDetail(token: string, planId: string): Promise<CarePlanDetail> {
  return apiFetch<CarePlanDetail>(`/plans/care-plans/${encodeURIComponent(planId)}`, {}, token);
}

export async function addCarePlanStage(
  token: string,
  planId: string,
  body: { phaseNo: number; name: string },
): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(
    `/plans/care-plans/${encodeURIComponent(planId)}/stages`,
    { method: "POST", body: JSON.stringify(body) },
    token,
  );
}

export async function proposeCarePlan(
  token: string,
  planId: string,
  proposedByStaffId: string,
): Promise<{ id: string; status: string }> {
  return apiFetch<{ id: string; status: string }>(
    `/plans/care-plans/${encodeURIComponent(planId)}/propose`,
    { method: "POST", body: JSON.stringify({ proposedByStaffId }) },
    token,
  );
}

export async function acceptCarePlan(
  token: string,
  planId: string,
  body: { method: "staff_confirmed"; acceptedTotal: number; notes?: string },
): Promise<{ id: string; status: string }> {
  return apiFetch<{ id: string; status: string }>(
    `/plans/care-plans/${encodeURIComponent(planId)}/accept`,
    { method: "POST", body: JSON.stringify(body) },
    token,
  );
}
