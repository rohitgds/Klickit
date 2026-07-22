import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildDocumentPrintSnapshot,
  calculateCarePlanTotals,
  evaluateAllergyRule,
  hashMedicationOrderSignature,
  validateCarePlanStatusTransition,
  validateMedicationOrderSave,
  validateMedicationOrderSign,
  validatePlanAcceptance,
  validatePrescriptionRevision,
  verifyDoctorSigningPin,
} from "../src/index.ts";

describe("@klickit/plans-prescriptions", () => {
  it("calculates care plan totals with discounts and accepted lines", () => {
    const totals = calculateCarePlanTotals([
      { proposedFee: 1000, discount: 100, accepted: true },
      { proposedFee: 500, accepted: false },
    ]);
    assert.equal(totals.estimatedTotal, 1400);
    assert.equal(totals.acceptedTotal, 900);
  });

  it("rejects invalid care plan status transitions", () => {
    const result = validateCarePlanStatusTransition({ fromStatus: "draft", toStatus: "accepted" });
    assert.equal(result.ok, false);
  });

  it("requires OTP for otp acceptance method", () => {
    const result = validatePlanAcceptance({ method: "otp", acceptedTotal: 100 });
    assert.equal(result.ok, false);
  });

  it("blocks medication orders when allergy rule action is block", () => {
    const result = evaluateAllergyRule({
      patientAllergies: ["Penicillin"],
      medicationIngredients: ["PENICILLIN"],
      rules: [{ ingredientCode: "PENICILLIN", allergyName: "Penicillin", action: "block" }],
    });
    assert.equal(result.blocked, true);
  });

  it("requires all child collections before medication order save", () => {
    const result = validateMedicationOrderSave({ diagnosisCount: 0, serviceLinkCount: 1, lineCount: 1 });
    assert.equal(result.ok, false);
  });

  it("requires doctor PIN verification before signing", () => {
    const result = validateMedicationOrderSign({
      status: "saved",
      clinicianStaffId: "a",
      signingStaffId: "a",
      pinVerified: false,
    });
    assert.equal(result.ok, false);
  });

  it("hashes medication order signing payload deterministically", () => {
    const hash = hashMedicationOrderSignature('{"a":1}');
    assert.match(hash, /^[a-f0-9]{64}$/);
  });

  it("verifies doctor signing PIN hash", () => {
    const pin = "1234";
    const hash = hashMedicationOrderSignature(pin);
    const result = verifyDoctorSigningPin({ providedPin: pin, storedPinHash: hash });
    assert.equal(result.ok, true);
  });

  it("requires signed source for prescription revision", () => {
    const result = validatePrescriptionRevision({ replacedStatus: "draft", reason: "Typo" });
    assert.equal(result.ok, false);
  });

  it("builds print snapshot with stable hash", () => {
    const snapshot = buildDocumentPrintSnapshot({
      documentType: "care_plan",
      templateVersion: 1,
      sourceEntityType: "care_plan",
      sourceEntityId: "11111111-1111-4111-8111-111111111111",
      payload: { planNo: "CP-001" },
      layout: { pageSize: "A4" },
    });
    assert.equal(snapshot.reprintNo, 1);
    assert.match(snapshot.snapshotHash, /^[a-f0-9]{64}$/);
  });
});
