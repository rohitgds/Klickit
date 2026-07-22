import { buildClinicalQueuePath } from "../config/clinicalQueue.js";
import type { UnscheduledEncounterFormValues } from "../config/clinicalQueue.js";
import { apiFetch } from "./client.js";
import type { CareBooking, ClinicalQueueResponse, QueueEncounter } from "./types.js";

export async function fetchClinicalQueue(token: string, date: string): Promise<ClinicalQueueResponse> {
  return apiFetch<ClinicalQueueResponse>(buildClinicalQueuePath(date), {}, token);
}

export async function admitUnscheduledEncounter(
  token: string,
  body: UnscheduledEncounterFormValues,
): Promise<{ id: string; queueSequence: number; status: string }> {
  return apiFetch<{ id: string; queueSequence: number; status: string }>(
    "/clinical-queue/unscheduled",
    { method: "POST", body: JSON.stringify(body) },
    token,
  );
}

export async function checkInBooking(
  token: string,
  bookingId: string,
  encounterDate: string,
): Promise<{ encounterId: string; queueSequence?: number; status?: string; idempotent?: boolean }> {
  return apiFetch<{ encounterId: string; queueSequence?: number; status?: string; idempotent?: boolean }>(
    `/clinical-queue/bookings/${encodeURIComponent(bookingId)}/check-in`,
    { method: "POST", body: JSON.stringify({ encounterDate }) },
    token,
  );
}

export async function engageEncounter(
  token: string,
  encounterId: string,
  allowDirectEngage = true,
): Promise<{ id: string; status: string }> {
  return apiFetch<{ id: string; status: string }>(
    `/clinical-queue/encounters/${encodeURIComponent(encounterId)}/engage`,
    { method: "POST", body: JSON.stringify({ reason: "BEGIN_CARE", allowDirectEngage }) },
    token,
  );
}

export async function releaseEncounter(token: string, encounterId: string): Promise<{ id: string; status: string }> {
  return apiFetch<{ id: string; status: string }>(
    `/clinical-queue/encounters/${encodeURIComponent(encounterId)}/release`,
    { method: "POST", body: JSON.stringify({ reason: "RELEASE_TO_WAITING" }) },
    token,
  );
}

export async function checkoutEncounter(token: string, encounterId: string): Promise<{ id: string; status: string }> {
  return apiFetch<{ id: string; status: string }>(
    `/clinical-queue/encounters/${encodeURIComponent(encounterId)}/checkout`,
    { method: "POST", body: JSON.stringify({ reason: "CHECKOUT" }) },
    token,
  );
}

export type { CareBooking };
