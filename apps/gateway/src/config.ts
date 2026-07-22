export interface GatewayConfig {
  appEnv: string;
  host: string;
  port: number;
  clinicCode: string;
  gatewayCode: string;
  databaseUrl: string;
  lanDiscoveryEnabled: boolean;
  cloudSyncUrl: string | null;
  corsOrigins: string[];
  logLevel: "info" | "debug" | "warn" | "error";
  serviceName: string;
  softwareVersion: string;
  allowDevSessionBootstrap: boolean;
}

function parseCorsOrigins(raw: string | undefined): string[] {
  if (!raw?.trim()) {
    return [];
  }
  return raw
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function resolveCorsOrigins(appEnv: string, env: NodeJS.ProcessEnv): string[] {
  const configured = parseCorsOrigins(env.GATEWAY_CORS_ORIGINS);
  if (configured.length > 0) {
    return configured;
  }
  if (appEnv === "staging") {
    return ["https://klickit-web-2c63.vercel.app"];
  }
  return [];
}

function resolveGatewayPort(env: NodeJS.ProcessEnv): number {
  const raw = env.PORT ?? env.GATEWAY_PORT ?? "8787";
  const port = Number(raw);
  if (!Number.isFinite(port) || port <= 0) {
    throw new Error(`Invalid gateway port: ${raw}`);
  }
  return port;
}

function defaultGatewayHost(appEnv: string, env: NodeJS.ProcessEnv): string {
  if (env.GATEWAY_HOST) {
    return env.GATEWAY_HOST;
  }
  return appEnv === "local" ? "127.0.0.1" : "0.0.0.0";
}

function defaultLanDiscovery(appEnv: string, env: NodeJS.ProcessEnv): boolean {
  if (env.GATEWAY_LAN_DISCOVERY !== undefined) {
    return env.GATEWAY_LAN_DISCOVERY.toLowerCase() !== "false";
  }
  return appEnv === "local";
}

export function loadGatewayConfig(env: NodeJS.ProcessEnv = process.env): GatewayConfig {
  const appEnv = env.APP_ENV ?? "local";
  return {
    appEnv,
    host: defaultGatewayHost(appEnv, env),
    port: resolveGatewayPort(env),
    clinicCode: env.KLICKIT_CLINIC_CODE ?? "DEV",
    gatewayCode: env.KLICKIT_GATEWAY_CODE ?? "DEV-GW-01",
    databaseUrl:
      env.GATEWAY_DATABASE_URL ??
      env.DATABASE_URL ??
      "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
    lanDiscoveryEnabled: defaultLanDiscovery(appEnv, env),
    cloudSyncUrl: env.KLICKIT_CLOUD_SYNC_URL ?? null,
    corsOrigins: resolveCorsOrigins(appEnv, env),
    logLevel: (env.GATEWAY_LOG_LEVEL as GatewayConfig["logLevel"]) ?? "info",
    serviceName: "KlickIt Clinic Gateway",
    softwareVersion: env.KLICKIT_SOFTWARE_VERSION ?? "0.0.0",
    allowDevSessionBootstrap: appEnv === "local",
  };
}
