import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildAgingBuckets,
  calculateFeeStatementLine,
  calculateFeeStatementTotals,
  calculatePatientExposure,
  reconcileCentVariance,
  validateCollectionReceiptTenders,
  validateDiscountCeiling,
  validateFeeAllocation,
  validateFeeStatementIssue,
  validateRefundAmount,
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

  it("validates split tender totals", () => {
    const result = validateCollectionReceiptTenders({
      grossCollected: 1000,
      tenders: [{ amount: 600 }, { amount: 400 }],
    });
    assert.equal(result.ok, true);
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

  it("blocks refunds above available balance", () => {
    const result = validateRefundAmount({ refundAmount: 500, availableOnReceipt: 400 });
    assert.equal(result.ok, false);
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

  it("builds aging buckets from due dates", () => {
    const buckets = buildAgingBuckets(
      [{ dueDate: "2026-07-22", outstandingTotal: 100 }, { dueDate: "2026-07-01", outstandingTotal: 200 }],
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
});
