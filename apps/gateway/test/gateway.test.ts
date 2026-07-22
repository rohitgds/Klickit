import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildServer } from "../src/server.ts";
import { loadGatewayConfig } from "../src/config.ts";
import { createServiceLifecycle, markServiceReady } from "../src/lifecycle.ts";
import { createMockPool, TEST_BOOTSTRAP } from "./helpers.ts";
import { evaluateOfflineWritePolicy } from "../src/sync/engine.ts";
import { mergeIndependentFields } from "../src/sync/conflicts.ts";
import { buildDiscoveryBeacon } from "../src/clinic/services.ts";
import { isWriteAllowedOffline } from "@klickit/sync-contracts";

describe("gateway health", () => {
  it("returns a KlickIt health payload", async () => {
    const { app, close } = await buildServer({
      skipDatabase: true,
      pool: createMockPool(),
      bootstrap: TEST_BOOTSTRAP,
    });
    const response = await app.inject({ method: "GET", url: "/health" });
    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.product, "KlickIt");
    assert.equal(body.component, "gateway");
    assert.equal(body.phase, 53);
    await close();
  });

  it("exposes frozen architecture boundaries", async () => {
    const { app, close } = await buildServer({ skipDatabase: true });
    const response = await app.inject({ method: "GET", url: "/architecture" });
    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.phase, 53);
    assert.equal(body.components.length, 5);
    assert.equal(body.providers.length, 10);
    await close();
  });

  it("reports service lifecycle status", async () => {
    const lifecycle = createServiceLifecycle();
    markServiceReady(lifecycle);
    const config = loadGatewayConfig({ KLICKIT_CLINIC_CODE: "DEV", KLICKIT_GATEWAY_CODE: "DEV-GW-01" });
    const { app, close } = await buildServer({
      config,
      lifecycle,
      skipDatabase: true,
      pool: createMockPool(),
      bootstrap: TEST_BOOTSTRAP,
    });
    const response = await app.inject({ method: "GET", url: "/service/status" });
    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.service, "KlickIt Clinic Gateway");
    assert.equal(body.clinicCode, "DEV");
    assert.equal(body.gatewayCode, "DEV-GW-01");
    assert.equal(body.lifecycle, "ready");
    await close();
    assert.equal(lifecycle.state, "stopped");
  });
});

describe("clinic configuration and discovery", () => {
  it("returns clinic config with offline policy", async () => {
    const config = loadGatewayConfig();
    const { app, close } = await buildServer({
      config,
      skipDatabase: true,
      pool: createMockPool(),
      bootstrap: TEST_BOOTSTRAP,
    });
    const response = await app.inject({ method: "GET", url: "/clinic/config" });
    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.clinicCode, "DEV");
    assert.equal(body.clinic.name, "Development Clinic");
    assert.equal(body.offlinePolicy.writeAllowed, true);
    await close();
  });

  it("exposes LAN discovery beacon", async () => {
    const config = loadGatewayConfig({ GATEWAY_PORT: "8787" });
    const beacon = buildDiscoveryBeacon(config, TEST_BOOTSTRAP, "192.168.1.10");
    assert.equal(beacon.product, "KlickIt");
    assert.equal(beacon.clinicCode, "DEV");
    assert.equal(beacon.port, 8787);

    const { app, close } = await buildServer({
      config,
      skipDatabase: true,
      pool: createMockPool(),
      bootstrap: TEST_BOOTSTRAP,
    });
    const response = await app.inject({ method: "GET", url: "/discovery" });
    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.gatewayCode, "DEV-GW-01");
    await close();
  });
});

describe("sync and offline policy", () => {
  it("accepts push batch events into outbox flow", async () => {
    const { app, close } = await buildServer({
      skipDatabase: true,
      pool: createMockPool(),
      bootstrap: TEST_BOOTSTRAP,
    });
    const response = await app.inject({
      method: "POST",
      url: "/sync/push",
      payload: {
        gatewayId: TEST_BOOTSTRAP.gateway.id,
        clinicId: TEST_BOOTSTRAP.clinic.id,
        events: [
          {
            organizationId: TEST_BOOTSTRAP.clinic.organizationId,
            clinicId: TEST_BOOTSTRAP.clinic.id,
            gatewayId: TEST_BOOTSTRAP.gateway.id,
            aggregateType: "patient",
            aggregateId: "99999999-9999-4999-8999-999999999999",
            eventType: "patient.created",
            payloadJson: { name: "Synthetic Patient" },
            payloadHash: "abc123",
            idempotencyKey: "test-key-1",
            aggregateVersion: 1,
            schemaVersion: 1,
          },
        ],
      },
    });
    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.results[0].status, "accepted");
    await close();
  });

  it("blocks writes when offline limit exceeded", async () => {
    const readOnlyBootstrap = {
      ...TEST_BOOTSTRAP,
      gateway: {
        ...TEST_BOOTSTRAP.gateway,
        lastSuccessfulCloudSyncAt: new Date(Date.now() - 80 * 60 * 60 * 1000).toISOString(),
        readOnlyAt: new Date().toISOString(),
      },
    };
    const policy = evaluateOfflineWritePolicy(readOnlyBootstrap.gateway);
    assert.equal(isWriteAllowedOffline(policy.offlineHours), false);

    const { app, close } = await buildServer({
      skipDatabase: true,
      pool: createMockPool(),
      bootstrap: readOnlyBootstrap,
    });
    const response = await app.inject({
      method: "POST",
      url: "/sync/push",
      payload: {
        gatewayId: readOnlyBootstrap.gateway.id,
        clinicId: readOnlyBootstrap.clinic.id,
        events: [],
      },
    });
    assert.equal(response.statusCode, 403);
    await close();
  });

  it("merges independent field changes without conflict", () => {
    const { merged, conflicts } = mergeIndependentFields(
      { name: "Patient" },
      { phone: "111" },
      { email: "a@example.com" },
    );
    assert.equal(conflicts.length, 0);
    assert.deepEqual(merged, { name: "Patient", phone: "111", email: "a@example.com" });
  });
});

describe("resilience foundations", () => {
  it("returns backup manifest and updater status", async () => {
    const { app, close } = await buildServer({
      skipDatabase: true,
      pool: createMockPool(),
      bootstrap: TEST_BOOTSTRAP,
    });
    const backup = await app.inject({ method: "GET", url: "/resilience/backup/manifest" });
    const updater = await app.inject({ method: "GET", url: "/resilience/updater/status" });
    assert.equal(backup.statusCode, 200);
    assert.equal(updater.statusCode, 200);
    assert.equal(backup.json().product, "KlickIt");
    assert.equal(updater.json().updateAvailable, false);
    await close();
  });
});
