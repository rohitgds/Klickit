import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildEncounterNotesPath,
  buildEncounterWorkspacePath,
  canOpenEncounterWorkspace,
  formatEncounterStatusLabel,
} from "../src/config/clinical.js";
import { buildPatientBalancePath, extractFeeScheduleOptions, formatMoney } from "../src/config/finance.js";
import {
  buildDueTasksPath,
  continuityTaskPatientId,
  filterDueTasksByPatient,
} from "../src/config/comms.js";
import { conflictResolutionLabel, staffTypeLabel } from "../src/config/system.js";

describe("ui modules 6-14 helpers", () => {
  it("builds encounter workspace paths", () => {
    assert.equal(buildEncounterWorkspacePath("enc-1"), "/clinical/encounters/enc-1/workspace");
    assert.equal(buildEncounterNotesPath("enc-1"), "/clinical/encounters/enc-1/notes");
  });

  it("detects workspace-eligible encounter statuses", () => {
    assert.equal(canOpenEncounterWorkspace("engaged"), true);
    assert.equal(canOpenEncounterWorkspace("waiting"), false);
  });

  it("formats encounter status labels", () => {
    assert.equal(formatEncounterStatusLabel("checked_in"), "checked in");
  });

  it("builds finance paths and formats money", () => {
    assert.equal(buildPatientBalancePath("pat-1"), "/finance/patients/pat-1/balance");
    assert.match(formatMoney(1500), /1,500/);
  });

  it("extracts fee schedule options from items", () => {
    const options = extractFeeScheduleOptions([
      { fee_schedule_id: "fs-1", service_name: "Consult" },
      { fee_schedule_id: "fs-1", service_name: "X-Ray" },
      { fee_schedule_id: "fs-2", service_name: "Cleaning" },
    ]);
    assert.equal(options.length, 2);
  });

  it("builds comms task path and filters by patient", () => {
    assert.equal(buildDueTasksPath("2026-07-22"), "/continuity/tasks/due?asOf=2026-07-22");
    const filtered = filterDueTasksByPatient([{ patient_id: "aaaa-bbbb" }], "bbbb");
    assert.equal(filtered.length, 1);
    assert.equal(continuityTaskPatientId({ patient_id: "p1" }), "p1");
  });

  it("labels system configuration helpers", () => {
    assert.equal(conflictResolutionLabel("keep_local"), "Keep local");
    assert.equal(staffTypeLabel("front_office"), "front office");
  });
});
