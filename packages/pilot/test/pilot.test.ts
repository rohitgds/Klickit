import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildAcceptanceEvidence,
  describeShalimarExpansionPlan,
  evaluateDailyReconciliation,
  evaluateGoLiveChecklist,
  GO_LIVE_CHECKLIST_ITEMS,
  validateProductionGate,
} from "../src/index.js";

describe("@klickit/pilot", () => {
  it("requires every go-live checklist item", () => {
    const partial = evaluateGoLiveChecklist({ backup_drill_passed: true });
    assert.equal(partial.ready, false);
    assert.equal(partial.incomplete.length, GO_LIVE_CHECKLIST_ITEMS.length - 1);
  });

  it("opens production gate only with checklist and approval", () => {
    const blocked = validateProductionGate({
      appEnv: "local",
      productionApproved: true,
      checklistReady: true,
    });
    assert.equal(blocked.allowed, false);

    const allowed = validateProductionGate({
      appEnv: "production",
      productionApproved: true,
      checklistReady: true,
    });
    assert.equal(allowed.allowed, true);
  });

  it("requires zero daily reconciliation variance", () => {
    const ok = evaluateDailyReconciliation({ sourceTotalMinor: 100000, outputTotalMinor: 100000 });
    assert.equal(ok.ok, true);
    const bad = evaluateDailyReconciliation({ sourceTotalMinor: 100000, outputTotalMinor: 99999 });
    assert.equal(bad.ok, false);
  });

  it("blocks acceptance when severity 1/2 issues remain", () => {
    const result = buildAcceptanceEvidence({
      milestone: "Milestone 10",
      scenariosPassed: 10,
      scenariosTotal: 10,
      unresolvedSeverity12: 1,
    });
    assert.equal(result.accepted, false);
  });

  it("describes Shalimar expansion prerequisites", () => {
    const plan = describeShalimarExpansionPlan();
    assert.ok(plan.deliverables.length >= 4);
    assert.ok(plan.gate.length >= 3);
  });
});
