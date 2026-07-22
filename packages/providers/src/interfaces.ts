export type ProviderKind =
  | "database"
  | "object-storage"
  | "auth"
  | "realtime"
  | "job-queue"
  | "messaging"
  | "monitoring"
  | "desktop-shell"
  | "local-gateway"
  | "deployment";

export interface ProviderDescriptor {
  kind: ProviderKind;
  interfaceName: string;
  currentImplementation: string;
  replacementCandidates: readonly string[];
}

export interface DatabaseProvider {
  readonly kind: "database";
  ping(): Promise<{ ok: true; provider: string }>;
}

export interface ObjectStorageProvider {
  readonly kind: "object-storage";
  putObject(input: { key: string; checksum: string }): Promise<{ key: string; provider: string }>;
}

export interface AuthProvider {
  readonly kind: "auth";
  validateSession(token: string): Promise<{ valid: boolean; provider: string }>;
}

export interface RealtimeProvider {
  readonly kind: "realtime";
  publish(channel: string, event: string): Promise<{ delivered: boolean; provider: string }>;
}

export interface JobQueueProvider {
  readonly kind: "job-queue";
  enqueue(jobName: string, payload: Record<string, unknown>): Promise<{ id: string; provider: string }>;
}

export interface MessagingProvider {
  readonly kind: "messaging";
  sendMessage(input: { recipient: string; templateId: string }): Promise<{ queued: boolean; provider: string }>;
}

export interface MonitoringProvider {
  readonly kind: "monitoring";
  recordEvent(name: string, attributes?: Record<string, string>): Promise<{ accepted: boolean; provider: string }>;
}

export interface DesktopShellProvider {
  readonly kind: "desktop-shell";
  launch(mode: "local-gateway" | "cloud"): Promise<{ started: boolean; provider: string }>;
}

export interface LocalGatewayRuntime {
  readonly kind: "local-gateway";
  getHealth(): Promise<{ status: "ok" | "degraded" | "error"; provider: string }>;
}

export interface DeploymentProvider {
  readonly kind: "deployment";
  describeTargets(): Promise<{ targets: readonly string[]; provider: string }>;
}

export interface ProviderRegistry {
  database: DatabaseProvider;
  objectStorage: ObjectStorageProvider;
  auth: AuthProvider;
  realtime: RealtimeProvider;
  jobQueue: JobQueueProvider;
  messaging: MessagingProvider;
  monitoring: MonitoringProvider;
  desktopShell: DesktopShellProvider;
  localGateway: LocalGatewayRuntime;
  deployment: DeploymentProvider;
}

export const PROVIDER_DESCRIPTORS: readonly ProviderDescriptor[] = [
  {
    kind: "database",
    interfaceName: "DatabaseProvider",
    currentImplementation: "Supabase PostgreSQL / local PostgreSQL via gateway",
    replacementCandidates: ["RDS", "Cloud SQL", "Neon", "self-hosted PostgreSQL"],
  },
  {
    kind: "object-storage",
    interfaceName: "ObjectStorageProvider",
    currentImplementation: "Supabase Storage",
    replacementCandidates: ["S3", "R2", "B2", "MinIO"],
  },
  {
    kind: "auth",
    interfaceName: "AuthProvider",
    currentImplementation: "Supabase Auth initially",
    replacementCandidates: ["Keycloak", "Auth0", "Cognito", "custom auth service"],
  },
  {
    kind: "realtime",
    interfaceName: "RealtimeProvider",
    currentImplementation: "Supabase Realtime initially",
    replacementCandidates: ["SSE/WebSocket service", "Ably", "Pusher"],
  },
  {
    kind: "job-queue",
    interfaceName: "JobQueueProvider",
    currentImplementation: "PostgreSQL-backed queue",
    replacementCandidates: ["Graphile Worker", "pg-boss", "managed queue"],
  },
  {
    kind: "messaging",
    interfaceName: "MessagingProvider",
    currentImplementation: "Pabbly Chatflow/Connect adapter",
    replacementCandidates: ["Meta Cloud API", "alternative BSP"],
  },
  {
    kind: "monitoring",
    interfaceName: "MonitoringProvider",
    currentImplementation: "To be selected",
    replacementCandidates: ["OpenTelemetry", "Sentry", "Grafana", "Datadog"],
  },
  {
    kind: "desktop-shell",
    interfaceName: "DesktopShellProvider",
    currentImplementation: "Tauri",
    replacementCandidates: ["Electron", "PWA shell", "native shell"],
  },
  {
    kind: "local-gateway",
    interfaceName: "LocalGatewayRuntime",
    currentImplementation: "Windows service + Fastify + local PostgreSQL",
    replacementCandidates: ["Linux service", "container appliance"],
  },
  {
    kind: "deployment",
    interfaceName: "DeploymentProvider",
    currentImplementation: "GitHub Actions + Vercel + Supabase",
    replacementCandidates: ["GitLab CI", "Cloudflare", "self-hosted deploy"],
  },
];

export function createStubProviderRegistry(provider = "stub"): ProviderRegistry {
  return {
    database: {
      kind: "database",
      async ping() {
        return { ok: true, provider };
      },
    },
    objectStorage: {
      kind: "object-storage",
      async putObject(input) {
        return { key: input.key, provider };
      },
    },
    auth: {
      kind: "auth",
      async validateSession() {
        return { valid: false, provider };
      },
    },
    realtime: {
      kind: "realtime",
      async publish(channel) {
        return { delivered: false, provider: `${provider}:${channel}` };
      },
    },
    jobQueue: {
      kind: "job-queue",
      async enqueue(jobName) {
        return { id: `${jobName}-stub`, provider };
      },
    },
    messaging: {
      kind: "messaging",
      async sendMessage() {
        return { queued: false, provider };
      },
    },
    monitoring: {
      kind: "monitoring",
      async recordEvent(name) {
        return { accepted: true, provider: `${provider}:${name}` };
      },
    },
    desktopShell: {
      kind: "desktop-shell",
      async launch(mode) {
        return { started: false, provider: `${provider}:${mode}` };
      },
    },
    localGateway: {
      kind: "local-gateway",
      async getHealth() {
        return { status: "ok", provider };
      },
    },
    deployment: {
      kind: "deployment",
      async describeTargets() {
        return { targets: ["web", "desktop", "gateway", "cloud"], provider };
      },
    },
  };
}
