import type { SchedulerViewType } from "@klickit/scheduling";
import { apiFetch } from "./client.js";
import {
  buildSchedulerViewPath,
  type BookingCreateInput,
  type BookingTransitionInput,
} from "../config/scheduling.js";
import type {
  AvailabilityResponse,
  CareBooking,
  SchedulingMasters,
  SchedulerViewResponse,
  StaffMember,
} from "./types.js";

export async function fetchSchedulingMasters(token: string): Promise<SchedulingMasters> {
  return apiFetch<SchedulingMasters>("/scheduling/masters", {}, token);
}

export async function fetchSchedulerView(
  token: string,
  input: {
    viewType: SchedulerViewType;
    date: string;
    chairId?: string;
    leadClinicianId?: string;
  },
): Promise<SchedulerViewResponse> {
  return apiFetch<SchedulerViewResponse>(buildSchedulerViewPath(input), {}, token);
}

export async function fetchStaff(token: string): Promise<{ staff: StaffMember[] }> {
  const response = await apiFetch<{
    staff: Array<{
      id: string;
      display_name: string;
      staff_type: string | null;
      active: boolean | null;
    }>;
  }>("/identity/staff", {}, token);
  return {
    staff: response.staff.map((row) => ({
      id: row.id,
      displayName: row.display_name,
      staffType: row.staff_type,
      active: row.active ?? true,
    })),
  };
}

export async function createBooking(token: string, body: BookingCreateInput): Promise<{ id: string; status: string }> {
  return apiFetch<{ id: string; status: string }>(
    "/scheduling/bookings",
    { method: "POST", body: JSON.stringify(body) },
    token,
  );
}

export async function confirmBooking(token: string, bookingId: string, reason?: string): Promise<CareBooking> {
  return apiFetch<CareBooking>(
    `/scheduling/bookings/${encodeURIComponent(bookingId)}/confirm`,
    { method: "POST", body: JSON.stringify({ reason: reason ?? "PATIENT_CORE" }) },
    token,
  );
}

export async function cancelBooking(token: string, bookingId: string, reason: string): Promise<CareBooking> {
  return apiFetch<CareBooking>(
    `/scheduling/bookings/${encodeURIComponent(bookingId)}/cancel`,
    { method: "POST", body: JSON.stringify({ reason }) },
    token,
  );
}

export async function markBookingNoShow(token: string, bookingId: string, reason: string): Promise<CareBooking> {
  return apiFetch<CareBooking>(
    `/scheduling/bookings/${encodeURIComponent(bookingId)}/no-show`,
    { method: "POST", body: JSON.stringify({ reason }) },
    token,
  );
}

export async function rescheduleBooking(
  token: string,
  bookingId: string,
  body: BookingTransitionInput,
): Promise<CareBooking> {
  return apiFetch<CareBooking>(
    `/scheduling/bookings/${encodeURIComponent(bookingId)}/reschedule`,
    { method: "POST", body: JSON.stringify(body) },
    token,
  );
}

export async function fetchBookingHistory(
  token: string,
  bookingId: string,
): Promise<{ history: Array<Record<string, unknown>> }> {
  return apiFetch<{ history: Array<Record<string, unknown>> }>(
    `/scheduling/bookings/${encodeURIComponent(bookingId)}/history`,
    {},
    token,
  );
}

export async function fetchAvailability(
  token: string,
  input: { startsAt: string; endsAt: string; chairId?: string; leadClinicianId?: string },
): Promise<AvailabilityResponse> {
  const params = new URLSearchParams({
    startsAt: input.startsAt,
    endsAt: input.endsAt,
  });
  if (input.chairId) {
    params.set("chairId", input.chairId);
  }
  if (input.leadClinicianId) {
    params.set("leadClinicianId", input.leadClinicianId);
  }
  return apiFetch<AvailabilityResponse>(`/scheduling/availability?${params.toString()}`, {}, token);
}

export async function createBlackout(
  token: string,
  body: {
    startsAt: string;
    endsAt: string;
    reason: string;
    chairId?: string;
    clinicianId?: string;
  },
): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(
    "/scheduling/blackouts",
    { method: "POST", body: JSON.stringify(body) },
    token,
  );
}
