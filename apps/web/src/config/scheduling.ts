import type { SchedulerViewType } from "@klickit/scheduling";
import { z } from "zod";

export const SCHEDULER_VIEW_OPTIONS: readonly { value: SchedulerViewType; label: string }[] = [
  { value: "month", label: "Month" },
  { value: "week", label: "Week" },
  { value: "day", label: "Day" },
  { value: "resource", label: "Resource Day" },
];

export const bookingCreateSchema = z.object({
  patientMode: z.enum(["registered", "quick"]),
  patientId: z.string().optional(),
  firstNameSnapshot: z.string().optional(),
  lastNameSnapshot: z.string().optional(),
  cellPhoneSnapshot: z.string().optional(),
  bookingDate: z.string().min(1, "Booking date is required"),
  startTime: z.string().min(1, "Start time is required"),
  durationMinutes: z.number().min(5).max(480),
  leadClinicianId: z.string().min(1, "Lead clinician is required"),
  chairId: z.string().min(1, "Chair is required"),
  reasonId: z.string().min(1, "Booking reason is required"),
  comments: z.string().optional(),
});

export type BookingCreateFormValues = z.infer<typeof bookingCreateSchema>;

export interface BookingCreateInput {
  patientId?: string;
  patientKind: "new" | "established";
  firstNameSnapshot?: string;
  lastNameSnapshot?: string;
  cellPhoneSnapshot?: string;
  startsAt: string;
  endsAt: string;
  leadClinicianId: string;
  chairId: string;
  reasonId: string;
  comments?: string;
}

export interface BookingTransitionInput {
  startsAt: string;
  endsAt: string;
  leadClinicianId?: string;
  chairId?: string;
  resetConfirmation?: boolean;
}

export function buildSchedulerViewPath(input: {
  viewType: SchedulerViewType;
  date: string;
  chairId?: string;
  leadClinicianId?: string;
}): string {
  const params = new URLSearchParams({ date: input.date });
  if (input.chairId) {
    params.set("chairId", input.chairId);
  }
  if (input.leadClinicianId) {
    params.set("leadClinicianId", input.leadClinicianId);
  }
  return `/scheduling/views/${input.viewType}?${params.toString()}`;
}

export function shiftSchedulerAnchorDate(
  viewType: SchedulerViewType,
  anchorDate: string,
  direction: -1 | 1,
): string {
  const date = new Date(`${anchorDate}T12:00:00`);
  if (viewType === "month") {
    date.setMonth(date.getMonth() + direction);
  } else if (viewType === "week") {
    date.setDate(date.getDate() + direction * 7);
  } else {
    date.setDate(date.getDate() + direction);
  }
  return date.toISOString().slice(0, 10);
}

export function formatBookingTime(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatBookingDateTime(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function buildBookingIsoRange(
  date: string,
  startTime: string,
  durationMinutes: number,
): { startsAt: string; endsAt: string } {
  const startsAt = new Date(`${date}T${startTime}:00`);
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);
  return { startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() };
}

export function toBookingCreatePayload(values: BookingCreateFormValues): BookingCreateInput {
  const { startsAt, endsAt } = buildBookingIsoRange(
    values.bookingDate,
    values.startTime,
    values.durationMinutes,
  );
  if (values.patientMode === "registered") {
    return {
      patientKind: "established",
      patientId: values.patientId,
      startsAt,
      endsAt,
      leadClinicianId: values.leadClinicianId,
      chairId: values.chairId,
      reasonId: values.reasonId,
      comments: values.comments?.trim() || undefined,
    };
  }
  return {
    patientKind: "new",
    firstNameSnapshot: values.firstNameSnapshot?.trim() || undefined,
    lastNameSnapshot: values.lastNameSnapshot?.trim() || undefined,
    cellPhoneSnapshot: values.cellPhoneSnapshot?.trim() || undefined,
    startsAt,
    endsAt,
    leadClinicianId: values.leadClinicianId,
    chairId: values.chairId,
    reasonId: values.reasonId,
    comments: values.comments?.trim() || undefined,
  };
}

export function groupBookingsByDay<T extends { startsAt: string | null }>(
  bookings: readonly T[],
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const booking of bookings) {
    if (!booking.startsAt) {
      continue;
    }
    const day = booking.startsAt.slice(0, 10);
    const bucket = grouped.get(day) ?? [];
    bucket.push(booking);
    grouped.set(day, bucket);
  }
  return grouped;
}

export function lookupMasterName(
  items: readonly { id: string; name: string | null; code?: string | null }[],
  id: string,
): string {
  const match = items.find((item) => item.id === id);
  if (!match) {
    return id.slice(0, 8);
  }
  return match.name ?? match.code ?? id.slice(0, 8);
}

export function lookupStaffName(staff: readonly { id: string; displayName: string }[], id: string): string {
  const match = staff.find((member) => member.id === id);
  return match?.displayName ?? id.slice(0, 8);
}
