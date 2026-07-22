import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildBookingIsoRange,
  buildSchedulerViewPath,
  groupBookingsByDay,
  shiftSchedulerAnchorDate,
  toBookingCreatePayload,
} from "../src/config/scheduling.js";

describe("ui module 4 scheduling helpers", () => {
  it("builds scheduler view path with filters", () => {
    assert.equal(
      buildSchedulerViewPath({
        viewType: "week",
        date: "2026-07-22",
        chairId: "chair-1",
      }),
      "/scheduling/views/week?date=2026-07-22&chairId=chair-1",
    );
  });

  it("shifts anchor date by view interval", () => {
    assert.equal(shiftSchedulerAnchorDate("day", "2026-07-22", 1), "2026-07-23");
    assert.equal(shiftSchedulerAnchorDate("week", "2026-07-22", -1), "2026-07-15");
  });

  it("builds booking iso range from local date and time", () => {
    const range = buildBookingIsoRange("2026-07-22", "10:00", 30);
    assert.ok(range.startsAt.includes("2026"));
    assert.ok(new Date(range.endsAt).getTime() > new Date(range.startsAt).getTime());
  });

  it("groups bookings by day", () => {
    const grouped = groupBookingsByDay([
      { startsAt: "2026-07-22T04:00:00.000Z" },
      { startsAt: "2026-07-23T04:00:00.000Z" },
    ]);
    assert.equal(grouped.get("2026-07-22")?.length, 1);
    assert.equal(grouped.get("2026-07-23")?.length, 1);
  });

  it("maps booking form values to create payload", () => {
    const payload = toBookingCreatePayload({
      patientMode: "quick",
      firstNameSnapshot: "Anita",
      bookingDate: "2026-07-22",
      startTime: "10:00",
      durationMinutes: 30,
      leadClinicianId: "clinician-1",
      chairId: "chair-1",
      reasonId: "reason-1",
    });
    assert.equal(payload.patientKind, "new");
    assert.equal(payload.firstNameSnapshot, "Anita");
    assert.equal(payload.leadClinicianId, "clinician-1");
  });
});
