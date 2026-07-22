import type { GatewayConfig } from "../config.js";

export interface DatabasePoolLike {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<{ rows: T[]; rowCount: number | null }>;
  end(): Promise<void>;
}

export interface ClinicRecord {
  id: string;
  organizationId: string;
  clinicCode: string;
  name: string;
  timezone: string;
  active: boolean;
}

export interface GatewayRecord {
  id: string;
  organizationId: string;
  clinicId: string;
  gatewayCode: string;
  hostname: string | null;
  softwareVersion: string | null;
  lastSuccessfulCloudSyncAt: string | null;
  offlineStartedAt: string | null;
  readOnlyAt: string | null;
  active: boolean;
}

export interface ClinicBootstrap {
  clinic: ClinicRecord;
  gateway: GatewayRecord;
}

export interface DatabaseHealth {
  connected: boolean;
  provider: string;
  latencyMs: number | null;
  error?: string;
}

const DEV_DEFAULT_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

function resolvePoolOptions(databaseUrl: string): { connectionString: string; ssl?: { rejectUnauthorized: false } } {
  const isLocalHost =
    databaseUrl.includes("127.0.0.1") || databaseUrl.includes("localhost");
  if (isLocalHost) {
    return { connectionString: databaseUrl };
  }

  // Supabase/cloud URLs often include sslmode=require, which pg v8 treats as verify-full
  // and conflicts with managed Postgres certificates. Force encrypted but non-verifying SSL.
  const connectionString = databaseUrl.replace(/([?&])sslmode=[^&]*&?/g, (_, prefix) =>
    prefix === "?" ? "?" : prefix,
  ).replace(/[?&]$/, "");
  return { connectionString, ssl: { rejectUnauthorized: false } };
}

export function resolveDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  return env.GATEWAY_DATABASE_URL ?? env.DATABASE_URL ?? DEV_DEFAULT_URL;
}

export async function createDatabasePool(databaseUrl: string): Promise<DatabasePoolLike> {
  const { default: pg } = await import("pg");
  const pool = new pg.Pool({ max: 5, ...resolvePoolOptions(databaseUrl) });
  return {
    async query<T extends Record<string, unknown> = Record<string, unknown>>(
      sql: string,
      params: readonly unknown[] = [],
    ) {
      const result = await pool.query(sql, [...params]);
      return { rows: result.rows as unknown as T[], rowCount: result.rowCount };
    },
    async end() {
      await pool.end();
    },
  };
}

export async function pingDatabase(pool: DatabasePoolLike): Promise<DatabaseHealth> {
  const started = Date.now();
  try {
    await pool.query("SELECT 1 AS ok");
    return {
      connected: true,
      provider: "postgresql",
      latencyMs: Date.now() - started,
    };
  } catch (error) {
    return {
      connected: false,
      provider: "postgresql",
      latencyMs: null,
      error: error instanceof Error ? error.message : "Unknown database error",
    };
  }
}

export async function loadClinicBootstrap(
  pool: DatabasePoolLike,
  config: GatewayConfig,
): Promise<ClinicBootstrap | null> {
  const result = await pool.query<{
    clinic_id: string;
    organization_id: string;
    clinic_code: string;
    clinic_name: string;
    timezone: string;
    clinic_active: boolean;
    gateway_id: string;
    gateway_code: string;
    hostname: string | null;
    software_version: string | null;
    last_successful_cloud_sync_at: string | null;
    offline_started_at: string | null;
    read_only_at: string | null;
    gateway_active: boolean;
  }>(
    `
      SELECT
        c.id AS clinic_id,
        c.organization_id,
        c.clinic_code,
        c.name AS clinic_name,
        c.timezone,
        c.active AS clinic_active,
        g.id AS gateway_id,
        g.gateway_code,
        g.hostname,
        g.software_version,
        g.last_successful_cloud_sync_at,
        g.offline_started_at,
        g.read_only_at,
        g.active AS gateway_active
      FROM dentos_data.clinics c
      JOIN dentos_runtime.clinic_gateways g ON g.clinic_id = c.id
      WHERE c.clinic_code = $1
        AND g.gateway_code = $2
        AND c.active = true
        AND g.active = true
      LIMIT 1
    `,
    [config.clinicCode, config.gatewayCode],
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return {
    clinic: {
      id: row.clinic_id,
      organizationId: row.organization_id,
      clinicCode: row.clinic_code,
      name: row.clinic_name,
      timezone: row.timezone,
      active: row.clinic_active,
    },
    gateway: {
      id: row.gateway_id,
      organizationId: row.organization_id,
      clinicId: row.clinic_id,
      gatewayCode: row.gateway_code,
      hostname: row.hostname,
      softwareVersion: row.software_version,
      lastSuccessfulCloudSyncAt: row.last_successful_cloud_sync_at,
      offlineStartedAt: row.offline_started_at,
      readOnlyAt: row.read_only_at,
      active: row.gateway_active,
    },
  };
}

export async function touchGatewayHeartbeat(pool: DatabasePoolLike, gatewayId: string, hostname: string) {
  await pool.query(
    `
      UPDATE dentos_runtime.clinic_gateways
      SET last_seen_at = clock_timestamp(),
          hostname = $2,
          updated_at = clock_timestamp()
      WHERE id = $1
    `,
    [gatewayId, hostname],
  );
}
