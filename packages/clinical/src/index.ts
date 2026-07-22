import { createHash } from "node:crypto";

export type ClinicalNoteStatus = "draft" | "signed" | "amended";
export type CareDeliveryState = "planned" | "in_progress" | "completed" | "cancelled";

const PERMANENT_TEETH = new Set([
  11, 12, 13, 14, 15, 16, 17, 18,
  21, 22, 23, 24, 25, 26, 27, 28,
  31, 32, 33, 34, 35, 36, 37, 38,
  41, 42, 43, 44, 45, 46, 47, 48,
]);

const DECIDUOUS_TEETH = new Set([
  51, 52, 53, 54, 55,
  61, 62, 63, 64, 65,
  71, 72, 73, 74, 75,
  81, 82, 83, 84, 85,
]);

const VALID_SURFACES = new Set(["M", "D", "O", "I", "B", "L", "F", "V"]);

export function isValidFdiToothCode(toothCode: string): boolean {
  const value = Number(toothCode);
  return Number.isInteger(value) && (PERMANENT_TEETH.has(value) || DECIDUOUS_TEETH.has(value));
}

export function normalizeSurfaceCodes(codes: readonly string[]): string[] {
  return [...new Set(codes.map((code) => code.trim().toUpperCase()).filter(Boolean))];
}

export function areValidSurfaceCodes(codes: readonly string[]): boolean {
  return codes.every((code) => VALID_SURFACES.has(code.trim().toUpperCase()));
}

export function canEditClinicalNote(status: ClinicalNoteStatus): boolean {
  return status === "draft" || status === "amended";
}

export function validateClinicalNoteSign(input: {
  status: ClinicalNoteStatus;
  body?: string | null;
}): { ok: true } | { ok: false; code: string; message: string } {
  if (!input.body?.trim()) {
    return { ok: false, code: "NOTE_BODY_REQUIRED", message: "Clinical note body is required before signing" };
  }
  if (input.status === "signed") {
    return { ok: false, code: "NOTE_ALREADY_SIGNED", message: "Clinical note is already signed" };
  }
  return { ok: true };
}

export function validateClinicalNoteAmendment(input: {
  status: ClinicalNoteStatus;
  reason?: string;
  amendedBody?: string;
}): { ok: true } | { ok: false; code: string; message: string } {
  if (input.status !== "signed" && input.status !== "amended") {
    return { ok: false, code: "NOTE_NOT_SIGNED", message: "Only signed notes can be amended" };
  }
  if (!input.reason?.trim()) {
    return { ok: false, code: "AMENDMENT_REASON_REQUIRED", message: "Amendment reason is required" };
  }
  if (!input.amendedBody?.trim()) {
    return { ok: false, code: "AMENDMENT_BODY_REQUIRED", message: "Amended note body is required" };
  }
  return { ok: true };
}

export function validateCareDeliveryTransition(input: {
  fromStatus: CareDeliveryState;
  toStatus: CareDeliveryState;
}): { ok: true } | { ok: false; code: string; message: string } {
  const allowed: Record<CareDeliveryState, CareDeliveryState[]> = {
    planned: ["in_progress", "cancelled"],
    in_progress: ["completed", "cancelled"],
    completed: [],
    cancelled: [],
  };
  if (!allowed[input.fromStatus]?.includes(input.toStatus)) {
    return {
      ok: false,
      code: "CARE_DELIVERY_TRANSITION_INVALID",
      message: `Transition from ${input.fromStatus} to ${input.toStatus} is not allowed`,
    };
  }
  return { ok: true };
}

export function hashFilePayload(payload: Buffer | string): string {
  return createHash("sha256").update(payload).digest("hex");
}

export function evaluateCrossClinicClinicalAccess(input: {
  homeClinicId: string;
  encounterClinicId: string;
  permissionCode: string;
  hasCrossClinicGrant: boolean;
}): { allowed: boolean; mode: "full" | "read_only" | "denied"; reason?: string } {
  if (input.homeClinicId === input.encounterClinicId) {
    return { allowed: true, mode: "full" };
  }
  if (input.permissionCode === "clinical.view" && input.hasCrossClinicGrant) {
    return { allowed: true, mode: "read_only", reason: "Cross-clinic safety summary only" };
  }
  if (input.permissionCode.startsWith("clinical.") || input.permissionCode.startsWith("document.")) {
    return { allowed: false, mode: "denied", reason: "Cross-clinic clinical edit is denied" };
  }
  return { allowed: input.hasCrossClinicGrant, mode: input.hasCrossClinicGrant ? "read_only" : "denied" };
}

export function buildEncounterWorkspaceSummary(input: {
  encounterId: string;
  patientId: string;
  clinicId: string;
  leadClinicianId: string;
  status: string;
  allergies: readonly string[];
  findingCount: number;
  diagnosisCount: number;
  openDeliveryCount: number;
}) {
  return {
    encounterId: input.encounterId,
    patientId: input.patientId,
    clinicId: input.clinicId,
    leadClinicianId: input.leadClinicianId,
    status: input.status,
    safety: {
      allergies: input.allergies,
      readOnlyCrossClinic: false,
    },
    counts: {
      findings: input.findingCount,
      diagnoses: input.diagnosisCount,
      openDeliveries: input.openDeliveryCount,
    },
  };
}

export function shouldWarnPdfUpload(mimeType: string): boolean {
  return mimeType === "application/pdf";
}
