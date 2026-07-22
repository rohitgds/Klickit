import {
  buildIdempotencyKey,
  computeOfflineHoursSince,
  hashPayload,
  isWriteAllowedOffline,
  type PullBatchRequest,
  type PullBatchResponse,
  type PushBatchItemResult,
  type PushBatchRequest,
  type PushBatchResponse,
  type SyncEventEnvelope,
  SYNC_BATCH_DEFAULT_LIMIT,
} from "@klickit/sync-contracts";
import type { DatabasePoolLike, GatewayRecord } from "../db/client.js";

export interface SyncEngineContext {
  pool: DatabasePoolLike;
  gateway: GatewayRecord;
}

export async function enqueueOutboxEvent(
  ctx: SyncEngineContext,
  input: Omit<SyncEventEnvelope, "id" | "payloadHash" | "createdAt"> & { createdBy?: string },
): Promise<{ id: string; idempotencyKey: string }> {
  const idempotencyKey =
    input.idempotencyKey ||
    buildIdempotencyKey({
      organizationId: input.organizationId,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      eventType: input.eventType,
      aggregateVersion: input.aggregateVersion,
    });
  const payloadHash = hashPayload(input.payloadJson);
  const id = crypto.randomUUID();

  const existing = await ctx.pool.query<{ id: string }>(
    `
      SELECT id FROM dentos_runtime.sync_outbox_events
      WHERE organization_id = $1 AND idempotency_key = $2
    `,
    [input.organizationId, idempotencyKey],
  );
  if (existing.rows[0]) {
    return { id: existing.rows[0].id, idempotencyKey };
  }

  await ctx.pool.query(
    `
      INSERT INTO dentos_runtime.sync_outbox_events (
        id, organization_id, clinic_id, gateway_id, device_id,
        aggregate_type, aggregate_id, event_type, payload_json, payload_hash,
        idempotency_key, aggregate_version, created_by
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13
      )
    `,
    [
      id,
      input.organizationId,
      input.clinicId,
      input.gatewayId,
      input.deviceId ?? null,
      input.aggregateType,
      input.aggregateId,
      input.eventType,
      JSON.stringify(input.payloadJson),
      payloadHash,
      idempotencyKey,
      input.aggregateVersion,
      input.createdBy ?? null,
    ],
  );

  return { id, idempotencyKey };
}

export async function selectPendingOutboxEvents(
  ctx: SyncEngineContext,
  limit = SYNC_BATCH_DEFAULT_LIMIT,
): Promise<SyncEventEnvelope[]> {
  const result = await ctx.pool.query<{
    id: string;
    organization_id: string;
    clinic_id: string;
    gateway_id: string;
    device_id: string | null;
    aggregate_type: string;
    aggregate_id: string;
    event_type: string;
    payload_json: Record<string, unknown>;
    payload_hash: string;
    idempotency_key: string;
    aggregate_version: string;
    created_at: string;
  }>(
    `
      SELECT *
      FROM dentos_runtime.sync_outbox_events
      WHERE gateway_id = $1
        AND sent_at IS NULL
        AND available_at <= clock_timestamp()
      ORDER BY created_at ASC
      LIMIT $2
    `,
    [ctx.gateway.id, limit],
  );

  return result.rows.map((row) => ({
    id: row.id,
    organizationId: row.organization_id,
    clinicId: row.clinic_id,
    gatewayId: row.gateway_id,
    deviceId: row.device_id ?? undefined,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    eventType: row.event_type,
    payloadJson: row.payload_json,
    payloadHash: row.payload_hash,
    idempotencyKey: row.idempotency_key,
    aggregateVersion: Number(row.aggregate_version),
    schemaVersion: 1,
    createdAt: row.created_at,
  }));
}

export async function recordPushResults(
  ctx: SyncEngineContext,
  results: readonly PushBatchItemResult[],
): Promise<void> {
  for (const result of results) {
    await ctx.pool.query(
      `
        UPDATE dentos_runtime.sync_outbox_events
        SET sent_at = clock_timestamp(),
            cloud_status = $2,
            last_error = $3
        WHERE gateway_id = $1 AND idempotency_key = $4
      `,
      [ctx.gateway.id, result.status, result.error ?? null, result.idempotencyKey],
    );
  }
}

export async function applyPushBatchLocally(
  ctx: SyncEngineContext,
  request: PushBatchRequest,
): Promise<PushBatchResponse> {
  const results: PushBatchItemResult[] = [];

  for (const event of request.events) {
    try {
      const { idempotencyKey } = await enqueueOutboxEvent(ctx, event);
      results.push({ idempotencyKey, status: "accepted" });
    } catch (error) {
      results.push({
        idempotencyKey: event.idempotencyKey,
        status: "rejected",
        error: error instanceof Error ? error.message : "Failed to enqueue outbox event",
      });
    }
  }

  return { results };
}

export async function getCursorToken(ctx: SyncEngineContext, direction: "push" | "pull"): Promise<string> {
  const result = await ctx.pool.query<{ cursor_token: string }>(
    `
      SELECT cursor_token
      FROM dentos_runtime.sync_cursors
      WHERE gateway_id = $1 AND direction = $2
    `,
    [ctx.gateway.id, direction],
  );
  return result.rows[0]?.cursor_token ?? "0";
}

