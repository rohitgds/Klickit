import type { GatewayConfig } from "../config.js";
import type { ClinicBootstrap } from "../db/client.js";
import { evaluateOfflineWritePolicy } from "../sync/engine.js";

export interface GatewayRuntimeState {
  bootstrap: ClinicBootstrap | null;
  databaseConnected: boolean;
  databaseError?: string;
}

export function buildClinicConfigResponse(
  config: GatewayConfig,
  runtime: GatewayRuntimeState,
) {
  const policy = runtime.bootstrap
    ? evaluateOfflineWritePolicy(runtime.bootstrap.gateway)
    : { offlineHours: 0, writeAllowed: true, readOnly: false };

  return {
    clinicCode: config.clinicCode,
    gatewayCode: config.gatewayCode,
    softwareVersion: config.softwareVersion,
    databaseConnected: runtime.databaseConnected,
    databaseError: runtime.databaseError,
    clinic: runtime.bootstrap?.clinic ?? null,
    gateway: runtime.bootstrap?.gateway ?? null,
    offlinePolicy: policy,
    cloudSyncUrl: config.cloudSyncUrl,
  };
}

export interface BackupManifest {
  product: "KlickIt";
  clinicCode: string;
  gatewayId: string | null;
  createdAt: string;
  databaseUrlConfigured: boolean;
  note: string;
}

export function buildBackupManifest(config: GatewayConfig, runtime: GatewayRuntimeState): BackupManifest {
  return {
    product: "KlickIt",
    clinicCode: config.clinicCode,
    gatewayId: runtime.bootstrap?.gateway.id ?? null,
    createdAt: new Date().toISOString(),
    databaseUrlConfigured: Boolean(config.databaseUrl),
    note: "Foundation manifest only. Encrypted backup execution is deferred to pilot readiness phases.",
  };
}

export interface UpdaterStatus {
  channel: "internal-dev";
  currentVersion: string;
  updateAvailable: boolean;
  note: string;
}

export function buildUpdaterStatus(config: GatewayConfig): UpdaterStatus {
  return {
    channel: "internal-dev",
    currentVersion: config.softwareVersion,
    updateAvailable: false,
    note: "Signed updater integration is scheduled for Rohini readiness phases.",
  };
}
