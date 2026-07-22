export interface DashboardMetricRow {
  key: string;
  label: string;
  value: number;
}

export interface DashboardQuickAction {
  label: string;
  permission: string;
  route: string;
  targetModule: string;
}

export const DASHBOARD_QUICK_ACTIONS: readonly DashboardQuickAction[] = [
  {
    label: "Register Patient",
    permission: "patient.create",
    route: "/patient-registry",
    targetModule: "UI Module 3",
  },
  {
    label: "Add to Clinical Queue",
    permission: "queue.admit",
    route: "/clinical-queue",
    targetModule: "UI Module 5",
  },
  {
    label: "Create Booking",
    permission: "scheduler.create",
    route: "/scheduler",
    targetModule: "UI Module 4",
  },
  {
    label: "Record Collection",
    permission: "collection.create",
    route: "/financial-operations",
    targetModule: "UI Module 9",
  },
];

export function formatDateParamInTimezone(date: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

export function buildDashboardMetricRows(summary: {
  bookingsScheduled: number;
  bookingsConfirmed: number;
  arrivalsExpected: number;
  queueWaiting: number;
  queueEngaged: number;
  noShowsToday: number;
  cancellationsToday: number;
}): DashboardMetricRow[] {
  return [
    { key: "bookingsScheduled", label: "Bookings scheduled", value: summary.bookingsScheduled },
    { key: "bookingsConfirmed", label: "Bookings confirmed", value: summary.bookingsConfirmed },
    { key: "arrivalsExpected", label: "Arrivals expected", value: summary.arrivalsExpected },
    { key: "queueWaiting", label: "Queue waiting", value: summary.queueWaiting },
    { key: "queueEngaged", label: "Queue engaged", value: summary.queueEngaged },
    { key: "noShowsToday", label: "No-shows today", value: summary.noShowsToday },
    { key: "cancellationsToday", label: "Cancellations today", value: summary.cancellationsToday },
  ];
}

export function filterQuickActionsByPermission(
  actions: readonly DashboardQuickAction[],
  permissionCodes: readonly string[],
): DashboardQuickAction[] {
  return actions.filter((action) => permissionCodes.includes(action.permission));
}

export function dashboardHasActivity(summary: {
  bookingsScheduled: number;
  bookingsConfirmed: number;
  arrivalsExpected: number;
  queueWaiting: number;
  queueEngaged: number;
  noShowsToday: number;
  cancellationsToday: number;
}): boolean {
  return buildDashboardMetricRows(summary).some((row) => row.value > 0);
}

export function buildDashboardQueryPath(date: string): string {
  return `/dashboard/operational/daily?date=${encodeURIComponent(date)}`;
}
