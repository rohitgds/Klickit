export type SyncDirection = "push" | "pull";

export type CloudApplyStatus =
  | "accepted"
  | "already_applied"
  | "rejected"
  | "validation_failed"
  | "permission_failed"
  | "conflict";

export type LocalApplyStatus = "applied" | "already_applied" | "rejected" | "conflict";

export type ConflictResolutionAction = "keep_local" | "keep_cloud" | "manual_merge";

export type ConflictStatus = "open" | "resolved" | "dismissed";

export interface SyncEventEnvelope {
  id: string;
  organizationId: string;
  clinicId: string;
  gatewayId: string;
  deviceId?: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payloadJson: Record<string, unknown>;
  payloadHash: string;
  idempotencyKey: string;
  aggregateVersion: number;
  schemaVersion: number;
  createdAt: string;
}

export interface PushBatchRequest {
  gatewayId: string;
  clinicId: string;
  events: readonly SyncEventEnvelope[];
}

export interface PushBatchItemResult {
  idempotencyKey: string;
  status: CloudApplyStatus;
  error?: string;
}

export interface PushBatchResponse {
  results: readonly PushBatchItemResult[];
  cursorToken?: string;
}

export interface PullBatchRequest {
  gatewayId: string;
  clinicId: string;
  cursorToken: string;
  limit?: number;
}

export interface PullBatchResponse {
  events: readonly SyncEventEnvelope[];
  nextCursorToken: string;
  hasMore: boolean;
}

export interface FieldConflictInput {
  aggregateType: string;
  aggregateId: string;
  fieldName: string;
  localValue: unknown;
  cloudValue: unknown;
  baseVersion?: number;
}

export interface DuplicateCandidateInput {
  patientIdA: string;
  patientIdB: string;
  clinicId: string;
  matchSignals: readonly string[];
}

export interface AppointmentCollisionWarning {
  patientId: string;
  appointmentIdA: string;
  appointmentIdB: string;
  clinicIdA: string;
  clinicIdB: string;
  message: string;
}

export const OFFLINE_WRITE_LIMIT_HOURS = 72;

export const SYNC_BATCH_DEFAULT_LIMIT = 50;

export function buildIdempotencyKey(input: {
  organizationId: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  aggregateVersion: number;
}): string {
  return `${input.organizationId}:${input.aggregateType}:${input.aggregateId}:${input.eventType}:${input.aggregateVersion}`;
}

export function hashPayload(payload: Record<string, unknown>): string {
  const normalized = JSON.stringify(payload, Object.keys(payload).sort());
  let hash = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash * 31 + normalized.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function detectFieldConflict(input: FieldConflictInput): boolean {
  if (input.localValue === undefined && input.cloudValue === undefined) {
    return false;
  }
  return JSON.stringify(input.localValue) !== JSON.stringify(input.cloudValue);
}

export function mergeIndependentFields(
  base: Record<string, unknown>,
  localPatch: Record<string, unknown>,
  cloudPatch: Record<string, unknown>,
): { merged: Record<string, unknown>; conflicts: FieldConflictInput[] } {
  const merged = { ...base, ...localPatch, ...cloudPatch };
  const conflicts: FieldConflictInput[] = [];

  for (const field of new Set([...Object.keys(localPatch), ...Object.keys(cloudPatch)])) {
    if (!(field in localPatch) || !(field in cloudPatch)) {
      continue;
    }
    const conflict: FieldConflictInput = {
      aggregateType: "unknown",
      aggregateId: "unknown",
      fieldName: field,
      localValue: localPatch[field],
      cloudValue: cloudPatch[field],
    };
    if (detectFieldConflict(conflict)) {
      conflicts.push(conflict);
      merged[field] = localPatch[field];
    }
  }

  return { merged, conflicts };
}

export function computeOfflineHoursSince(lastSuccessfulCloudSyncAt: string | null, now = new Date()): number {
  if (!lastSuccessfulCloudSyncAt) {
    return 0;
  }
  const last = new Date(lastSuccessfulCloudSyncAt).getTime();
  if (Number.isNaN(last)) {
    return 0;
  }
  return Math.max(0, (now.getTime() - last) / (1000 * 60 * 60));
}

export function isWriteAllowedOffline(offlineHours: number): boolean {
  return offlineHours <= OFFLINE_WRITE_LIMIT_HOURS;
}
