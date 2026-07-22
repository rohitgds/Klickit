import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { EmptyState, ErrorState, LoadingState, PermissionGuard } from "@klickit/ui";
import { useAuth } from "../auth/AuthContext.js";
import {
  fetchAcceptanceRecords,
  fetchHandoverSummary,
  fetchProductionGate,
  fetchUnresolvedIssues,
  recordAcceptance,
} from "../api/pilot.js";
import { PILOT_NAV_ITEMS } from "../config/navigation.js";

const DEMO_FLOW = [
  { step: 1, label: "Login", path: "/login", module: "UI Module 1" },
  { step: 2, label: "Dashboard", path: "/dashboard", module: "UI Module 2" },
  { step: 3, label: "Register patient", path: "/patient-registry/register", module: "UI Module 3" },
  { step: 4, label: "Book appointment", path: "/scheduler", module: "UI Module 4" },
  { step: 5, label: "Clinical queue check-in", path: "/clinical-queue", module: "UI Module 5" },
  { step: 6, label: "Encounter workspace", path: "/clinical-queue", module: "UI Modules 6–8, 11" },
  { step: 7, label: "Financial operations", path: "/financial-operations", module: "UI Module 9" },
  { step: 8, label: "Comms center", path: "/comms-center", module: "UI Module 10" },
  { step: 9, label: "System configuration", path: "/system-configuration", module: "UI Modules 12–13" },
  { step: 10, label: "Pilot acceptance", path: "/pilot-demo", module: "UI Module 14" },
];

