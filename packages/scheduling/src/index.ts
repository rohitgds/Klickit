export type CareBookingState =
  | "scheduled"
  | "confirmed"
  | "arrived"
  | "cancelled"
  | "no_show"
  | "completed";

export type EncounterFlowState = "waiting" | "checked_in" | "engaged" | "checked_out" | "cancelled";

export type SchedulerViewType = "month" | "week" | "day" | "resource";

const BOOKING_TRANSITIONS: Readonly<
  Record<string, readonly { to: CareBookingState; reasonPrefix?: string }[]>
> = {
  "null:scheduled": [{ to: "scheduled" }],
  "scheduled:confirmed": [{ to: "confirmed" }],
  "confirmed:scheduled": [{ to: "scheduled" }],
  "scheduled:arrived": [{ to: "arrived" }],
  "confirmed:arrived": [{ to: "arrived" }],
  "scheduled:cancelled": [{ to: "cancelled" }],
  "confirmed:cancelled": [{ to: "cancelled" }],
  "scheduled:no_show": [{ to: "no_show" }],
  "confirmed:no_show": [{ to: "no_show" }],
  "arrived:completed": [{ to: "completed" }],
  "cancelled:scheduled": [{ to: "scheduled" }],
  "no_show:scheduled": [{ to: "scheduled" }],
};

const ENCOUNTER_TRANSITIONS: Readonly<Record<string, readonly EncounterFlowState[]>> = {
  "waiting:checked_in": ["checked_in"],
  "waiting:engaged": ["engaged"],
  "waiting:cancelled": ["cancelled"],
  "checked_in:engaged": ["engaged"],
  "checked_in:cancelled": ["cancelled"],
  "checked_in:checked_out": ["checked_out"],
  "engaged:checked_out": ["checked_out"],
  "engaged:checked_in": ["checked_in"],
  "checked_out:engaged": ["engaged"],
};

export function validateBookingTransition(input: {
  fromStatus: CareBookingState | null;
  toStatus: CareBookingState;
  reason: string;
  allowTerminalCorrection?: boolean;
}): { ok: true } | { ok: false; code: string; message: string } {
  if (!input.reason.trim()) {
    return { ok: false, code: "REASON_REQUIRED", message: "Transition reason is required" };
  }

  const key = `${input.fromStatus ?? "null"}:${input.toStatus}`;
  const allowed = BOOKING_TRANSITIONS[key];
  if (!allowed) {
    if (
      input.allowTerminalCorrection &&
      (input.fromStatus === "cancelled" || input.fromStatus === "no_show") &&
      input.toStatus === "scheduled"
    ) {
      return { ok: true };
    }
    return {
      ok: false,
      code: "CARE_BOOKING_STATUS_TRANSITION_INVALID",
      message: `Transition from ${input.fromStatus ?? "null"} to ${input.toStatus} is not allowed`,
    };
  }
  return { ok: true };
}

export function validateEncounterTransition(input: {
  fromStatus: EncounterFlowState;
  toStatus: EncounterFlowState;
  reason?: string;
  allowDirectEngage?: boolean;
  allowCorrection?: boolean;
}): { ok: true } | { ok: false; code: string; message: string } {
  if (input.fromStatus === "waiting" && input.toStatus === "engaged" && !input.allowDirectEngage) {
    return { ok: false, code: "DIRECT_ENGAGE_NOT_ALLOWED", message: "Clinic does not allow direct engage" };
  }
  if (
    (input.fromStatus === "engaged" && input.toStatus === "checked_in") ||
    (input.fromStatus === "checked_out" && input.toStatus === "engaged")
  ) {
    if (!input.allowCorrection || !input.reason?.trim()) {
      return { ok: false, code: "CORRECTION_DENIED", message: "Correction permission and reason are required" };
    }
    return { ok: true };
  }

  const key = `${input.fromStatus}:${input.toStatus}`;
  const allowed = ENCOUNTER_TRANSITIONS[key];
  if (!allowed?.includes(input.toStatus)) {
    return {
      ok: false,
      code: "ENCOUNTER_STATUS_TRANSITION_INVALID",
      message: `Transition from ${input.fromStatus} to ${input.toStatus} is not allowed`,
    };
  }
  return { ok: true };
}

