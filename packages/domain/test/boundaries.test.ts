import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  APP_COMPONENT_BOUNDARIES,
  DOMAIN_MODULE_BOUNDARIES,
  getComponentBoundary,
  resolveRuntimeMode,
} from "../src/boundaries.js";

describe("architecture boundaries", () => {
  it("freezes five app component boundaries", () => {
    assert.equal(APP_COMPONENT_BOUNDARIES.length, 5);
  });

  it("keeps gateway as the only local database owner", () => {
    const owners = APP_COMPONENT_BOUNDARIES.filter((item) => item.ownsLocalDatabase);
    assert.deepEqual(owners.map((item) => item.id), ["gateway"]);
  });

  it("keeps cloud sync as system of record", () => {
    const cloud = getComponentBoundary("cloud-sync");
    assert.equal(cloud.ownsCloudSystemOfRecord, true);
  });

  it("registers sync-engine under gateway ownership", () => {
    const sync = DOMAIN_MODULE_BOUNDARIES.find((item) => item.id === "sync-engine");
    assert.equal(sync?.owner, "gateway");
  });

  it("resolves clinic-offline mode when cloud is unavailable", () => {
    assert.equal(
      resolveRuntimeMode({ gatewayReachable: true, cloudReachable: false, offlineHours: 1 }),
      "clinic-offline",
    );
  });
});
