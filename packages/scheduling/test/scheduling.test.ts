import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildKeyboardShortcuts,
  buildOperationalDashboardSummary,
  buildSchedulerViewRange,
  detectCrossClinicCollision,
  intervalsOverlap,
  validateBookingTransition,
  validateEncounterTransition,
} from "../src/index.js";

describe("scheduling domain logic", () => {
  it("allows valid care booking transitions", () => {
    assert.deepEqual(
      validateBookingTransition({ fromStatus: null, toStatus: "scheduled", reason: "CARE_BOOKING_CREATED" }),
      { ok: true },
    );
    assert.deepEqual(
      validateBookingTransition({ fromStatus: "scheduled", toStatus: "confirmed", reason: "PATIENT_CORE" }),
      { ok: true },
    );
  });

  it("rejects invalid care booking transitions", () => {
    const result = validateBookingTransition({
      fromStatus: "completed",
      toStatus: "scheduled",
      reason: "INVALID",
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "CARE_BOOKING_STATUS_TRANSITION_INVALID");
    }
  });

  it("detects overlapping intervals", () => {
    const startA = new Date("2026-07-22T09:00:00.000Z");
    const endA = new Date("2026-07-22T09:30:00.000Z");
    const startB = new Date("2026-07-22T09:15:00.000Z");
    const endB = new Date("2026-07-22T10:00:00.000Z");
    assert.equal(intervalsOverlap(startA, endA, startB, endB), true);
  });

  it("builds scheduler view ranges", () => {
    const day = buildSchedulerViewRange({ view: "day", anchorDate: "2026-07-22" });
    assert.ok(day.startsAt.startsWith("2026-07-22"));
    const week = buildSchedulerViewRange({ view: "week", anchorDate: "2026-07-22" });
    assert.ok(new Date(week.endsAt).getTime() > new Date(week.startsAt).getTime());
  });

  it("validates encounter transitions", () => {
    assert.deepEqual(
      validateEncounterTransition({ fromStatus: "waiting", toStatus: "checked_in" }),
      { ok: true },
    );
    const denied = validateEncounterTransition({ fromStatus: "waiting", toStatus: "engaged" });
    assert.equal(denied.ok, false);
  });

  it("detects cross-clinic collisions", () => {
    const collision = detectCrossClinicCollision({
      patientId: "patient-1",
      clinicIdA: "clinic-a",
      clinicIdB: "clinic-b",
      bookingIdA: "booking-a",
      bookingIdB: "booking-b",
      startsAtA: new Date("2026-07-22T09:00:00.000Z"),
      endsAtA: new Date("2026-07-22T09:30:00.000Z"),
      startsAtB: new Date("2026-07-22T09:15:00.000Z"),
      endsAtB: new Date("2026-07-22T10:00:00.000Z"),
    });
    assert.ok(collision);
  });

  it("builds keyboard shortcuts and dashboard summary", () => {
    assert.ok(buildKeyboardShortcuts().length >= 4);
    const summary = buildOperationalDashboardSummary({
      date: "2026-07-22",
      bookingsScheduled: 3,
      bookingsConfirmed: 2,
      arrivalsExpected: 5,
      queueWaiting: 1,
      queueEngaged: 1,
      noShowsToday: 0,
      cancellationsToday: 0,
    });
    assert.equal(summary.quickActions.length, 4);
  });
});
