import { createHash } from "node:crypto";

export type CarePlanStatus =
  | "draft"
  | "proposed"
  | "accepted"
  | "partially_accepted"
  | "declined"
  | "completed"
  | "cancelled";

export type TreatmentBundleTier = "primary" | "secondary" | "tertiary";
export type MedicationOrderStatus = "draft" | "saved" | "signed" | "void";
export type AllergyRuleAction = "block" | "warn" | "information";
export type PlanAcceptanceMethod = "staff_confirmed" | "otp" | "signature_upload";
export type DocumentPrintType = "care_plan" | "medication_order" | "consent";

export function calculateCarePlanTotals(lines: readonly { proposedFee: number; discount?: number; accepted?: boolean }[]) {
  let estimatedTotal = 0;
  let acceptedTotal = 0;
  for (const line of lines) {
    const discount = line.discount ?? 0;
    const net = Math.max(0, line.proposedFee - discount);
    estimatedTotal += net;
    if (line.accepted) {
      acceptedTotal += net;
    }
  }
  return {
    estimatedTotal: roundMoney(estimatedTotal),
    acceptedTotal: roundMoney(acceptedTotal),
    displayedAmount: roundMoney(estimatedTotal),
  };
}

export function validateCarePlanStatusTransition(input: {
  fromStatus: CarePlanStatus;
  toStatus: CarePlanStatus;
}): { ok: true } | { ok: false; code: string; message: string } {
  const allowed: Record<CarePlanStatus, CarePlanStatus[]> = {
    draft: ["proposed", "cancelled"],
    proposed: ["accepted", "partially_accepted", "declined", "cancelled"],
    accepted: ["completed", "cancelled"],
    partially_accepted: ["accepted", "declined", "cancelled"],
    declined: [],
    completed: [],
    cancelled: [],
  };
  if (!allowed[input.fromStatus]?.includes(input.toStatus)) {
    return {
      ok: false,
      code: "INVALID_PLAN_STATUS",
      message: `Cannot move care plan from ${input.fromStatus} to ${input.toStatus}`,
    };
  }
  return { ok: true };
}

export function validateTreatmentBundleTier(tier: string): tier is TreatmentBundleTier {
  return tier === "primary" || tier === "secondary" || tier === "tertiary";
}

export function validatePlanAcceptance(input: {
  method: PlanAcceptanceMethod;
  acceptedTotal: number;
  confirmationCode?: string;
  signatureHash?: string;
}): { ok: true } | { ok: false; code: string; message: string } {
  if (input.acceptedTotal < 0) {
    return { ok: false, code: "INVALID_ACCEPTED_TOTAL", message: "Accepted total cannot be negative" };
  }
  if (input.method === "otp" && !input.confirmationCode?.trim()) {
    return { ok: false, code: "OTP_REQUIRED", message: "OTP confirmation code is required" };
  }
  if (input.method === "signature_upload" && !input.signatureHash?.trim()) {
    return { ok: false, code: "SIGNATURE_REQUIRED", message: "Signature hash is required" };
  }
  return { ok: true };
}

export function evaluateAllergyRule(input: {
  patientAllergies: readonly string[];
  medicationIngredients: readonly string[];
  rules: readonly { ingredientCode: string; allergyName: string; action: AllergyRuleAction }[];
}) {
  const matches: { ingredientCode: string; allergyName: string; action: AllergyRuleAction }[] = [];
  for (const rule of input.rules) {
    const allergyMatch = input.patientAllergies.some(
      (allergy) => allergy.toLowerCase() === rule.allergyName.toLowerCase(),
    );
    const ingredientMatch = input.medicationIngredients.some(
      (ingredient) => ingredient.toLowerCase() === rule.ingredientCode.toLowerCase(),
    );
    if (allergyMatch && ingredientMatch) {
      matches.push(rule);
    }
  }
  const blocked = matches.some((match) => match.action === "block");
  const warnings = matches.filter((match) => match.action === "warn");
  return { blocked, warnings, matches };
}

export function validateMedicationOrderSave(input: {
  diagnosisCount: number;
  serviceLinkCount: number;
  lineCount: number;
}): { ok: true } | { ok: false; code: string; message: string } {
  if (input.diagnosisCount < 1 || input.serviceLinkCount < 1 || input.lineCount < 1) {
    return {
      ok: false,
      code: "MEDICATION_ORDER_INCOMPLETE",
      message: "Medication orders require at least one diagnosis, service link and medication line",
    };
  }
  return { ok: true };
}

export function validateMedicationOrderSign(input: {
  status: MedicationOrderStatus;
  clinicianStaffId: string;
  signingStaffId: string;
  pinVerified: boolean;
}): { ok: true } | { ok: false; code: string; message: string } {
  if (input.status !== "saved") {
    return { ok: false, code: "ORDER_NOT_SAVED", message: "Only saved medication orders can be signed" };
  }
  if (input.clinicianStaffId !== input.signingStaffId) {
    return { ok: false, code: "DOCTOR_ONLY_SIGN", message: "Only the prescribing clinician may sign the order" };
  }
  if (!input.pinVerified) {
    return { ok: false, code: "PIN_REQUIRED", message: "Doctor signing PIN verification failed" };
  }
  return { ok: true };
}

export function buildMedicationOrderSigningPayload(input: Record<string, unknown>): string {
  return stableStringify(sortKeysDeep(input));
}

export function hashMedicationOrderSignature(payload: string, algorithm = "sha256"): string {
  return createHash(algorithm).update(payload).digest("hex");
}

export function verifyDoctorSigningPin(input: {
  providedPin: string;
  storedPinHash: string;
  algorithm?: string;
  lockedUntil?: Date | null;
  now?: Date;
}): { ok: true } | { ok: false; code: string; message: string } {
  const now = input.now ?? new Date();
  if (input.lockedUntil && input.lockedUntil.getTime() > now.getTime()) {
    return { ok: false, code: "PIN_LOCKED", message: "Signing PIN is temporarily locked" };
  }
  const hash = createHash(input.algorithm ?? "sha256").update(input.providedPin).digest("hex");
  if (hash !== input.storedPinHash) {
    return { ok: false, code: "PIN_INVALID", message: "Signing PIN is incorrect" };
  }
  return { ok: true };
}

export function validatePrescriptionRevision(input: {
  replacedStatus: MedicationOrderStatus;
  reason?: string;
}): { ok: true } | { ok: false; code: string; message: string } {
  if (input.replacedStatus !== "signed") {
    return {
      ok: false,
      code: "REVISION_SOURCE_NOT_SIGNED",
      message: "Only signed medication orders can be revised",
    };
  }
  if (!input.reason?.trim()) {
    return { ok: false, code: "REVISION_REASON_REQUIRED", message: "Revision reason is required" };
  }
  return { ok: true };
}

export function buildDocumentPrintSnapshot(input: {
  documentType: DocumentPrintType;
  templateVersion: number;
  sourceEntityType: string;
  sourceEntityId: string;
  payload: Record<string, unknown>;
  layout: Record<string, unknown>;
  reprintNo?: number;
}) {
  return {
    documentType: input.documentType,
    templateVersion: input.templateVersion,
    sourceEntityType: input.sourceEntityType,
    sourceEntityId: input.sourceEntityId,
    reprintNo: input.reprintNo ?? 1,
    payloadJson: input.payload,
    layoutJson: input.layout,
    snapshotHash: hashMedicationOrderSignature(stableStringify(sortKeysDeep(input.payload))),
  };
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sortKeysDeep(entry));
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.keys(record)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortKeysDeep(record[key]);
        return acc;
      }, {});
  }
  return value;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value);
}
