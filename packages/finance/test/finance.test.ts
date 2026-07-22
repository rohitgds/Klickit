import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildAgingBuckets,
  calculateFeeStatementLine,
  calculateFeeStatementTotals,
  calculatePatientExposure,
  distributeProportionalLineSplits,
  reconcileCentVariance,
  validateCollectionReceiptTenders,
  validateDiscountCeiling,
  validateFeeAllocation,
  validateFeeStatementIssue,
  validateRefundAmount,
  validateRefundBlockedWhenAllocated,
  validateRep001Reconciliation,
} from "../src/index.js";

describe("@klickit/finance", () => {
  it("calculates GST fee statement line totals", () => {
    const line = calculateFeeStatementLine({
      quantity: 1,
      unitFee: 1000,
      lineDiscount: 100,
      cgstRate: 9,
      sgstRate: 9,
    });
    assert.equal(line.taxableAmount, 900);
    assert.equal(line.cgstAmount, 81);
    assert.equal(line.lineTotal, 1062);
  });

  it("aggregates fee statement header totals", () => {
    const line = calculateFeeStatementLine({ quantity: 1, unitFee: 500 });
    const totals = calculateFeeStatementTotals([line]);
    assert.equal(totals.grandTotal, 500);
  });

  it("enforces role discount ceilings", () => {
    const result = validateDiscountCeiling({ lineGross: 1000, requestedDiscount: 200, maxDiscountPercent: 10 });
    assert.equal(result.ok, false);
  });

  it("requires lines before issue", () => {
    const result = validateFeeStatementIssue({ status: "draft", lineCount: 0 });
    assert.equal(result.ok, false);
  });

  it("validates split tender totals (FIN-DEC-06)", () => {
    const single = validateCollectionReceiptTenders({ grossCollected: 1000, tenders: [{ amount: 1000 }] });
    assert.equal(single.ok, true);
    const split = validateCollectionReceiptTenders({
      grossCollected: 1000,
      tenders: [{ amount: 600 }, { amount: 400 }],
    });
    assert.equal(split.ok, true);
    const bad = validateCollectionReceiptTenders({
      grossCollected: 1000,
      tenders: [{ amount: 600 }, { amount: 300 }],
    });
    assert.equal(bad.ok, false);
  });

  it("validates allocation split parity", () => {
    const result = validateFeeAllocation({
      allocationAmount: 500,
      availableOnReceipt: 800,
      outstandingOnStatement: 1000,
      lineSplitTotal: 500,
      tenderSplitTotal: 500,
    });
    assert.equal(result.ok, true);
  });

  it("blocks refunds above unapplied balance (FIN-DEC-05)", () => {
    const result = validateRefundAmount({ refundAmount: 500, availableOnReceipt: 400 });
    assert.equal(result.ok, false);
    const blocked = validateRefundBlockedWhenAllocated({
      refundAmount: 300,
      unappliedTotal: 200,
      appliedTotal: 800,
    });
    assert.equal(blocked.ok, false);
  });

  it("calculates patient open exposure", () => {
    const exposure = calculatePatientExposure({
      assessedTotal: 1000,
      appliedTotal: 400,
      creditTotal: 100,
      writeoffTotal: 0,
    });
    assert.equal(exposure, 500);
  });

  it("builds aging buckets from due dates (FIN-DEC-03)", () => {
    const buckets = buildAgingBuckets(
      [
        { dueDate: "2026-07-22", outstandingTotal: 100 },
        { dueDate: "2026-07-01", outstandingTotal: 200 },
      ],
      "2026-07-22",
    );
    assert.equal(buckets.current, 100);
    assert.equal(buckets.days30, 200);
  });

  it("requires zero reconciliation variance", () => {
    const result = reconcileCentVariance({ sourceTotal: 1000, outputTotal: 1000 });
    assert.equal(result.ok, true);
    const bad = reconcileCentVariance({ sourceTotal: 1000, outputTotal: 999.99 });
    assert.equal(bad.ok, false);
  });

  it("passes REP-001 grid reconciliation fixture", () => {
    const line = calculateFeeStatementLine({ quantity: 1, unitFee: 1000, cgstRate: 9, sgstRate: 9 });
    const totals = calculateFeeStatementTotals([line]);
    const result = validateRep001Reconciliation({
      lineTotals: [line.lineTotal],
      headerGrandTotal: totals.grandTotal,
      journalDebits: [totals.grandTotal],
      journalCredits: [totals.grandTotal],
    });
    assert.equal(result.ok, true);
  });

  it("distributes proportional line splits (FIN-DEC-04)", () => {
    const splits = distributeProportionalLineSplits({
      allocationAmount: 100,
      lines: [
        { lineId: "l1", outstandingAmount: 75 },
        { lineId: "l2", outstandingAmount: 25 },
      ],
    });
    assert.equal(splits.reduce((sum, split) => sum + split.amount, 0), 100);
  });
});
