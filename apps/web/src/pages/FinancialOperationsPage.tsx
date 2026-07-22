import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { EmptyState, ErrorState, LoadingState, PermissionGuard } from "@klickit/ui";
import { useAuth } from "../auth/AuthContext.js";
import {
  createFeeStatementDraft,
  fetchFeeStatementDetail,
  fetchFinanceMasters,
  fetchPatientBalance,
  issueFeeStatement,
} from "../api/finance.js";
import { fetchStaff } from "../api/scheduling.js";
import { feeStatementStatusLabel, extractFeeScheduleOptions, formatMoney } from "../config/finance.js";

export function FinancialOperationsPage() {
  const auth = useAuth();
  const canView = auth.hasPermission("fee_statement.view");
  const canCreate = auth.hasPermission("fee_statement.create");
  const canIssue = auth.hasPermission("fee_statement.issue");

  const [patientId, setPatientId] = useState("");
  const [lookupPatientId, setLookupPatientId] = useState("");
  const [feeScheduleId, setFeeScheduleId] = useState("");
  const [statementRef, setStatementRef] = useState("");
  const [activeStatementId, setActiveStatementId] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const mastersQuery = useQuery({
    queryKey: ["finance", "masters", auth.token],
    queryFn: () => fetchFinanceMasters(auth.token!),
    enabled: Boolean(auth.token && canView),
  });

  const balanceQuery = useQuery({
    queryKey: ["finance", "balance", lookupPatientId, auth.token],
    queryFn: () => fetchPatientBalance(auth.token!, lookupPatientId),
    enabled: Boolean(auth.token && canView && lookupPatientId),
  });

  const statementQuery = useQuery({
    queryKey: ["finance", "statement", activeStatementId, auth.token],
    queryFn: () => fetchFeeStatementDetail(auth.token!, activeStatementId),
    enabled: Boolean(auth.token && canView && activeStatementId),
  });

  useQuery({
    queryKey: ["identity", "staff", auth.token],
    queryFn: () => fetchStaff(auth.token!),
    enabled: Boolean(auth.token && canView),
  });

  if (!canView) {
    return (
      <PermissionGuard allowed={false} permissionCode="fee_statement.view">
        <span />
      </PermissionGuard>
    );
  }

  return (
    <div className="ki-dashboard">
      {actionError ? <ErrorState title="Finance action failed" message={actionError} onRetry={() => setActionError(null)} /> : null}

      <section className="ki-dashboard-section">
        <h2 className="ki-dashboard-section-title">Patient balance lookup</h2>
        <form
          className="ki-scheduler-filters"
          onSubmit={(event) => {
            event.preventDefault();
            setLookupPatientId(patientId.trim());
          }}
        >
          <label className="ki-scheduler-filter">
            <span className="ki-dashboard-date-label">Patient ID</span>
            <input className="ki-input" value={patientId} onChange={(e) => setPatientId(e.target.value)} />
          </label>
          <button type="submit" className="ki-btn ki-btn-primary">
            Lookup balance
          </button>
        </form>
        {balanceQuery.isLoading ? <LoadingState label="Loading balance…" /> : null}
        {balanceQuery.isSuccess ? (
          <table className="ki-dashboard-table ki-patient-table">
            <tbody>
              <tr>
                <th scope="row">Open exposure</th>
                <td>{formatMoney(balanceQuery.data.openExposure)}</td>
              </tr>
              <tr>
                <th scope="row">Unapplied collections</th>
                <td>{formatMoney(balanceQuery.data.unappliedCollections)}</td>
              </tr>
            </tbody>
          </table>
        ) : null}
      </section>

      <section className="ki-dashboard-section">
        <h2 className="ki-dashboard-section-title">Fee statement draft</h2>
        {mastersQuery.isLoading ? <LoadingState label="Loading finance masters…" /> : null}
        {canCreate ? (
          <form
            className="ki-form-stack"
            onSubmit={(event) => {
              event.preventDefault();
              if (!auth.token || !patientId.trim() || !feeScheduleId || !statementRef.trim()) return;
              setBusy(true);
              setActionError(null);
              void createFeeStatementDraft(auth.token, {
                patientId: patientId.trim(),
                statementReference: statementRef.trim(),
                feeScheduleId,
              })
                .then((result) => {
                  setActiveStatementId(result.id);
                  return statementQuery.refetch();
                })
                .catch((error: unknown) =>
                  setActionError(error instanceof Error ? error.message : "Statement create failed"),
                )
                .finally(() => setBusy(false));
            }}
          >
            <label className="ki-scheduler-filter">
              <span className="ki-dashboard-date-label">Patient ID</span>
              <input className="ki-input" value={patientId} onChange={(e) => setPatientId(e.target.value)} />
            </label>
            <label className="ki-scheduler-filter">
              <span className="ki-dashboard-date-label">Statement reference</span>
              <input className="ki-input" value={statementRef} onChange={(e) => setStatementRef(e.target.value)} />
            </label>
            <label className="ki-scheduler-filter">
              <span className="ki-dashboard-date-label">Fee schedule</span>
              <select className="ki-input" value={feeScheduleId} onChange={(e) => setFeeScheduleId(e.target.value)}>
                <option value="">Select schedule</option>
                {extractFeeScheduleOptions(mastersQuery.data?.feeScheduleItems ?? []).map((schedule) => (
                  <option key={schedule.id} value={schedule.id}>
                    {schedule.label}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="ki-btn ki-btn-primary" disabled={busy}>
              Create draft
            </button>
          </form>
        ) : null}
        {activeStatementId && statementQuery.data ? (
          <div className="ki-form-stack">
            <p className="ki-dashboard-note">
              Statement {activeStatementId.slice(0, 8)}… — {feeStatementStatusLabel(statementQuery.data.status)}
            </p>
            {canIssue && statementQuery.data.status === "draft" ? (
              <button
                type="button"
                className="ki-btn ki-btn-primary"
                disabled={busy}
                onClick={() => {
                  if (!auth.token) return;
                  setBusy(true);
                  void issueFeeStatement(auth.token, activeStatementId)
                    .then(() => statementQuery.refetch())
                    .catch((error: unknown) =>
                      setActionError(error instanceof Error ? error.message : "Issue failed"),
                    )
                    .finally(() => setBusy(false));
                }}
              >
                Issue statement
              </button>
            ) : null}
          </div>
        ) : (
          <EmptyState title="No active statement" description="Create a fee statement draft to issue charges." />
        )}
      </section>

      <section className="ki-dashboard-section">
        <h2 className="ki-dashboard-section-title">Finance masters</h2>
        {mastersQuery.isSuccess ? (
          <table className="ki-dashboard-table ki-patient-table">
            <thead>
              <tr>
                <th scope="col">Schedules</th>
                <th scope="col">Fee items</th>
                <th scope="col">Collection methods</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{extractFeeScheduleOptions(mastersQuery.data.feeScheduleItems ?? []).length} schedules</td>
                <td>{(mastersQuery.data.feeScheduleItems ?? []).length} fee items</td>
                <td>{(mastersQuery.data.collectionMethods ?? []).map((m) => m.code ?? m.description ?? m.id).join(", ") || "—"}</td>
              </tr>
            </tbody>
          </table>
        ) : null}
      </section>
    </div>
  );
}
