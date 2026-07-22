export type FeeStatementStatus = "draft" | "issued" | "part_paid" | "paid" | "void";
export type CollectionReceiptStatus = "active" | "void" | "part_refunded" | "refunded";
export type FeeAllocationStatus = "active" | "reversed";

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculateFeeStatementLine(input: {
  quantity: number;
  unitFee: number;
  lineDiscount?: number;
  cgstRate?: number;
  sgstRate?: number;
  igstRate?: number;
}): {
  grossAmount: number;
  discountAmount: number;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  lineTotal: number;
} {
  const grossAmount = roundMoney(input.quantity * input.unitFee);
  const discountAmount = roundMoney(input.lineDiscount ?? 0);
  const taxableAmount = roundMoney(Math.max(0, grossAmount - discountAmount));
  const cgstAmount = roundMoney(taxableAmount * (input.cgstRate ?? 0) / 100);
  const sgstAmount = roundMoney(taxableAmount * (input.sgstRate ?? 0) / 100);
  const igstAmount = roundMoney(taxableAmount * (input.igstRate ?? 0) / 100);
  const lineTotal = roundMoney(taxableAmount + cgstAmount + sgstAmount + igstAmount);
  return { grossAmount, discountAmount, taxableAmount, cgstAmount, sgstAmount, igstAmount, lineTotal };
}

export function calculateFeeStatementTotals(
  lines: readonly ReturnType<typeof calculateFeeStatementLine>[],
  roundOff = 0,
) {
  const subtotal = roundMoney(lines.reduce((sum, line) => sum + line.grossAmount, 0));
  const discountTotal = roundMoney(lines.reduce((sum, line) => sum + line.discountAmount, 0));
  const taxableTotal = roundMoney(lines.reduce((sum, line) => sum + line.taxableAmount, 0));
  const taxTotal = roundMoney(
    lines.reduce((sum, line) => sum + line.cgstAmount + line.sgstAmount + line.igstAmount, 0),
  );
  const grandTotal = roundMoney(taxableTotal + taxTotal + roundOff);
  return { subtotal, discountTotal, taxableTotal, taxTotal, roundOff, grandTotal };
}

export function validateDiscountCeiling(input: {
  lineGross: number;
  requestedDiscount: number;
  maxDiscountPercent: number;
}): { ok: true } | { ok: false; code: string; message: string } {
  const maxAllowed = roundMoney((input.lineGross * input.maxDiscountPercent) / 100);
  if (input.requestedDiscount > maxAllowed) {
    return {
      ok: false,
      code: "DISCOUNT_CEILING_EXCEEDED",
      message: `Discount exceeds role ceiling of ${input.maxDiscountPercent}%`,
    };
  }
  return { ok: true };
}

export function validateFeeStatementIssue(input: {
  status: FeeStatementStatus;
  lineCount: number;
}): { ok: true } | { ok: false; code: string; message: string } {
  if (input.status !== "draft") {
    return { ok: false, code: "NOT_DRAFT", message: "Only draft fee statements can be issued" };
  }
  if (input.lineCount < 1) {
    return { ok: false, code: "NO_LINES", message: "Fee statement requires at least one line" };
  }
  return { ok: true };
}

export function validateFeeStatementStatusTransition(input: {
  fromStatus: FeeStatementStatus;
  toStatus: FeeStatementStatus;
}): { ok: true } | { ok: false; code: string; message: string } {
  const allowed: Record<FeeStatementStatus, FeeStatementStatus[]> = {
    draft: ["issued", "void"],
    issued: ["part_paid", "paid", "void"],
    part_paid: ["paid", "void"],
    paid: ["void"],
    void: [],
  };
  if (!allowed[input.fromStatus]?.includes(input.toStatus)) {
    return {
      ok: false,
      code: "INVALID_FEE_STATEMENT_STATUS",
      message: `Cannot move fee statement from ${input.fromStatus} to ${input.toStatus}`,
    };
  }
  return { ok: true };
}

