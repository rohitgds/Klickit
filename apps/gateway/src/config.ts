export interface GatewayConfig {
  host: string;
  port: number;
  clinicCode: string;
  gatewayCode: string;
  databaseUrl: string;
  lanDiscoveryEnabled: boolean;
  cloudSyncUrl: string | null;
  logLevel: "info" | "debug" | "warn" | "error";
  serviceName: string;
  softwareVersion: string;
  allowDevSessionBootstrap: boolean;
}

export function loadGatewayConfig(env: NodeJS.ProcessEnv = process.env): GatewayConfig {
  const appEnv = env.APP_ENV ?? "local";
  return {
    host: env.GATEWAY_HOST ?? "127.0.0.1",
    port: Number(env.GATEWAY_PORT ?? 8787),
    clinicCode: env.KLICKIT_CLINIC_CODE ?? "DEV",
    gatewayCode: env.KLICKIT_GATEWAY_CODE ?? "DEV-GW-01",
    databaseUrl:
      env.GATEWAY_DATABASE_URL ??
      env.DATABASE_URL ??
      "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
    lanDiscoveryEnabled: (env.GATEWAY_LAN_DISCOVERY ?? "true").toLowerCase() !== "false",
    cloudSyncUrl: env.KLICKIT_CLOUD_SYNC_URL ?? null,
    logLevel: (env.GATEWAY_LOG_LEVEL as GatewayConfig["logLevel"]) ?? "info",
    serviceName: "KlickIt Clinic Gateway",
    softwareVersion: env.KLICKIT_SOFTWARE_VERSION ?? "0.0.0",
    allowDevSessionBootstrap: appEnv === "local",
  };
}