export function intervalsOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function isActiveBookingStatus(status: CareBookingState): boolean {
  return status === "scheduled" || status === "confirmed" || status === "arrived";
}

export function buildSchedulerViewRange(input: {
  view: SchedulerViewType;
  anchorDate: string;
}): { startsAt: string; endsAt: string } {
  const anchor = new Date(`${input.anchorDate}T00:00:00.000Z`);
  if (Number.isNaN(anchor.getTime())) {
    throw new Error("Invalid anchor date");
  }

  if (input.view === "day" || input.view === "resource") {
    const startsAt = new Date(anchor);
    const endsAt = new Date(anchor);
    endsAt.setUTCDate(endsAt.getUTCDate() + 1);
    return { startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() };
  }

  if (input.view === "week") {
    const weekday = anchor.getUTCDay();
    const startsAt = new Date(anchor);
    startsAt.setUTCDate(startsAt.getUTCDate() - weekday);
    const endsAt = new Date(startsAt);
    endsAt.setUTCDate(endsAt.getUTCDate() + 7);
    return { startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() };
  }

  const startsAt = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
  const endsAt = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 1));
  return { startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() };
}

export function buildKeyboardShortcuts(): readonly { key: string; action: string; description: string }[] {
  return [
    { key: "N", action: "create_booking", description: "Open new care booking form" },
    { key: "R", action: "refresh_view", description: "Refresh scheduler view" },
    { key: "T", action: "jump_today", description: "Jump to today" },
    { key: "Left", action: "previous_interval", description: "Move to previous day/week/month" },
    { key: "Right", action: "next_interval", description: "Move to next day/week/month" },
    { key: "Enter", action: "open_selected_booking", description: "Open selected booking details" },
  ];
}

export interface OperationalDashboardSummary {
  date: string;
  bookingsScheduled: number;
  bookingsConfirmed: number;
  arrivalsExpected: number;
  queueWaiting: number;
  queueEngaged: number;
  noShowsToday: number;
  cancellationsToday: number;
  quickActions: readonly string[];
}

export function buildOperationalDashboardSummary(input: {
  date: string;
  bookingsScheduled: number;
  bookingsConfirmed: number;
  arrivalsExpected: number;
  queueWaiting: number;
  queueEngaged: number;
  noShowsToday: number;
  cancellationsToday: number;
}): OperationalDashboardSummary {
  return {
    ...input,
    quickActions: ["Create Booking", "Unscheduled Encounter", "Refresh Queue", "Register Patient"],
  };
}

export function detectCrossClinicCollision(input: {
  patientId: string;
  clinicIdA: string;
  clinicIdB: string;
  bookingIdA: string;
  bookingIdB: string;
  startsAtA: Date;
  endsAtA: Date;
  startsAtB: Date;
  endsAtB: Date;
}): { collision: boolean; patientId: string; bookingIdA: string; bookingIdB: string } | null {
  if (input.clinicIdA === input.clinicIdB) {
    return null;
  }
  if (!intervalsOverlap(input.startsAtA, input.endsAtA, input.startsAtB, input.endsAtB)) {
    return null;
  }
  return {
    collision: true,
    patientId: input.patientId,
    bookingIdA: input.bookingIdA,
    bookingIdB: input.bookingIdB,
  };
}

export function slotIsWithinWorkingHours(input: {
  weekday: number;
  slotStartMinutes: number;
  slotEndMinutes: number;
  workingHours: readonly { weekday: number; startsLocalMinutes: number; endsLocalMinutes: number; active: boolean }[];
}): boolean {
  const windows = input.workingHours.filter((row) => row.active && row.weekday === input.weekday);
  if (windows.length === 0) {
    return false;
  }
  return windows.some(
    (window) =>
      input.slotStartMinutes >= window.startsLocalMinutes && input.slotEndMinutes <= window.endsLocalMinutes,
  );
}

export function parseLocalTimeToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function bookingDurationMinutes(startsAt: Date, endsAt: Date): number {
  return Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000);
}
