import { z } from "zod";

export const unscheduledEncounterSchema = z.object({
  patientId: z.string().min(1, "Select a patient"),
  leadClinicianId: z.string().min(1, "Lead clinician is required"),
  reasonId: z.string().min(1, "Reason is required"),
  encounterDate: z.string().min(1, "Operational date is required"),
  chairId: z.string().optional(),
  scheduledTime: z.string().optional(),
});

export type UnscheduledEncounterFormValues = z.infer<typeof unscheduledEncounterSchema>;

export function buildClinicalQueuePath(date: string): string {
  return `/clinical-queue?date=${encodeURIComponent(date)}`;
}

export function formatEncounterStatus(status: string): string {
  return status.replace(/_/g, " ");
}

export function filterEncountersByClinician<
  T extends { leadClinicianId: string },
>(encounters: readonly T[], clinicianId: string): T[] {
  if (!clinicianId) {
    return [...encounters];
  }
  return encounters.filter((encounter) => encounter.leadClinicianId === clinicianId);
}

export function filterEncountersByPatientQuery<
  T extends { patientId: string },
>(encounters: readonly T[], query: string): T[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return [...encounters];
  }
  return encounters.filter((encounter) => encounter.patientId.toLowerCase().includes(trimmed));
}

export function encounterActionAvailability(status: string): {
  canEngage: boolean;
  canRelease: boolean;
  canCheckout: boolean;
} {
  return {
    canEngage: status === "waiting" || status === "checked_in",
    canRelease: status === "engaged",
    canCheckout: status === "checked_in" || status === "engaged",
  };
}
