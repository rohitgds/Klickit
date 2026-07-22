import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { scoreDuplicateCandidate } from "@klickit/patients";
import {
  buildPatientSearchPath,
  isPatientSearchQueryValid,
  patientRegisterSchema,
  patientProfileDisplayName,
  rankDuplicateCandidates,
} from "../src/config/patients.js";

describe("ui module 3 patient helpers", () => {
  it("validates patient search queries", () => {
    assert.equal(isPatientSearchQueryValid(""), true);
    assert.equal(isPatientSearchQueryValid("P-001"), true);
    assert.equal(isPatientSearchQueryValid("ab"), true);
    assert.equal(isPatientSearchQueryValid("a"), true);
    assert.equal(isPatientSearchQueryValid("@"), false);
  });

  it("builds patient search path with paging", () => {
    assert.equal(
      buildPatientSearchPath("rohit", 25, 50),
      "/patients/search?q=rohit&limit=25&offset=50",
    );
  });

  it("requires given name in registration schema", () => {
    const parsed = patientRegisterSchema.safeParse({ firstName: "Anita" });
    assert.equal(parsed.success, true);
    const invalid = patientRegisterSchema.safeParse({ firstName: "" });
    assert.equal(invalid.success, false);
  });

  it("builds profile display name from parts", () => {
    assert.equal(
      patientProfileDisplayName({ first_name: "Anita", last_name: "Sharma", display_name: null }),
      "Anita Sharma",
    );
  });

  it("ranks duplicate candidates by score", () => {
    const ranked = rankDuplicateCandidates(
      [
        {
          id: "p1",
          patientNo: "P-001",
          displayName: "Anita Sharma",
          cellPhone: "9876543210",
        },
      ],
      { firstName: "Anita", lastName: "Sharma", cellPhone: "9876543210" },
      scoreDuplicateCandidate,
    );
    assert.equal(ranked.length, 1);
    assert.ok(ranked[0]!.score >= 40);
  });
});
