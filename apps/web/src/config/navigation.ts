export interface PilotNavItem {
  label: string;
  to: string;
  permission: string;
  moduleRef: string;
  end?: boolean;
}

export const PILOT_NAV_ITEMS: PilotNavItem[] = [
  { label: "Dashboard", to: "/dashboard", permission: "scheduler.view", moduleRef: "UI-DSH-001", end: true },
  { label: "Clinical Queue", to: "/clinical-queue", permission: "queue.view", moduleRef: "UI-QUE-001" },
  { label: "Scheduler", to: "/scheduler", permission: "scheduler.view", moduleRef: "UI-SCH-001" },
  { label: "Patient Registry", to: "/patient-registry", permission: "patient.view", moduleRef: "UI-PAT-001" },
  { label: "Financial Operations", to: "/financial-operations", permission: "fee_statement.view", moduleRef: "UI-FIN-001" },
  { label: "Comms Center", to: "/comms-center", permission: "message.view", moduleRef: "UI-COM-001" },
  { label: "System Configuration", to: "/system-configuration", permission: "configuration.practice.view", moduleRef: "UI-CFG-001" },
];

export function filterNavItemsByPermission(
  items: PilotNavItem[],
  permissionCodes: readonly string[],
): PilotNavItem[] {
  return items.filter((item) => permissionCodes.includes(item.permission));
}

export const MODULE_PLACEHOLDERS: Record<string, { title: string; description: string; nextModule: string }> = {
  "/dashboard": {
    title: "Dashboard",
    description: "Operational summary and quick actions will appear here in UI Module 2.",
    nextModule: "Dashboard",
  },
  "/clinical-queue": {
    title: "Clinical Queue",
    description: "Arrival, admission, chair flow and checkout will be built in UI Module 5.",
    nextModule: "Clinical Queue",
  },
  "/scheduler": {
    title: "Scheduler",
    description: "Calendar booking views will be built in UI Module 4.",
    nextModule: "Scheduler",
  },
  "/patient-registry": {
    title: "Patient Registry",
    description: "Search, registration and duplicate warnings will be built in UI Module 3.",
    nextModule: "Patient Registry",
  },
  "/financial-operations": {
    title: "Financial Operations",
    description: "Fee statements, collections and allocations will be built in UI Module 9.",
    nextModule: "Financial Operations",
  },
  "/comms-center": {
    title: "Comms Center",
    description: "Recalls, templates and message status will be built in UI Module 10.",
    nextModule: "Recall and Communications",
  },
  "/system-configuration": {
    title: "System Configuration",
    description: "Staff, access and clinic setup screens will be built in UI Module 12.",
    nextModule: "Settings and Permissions",
  },
};

export function mapClinicConfigToSyncStatus(config: {
  databaseConnected: boolean;
  offlinePolicy: { readOnly: boolean };
  cloudSyncUrl: string | null;
}): "online" | "local-offline" | "read-only" | "disconnected" {
  if (!config.databaseConnected) {
    return "disconnected";
  }
  if (config.offlinePolicy.readOnly) {
    return "read-only";
  }
  if (!config.cloudSyncUrl) {
    return "local-offline";
  }
  return "online";
}
