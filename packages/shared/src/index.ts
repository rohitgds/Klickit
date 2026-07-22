export const PRODUCT_NAME = "KlickIt" as const;

export const APP_COMPONENTS = [
  "KlickIt Web",
  "KlickIt Windows Desktop",
  "KlickIt Clinic Gateway",
] as const;

export type HealthStatus = "ok" | "degraded" | "error";

export interface HealthResponse {
  product: typeof PRODUCT_NAME;
  component: string;
  status: HealthStatus;
  timestamp: string;
}

export function createHealthResponse(component: string, status: HealthStatus = "ok"): HealthResponse {
  return {
    product: PRODUCT_NAME,
    component,
    status,
    timestamp: new Date().toISOString(),
  };
}

export type ClientRuntimeMode = "local-gateway" | "cloud" | "auto";

export type RuntimeIndicator =
  | "local-online"
  | "local-offline"
  | "cloud-online"
  | "read-only-offline-limit";

export interface GatewayDiscoveryRecord {
  product: typeof PRODUCT_NAME;
  service: "clinic-gateway";
  clinicCode: string;
  clinicName: string;
  gatewayId: string;
  gatewayCode: string;
  host: string;
  port: number;
  softwareVersion: string;
}

export function resolveClientApiBase(input: {
  mode: ClientRuntimeMode;
  gatewayUrl?: string;
  cloudUrl?: string;
  discoveredGatewayUrl?: string;
}): string | null {
  if (input.mode === "cloud") {
    return input.cloudUrl ?? null;
  }
  if (input.mode === "local-gateway") {
    return input.gatewayUrl ?? input.discoveredGatewayUrl ?? "http://127.0.0.1:8787";
  }
  return input.discoveredGatewayUrl ?? input.gatewayUrl ?? input.cloudUrl ?? "http://127.0.0.1:8787";
}

export function mapRuntimeIndicator(input: {
  gatewayReachable: boolean;
  cloudReachable: boolean;
  offlineHours: number;
  readOnly: boolean;
}): RuntimeIndicator {
  if (input.readOnly || input.offlineHours > 72) {
    return "read-only-offline-limit";
  }
  if (input.gatewayReachable && !input.cloudReachable) {
    return "local-offline";
  }
  if (input.gatewayReachable && input.cloudReachable) {
    return "local-online";
  }
  return "cloud-online";
}

export async function discoverGateway(baseUrl: string): Promise<GatewayDiscoveryRecord | null> {
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/discovery`);
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as GatewayDiscoveryRecord;
  } catch {
    return null;
  }
}
