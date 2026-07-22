import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildSyntheticSyncEvent,
  buildTwoClinicSyncScenario,
  generateSyntheticDrKlickRows,
  SYNTHETIC_SYNC_CLINIC_A,
} from "../src/index.js";

describe("@klickit/test-fixtures", () => {
  it("generates deterministic synthetic DrKlick rows", () => {
    const rows = generateSyntheticDrKlickRows(3);
    assert.equal(rows.length, 3);
    assert.equal(rows[0]?.sourcePatientKey, "DRK-SYN-00001");
    assert.match(rows[1]?.mobile ?? "", /^9/);
  });

  it("builds synthetic sync events for clinic A", () => {
    const event = buildSyntheticSyncEvent({ clinic: SYNTHETIC_SYNC_CLINIC_A });
    assert.equal(event.clinicId, SYNTHETIC_SYNC_CLINIC_A.clinicId);
    assert.equal(event.gatewayId, SYNTHETIC_SYNC_CLINIC_A.gatewayId);
    assert.ok(event.idempotencyKey.includes("DEV"));
  });

  it("builds two-clinic replay scenario", () => {
    const scenario = buildTwoClinicSyncScenario();
    assert.notEqual(scenario.clinicAEvent.clinicId, scenario.clinicBEvent.clinicId);
  });
});
