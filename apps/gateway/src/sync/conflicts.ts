import { detectFieldConflict, mergeIndependentFields, type ConflictResolutionAction, type FieldConflictInput } from "@klickit/sync-contracts";
import type { DatabasePoolLike } from "../db/client.js";

export interface StoredConflict {
  id: string;
  aggregateType: string;
  aggregateId: string;
  fieldName: string;
  localValue: unknown;
  cloudValue: unknown;
  status: "open" | "resolved" | "dismissed";
}

export async function createFieldConflict(
  pool: DatabasePoolLike,
  input: FieldConflictInput & {
    organizationId: string;
    clinicId: string;
    gatewayId: string;
    createdBy?: string;
  },
): Promise<string | null> {
  if (!detectFieldConflict(input)) {
    return null;
  }

  const id = crypto.randomUUID();
  await pool.query(
    `
      INSERT INTO dentos_runtime.sync_conflicts (
        id, organization_id, clinic_id, gateway_id,
        aggregate_type, aggregate_id, field_name,
        local_value_json, cloud_value_json, base_version, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `,
    [
      id,
      input.organizationId,
      input.clinicId,
      input.gatewayId,
      input.aggregateType,
      input.aggregateId,
      input.fieldName,
      JSON.stringify(input.localValue ?? null),
      JSON.stringify(input.cloudValue ?? null),
      input.baseVersion ?? null,
      input.createdBy ?? null,
    ],
  );
  return id;
}

export async function listOpenConflicts(
  pool: DatabasePoolLike,
  clinicId: string,
): Promise<StoredConflict[]> {
  const result = await pool.query<{
    id: string;
    aggregate_type: string;
    aggregate_id: string;
    field_name: string;
    local_value_json: unknown;
    cloud_value_json: unknown;
    status: "open" | "resolved" | "dismissed";
  }>(
    `
      SELECT id, aggregate_type, aggregate_id, field_name, local_value_json, cloud_value_json, status
      FROM dentos_runtime.sync_conflicts
      WHERE clinic_id = $1 AND status = 'open'
      ORDER BY detected_at ASC
    `,
    [clinicId],
  );

  return result.rows.map((row) => ({
    id: row.id,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    fieldName: row.field_name,
    localValue: row.local_value_json,
    cloudValue: row.cloud_value_json,
    status: row.status,
  }));
}

export async function resolveConflict(
  pool: DatabasePoolLike,
  input: {
    conflictId: string;
    resolutionAction: ConflictResolutionAction;
    resolvedValue?: unknown;
    resolvedBy: string;
    reason: string;
  },
): Promise<void> {
  await pool.query(
    `
      INSERT INTO dentos_runtime.sync_conflict_resolutions (
        id, conflict_id, resolution_action, resolved_value_json, resolved_by, reason
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `,
    [
      crypto.randomUUID(),
      input.conflictId,
      input.resolutionAction,
      JSON.stringify(input.resolvedValue ?? null),
      input.resolvedBy,
      input.reason,
    ],
  );

  await pool.query(
    `
      UPDATE dentos_runtime.sync_conflicts
      SET status = 'resolved'
      WHERE id = $1
    `,
    [input.conflictId],
  );
}

export async function queueDuplicateCandidate(
  pool: DatabasePoolLike,
  input: {
    organizationId: string;
    clinicId: string;
    patientIdA: string;
    patientIdB: string;
    matchSignals: readonly string[];
  },
): Promise<string> {
  const id = crypto.randomUUID();
  await pool.query(
    `
      INSERT INTO dentos_runtime.sync_conflicts (
        id, organization_id, clinic_id, gateway_id,
        aggregate_type, aggregate_id, field_name,
        local_value_json, cloud_value_json, status
      ) VALUES (
        $1, $2, $3,
        (SELECT id FROM dentos_runtime.clinic_gateways WHERE clinic_id = $3 AND active = true LIMIT 1),
        'patient_duplicate', $4, 'duplicate_candidate',
        $5::jsonb, $6::jsonb, 'open'
      )
    `,
    [
      id,
      input.organizationId,
      input.clinicId,
      input.patientIdA,
      JSON.stringify({ patientId: input.patientIdA, signals: input.matchSignals }),
      JSON.stringify({ patientId: input.patientIdB }),
    ],
  );
  return id;
}

export async function recordAppointmentCollisionWarning(
  pool: DatabasePoolLike,
  input: {
    organizationId: string;
    clinicId: string;
    patientId: string;
    appointmentIdA: string;
    appointmentIdB: string;
    clinicIdA: string;
    clinicIdB: string;
  },
): Promise<string> {
  const id = crypto.randomUUID();
  await pool.query(
    `
      INSERT INTO dentos_runtime.sync_conflicts (
        id, organization_id, clinic_id, gateway_id,
        aggregate_type, aggregate_id, field_name,
        local_value_json, cloud_value_json, status
      ) VALUES (
        $1, $2, $3,
        (SELECT id FROM dentos_runtime.clinic_gateways WHERE clinic_id = $3 AND active = true LIMIT 1),
        'appointment_collision', $4, 'collision_warning',
        $5::jsonb, $6::jsonb, 'open'
      )
    `,
    [
      id,
      input.organizationId,
      input.clinicId,
      input.patientId,
      JSON.stringify({ appointmentId: input.appointmentIdA, clinicId: input.clinicIdA }),
      JSON.stringify({ appointmentId: input.appointmentIdB, clinicId: input.clinicIdB }),
    ],
  );
  return id;
}

export { mergeIndependentFields };
