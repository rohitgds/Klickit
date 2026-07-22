export type DeploymentTarget = "web" | "desktop" | "gateway" | "cloud" | "worker";

export type RuntimeMode = "cloud-online" | "clinic-lan" | "clinic-offline";

export interface AppComponentBoundary {
  id: "web" | "desktop" | "gateway" | "cloud-sync" | "communications";
  name: string;
  deploymentTarget: DeploymentTarget;
  ownsUi: boolean;
  ownsLocalDatabase: boolean;
  ownsCloudSystemOfRecord: boolean;
  responsibilities: readonly string[];
  forbiddenResponsibilities: readonly string[];
}

export const APP_COMPONENT_BOUNDARIES: readonly AppComponentBoundary[] = [
  {
    id: "web",
    name: "KlickIt Web",
    deploymentTarget: "web",
    ownsUi: true,
    ownsLocalDatabase: false,
    ownsCloudSystemOfRecord: false,
    responsibilities: [
      "Shared React/TypeScript/Vite UI",
      "Browser access on clinic LAN or internet",
      "Calls gateway API in clinic mode or cloud API in cloud mode",
    ],
    forbiddenResponsibilities: [
      "Direct PostgreSQL access from the browser",
      "Accounting source of truth",
      "WhatsApp provider credentials in client code",
    ],
  },
  {
    id: "desktop",
    name: "KlickIt Windows Desktop",
    deploymentTarget: "desktop",
    ownsUi: true,
    ownsLocalDatabase: false,
    ownsCloudSystemOfRecord: false,
    responsibilities: [
      "Tauri shell for shared frontend",
      "Desktop install/update boundary",
      "Local/cloud mode selection UI",
    ],
    forbiddenResponsibilities: [
      "Duplicate business rules outside shared packages",
      "Permanent lock-in to one desktop framework without adapter",
    ],
  },
  {
    id: "gateway",
    name: "KlickIt Clinic Gateway",
    deploymentTarget: "gateway",
    ownsUi: false,
    ownsLocalDatabase: true,
    ownsCloudSystemOfRecord: false,
    responsibilities: [
      "Local Fastify API on clinic LAN",
      "Local PostgreSQL for offline clinic operation",
      "Sync outbox/inbox, local file cache, backup hooks",
      "72-hour offline write policy enforcement at clinic edge",
    ],
    forbiddenResponsibilities: [
      "Replacing cloud as multi-clinic system of record",
      "Blind table-copy synchronization",
      "Last-write-wins conflict resolution",
    ],
  },
  {
    id: "cloud-sync",
    name: "Supabase Cloud System of Record",
    deploymentTarget: "cloud",
    ownsUi: false,
    ownsLocalDatabase: false,
    ownsCloudSystemOfRecord: true,
    responsibilities: [
      "Cloud PostgreSQL authoritative store across clinics",
      "Cloud object storage for shared files",
      "Auth/session support where selected",
      "Receive and apply idempotent sync events",
    ],
    forbiddenResponsibilities: [
      "Replacing clinic gateway for LAN-only outage operation",
      "Storing provider URLs as permanent business identifiers",
    ],
  },
  {
    id: "communications",
    name: "Pabbly Communications Integration",
    deploymentTarget: "cloud",
    ownsUi: false,
    ownsLocalDatabase: false,
    ownsCloudSystemOfRecord: false,
    responsibilities: [
      "WhatsApp inbox and approved automations via adapter",
      "Webhook ingress with verification",
      "Message metadata and timeline links inside KlickIt",
    ],
    forbiddenResponsibilities: [
      "Embedding full helpdesk UI inside KlickIt for pilot",
      "Patient messaging without consent and approved test recipients in development",
    ],
  },
] as const;

