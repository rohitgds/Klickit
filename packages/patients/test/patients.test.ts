import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildPatientDisplayName,
  normalizePhone,
  renderPatientNumber,
  scoreDuplicateCandidate,
  validateDrKlickStagingRow,
} from "../src/index.js";

describe("patient helpers", () => {
  it("normalizes Indian mobile numbers", () => {
    assert.equal(normalizePhone("+91 98765 43210"), "9876543210");
  });

  it("builds display names", () => {
    assert.equal(buildPatientDisplayName({ firstName: "Asha", lastName: "Singh" }), "Asha Singh");
  });

  it("renders clinic patient numbers", () => {
    assert.equal(renderPatientNumber({ prefix: "DEV", separator: "-", number: 7, width: 5 }), "DEV-00007");
  });

  it("scores duplicate candidates", () => {
    const { score, signals } = scoreDuplicateCandidate({
      nameA: "Asha Singh",
      nameB: "asha singh",
      phoneA: "9876543210",
      phoneB: "09876543210",
    });
    assert.ok(score >= 80);
    assert.ok(signals.includes("mobile"));
  });

  it("validates staging rows", () => {
    assert.equal(validateDrKlickStagingRow({ sourceRowNumber: 1, firstName: "Test" }).valid, true);
    assert.equal(validateDrKlickStagingRow({ sourceRowNumber: 2, firstName: "" }).valid, false);
  });
});
