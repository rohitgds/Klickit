import type {
  PatientProfileResponse,
  PatientRegisterRequest,
  PatientRegisterResponse,
  PatientSafetySummary,
  PatientSearchHit,
} from "./types.js";
import { apiFetch } from "./client.js";
import { buildPatientSearchPath } from "../config/patients.js";

export async function searchPatients(
  token: string,
  input: { q?: string; limit?: number; offset?: number },
): Promise<{ patients: PatientSearchHit[] }> {
  return apiFetch<{ patients: PatientSearchHit[] }>(
    buildPatientSearchPath(input.q ?? "", input.limit, input.offset),
    {},
    token,
  );
}

export async function registerPatient(
  token: string,
  body: PatientRegisterRequest,
): Promise<PatientRegisterResponse> {
  return apiFetch<PatientRegisterResponse>(
    "/patients/register",
    { method: "POST", body: JSON.stringify(body) },
    token,
  );
}

export async function fetchPatientProfile(
  token: string,
  patientId: string,
): Promise<PatientProfileResponse> {
  return apiFetch<PatientProfileResponse>(`/patients/${encodeURIComponent(patientId)}/profile`, {}, token);
}

export async function fetchPatientSafetySummary(
  token: string,
  patientId: string,
): Promise<PatientSafetySummary> {
  return apiFetch<PatientSafetySummary>(
    `/patients/${encodeURIComponent(patientId)}/safety-summary`,
    {},
    token,
  );
}

export async function queueDuplicateReview(
  token: string,
  body: { patientIdA: string; patientIdB: string },
): Promise<{ id: string; score: number; signals: string[] }> {
  return apiFetch<{ id: string; score: number; signals: string[] }>(
    "/patients/duplicates/review",
    { method: "POST", body: JSON.stringify(body) },
    token,
  );
}
