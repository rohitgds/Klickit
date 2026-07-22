import type { FastifyInstance } from "fastify";
import {
  APP_COMPONENT_BOUNDARIES,
  DOMAIN_MODULE_BOUNDARIES,
  resolveRuntimeMode,
} from "@klickit/domain";
import { PROVIDER_DESCRIPTORS } from "@klickit/providers";
import { createHealthResponse } from "@klickit/shared";
import type { PushBatchRequest, PullBatchRequest } from "@klickit/sync-contracts";
import type { GatewayConfig } from "../config.js";
import type { ServiceLifecycle } from "../lifecycle.js";
import { getServiceStatus } from "../lifecycle.js";
import {
  buildDiscoveryBeacon,
  isDeviceApproved,
  listApprovedDevices,
  resolveAdvertisedHost,
} from "../clinic/services.js";
import type { DatabasePoolLike, ClinicBootstrap } from "../db/client.js";
import { pingDatabase } from "../db/client.js";
import { buildBackupManifest, buildClinicConfigResponse, buildUpdaterStatus, type GatewayRuntimeState } from "../resilience/status.js";
import {
  applyPushBatchLocally,
  evaluateOfflineWritePolicy,
  markGatewayReadOnly,
  pullBatchLocally,
  recordSuccessfulCloudSync,
  selectPendingOutboxEvents,
} from "../sync/engine.js";
import { listOpenConflicts, resolveConflict } from "../sync/conflicts.js";
import { approveDevice, revokeDevice } from "../clinic/services.js";
import { registerMilestone3Routes } from "./milestone3.js";

export interface GatewayDependencies {
  config: GatewayConfig;
  lifecycle: ServiceLifecycle;
  pool: DatabasePoolLike | null;
  bootstrap: ClinicBootstrap | null;
  databaseConnected: boolean;
  databaseError?: string;
}

function runtimeState(deps: GatewayDependencies): GatewayRuntimeState {
  return {
    bootstrap: deps.bootstrap,
    databaseConnected: deps.databaseConnected,
    databaseError: deps.databaseError,
  };
}

function syncContext(deps: GatewayDependencies) {
  if (!deps.pool || !deps.bootstrap) {
    throw new Error("Gateway database bootstrap is unavailable");
  }
  return {
    pool: deps.pool,
    gateway: deps.bootstrap.gateway,
  };
}

function enforceWriteAllowed(deps: GatewayDependencies) {
  if (!deps.bootstrap) {
    return;
  }
  const policy = evaluateOfflineWritePolicy(deps.bootstrap.gateway);
  if (!policy.writeAllowed || policy.readOnly) {
    throw new Error("Clinic gateway is read-only after the 72-hour offline limit");
  }
}

