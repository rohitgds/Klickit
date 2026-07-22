export type FinanceTab = "balance" | "statements" | "collections" | "allocations" | "reconciliation";

export const FINANCE_TABS: FinanceTab[] = [
  "balance",
  "statements",
  "collections",
  "allocations",
  "reconciliation",
];

export function financeTabLabel(tab: FinanceTab): string {
  switch (tab) {
    case "balance":
      return "Balance";
    case "statements":
      return "Statements";
    case "collections":
      return "Collections";
    case "allocations":
      return "Allocations";
    case "reconciliation":
      return "Reconciliation";
    default:
      return tab;
  }
}

export function buildPatientBalancePath(patientId: string): string {
  return `/finance/patients/${encodeURIComponent(patientId)}/balance`;
}

export function buildPatientAgingPath(patientId: string, asOf?: string): string {
  const base = `/finance/patients/${encodeURIComponent(patientId)}/aging`;
  return asOf ? `${base}?asOf=${encodeURIComponent(asOf)}` : base;
}

export function buildFeeStatementReconcilePath(statementId: string): string {
  return `/finance/fee-statements/${encodeURIComponent(statementId)}/reconcile`;
}

export function formatMoney(amount: number, currency = "INR"): string {
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export function extractFeeScheduleOptions(
  items: Array<{ fee_schedule_id: string; service_name?: string; service_code?: string }>,
): Array<{ id: string; label: string }> {
  const map = new Map<string, string>();
  for (const item of items) {
    if (!map.has(item.fee_schedule_id)) {
      map.set(item.fee_schedule_id, item.service_name ?? item.service_code ?? item.fee_schedule_id.slice(0, 8));
    }
  }
  return [...map.entries()].map(([id, label]) => ({ id, label: `Schedule ${label}` }));
}

export function extractServiceOptions(
  items: Array<{
    fee_schedule_id: string;
    service_id: string;
    service_name?: string;
    service_code?: string;
  }>,
  feeScheduleId: string,
): Array<{ id: string; label: string }> {
  return items
    .filter((item) => item.fee_schedule_id === feeScheduleId)
    .map((item) => ({
      id: item.service_id,
      label: item.service_name ?? item.service_code ?? item.service_id.slice(0, 8),
    }));
}

export function feeStatementStatusLabel(status: string): string {
  return status.replaceAll("_", " ");
}

export function buildSplitTenderRows(input: {
  methodA: string;
  amountA: number;
  methodB?: string;
  amountB?: number;
}): Array<{ collectionMethodId: string; amount: number }> {
  if (input.methodB && input.amountB && input.amountB > 0) {
    return [
      { collectionMethodId: input.methodA, amount: input.amountA },
      { collectionMethodId: input.methodB, amount: input.amountB },
    ];
  }
  return [{ collectionMethodId: input.methodA, amount: input.amountA }];
}

export function buildSimpleAllocationPayload(input: {
  collectionReceiptId: string;
  feeStatementId: string;
  amount: number;
  lineId: string;
  tenderId: string;
}) {
  return {
    collectionReceiptId: input.collectionReceiptId,
    feeStatementId: input.feeStatementId,
    amount: input.amount,
    lineSplits: [{ feeStatementLineId: input.lineId, amount: input.amount }],
    tenderSplits: [{ collectionTenderId: input.tenderId, amount: input.amount }],
  };
}

export function reconciliationStatusLabel(ok: boolean, variance?: number): string {
  if (ok) {
    return "Reconciled — INR 0.00 variance";
  }
  return variance !== undefined ? `Variance INR ${variance.toFixed(2)}` : "Reconciliation failed";
}
