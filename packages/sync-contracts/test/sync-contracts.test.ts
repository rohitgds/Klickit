import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildIdempotencyKey,
  computeOfflineHoursSince,
  detectFieldConflict,
  hashPayload,
  isWriteAllowedOffline,
  mergeIndependentFields,
  OFFLINE_WRITE_LIMIT_HOURS,
} from "../src/index.js";

describe("sync contracts", () => {
  it("builds stable idempotency keys", () => {
    const key = buildIdempotencyKey({
      organizationId: "org-1",
      aggregateType: "patient",
      aggregateId: "pat-1",
      eventType: "patient.updated",
      aggregateVersion: 2,
    });
    assert.equal(key, "org-1:patient:pat-1:patient.updated:2");
  });

  it("hashes payloads deterministically", () => {
    const a = hashPayload({ b: 2, a: 1 });
    const b = hashPayload({ a: 1, b: 2 });
    assert.equal(a, b);
  });

  it("detects same-field conflicts", () => {
    assert.equal(
      detectFieldConflict({
        aggregateType: "patient",
        aggregateId: "1",
        fieldName: "name",
        localValue: "A",
        cloudValue: "B",
      }),
      true,
    );
    assert.equal(
      detectFieldConflict({
        aggregateType: "patient",
        aggregateId: "1",
        fieldName: "name",
        localValue: "A",
        cloudValue: "A",
      }),
      false,
    );
  });

  it("merges independent field changes", () => {
    const { merged, conflicts } = mergeIndependentFields(
      { name: "Base", phone: "111" },
      { phone: "222" },
      { email: "x@example.com" },
    );
    assert.deepEqual(merged, { name: "Base", phone: "222", email: "x@example.com" });
    assert.equal(conflicts.length, 0);
  });

  it("enforces the 72-hour offline write limit", () => {
    assert.equal(OFFLINE_WRITE_LIMIT_HOURS, 72);
    assert.equal(isWriteAllowedOffline(71), true);
    assert.equal(isWriteAllowedOffline(72), true);
    assert.equal(isWriteAllowedOffline(73), false);
    const hours = computeOfflineHoursSince(new Date(Date.now() - 73 * 60 * 60 * 1000).toISOString());
    assert.ok(hours >= 73);
  });
});
