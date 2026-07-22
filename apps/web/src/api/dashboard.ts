import { buildDashboardQueryPath } from "../config/dashboard.js";
import { apiFetch } from "./client.js";
import type { OperationalDashboardSummary } from "./types.js";

export async function fetchOperationalDashboard(
  token: string,
  date: string,
): Promise<OperationalDashboardSummary> {
  return apiFetch<OperationalDashboardSummary>(buildDashboardQueryPath(date), {}, token);
}
