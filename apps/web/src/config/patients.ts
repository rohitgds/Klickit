import { z } from "zod";

export const PATIENT_SEARCH_PAGE_SIZE = 25;
export const PATIENT_SEARCH_MIN_CHARS = 2;

export const patientRegisterSchema = z.object({
  firstName: z.string().trim().min(1, "Given name is required").max(80),
  middleName: z.string().trim().max(80).optional(),
  lastName: z.string().trim().max(80).optional(),
  cellPhone: z.string().trim().optional(),
  birthDate: z.string().optional(),
});

export type PatientRegisterFormValues = z.infer<typeof patientRegisterSchema>;

export function isPatientSearchQueryValid(query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) {
    return true;
  }
  if (/^[A-Za-z0-9-]+$/.test(trimmed) && trimmed.length >= 1) {
    return true;
  }
  return trimmed.length >= PATIENT_SEARCH_MIN_CHARS;
}

export function buildPatientSearchPath(q: string, limit = PATIENT_SEARCH_PAGE_SIZE, offset = 0): string {
  const params = new URLSearchParams();
  const trimmed = q.trim();
  if (trimmed) {
    params.set("q", trimmed);
  }
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  return `/patients/search?${params.toString()}`;
}

export function formatPatientPhone(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }
  return value;
}

export function formatPatientActive(active: boolean): string {
  return active ? "Active" : "Inactive";
}

export function patientProfileDisplayName(patient: Record<string, unknown> | null): string {
  if (!patient) {
    return "Unknown patient";
  }
  const displayName = patient.display_name;
  if (typeof displayName === "string" && displayName.trim()) {
    return displayName;
  }
  const parts = [patient.first_name, patient.middle_name, patient.last_name].filter(
    (part) => typeof part === "string" && part.trim(),
  );
  return parts.length ? parts.join(" ") : "Unknown patient";
}

export function formatPatientProfileActive(patient: Record<string, unknown> | null): string {
  if (!patient) {
    return "—";
  }
  if (typeof patient.active === "boolean") {
    return patient.active ? "Active" : "Inactive";
  }
  return patientProfileField(patient, "active");
}
export function patientProfileField(patient: Record<string, unknown> | null, key: string): string {
  if (!patient) {
    return "—";
  }
  const value = patient[key];
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  return String(value);
}

export interface DuplicateCandidate {
  patient: {
    id: string;
    patientNo: string;
    displayName: string;
    cellPhone: string | null;
  };
  score: number;
  signals: string[];
}

export function rankDuplicateCandidates(
  candidates: readonly {
    id: string;
    patientNo: string;
    displayName: string;
    cellPhone: string | null;
  }[],
  input: { firstName: string; lastName?: string; cellPhone?: string; birthDate?: string },
  scoreFn: (args: {
    nameA: string;
    nameB: string;
    phoneA?: string | null;
    phoneB?: string | null;
    birthDateA?: string | null;
    birthDateB?: string | null;
  }) => { score: number; signals: string[] },
): DuplicateCandidate[] {
  const targetName = [input.firstName, input.lastName].filter(Boolean).join(" ").trim();
  return candidates
    .map((patient) => {
      const { score, signals } = scoreFn({
        nameA: targetName,
        nameB: patient.displayName,
        phoneA: input.cellPhone ?? null,
        phoneB: patient.cellPhone,
        birthDateA: input.birthDate ?? null,
        birthDateB: null,
      });
      return { patient, score, signals };
    })
    .filter((entry) => entry.score >= 40)
    .sort((a, b) => b.score - a.score);
}
