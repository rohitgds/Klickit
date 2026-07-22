import type { DatabasePoolLike } from "../src/db/client.js";
import type { ClinicBootstrap } from "../src/db/client.js";

export const TEST_BOOTSTRAP: ClinicBootstrap = {
  clinic: {
    id: "22222222-2222-4222-8222-222222222222",
    organizationId: "11111111-1111-4111-8111-111111111111",
    clinicCode: "DEV",
    name: "Development Clinic",
    timezone: "Asia/Kolkata",
    active: true,
  },
  gateway: {
    id: "44444444-4444-4444-8444-444444444444",
    organizationId: "11111111-1111-4111-8111-111111111111",
    clinicId: "22222222-2222-4222-8222-222222222222",
    gatewayCode: "DEV-GW-01",
    hostname: "test-host",
    softwareVersion: "0.0.0",
    lastSuccessfulCloudSyncAt: new Date().toISOString(),
    offlineStartedAt: null,
    readOnlyAt: null,
    active: true,
  },
};

type QueryHandler = (sql: string, params?: readonly unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount: number }>;

export function createMockPool(handler?: QueryHandler): DatabasePoolLike {
  const defaultHandler: QueryHandler = async (sql) => {
    if (sql.includes("SELECT 1")) {
      return { rows: [{ ok: 1 }], rowCount: 1 };
    }
    if (sql.includes("sync_outbox_events") && sql.includes("INSERT")) {
      return { rows: [], rowCount: 1 };
    }
    if (sql.includes("sync_outbox_events") && sql.includes("SELECT id")) {
      return { rows: [], rowCount: 0 };
    }
    if (sql.includes("sync_outbox_events") && sql.includes("SELECT *")) {
      return { rows: [], rowCount: 0 };
    }
    if (sql.includes("sync_inbox_events")) {
      return { rows: [], rowCount: 0 };
    }
    if (sql.includes("sync_cursors")) {
      return { rows: [], rowCount: 0 };
    }
    if (sql.includes("sync_conflicts")) {
      return { rows: [], rowCount: 0 };
    }
    if (sql.includes("approved_devices")) {
      return { rows: [], rowCount: 0 };
    }
    if (sql.includes("UPDATE dentos_runtime.clinic_gateways")) {
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };

  const run = handler ?? defaultHandler;
  return {
    query: run,
    async end() {},
  };
}
