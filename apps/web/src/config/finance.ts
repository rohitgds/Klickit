export function buildPatientBalancePath(patientId: string): string {
  return `/finance/patients/${encodeURIComponent(patientId)}/balance`;
}

export function buildPatientAgingPath(patientId: string, asOf?: string): string {
  const base = `/finance/patients/${encodeURIComponent(patientId)}/aging`;
  return asOf ? `${base}?asOf=${encodeURIComponent(asOf)}` : base;
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

export function feeStatementStatusLabel(status: string): string {
  return status.replaceAll("_", " ");
}
