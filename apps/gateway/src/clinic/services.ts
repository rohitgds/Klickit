import type { DatabasePoolLike } from "../db/client.js";
import type { ClinicBootstrap } from "../db/client.js";
import type { GatewayConfig } from "../config.js";

export interface ApprovedDeviceInput {
  organizationId: string;
  clinicId: string;
  gatewayId: string;
  deviceLabel: string;
  deviceFingerprintHash: string;
  approvedBy: string;
}

export async function approveDevice(pool: DatabasePoolLike, input: ApprovedDeviceInput): Promise<string> {
  const id = crypto.randomUUID();
  await pool.query(
    `
      INSERT INTO dentos_runtime.approved_devices (
        id, organization_id, clinic_id, gateway_id,
        device_label, device_fingerprint_hash,
        approved_by, approved_at, active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, clock_timestamp(), true)
      ON CONFLICT (clinic_id, device_fingerprint_hash)
      DO UPDATE SET
        device_label = EXCLUDED.device_label,
        revoked_at = NULL,
        revoked_by = NULL,
        active = true,
        updated_at = clock_timestamp()
      RETURNING id
    `,
    [
      id,
      input.organizationId,
      input.clinicId,
      input.gatewayId,
      input.deviceLabel,
      input.deviceFingerprintHash,
      input.approvedBy,
    ],
  );
  return id;
}

export async function revokeDevice(
  pool: DatabasePoolLike,
  input: { clinicId: string; deviceFingerprintHash: string; revokedBy: string },
): Promise<boolean> {
  const result = await pool.query(
    `
      UPDATE dentos_runtime.approved_devices
      SET active = false,
          revoked_at = clock_timestamp(),
          revoked_by = $3,
          updated_at = clock_timestamp()
      WHERE clinic_id = $1
        AND device_fingerprint_hash = $2
        AND active = true
    `,
    [input.clinicId, input.deviceFingerprintHash, input.revokedBy],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function isDeviceApproved(
  pool: DatabasePoolLike,
  clinicId: string,
  deviceFingerprintHash: string,
): Promise<boolean> {
  const result = await pool.query<{ id: string }>(
    `
      SELECT id
      FROM dentos_runtime.approved_devices
      WHERE clinic_id = $1
        AND device_fingerprint_hash = $2
        AND active = true
        AND revoked_at IS NULL
      LIMIT 1
    `,
    [clinicId, deviceFingerprintHash],
  );
  return Boolean(result.rows[0]);
}

export async function listApprovedDevices(pool: DatabasePoolLike, clinicId: string) {
  const result = await pool.query<{
    id: string;
    device_label: string;
    device_fingerprint_hash: string;
    approved_at: string;
    active: boolean;
  }>(
    `
      SELECT id, device_label, device_fingerprint_hash, approved_at, active
      FROM dentos_runtime.approved_devices
      WHERE clinic_id = $1
      ORDER BY approved_at DESC
    `,
    [clinicId],
  );
  return result.rows;
}

export interface DiscoveryBeacon {
  product: "KlickIt";
  service: "clinic-gateway";
  clinicCode: string;
  clinicName: string;
  gatewayId: string;
  gatewayCode: string;
  host: string;
  port: number;
  softwareVersion: string;
  lanDiscoveryEnabled: boolean;
  timestamp: string;
}

export function buildDiscoveryBeacon(
  config: GatewayConfig,
  bootstrap: ClinicBootstrap,
  advertisedHost: string,
): DiscoveryBeacon {
  return {
    product: "KlickIt",
    service: "clinic-gateway",
    clinicCode: bootstrap.clinic.clinicCode,
    clinicName: bootstrap.clinic.name,
    gatewayId: bootstrap.gateway.id,
    gatewayCode: bootstrap.gateway.gatewayCode,
    host: advertisedHost,
    port: config.port,
    softwareVersion: config.softwareVersion,
    lanDiscoveryEnabled: config.lanDiscoveryEnabled,
    timestamp: new Date().toISOString(),
  };
}

export function resolveAdvertisedHost(config: GatewayConfig, requestHost?: string): string {
  if (config.host === "0.0.0.0" && requestHost) {
    return requestHost.split(":")[0] ?? config.host;
  }
  return config.host;
}

export const DISCOVERY_SERVICE_TYPE = "_klickit-gateway._tcp";

export function buildGatewayBaseUrl(host: string, port: number): string {
  return `http://${host}:${port}`;
}