export function validateCollectionReceiptTenders(input: {
  grossCollected: number;
  tenders: readonly { amount: number }[];
}): { ok: true } | { ok: false; code: string; message: string } {
  if (input.tenders.length < 1) {
    return { ok: false, code: "NO_TENDERS", message: "Collection requires at least one tender" };
  }
  const tenderTotal = roundMoney(input.tenders.reduce((sum, tender) => sum + tender.amount, 0));
  if (tenderTotal !== roundMoney(input.grossCollected)) {
    return {
      ok: false,
      code: "TENDER_TOTAL_MISMATCH",
      message: "Tender amounts must equal gross collected amount",
    };
  }
  return { ok: true };
}

export function validateFeeAllocation(input: {
  allocationAmount: number;
  availableOnReceipt: number;
  outstandingOnStatement: number;
  lineSplitTotal: number;
  tenderSplitTotal: number;
}): { ok: true } | { ok: false; code: string; message: string } {
  if (input.allocationAmount <= 0) {
    return { ok: false, code: "ALLOCATION_AMOUNT_INVALID", message: "Allocation amount must be positive" };
  }
  if (input.allocationAmount > input.availableOnReceipt) {
    return { ok: false, code: "RECEIPT_INSUFFICIENT", message: "Allocation exceeds unapplied collection amount" };
  }
  if (input.allocationAmount > input.outstandingOnStatement) {
    return { ok: false, code: "STATEMENT_INSUFFICIENT", message: "Allocation exceeds fee statement outstanding" };
  }
  if (roundMoney(input.lineSplitTotal) !== roundMoney(input.allocationAmount)) {
    return { ok: false, code: "LINE_SPLIT_MISMATCH", message: "Line split total must equal allocation amount" };
  }
  if (roundMoney(input.tenderSplitTotal) !== roundMoney(input.allocationAmount)) {
    return { ok: false, code: "TENDER_SPLIT_MISMATCH", message: "Tender split total must equal allocation amount" };
  }
  return { ok: true };
}

export function validateRefundAmount(input: {
  refundAmount: number;
  availableOnReceipt: number;
}): { ok: true } | { ok: false; code: string; message: string } {
  if (input.refundAmount <= 0) {
    return { ok: false, code: "REFUND_AMOUNT_INVALID", message: "Refund amount must be positive" };
  }
  if (input.refundAmount > input.availableOnReceipt) {
    return { ok: false, code: "REFUND_EXCEEDS_AVAILABLE", message: "Refund exceeds available collection balance" };
  }
  return { ok: true };
}

export function calculatePatientExposure(input: {
  assessedTotal: number;
  appliedTotal: number;
  creditTotal: number;
  writeoffTotal: number;
}): number {
  return roundMoney(
    Math.max(0, input.assessedTotal - input.appliedTotal - input.creditTotal - input.writeoffTotal),
  );
}