export function PilotDemoPage() {
  const auth = useAuth();
  const canView = auth.hasPermission("pilot.view");
  const canManage = auth.hasPermission("pilot.manage");

  const [scenariosPassed, setScenariosPassed] = useState(10);
  const [scenariosTotal, setScenariosTotal] = useState(10);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const gateQuery = useQuery({
    queryKey: ["pilot", "production-gate", auth.token],
    queryFn: () => fetchProductionGate(auth.token!),
    enabled: Boolean(auth.token && canView),
  });

  const handoverQuery = useQuery({
    queryKey: ["pilot", "handover-summary", auth.token],
    queryFn: () => fetchHandoverSummary(auth.token!),
    enabled: Boolean(auth.token && canView),
  });

  const acceptanceQuery = useQuery({
    queryKey: ["pilot", "acceptance-records", auth.token],
    queryFn: () => fetchAcceptanceRecords(auth.token!),
    enabled: Boolean(auth.token && canView),
  });

  const issuesQuery = useQuery({
    queryKey: ["pilot", "issues", auth.token],
    queryFn: () => fetchUnresolvedIssues(auth.token!),
    enabled: Boolean(auth.token && canView),
  });

  if (!canView) {
    return (
      <PermissionGuard allowed={false} permissionCode="pilot.view">
        <span />
      </PermissionGuard>
    );
  }

  return (
    <div className="ki-dashboard">
      <div className="ki-dashboard-toolbar">
        <Link to="/system-configuration" className="ki-btn">
          ← System configuration
        </Link>
      </div>

      {actionError ? <ErrorState title="Pilot action failed" message={actionError} onRetry={() => setActionError(null)} /> : null}

      <section className="ki-dashboard-section">
        <h2 className="ki-dashboard-section-title">End-to-end pilot demo flow</h2>
        <p className="ki-dashboard-note">
          Walk through each linked screen with the gateway running on port 8787. All {PILOT_NAV_ITEMS.length} main nav
          modules are now wired.
        </p>
        <table className="ki-dashboard-table ki-patient-table">
          <thead>
            <tr>
              <th scope="col">Step</th>
              <th scope="col">Screen</th>
              <th scope="col">Module</th>
              <th scope="col">Open</th>
            </tr>
          </thead>
          <tbody>
            {DEMO_FLOW.map((item) => (
              <tr key={item.step}>
                <td>{item.step}</td>
                <td>{item.label}</td>
                <td>{item.module}</td>
                <td>
                  <Link to={item.path} className="ki-btn ki-btn-sm">
                    Go
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="ki-dashboard-section">
        <h2 className="ki-dashboard-section-title">Production gate</h2>
        {gateQuery.isLoading ? <LoadingState label="Checking production gate…" /> : null}
        {gateQuery.data ? (
          <p className="ki-dashboard-note">
            Status: {gateQuery.data.allowed ? "Allowed" : "Blocked"}
            {gateQuery.data.environment ? ` (${gateQuery.data.environment})` : ""}
            {gateQuery.data.reason ? ` — ${gateQuery.data.reason}` : ""}
          </p>
        ) : null}
      </section>

      <section className="ki-dashboard-section">
        <h2 className="ki-dashboard-section-title">Handover summary</h2>
        {handoverQuery.isLoading ? <LoadingState label="Loading handover…" /> : null}
        {handoverQuery.data ? (
          <pre className="ki-code-block">{JSON.stringify(handoverQuery.data, null, 2)}</pre>
        ) : (
          <EmptyState title="No handover summary" description="Gateway will return handover metadata when available." />
        )}
      </section>

      <section className="ki-dashboard-section">
        <h2 className="ki-dashboard-section-title">Acceptance records</h2>
        {acceptanceQuery.isSuccess && (acceptanceQuery.data.records ?? []).length > 0 ? (
          <table className="ki-dashboard-table ki-patient-table">
            <thead>
              <tr>
                <th scope="col">Type</th>
                <th scope="col">Scenarios</th>
                <th scope="col">Recorded</th>
              </tr>
            </thead>
            <tbody>
              {acceptanceQuery.data.records.map((record) => (
                <tr key={record.id}>
                  <td>{record.acceptanceType}</td>
                  <td>
                    {record.scenariosPassed}/{record.scenariosTotal}
                  </td>
                  <td>{record.recordedAt ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState title="No acceptance records" description="Record pilot acceptance after completing the demo flow." />
        )}
        {canManage ? (
          <form
            className="ki-scheduler-filters"
            onSubmit={(event) => {
              event.preventDefault();
              if (!auth.token) return;
              setBusy(true);
              setActionError(null);
              void recordAcceptance(auth.token, {
                acceptanceType: "pilot_report",
                scenariosPassed,
                scenariosTotal,
                unresolvedSeverity12: (issuesQuery.data?.issues ?? []).filter((i) => i.severity <= 2).length,
              })
                .then(() => acceptanceQuery.refetch())
                .catch((error: unknown) =>
                  setActionError(error instanceof Error ? error.message : "Acceptance record failed"),
                )
                .finally(() => setBusy(false));
            }}
          >
            <label className="ki-scheduler-filter">
              <span className="ki-dashboard-date-label">Passed</span>
              <input
                className="ki-input"
                type="number"
                value={scenariosPassed}
                onChange={(e) => setScenariosPassed(Number(e.target.value))}
              />
            </label>
            <label className="ki-scheduler-filter">
              <span className="ki-dashboard-date-label">Total</span>
              <input
                className="ki-input"
                type="number"
                value={scenariosTotal}
                onChange={(e) => setScenariosTotal(Number(e.target.value))}
              />
            </label>
            <button type="submit" className="ki-btn ki-btn-primary" disabled={busy}>
              Record pilot acceptance
            </button>
          </form>
        ) : null}
      </section>

      <section className="ki-dashboard-section">
        <h2 className="ki-dashboard-section-title">Open pilot issues</h2>
        {issuesQuery.isSuccess && (issuesQuery.data.issues ?? []).length > 0 ? (
          <table className="ki-dashboard-table ki-patient-table">
            <thead>
              <tr>
                <th scope="col">Severity</th>
                <th scope="col">Title</th>
              </tr>
            </thead>
            <tbody>
              {issuesQuery.data.issues.map((issue) => (
                <tr key={issue.id}>
                  <td>{issue.severity}</td>
                  <td>{issue.title}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="ki-dashboard-note">No unresolved pilot issues recorded.</p>
        )}
      </section>
    </div>
  );
}