export async function setCursorToken(
  ctx: SyncEngineContext,
  direction: "push" | "pull",
  cursorToken: string,
): Promise<void> {
  await ctx.pool.query(
    `
      INSERT INTO dentos_runtime.sync_cursors (
        id, organization_id, clinic_id, gateway_id, direction, cursor_token
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (gateway_id, direction)
      DO UPDATE SET cursor_token = EXCLUDED.cursor_token, updated_at = clock_timestamp()
    `,
    [crypto.randomUUID(), ctx.gateway.organizationId, ctx.gateway.clinicId, ctx.gateway.id, direction, cursorToken],
  );
}

export async function applyInboxEvent(
  ctx: SyncEngineContext,
  event: SyncEventEnvelope & { cloudEventId: string },
): Promise<"applied" | "already_applied" | "rejected"> {
  const existing = await ctx.pool.query<{ id: string }>(
    `
      SELECT id FROM dentos_runtime.sync_inbox_events
      WHERE gateway_id = $1 AND cloud_event_id = $2
    `,
    [ctx.gateway.id, event.cloudEventId],
  );
  if (existing.rows[0]) {
    return "already_applied";
  }

  await ctx.pool.query(
    `
      INSERT INTO dentos_runtime.sync_inbox_events (
        id, organization_id, clinic_id, gateway_id, cloud_event_id,
        aggregate_type, aggregate_id, event_type, payload_json, payload_hash,
        idempotency_key, aggregate_version, applied_at, apply_status
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, clock_timestamp(), 'applied'
      )
    `,
    [
      crypto.randomUUID(),
      event.organizationId,
      event.clinicId,
      event.gatewayId,
      event.cloudEventId,
      event.aggregateType,
      event.aggregateId,
      event.eventType,
      JSON.stringify(event.payloadJson),
      event.payloadHash,
      event.idempotencyKey,
      event.aggregateVersion,
    ],
  );

  return "applied";
}

export async function pullBatchLocally(
  ctx: SyncEngineContext,
  request: PullBatchRequest,
): Promise<PullBatchResponse> {
  const limit = request.limit ?? SYNC_BATCH_DEFAULT_LIMIT;
  const cursor = request.cursorToken === "0" ? "1970-01-01T00:00:00.000Z" : request.cursorToken;

  const result = await ctx.pool.query<{
    id: string;
    organization_id: string;
    clinic_id: string;
    gateway_id: string;
    cloud_event_id: string;
    aggregate_type: string;
    aggregate_id: string;
    event_type: string;
    payload_json: Record<string, unknown>;
    payload_hash: string;
    idempotency_key: string;
    aggregate_version: string;
    received_at: string;
  }>(
    `
      SELECT *
      FROM dentos_runtime.sync_inbox_events
      WHERE gateway_id = $1
        AND received_at > $2::timestamptz
      ORDER BY received_at ASC
      LIMIT $3
    `,
    [ctx.gateway.id, cursor, limit + 1],
  );

  const hasMore = result.rows.length > limit;
  const rows = hasMore ? result.rows.slice(0, limit) : result.rows;
  const events: SyncEventEnvelope[] = rows.map((row) => ({
    id: row.id,
    organizationId: row.organization_id,
    clinicId: row.clinic_id,
    gatewayId: row.gateway_id,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    eventType: row.event_type,
    payloadJson: row.payload_json,
    payloadHash: row.payload_hash,
    idempotencyKey: row.idempotency_key,
    aggregateVersion: Number(row.aggregate_version),
    schemaVersion: 1,
    createdAt: row.received_at,
  }));

  const nextCursorToken = rows.length > 0 ? rows[rows.length - 1]!.received_at : request.cursorToken;

  if (rows.length > 0) {
    await setCursorToken(ctx, "pull", nextCursorToken);
  }

  return { events, nextCursorToken, hasMore };
}

export function evaluateOfflineWritePolicy(gateway: GatewayRecord): {
  offlineHours: number;
  writeAllowed: boolean;
  readOnly: boolean;
} {
  const offlineHours = computeOfflineHoursSince(gateway.lastSuccessfulCloudSyncAt);
  const writeAllowed = isWriteAllowedOffline(offlineHours);
  const readOnly = Boolean(gateway.readOnlyAt) || !writeAllowed;
  return { offlineHours, writeAllowed, readOnly };
}

export async function markGatewayReadOnly(ctx: SyncEngineContext): Promise<void> {
  await ctx.pool.query(
    `
      UPDATE dentos_runtime.clinic_gateways
      SET read_only_at = COALESCE(read_only_at, clock_timestamp()),
          updated_at = clock_timestamp()
      WHERE id = $1
    `,
    [ctx.gateway.id],
  );
}

export async function recordSuccessfulCloudSync(ctx: SyncEngineContext): Promise<void> {
  await ctx.pool.query(
    `
      UPDATE dentos_runtime.clinic_gateways
      SET last_successful_cloud_sync_at = clock_timestamp(),
          offline_started_at = NULL,
          read_only_at = NULL,
          updated_at = clock_timestamp()
      WHERE id = $1
    `,
    [ctx.gateway.id],
  );
}
