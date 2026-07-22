import { apiFetch } from "./client.js";

export interface SyncConflict {
  id: string;
  aggregateType: string;
  aggregateId: string;
  fieldName: string;
  localValue: unknown;
  cloudValue: unknown;
  status: string;
}

export interface SyncStatusSummary {
  pendingOutbox: number;
  failedOutbox: number;
  openConflicts: number;
  deadLetters: number;
  offlinePolicy: {
    offlineHours: number;
    writeAllowed: boolean;
    readOnly: boolean;
  };
}

type GatewayConflictRow = {
  id: string;
  aggregateType: string;
  aggregateId: string;
  fieldName: string;
  localValue: unknown;
  cloudValue: unknown;
  status: string;
};

export async function fetchOpenConflicts(token: string): Promise<{ conflicts: SyncConflict[] }> {
  const response = await apiFetch<{ conflicts: GatewayConflictRow[] }>("/sync/conflicts/open", {}, token);
  return {
    conflicts: (response.conflicts ?? []).map((row) => ({
      id: row.id,
      aggregateType: row.aggregateType,
      aggregateId: row.aggregateId,
      fieldName: row.fieldName,
      localValue: row.localValue,
      cloudValue: row.cloudValue,
      status: row.status,
    })),
  };
}

export async function fetchSyncStatus(token: string): Promise<SyncStatusSummary> {
  return apiFetch<SyncStatusSummary>("/sync/status", {}, token);
}

export async function resolveSyncConflict(
  token: string,
  body: {
    conflictId: string;
    resolutionAction: "keep_local" | "keep_cloud" | "manual_merge";
    resolvedBy: string;
    reason: string;
    resolvedValue?: unknown;
  },
): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>("/sync/conflicts/resolve", { method: "POST", body: JSON.stringify(body) }, token);
}

export async function fetchBackupManifest(token: string): Promise<Record<string, unknown>> {
  return apiFetch<Record<string, unknown>>("/resilience/backup/manifest", {}, token);
}

export async function fetchBackupRuns(token: string): Promise<{ runs: Array<{ id: string; createdAt?: string }> }> {
  return apiFetch<{ runs: Array<{ id: string; createdAt?: string }> }>("/resilience/backup/runs", {}, token);
}

export async function fetchRecoveryStatus(token: string): Promise<Record<string, unknown>> {
  return apiFetch<Record<string, unknown>>("/resilience/recovery/status", {}, token);
}