export function buildAgingBuckets(
  statements: readonly { dueDate: string | null; outstandingTotal: number }[],
  asOfDate: string,
): { current: number; days30: number; days60: number; days90: number; over90: number } {
  const asOf = new Date(asOfDate);
  const buckets = { current: 0, days30: 0, days60: 0, days90: 0, over90: 0 };
  for (const statement of statements) {
    const outstanding = roundMoney(statement.outstandingTotal);
    if (outstanding <= 0 || !statement.dueDate) {
      continue;
    }
    const due = new Date(statement.dueDate);
    const daysPastDue = Math.floor((asOf.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
    if (daysPastDue <= 0) {
      buckets.current += outstanding;
    } else if (daysPastDue <= 30) {
      buckets.days30 += outstanding;
    } else if (daysPastDue <= 60) {
      buckets.days60 += outstanding;
    } else if (daysPastDue <= 90) {
      buckets.days90 += outstanding;
    } else {
      buckets.over90 += outstanding;
    }
  }
  return {
    current: roundMoney(buckets.current),
    days30: roundMoney(buckets.days30),
    days60: roundMoney(buckets.days60),
    days90: roundMoney(buckets.days90),
    over90: roundMoney(buckets.over90),
  };
}

export function reconcileCentVariance(input: {
  sourceTotal: number;
  outputTotal: number;
}): { ok: true; variance: number } | { ok: false; variance: number; code: string; message: string } {
  const variance = roundMoney(input.outputTotal - input.sourceTotal);
  if (Math.abs(variance) > 0) {
    return {
      ok: false,
      variance,
      code: "RECONCILIATION_VARIANCE",
      message: `Financial reconciliation variance is INR ${variance.toFixed(2)}; expected INR 0.00`,
    };
  }
  return { ok: true, variance: 0 };
}

/** REP-001 — grid, header and journal must reconcile to INR 0.00 variance. */
export function validateRep001Reconciliation(input: {
  lineTotals: readonly number[];
  headerGrandTotal: number;
  journalDebits: readonly number[];
  journalCredits: readonly number[];
}): { ok: true } | { ok: false; code: string; message: string } {
  const lineSum = roundMoney(input.lineTotals.reduce((sum, value) => sum + value, 0));
  const headerCheck = reconcileCentVariance({ sourceTotal: lineSum, outputTotal: input.headerGrandTotal });
  if (!headerCheck.ok) {
    return { ok: false, code: headerCheck.code, message: headerCheck.message };
  }
  const debitTotal = roundMoney(input.journalDebits.reduce((sum, value) => sum + value, 0));
  const creditTotal = roundMoney(input.journalCredits.reduce((sum, value) => sum + value, 0));
  const journalCheck = reconcileCentVariance({ sourceTotal: debitTotal, outputTotal: creditTotal });
  if (!journalCheck.ok) {
    return { ok: false, code: journalCheck.code, message: journalCheck.message };
  }
  const gridCheck = reconcileCentVariance({ sourceTotal: input.headerGrandTotal, outputTotal: debitTotal });
  if (!gridCheck.ok) {
    return { ok: false, code: gridCheck.code, message: gridCheck.message };
  }
  return { ok: true };
}

export function validateRefundBlockedWhenAllocated(input: {
  refundAmount: number;
  unappliedTotal: number;
  appliedTotal: number;
}): { ok: true } | { ok: false; code: string; message: string } {
  if (input.appliedTotal > 0 && input.refundAmount > input.unappliedTotal) {
    return {
      ok: false,
      code: "REFUND_REQUIRES_DEALLOCATION",
      message: "Refund exceeds unapplied balance; reverse allocations first (FIN-DEC-05)",
    };
  }
  return validateRefundAmount({ refundAmount: input.refundAmount, availableOnReceipt: input.unappliedTotal });
}

export function distributeProportionalLineSplits(input: {
  allocationAmount: number;
  lines: readonly { lineId: string; outstandingAmount: number }[];
}): Array<{ lineId: string; amount: number }> {
  const eligible = input.lines.filter((line) => line.outstandingAmount > 0);
  if (eligible.length === 0) {
    return [];
  }
  const totalOutstanding = roundMoney(eligible.reduce((sum, line) => sum + line.outstandingAmount, 0));
  if (totalOutstanding <= 0) {
    return [];
  }
  const raw = eligible.map((line) => ({
    lineId: line.lineId,
    amount: roundMoney((input.allocationAmount * line.outstandingAmount) / totalOutstanding),
  }));
  let assigned = roundMoney(raw.reduce((sum, split) => sum + split.amount, 0));
  let remainder = roundMoney(input.allocationAmount - assigned);
  const sorted = [...raw].sort((a, b) => b.amount - a.amount);
  let index = 0;
  while (remainder > 0 && sorted.length > 0) {
    sorted[index % sorted.length]!.amount = roundMoney(sorted[index % sorted.length]!.amount + 0.01);
    remainder = roundMoney(remainder - 0.01);
    index += 1;
  }
  return sorted;
}
