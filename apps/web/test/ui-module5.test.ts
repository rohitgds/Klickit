import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildClinicalQueuePath,
  encounterActionAvailability,
  filterEncountersByClinician,
  filterEncountersByPatientQuery,
  formatEncounterStatus,
} from "../src/config/clinicalQueue.js";

describe("ui module 5 clinical queue helpers", () => {
  it("builds clinical queue path with date", () => {
    assert.equal(buildClinicalQueuePath("2026-07-22"), "/clinical-queue?date=2026-07-22");
  });

  it("formats encounter status labels", () => {
    assert.equal(formatEncounterStatus("checked_in"), "checked in");
  });

  it("filters encounters by clinician", () => {
    const filtered = filterEncountersByClinician(
      [
        { leadClinicianId: "c1", patientId: "p1" },
        { leadClinicianId: "c2", patientId: "p2" },
      ],
      "c1",
    );
    assert.equal(filtered.length, 1);
  });

  it("filters encounters by patient id fragment", () => {
    const filtered = filterEncountersByPatientQuery(
      [{ patientId: "aaaa-bbbb-cccc", leadClinicianId: "c1" }],
      "bbbb",
    );
    assert.equal(filtered.length, 1);
  });

  it("derives row action availability from status", () => {
    assert.deepEqual(encounterActionAvailability("checked_in"), {
      canEngage: true,
      canRelease: false,
      canCheckout: true,
    });
    assert.deepEqual(encounterActionAvailability("engaged"), {
      canEngage: false,
      canRelease: true,
      canCheckout: true,
    });
  });
});
