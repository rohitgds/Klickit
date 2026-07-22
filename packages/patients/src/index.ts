export interface PatientSearchInput {
  query?: string;
  clinicId?: string;
  activeOnly?: boolean;
  limit?: number;
  offset?: number;
}

export interface PatientSearchHit {
  id: string;
  patientNo: string;
  displayName: string;
  cellPhone: string | null;
  homeClinicId: string;
  active: boolean;
}

export function normalizePhone(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const digits = value.replace(/\D/g, "");
  if (digits.length < 10) {
    return digits || null;
  }
  return digits.slice(-10);
}

export function normalizeSearchText(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function buildPatientDisplayName(input: {
  firstName: string;
  middleName?: string | null;
  lastName?: string | null;
}): string {
  return [input.firstName, input.middleName, input.lastName].filter(Boolean).join(" ").trim();
}

export function renderPatientNumber(input: {
  prefix: string;
  separator: string;
  number: number;
  width: number;
}): string {
  const padded = String(input.number).padStart(input.width, "0");
  return `${input.prefix}${input.separator}${padded}`;
}

export function scoreDuplicateCandidate(input: {
  nameA: string;
  nameB: string;
  phoneA?: string | null;
  phoneB?: string | null;
  birthDateA?: string | null;
  birthDateB?: string | null;
}): { score: number; signals: string[] } {
  const signals: string[] = [];
  let score = 0;
  if (normalizeSearchText(input.nameA) === normalizeSearchText(input.nameB)) {
    score += 40;
    signals.push("name");
  }
  const phoneA = normalizePhone(input.phoneA);
  const phoneB = normalizePhone(input.phoneB);
  if (phoneA && phoneB && phoneA === phoneB) {
    score += 40;
    signals.push("mobile");
  }
  if (input.birthDateA && input.birthDateB && input.birthDateA === input.birthDateB) {
    score += 20;
    signals.push("birth_date");
  }
  return { score, signals };
}

export function buildCrossClinicSafetySummary(input: {
  patientId: string;
  allergies: readonly string[];
  lastClinicalNoteSummary?: string | null;
  lastUpdatedClinicCode?: string | null;
}) {
  return {
    patientId: input.patientId,
    readOnly: true,
    allergies: input.allergies,
    lastClinicalNoteSummary: input.lastClinicalNoteSummary ?? null,
    lastUpdatedClinicCode: input.lastUpdatedClinicCode ?? null,
  };
}

export interface DrKlickStagingRow {
  sourceRowNumber: number;
  sourcePatientKey?: string;
  firstName: string;
  lastName?: string;
  mobile?: string;
  email?: string;
  birthDate?: string;
  addressLine1?: string;
  categoryCode?: string;
  clinicCode?: string;
}

export function validateDrKlickStagingRow(row: DrKlickStagingRow): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!row.firstName?.trim()) {
    errors.push("firstName is required");
  }
  if (row.mobile && normalizePhone(row.mobile) === null) {
    errors.push("mobile must contain at least 10 digits");
  }
  if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
    errors.push("email must be valid");
  }
  if (row.birthDate && Number.isNaN(Date.parse(row.birthDate))) {
    errors.push("birthDate must be a valid date");
  }
  return { valid: errors.length === 0, errors };
}