export type DomainModuleId =
  | "identity-access"
  | "practice-directory"
  | "system-configuration"
  | "patient-registry"
  | "scheduler"
  | "clinical-queue"
  | "clinical-records"
  | "care-planning"
  | "medication-studio"
  | "financial-operations"
  | "allocation-ledger"
  | "comms-center"
  | "patient-files"
  | "sync-engine"
  | "resilience-audit"
  | "deep-analytics";

export interface DomainModuleBoundary {
  id: DomainModuleId;
  owner: DeploymentTarget | "shared";
  tablesOwned: boolean;
  commandsOwned: boolean;
  notes: string;
}

export const DOMAIN_MODULE_BOUNDARIES: readonly DomainModuleBoundary[] = [
  { id: "identity-access", owner: "shared", tablesOwned: true, commandsOwned: true, notes: "Users, roles, sessions, device approval" },
  { id: "practice-directory", owner: "shared", tablesOwned: true, commandsOwned: true, notes: "Organizations, clinics, staff" },
  { id: "system-configuration", owner: "shared", tablesOwned: true, commandsOwned: true, notes: "Masters, templates, numbering policies" },
  { id: "patient-registry", owner: "shared", tablesOwned: true, commandsOwned: true, notes: "Patients, duplicates, merge queue" },
  { id: "scheduler", owner: "shared", tablesOwned: true, commandsOwned: true, notes: "Bookings, resources, availability" },
  { id: "clinical-queue", owner: "shared", tablesOwned: true, commandsOwned: true, notes: "Walk-ins, queue transitions, checkout" },
  { id: "clinical-records", owner: "shared", tablesOwned: true, commandsOwned: true, notes: "Encounters, tooth-wise records, note locks" },
  { id: "care-planning", owner: "shared", tablesOwned: true, commandsOwned: true, notes: "Treatment plans, acceptance, estimates" },
  { id: "medication-studio", owner: "shared", tablesOwned: true, commandsOwned: true, notes: "Prescriptions, templates, signing" },
  { id: "financial-operations", owner: "shared", tablesOwned: true, commandsOwned: true, notes: "Fee statements, collections, refunds" },
  { id: "allocation-ledger", owner: "shared", tablesOwned: true, commandsOwned: true, notes: "Allocations, journals, balances" },
  { id: "comms-center", owner: "worker", tablesOwned: true, commandsOwned: true, notes: "Recalls, messaging metadata, automations" },
  { id: "patient-files", owner: "shared", tablesOwned: true, commandsOwned: true, notes: "Images, PDF metadata, resumable sync" },
  { id: "sync-engine", owner: "gateway", tablesOwned: true, commandsOwned: true, notes: "Outbox/inbox, conflicts, cursors" },
  { id: "resilience-audit", owner: "shared", tablesOwned: true, commandsOwned: true, notes: "Audit, backup, health, updater hooks" },
  { id: "deep-analytics", owner: "cloud", tablesOwned: false, commandsOwned: false, notes: "Read models and report registry only; pilot keeps operational subset" },
];

export function getComponentBoundary(id: AppComponentBoundary["id"]) {
  const boundary = APP_COMPONENT_BOUNDARIES.find((item) => item.id === id);
  if (!boundary) {
    throw new Error(`Unknown app component boundary: ${id}`);
  }
  return boundary;
}

export function getDomainModule(id: DomainModuleId) {
  const moduleBoundary = DOMAIN_MODULE_BOUNDARIES.find((item) => item.id === id);
  if (!moduleBoundary) {
    throw new Error(`Unknown domain module: ${id}`);
  }
  return moduleBoundary;
}

export function resolveRuntimeMode(input: {
  gatewayReachable: boolean;
  cloudReachable: boolean;
  offlineHours: number;
}): RuntimeMode {
  if (!input.gatewayReachable && input.cloudReachable) {
    return "cloud-online";
  }
  if (input.gatewayReachable && input.offlineHours <= 72) {
    return input.cloudReachable ? "clinic-lan" : "clinic-offline";
  }
  return "clinic-offline";
}
