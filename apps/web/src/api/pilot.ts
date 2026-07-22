import { apiFetch } from "./client.js";

export interface ProductionGateStatus {
  allowed: boolean;
  reason?: string;
  environment?: string;
}

export interface AcceptanceRecord {
  id: string;
  acceptanceType: string;
  scenariosPassed: number;
  scenariosTotal: number;
  recordedAt?: string;
}

export async function fetchProductionGate(token: string): Promise<ProductionGateStatus> {
  return apiFetch<ProductionGateStatus>("/pilot/production-gate", {}, token);
}

export async function fetchHandoverSummary(token: string): Promise<Record<string, unknown>> {
  return apiFetch<Record<string, unknown>>("/pilot/handover/summary", {}, token);
}

export async function fetchAcceptanceRecords(token: string): Promise<{ records: AcceptanceRecord[] }> {
  return apiFetch<{ records: AcceptanceRecord[] }>("/pilot/acceptance", {}, token);
}

export async function fetchUnresolvedIssues(
  token: string,
): Promise<{ issues: Array<{ id: string; severity: number; title: string }> }> {
  return apiFetch<{ issues: Array<{ id: string; severity: number; title: string }> }>("/pilot/issues", {}, token);
}

export async function recordAcceptance(
  token: string,
  body: {
    acceptanceType: "pilot_report" | "handover" | "sale_readiness";
    scenariosPassed: number;
    scenariosTotal: number;
    unresolvedSeverity12: number;
  },
): Promise<{ id: string }> {
  return apiFetch<{ id: string }>("/pilot/acceptance", { method: "POST", body: JSON.stringify(body) }, token);
}
