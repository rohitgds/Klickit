import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  filterNavItemsByPermission,
  mapClinicConfigToSyncStatus,
  PILOT_NAV_ITEMS,
} from "../src/config/navigation.js";
import {
  clearSession,
  hasPermission,
  readSessionToken,
  writeSession,
} from "../src/auth/sessionStorage.js";
import { resolveApiBase } from "../src/api/client.js";

describe("ui module 1 helpers", () => {
  it("filters navigation by permission", () => {
    const filtered = filterNavItemsByPermission(PILOT_NAV_ITEMS, ["patient.view", "scheduler.view"]);
    assert.ok(filtered.some((item) => item.to === "/patient-registry"));
    assert.ok(filtered.some((item) => item.to === "/dashboard"));
    assert.equal(filtered.some((item) => item.to === "/financial-operations"), false);
  });

  it("maps clinic config to sync status labels", () => {
    assert.equal(
      mapClinicConfigToSyncStatus({
        databaseConnected: true,
        offlinePolicy: { readOnly: false },
        cloudSyncUrl: "https://example.com",
      }),
      "online",
    );
    assert.equal(
      mapClinicConfigToSyncStatus({
        databaseConnected: false,
        offlinePolicy: { readOnly: false },
        cloudSyncUrl: null,
      }),
      "disconnected",
    );
  });

  it("stores session token in memory adapter", () => {
    const memory = new Map<string, string>();
    const adapter = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
      removeItem: (key: string) => {
        memory.delete(key);
      },
    };
    writeSession(
      {
        token: "demo-token",
        user: {
          userId: "user-1",
          clinicId: "clinic-1",
          organizationId: "org-1",
          permissionCodes: ["patient.view"],
        },
      },
      adapter,
    );
    assert.equal(readSessionToken(adapter), "demo-token");
    assert.equal(hasPermission(["patient.view"], "patient.view"), true);
    clearSession(adapter);
    assert.equal(readSessionToken(adapter), null);
  });

  it("defaults API base to proxied /api path", () => {
    assert.equal(resolveApiBase(), "/api");
  });
});
