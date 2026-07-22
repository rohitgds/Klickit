import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  PRODUCT_NAME,
  discoverGateway,
  mapRuntimeIndicator,
  resolveClientApiBase,
} from "@klickit/shared";

describe("web shell", () => {
  it("keeps the KlickIt product name", () => {
    assert.equal(PRODUCT_NAME, "KlickIt");
  });

  it("resolves client API base for local and cloud modes", () => {
    assert.equal(
      resolveClientApiBase({ mode: "local-gateway", gatewayUrl: "http://127.0.0.1:8787" }),
      "http://127.0.0.1:8787",
    );
    assert.equal(
      resolveClientApiBase({ mode: "cloud", cloudUrl: "https://cloud.example" }),
      "https://cloud.example",
    );
  });

  it("maps runtime indicators", () => {
    assert.equal(
      mapRuntimeIndicator({
        gatewayReachable: true,
        cloudReachable: false,
        offlineHours: 1,
        readOnly: false,
      }),
      "local-offline",
    );
    assert.equal(
      mapRuntimeIndicator({
        gatewayReachable: true,
        cloudReachable: true,
        offlineHours: 80,
        readOnly: true,
      }),
      "read-only-offline-limit",
    );
  });

  it("returns null when gateway discovery fails", async () => {
    const result = await discoverGateway("http://127.0.0.1:1");
    assert.equal(result, null);
  });
});