export async function registerGatewayRoutes(app: FastifyInstance, deps: GatewayDependencies) {
  app.get("/health", async () => {
    const base = createHealthResponse("gateway", deps.databaseConnected ? "ok" : "degraded");
    const dbHealth = deps.pool ? await pingDatabase(deps.pool) : null;
    const policy = deps.bootstrap ? evaluateOfflineWritePolicy(deps.bootstrap.gateway) : null;
    return {
      ...base,
      phase: 23,
      database: dbHealth,
      offlinePolicy: policy,
      lifecycle: deps.lifecycle.state,
    };
  });

  app.get("/service/status", async () => ({
    ...getServiceStatus(deps.config, deps.lifecycle),
    gatewayCode: deps.config.gatewayCode,
    softwareVersion: deps.config.softwareVersion,
    databaseConnected: deps.databaseConnected,
    clinicLoaded: Boolean(deps.bootstrap),
    runtimeMode: resolveRuntimeMode({
      gatewayReachable: true,
      cloudReachable: Boolean(deps.config.cloudSyncUrl),
      offlineHours: policyHours(deps),
    }),
  }));

  app.get("/architecture", async () => ({
    product: "KlickIt",
    phase: 23,
    runtimeMode: resolveRuntimeMode({
      gatewayReachable: true,
      cloudReachable: Boolean(deps.config.cloudSyncUrl),
      offlineHours: policyHours(deps),
    }),
    components: APP_COMPONENT_BOUNDARIES,
    modules: DOMAIN_MODULE_BOUNDARIES,
    providers: PROVIDER_DESCRIPTORS,
  }));

  app.get("/providers/health", async () => ({
    status: deps.databaseConnected ? "ok" : "degraded",
    provider: "local-gateway",
    databaseConnected: deps.databaseConnected,
  }));

  app.get("/", async () => ({
    message: deps.config.serviceName,
    clinicCode: deps.config.clinicCode,
    gatewayCode: deps.config.gatewayCode,
    note: "Local Fastify host for offline-first clinic operations",
  }));

  app.get("/clinic/config", async () => buildClinicConfigResponse(deps.config, runtimeState(deps)));

  app.get("/discovery", async (request) => {
    if (!deps.bootstrap) {
      return { error: "Clinic bootstrap unavailable" };
    }
    const host = resolveAdvertisedHost(deps.config, request.hostname);
    return buildDiscoveryBeacon(deps.config, deps.bootstrap, host);
  });

  app.get("/resilience/backup/manifest", async () => buildBackupManifest(deps.config, runtimeState(deps)));

  app.get("/resilience/updater/status", async () => buildUpdaterStatus(deps.config));

  app.get("/sync/outbox/pending", async () => {
    const ctx = syncContext(deps);
    const events = await selectPendingOutboxEvents(ctx);
    return { events, count: events.length };
  });

  app.post<{ Body: PushBatchRequest }>("/sync/push", async (request, reply) => {
    try {
      enforceWriteAllowed(deps);
      const ctx = syncContext(deps);
      const response = await applyPushBatchLocally(ctx, request.body);
      return response;
    } catch (error) {
      reply.code(403);
      return { error: error instanceof Error ? error.message : "Push rejected" };
    }
  });

  app.post<{ Body: PullBatchRequest }>("/sync/pull", async (request) => {
    const ctx = syncContext(deps);
    return pullBatchLocally(ctx, request.body);
  });

  app.post("/sync/cloud-sync/success", async () => {
    const ctx = syncContext(deps);
    await recordSuccessfulCloudSync(ctx);
    return { ok: true };
  });

  app.post("/sync/offline/enter-read-only", async () => {
    const ctx = syncContext(deps);
    await markGatewayReadOnly(ctx);
    return { ok: true, readOnly: true };
  });

  app.get("/sync/conflicts/open", async () => {
    if (!deps.bootstrap || !deps.pool) {
      return { conflicts: [] };
    }
    const conflicts = await listOpenConflicts(deps.pool, deps.bootstrap.clinic.id);
    return { conflicts };
  });

  app.post<{
    Body: {
      conflictId: string;
      resolutionAction: "keep_local" | "keep_cloud" | "manual_merge";
      resolvedValue?: unknown;
      resolvedBy: string;
      reason: string;
    };
  }>("/sync/conflicts/resolve", async (request) => {
    enforceWriteAllowed(deps);
    if (!deps.pool) {
      throw new Error("Database unavailable");
    }
    await resolveConflict(deps.pool, request.body);
    return { ok: true };
  });

  app.get("/devices/approved", async () => {
    if (!deps.bootstrap || !deps.pool) {
      return { devices: [] };
    }
    const devices = await listApprovedDevices(deps.pool, deps.bootstrap.clinic.id);
    return { devices };
  });

  app.post<{
    Body: {
      deviceLabel: string;
      deviceFingerprintHash: string;
      approvedBy: string;
    };
  }>("/devices/approve", async (request) => {
    enforceWriteAllowed(deps);
    if (!deps.pool || !deps.bootstrap) {
      throw new Error("Database unavailable");
    }
    const id = await approveDevice(deps.pool, {
      organizationId: deps.bootstrap.clinic.organizationId,
      clinicId: deps.bootstrap.clinic.id,
      gatewayId: deps.bootstrap.gateway.id,
      deviceLabel: request.body.deviceLabel,
      deviceFingerprintHash: request.body.deviceFingerprintHash,
      approvedBy: request.body.approvedBy,
    });
    return { id };
  });

  app.post<{
    Body: {
      deviceFingerprintHash: string;
      revokedBy: string;
    };
  }>("/devices/revoke", async (request) => {
    if (!deps.pool || !deps.bootstrap) {
      throw new Error("Database unavailable");
    }
    const revoked = await revokeDevice(deps.pool, {
      clinicId: deps.bootstrap.clinic.id,
      deviceFingerprintHash: request.body.deviceFingerprintHash,
      revokedBy: request.body.revokedBy,
    });
    return { revoked };
  });

  app.get<{ Querystring: { fingerprint: string } }>("/devices/check", async (request) => {
    if (!deps.pool || !deps.bootstrap) {
      return { approved: false };
    }
    const approved = await isDeviceApproved(
      deps.pool,
      deps.bootstrap.clinic.id,
      request.query.fingerprint,
    );
    return { approved };
  });

  await registerMilestone3Routes(app, deps);
}

function policyHours(deps: GatewayDependencies): number {
  if (!deps.bootstrap) {
    return 0;
  }
  return evaluateOfflineWritePolicy(deps.bootstrap.gateway).offlineHours;
}
