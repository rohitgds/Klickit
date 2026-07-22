import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildDashboardMetricRows,
  buildDashboardQueryPath,
  dashboardHasActivity,
  DASHBOARD_QUICK_ACTIONS,
  filterQuickActionsByPermission,
  formatDateParamInTimezone,
} from "../src/config/dashboard.js";

describe("ui module 2 dashboard helpers", () => {
  it("formats operational date as YYYY-MM-DD in clinic timezone", () => {
    const formatted = formatDateParamInTimezone(new Date("2026-07-22T12:00:00.000Z"), "Asia/Kolkata");
    assert.match(formatted, /^\d{4}-\d{2}-\d{2}$/);
  });

  it("builds dashboard query path with encoded date", () => {
    assert.equal(
      buildDashboardQueryPath("2026-07-22"),
      "/dashboard/operational/daily?date=2026-07-22",
    );
  });

  it("builds metric rows from operational summary", () => {
    const rows = buildDashboardMetricRows({
      bookingsScheduled: 3,
      bookingsConfirmed: 2,
      arrivalsExpected: 5,
      queueWaiting: 1,
      queueEngaged: 1,
      noShowsToday: 0,
      cancellationsToday: 0,
    });
    assert.equal(rows.length, 7);
    assert.equal(rows[0]?.label, "Bookings scheduled");
    assert.equal(rows[0]?.value, 3);
  });

  it("detects when dashboard summary has activity", () => {
    assert.equal(
      dashboardHasActivity({
        bookingsScheduled: 0,
        bookingsConfirmed: 0,
        arrivalsExpected: 0,
        queueWaiting: 0,
        queueEngaged: 0,
        noShowsToday: 0,
        cancellationsToday: 0,
      }),
      false,
    );
    assert.equal(
      dashboardHasActivity({
        bookingsScheduled: 1,
        bookingsConfirmed: 0,
        arrivalsExpected: 0,
        queueWaiting: 0,
        queueEngaged: 0,
        noShowsToday: 0,
        cancellationsToday: 0,
      }),
      true,
    );
  });

  it("filters quick actions by permission", () => {
    const filtered = filterQuickActionsByPermission(DASHBOARD_QUICK_ACTIONS, [
      "patient.create",
      "scheduler.create",
    ]);
    assert.equal(filtered.length, 2);
    assert.ok(filtered.some((action) => action.label === "Register Patient"));
    assert.ok(filtered.some((action) => action.label === "Create Booking"));
    assert.equal(filtered.some((action) => action.label === "Record Collection"), false);
  });
});
