import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateEffectivePermission,
  hashPassword,
  sessionHasPermission,
  verifyPassword,
} from "../src/index.js";

describe("identity permissions", () => {
  it("denies when no grant exists", () => {
    const result = evaluateEffectivePermission("patient.view", []);
    assert.equal(result.allowed, false);
  });

  it("allows role grants and override deny wins", () => {
    const grants = [
      { code: "patient.view", effect: "allow" as const, source: "role" as const },
      { code: "patient.view", effect: "deny" as const, source: "override" as const },
    ];
    const result = evaluateEffectivePermission("patient.view", grants);
    assert.equal(result.allowed, false);
  });

  it("hashes and verifies development passwords", () => {
    const hash = hashPassword("DevPass123!");
    assert.equal(verifyPassword("DevPass123!", hash), true);
    assert.equal(verifyPassword("wrong", hash), false);
  });

  it("checks session permission codes", () => {
    assert.equal(
      sessionHasPermission(
        {
          userId: "u1",
          organizationId: "o1",
          clinicId: "c1",
          membershipId: "m1",
          authzVersion: 1,
          permissionCodes: ["patient.view"],
        },
        "patient.view",
      ),
      true,
    );
  });
});
