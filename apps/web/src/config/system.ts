export type SystemTab = "staff" | "users" | "sync" | "resilience" | "pilot";

export const SYSTEM_TABS: { id: SystemTab; label: string }[] = [
  { id: "staff", label: "Staff" },
  { id: "users", label: "Users" },
  { id: "sync", label: "Sync Conflicts" },
  { id: "resilience", label: "Backup & Recovery" },
  { id: "pilot", label: "Pilot Handover" },
];

export function conflictResolutionLabel(action: string): string {
  switch (action) {
    case "keep_local":
      return "Keep local";
    case "keep_cloud":
      return "Keep cloud";
    case "manual_merge":
      return "Manual merge";
    default:
      return action;
  }
}

export function formatConflictValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "—";
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

export function staffTypeLabel(staffType: string): string {
  return staffType.replaceAll("_", " ");
}
