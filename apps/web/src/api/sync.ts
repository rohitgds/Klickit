import { apiFetch } from "./client.js";

export interface SyncConflict {
  id: string;
  entityType: string;
  entityId: string;
  fieldPath: string;
  localValue: unknown;
  cloudValue: unknown;
  detectedAt: string;
}

export async function fetchOpenConflicts(token: string): Promise<{ conflicts: SyncConflict[] }> {
  return apiFetch<{ conflicts: SyncConflict[] }>("/sync/conflicts/open", {}, token);
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
