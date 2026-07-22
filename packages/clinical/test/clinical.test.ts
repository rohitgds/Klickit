import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  areValidSurfaceCodes,
  evaluateCrossClinicClinicalAccess,
  hashFilePayload,
  isValidFdiToothCode,
  validateCareDeliveryTransition,
  validateClinicalNoteAmendment,
  validateClinicalNoteSign,
} from "../src/index.js";

describe("clinical domain logic", () => {
  it("validates FDI tooth codes", () => {
    assert.equal(isValidFdiToothCode("11"), true);
    assert.equal(isValidFdiToothCode("99"), false);
  });

  it("validates surface codes", () => {
    assert.equal(areValidSurfaceCodes(["M", "O"]), true);
    assert.equal(areValidSurfaceCodes(["X"]), false);
  });

  it("validates note sign and amend rules", () => {
    assert.deepEqual(validateClinicalNoteSign({ status: "draft", body: "Note" }), { ok: true });
    assert.equal(validateClinicalNoteAmendment({ status: "draft", reason: "fix", amendedBody: "x" }).ok, false);
  });

  it("validates care delivery transitions", () => {
    assert.deepEqual(
      validateCareDeliveryTransition({ fromStatus: "planned", toStatus: "in_progress" }),
      { ok: true },
    );
  });

  it("hashes file payloads deterministically", () => {
    assert.equal(hashFilePayload("abc"), hashFilePayload("abc"));
  });

  it("denies cross-clinic clinical edit", () => {
    const result = evaluateCrossClinicClinicalAccess({
      homeClinicId: "a",
      encounterClinicId: "b",
      permissionCode: "clinical.edit",
      hasCrossClinicGrant: true,
    });
    assert.equal(result.allowed, false);
  });
});
