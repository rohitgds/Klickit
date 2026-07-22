import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateEffectivePermission,
  hashPassword,
  sessionHasPermission,
  verifyPassword,
  PASSWORD_ALGORITHM_LEGACY_SCRYPT,
  hashSessionToken,
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

  it("hashes and verifies argon2id passwords", async () => {
    const { hash, algorithm } = await hashPassword("DevPass123!");
    assert.equal(algorithm, "argon2id");
    assert.match(hash, /^\$argon2id\$/);
    assert.equal(await verifyPassword("DevPass123!", hash), true);
    assert.equal(await verifyPassword("wrong", hash), false);
  });

  it("verifies legacy scrypt passwords during migration", async () => {
    const { scryptSync } = await import("node:crypto");
    const legacyHash = scryptSync("DevPass123!", "klickit-dev-salt", 32).toString("hex");
    assert.equal(await verifyPassword("DevPass123!", legacyHash, PASSWORD_ALGORITHM_LEGACY_SCRYPT), true);
  });

  it("hashes session tokens without exposing raw token in hash", () => {
    const token = "abc123";
    const hash = hashSessionToken(token);
    assert.notEqual(hash, token);
    assert.equal(hash.length, 64);
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
