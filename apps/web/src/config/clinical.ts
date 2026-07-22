export type EncounterTab =
  | "summary"
  | "notes"
  | "odontogram"
  | "care-plan"
  | "prescription"
  | "files";

export const ENCOUNTER_TABS: { id: EncounterTab; label: string }[] = [
  { id: "summary", label: "Summary" },
  { id: "notes", label: "Clinical Notes" },
  { id: "odontogram", label: "Odontogram" },
  { id: "care-plan", label: "Care Plan" },
  { id: "prescription", label: "Prescription" },
  { id: "files", label: "Files & Print" },
];

export function buildEncounterWorkspacePath(encounterId: string): string {
  return `/clinical/encounters/${encodeURIComponent(encounterId)}/workspace`;
}

export function buildEncounterNotesPath(encounterId: string): string {
  return `/clinical/encounters/${encodeURIComponent(encounterId)}/notes`;
}

export function buildEncounterOdontogramPath(encounterId: string): string {
  return `/clinical/encounters/${encodeURIComponent(encounterId)}/odontogram`;
}

export function formatEncounterStatusLabel(status: string): string {
  return status.replaceAll("_", " ");
}

export function canOpenEncounterWorkspace(status: string): boolean {
  return ["checked_in", "engaged", "released", "completed"].includes(status);
}
