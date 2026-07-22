import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { EmptyState, ErrorState, LoadingState, PermissionGuard } from "@klickit/ui";
import { useAuth } from "../auth/AuthContext.js";
import {
  addFeeStatementLine,
  createAllocation,
  createCollection,
  createFeeStatementDraft,
  fetchDailyReconciliations,
  fetchFeeStatementDetail,
  fetchFinanceMasters,
  fetchPatientBalance,
  issueFeeStatement,
  reconcileFeeStatement,
  recordDailyReconciliation,
} from "../api/finance.js";
import { fetchStaff } from "../api/scheduling.js";
import {
  FINANCE_TABS,
  buildSimpleAllocationPayload,
  buildSplitTenderRows,
  extractFeeScheduleOptions,
  extractServiceOptions,
  feeStatementStatusLabel,
  financeTabLabel,
  formatMoney,
  reconciliationStatusLabel,
  type FinanceTab,
} from "../config/finance.js";

export function FinancialOperationsPage() {
  const auth = useAuth();
  const canView = auth.hasPermission("fee_statement.view");
  const canCreate = auth.hasPermission("fee_statement.create");
  const canIssue = auth.hasPermission("fee_statement.issue");
  const canCollect = auth.hasPermission("collection.create");
  const canAllocate = auth.hasPermission("fee_allocation.create");
  const canPilot = auth.hasPermission("pilot.manage");

  const [tab, setTab] = useState<FinanceTab>("balance");
  const [patientId, setPatientId] = useState("");
  const [lookupPatientId, setLookupPatientId] = useState("");
  const [feeScheduleId, setFeeScheduleId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [statementRef, setStatementRef] = useState("");
  const [unitFee, setUnitFee] = useState("500");
  const [activeStatementId, setActiveStatementId] = useState("");
  const [collectionRef, setCollectionRef] = useState("");
  const [collectionAmount, setCollectionAmount] = useState("");
  const [splitAmount, setSplitAmount] = useState("");
  const [methodA, setMethodA] = useState("");
  const [methodB, setMethodB] = useState("");
  const [lastCollectionId, setLastCollectionId] = useState("");
  const [lastTenderId, setLastTenderId] = useState("");
  const [allocationAmount, setAllocationAmount] = useState("");
  const [reconcileResult, setReconcileResult] = useState<{ ok: boolean; variance?: number } | null>(null);
  const [dailySource, setDailySource] = useState("");
  const [dailyOutput, setDailyOutput] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const mastersQuery = useQuery({
    queryKey: ["finance", "masters", auth.token],
    queryFn: () => fetchFinanceMasters(auth.token!),
    enabled: Boolean(auth.token && canView),
  });

  const staffQuery = useQuery({
    queryKey: ["identity", "staff", auth.token],
    queryFn: () => fetchStaff(auth.token!),
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

  const dailyQuery = useQuery({
    queryKey: ["pilot", "reconciliation", auth.token],
    queryFn: () => fetchDailyReconciliations(auth.token!),
    enabled: Boolean(auth.token && canPilot && tab === "reconciliation"),
  });

  const staffOptions = staffQuery.data?.staff ?? [];
  const leadClinicianId = staffOptions[0]?.id ?? auth.user?.userId ?? "";
  const collectionMethods = mastersQuery.data?.collectionMethods ?? [];
  const feeItems = mastersQuery.data?.feeScheduleItems ?? [];

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

      <nav className="ki-tab-bar" aria-label="Financial operations">
        {FINANCE_TABS.map((item) => (
          <button
            key={item}
            type="button"
            className={tab === item ? "ki-tab ki-tab-active" : "ki-tab"}
            onClick={() => setTab(item)}
          >
            {financeTabLabel(item)}
          </button>
        ))}
      </nav>

      {tab === "balance" ? (
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
      ) : null}

      {tab === "statements" ? (
        <section className="ki-dashboard-section">
          <h2 className="ki-dashboard-section-title">Fee statement</h2>
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
                  .then((result) => setActiveStatementId(result.id))
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
                  {extractFeeScheduleOptions(feeItems).map((schedule) => (
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
              {statementQuery.data.status === "draft" && canCreate ? (
                <form
                  className="ki-form-stack"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!auth.token || !serviceId || !leadClinicianId) return;
                    setBusy(true);
                    void addFeeStatementLine(auth.token, activeStatementId, {
                      serviceId,
                      leadClinicianId,
                      quantity: 1,
                      unitFee: Number(unitFee),
                      sequenceNo: (statementQuery.data?.lines.length ?? 0) + 1,
                    })
                      .then(() => statementQuery.refetch())
                      .catch((error: unknown) =>
                        setActionError(error instanceof Error ? error.message : "Add line failed"),
                      )
                      .finally(() => setBusy(false));
                  }}
                >
                  <label className="ki-scheduler-filter">
                    <span className="ki-dashboard-date-label">Service</span>
                    <select className="ki-input" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
                      <option value="">Select service</option>
                      {extractServiceOptions(feeItems, feeScheduleId).map((service) => (
                        <option key={service.id} value={service.id}>
                          {service.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="ki-scheduler-filter">
                    <span className="ki-dashboard-date-label">Unit fee (INR)</span>
                    <input className="ki-input" value={unitFee} onChange={(e) => setUnitFee(e.target.value)} />
                  </label>
                  <button type="submit" className="ki-btn" disabled={busy}>
                    Add line
                  </button>
                </form>
              ) : null}
              {canIssue && statementQuery.data.status === "draft" && statementQuery.data.lines.length > 0 ? (
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
            <EmptyState title="No active statement" description="Create a fee statement draft to begin." />
          )}
        </section>
      ) : null}

      {tab === "collections" ? (
        <section className="ki-dashboard-section">
          <h2 className="ki-dashboard-section-title">Record collection</h2>
          <p className="ki-dashboard-note">FIN-DEC-06: split tender allowed when totals match.</p>
          {canCollect ? (
            <form
              className="ki-form-stack"
              onSubmit={(event) => {
                event.preventDefault();
                if (!auth.token || !patientId.trim() || !collectionRef.trim() || !methodA) return;
                const gross = Number(collectionAmount);
                const split = Number(splitAmount || 0);
                if (!Number.isFinite(gross) || gross <= 0) return;
                const tenders = buildSplitTenderRows({
                  methodA,
                  amountA: methodB && split > 0 ? gross - split : gross,
                  methodB: methodB || undefined,
                  amountB: methodB && split > 0 ? split : undefined,
                });
                setBusy(true);
                void createCollection(auth.token, {
                  patientId: patientId.trim(),
                  collectionReference: collectionRef.trim(),
                  leadClinicianId,
                  collectionOperatorId: auth.user?.userId ?? leadClinicianId,
                  tenders,
                })
                  .then((result) => {
                    setLastCollectionId(result.id);
                    setLastTenderId(result.tenders[0]?.id ?? "");
                    setLookupPatientId(patientId.trim());
                  })
                  .catch((error: unknown) =>
                    setActionError(error instanceof Error ? error.message : "Collection failed"),
                  )
                  .finally(() => setBusy(false));
              }}
            >
              <label className="ki-scheduler-filter">
                <span className="ki-dashboard-date-label">Patient ID</span>
                <input className="ki-input" value={patientId} onChange={(e) => setPatientId(e.target.value)} />
              </label>
              <label className="ki-scheduler-filter">
                <span className="ki-dashboard-date-label">Collection reference</span>
                <input className="ki-input" value={collectionRef} onChange={(e) => setCollectionRef(e.target.value)} />
              </label>
              <label className="ki-scheduler-filter">
                <span className="ki-dashboard-date-label">Gross amount (INR)</span>
                <input className="ki-input" value={collectionAmount} onChange={(e) => setCollectionAmount(e.target.value)} />
              </label>
              <label className="ki-scheduler-filter">
                <span className="ki-dashboard-date-label">Primary method</span>
                <select className="ki-input" value={methodA} onChange={(e) => setMethodA(e.target.value)}>
                  <option value="">Select method</option>
                  {collectionMethods.map((method) => (
                    <option key={method.id} value={method.id}>
                      {method.code ?? method.description ?? method.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="ki-scheduler-filter">
                <span className="ki-dashboard-date-label">Second method (optional split)</span>
                <select className="ki-input" value={methodB} onChange={(e) => setMethodB(e.target.value)}>
                  <option value="">None</option>
                  {collectionMethods.map((method) => (
                    <option key={method.id} value={method.id}>
                      {method.code ?? method.description ?? method.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </label>
              {methodB ? (
                <label className="ki-scheduler-filter">
                  <span className="ki-dashboard-date-label">Second tender amount (INR)</span>
                  <input className="ki-input" value={splitAmount} onChange={(e) => setSplitAmount(e.target.value)} />
                </label>
              ) : null}
              <button type="submit" className="ki-btn ki-btn-primary" disabled={busy}>
                Record collection
              </button>
            </form>
          ) : (
            <EmptyState title="Permission required" description="collection.create permission is required." />
          )}
          {lastCollectionId ? (
            <p className="ki-dashboard-note">Last collection: {lastCollectionId.slice(0, 8)}…</p>
          ) : null}
        </section>
      ) : null}

      {tab === "allocations" ? (
        <section className="ki-dashboard-section">
          <h2 className="ki-dashboard-section-title">Manual allocation</h2>
          <p className="ki-dashboard-note">FIN-DEC-01: collections stay unapplied until allocated here.</p>
          {canAllocate ? (
            <form
              className="ki-form-stack"
              onSubmit={(event) => {
                event.preventDefault();
                if (!auth.token || !lastCollectionId || !activeStatementId || !lastTenderId) return;
                const amount = Number(allocationAmount);
                const lineId = statementQuery.data?.lines[0]?.id;
                if (!lineId || !Number.isFinite(amount) || amount <= 0) return;
                setBusy(true);
                void createAllocation(
                  auth.token,
                  buildSimpleAllocationPayload({
                    collectionReceiptId: lastCollectionId,
                    feeStatementId: activeStatementId,
                    amount,
                    lineId,
                    tenderId: lastTenderId,
                  }),
                )
                  .then(() => {
                    void statementQuery.refetch();
                    if (lookupPatientId) {
                      void balanceQuery.refetch();
                    }
                  })
                  .catch((error: unknown) =>
                    setActionError(error instanceof Error ? error.message : "Allocation failed"),
                  )
                  .finally(() => setBusy(false));
              }}
            >
              <label className="ki-scheduler-filter">
                <span className="ki-dashboard-date-label">Collection receipt ID</span>
                <input className="ki-input" value={lastCollectionId} onChange={(e) => setLastCollectionId(e.target.value)} />
              </label>
              <label className="ki-scheduler-filter">
                <span className="ki-dashboard-date-label">Fee statement ID</span>
                <input className="ki-input" value={activeStatementId} onChange={(e) => setActiveStatementId(e.target.value)} />
              </label>
              <label className="ki-scheduler-filter">
                <span className="ki-dashboard-date-label">Allocation amount (INR)</span>
                <input className="ki-input" value={allocationAmount} onChange={(e) => setAllocationAmount(e.target.value)} />
              </label>
              <button type="submit" className="ki-btn ki-btn-primary" disabled={busy}>
                Allocate to statement
              </button>
            </form>
          ) : (
            <EmptyState title="Permission required" description="fee_allocation.create permission is required." />
          )}
        </section>
      ) : null}

      {tab === "reconciliation" ? (
        <section className="ki-dashboard-section">
          <h2 className="ki-dashboard-section-title">Reconciliation</h2>
          {activeStatementId ? (
            <button
              type="button"
              className="ki-btn"
              disabled={busy}
              onClick={() => {
                if (!auth.token) return;
                setBusy(true);
                void reconcileFeeStatement(auth.token, activeStatementId)
                  .then((result) => setReconcileResult(result))
                  .catch((error: unknown) =>
                    setActionError(error instanceof Error ? error.message : "Reconciliation failed"),
                  )
                  .finally(() => setBusy(false));
              }}
            >
              Reconcile active statement
            </button>
          ) : null}
          {reconcileResult ? (
            <p className="ki-dashboard-note">
              {reconciliationStatusLabel(reconcileResult.ok, reconcileResult.variance)}
            </p>
          ) : null}

          {canPilot ? (
            <form
              className="ki-form-stack"
              onSubmit={(event) => {
                event.preventDefault();
                if (!auth.token || !dailySource || !dailyOutput) return;
                setBusy(true);
                void recordDailyReconciliation(auth.token, {
                  reconciliationDate: new Date().toISOString().slice(0, 10),
                  sourceTotalMinor: Math.round(Number(dailySource) * 100),
                  outputTotalMinor: Math.round(Number(dailyOutput) * 100),
                })
                  .then(() => dailyQuery.refetch())
                  .catch((error: unknown) =>
                    setActionError(error instanceof Error ? error.message : "Daily reconciliation failed"),
                  )
                  .finally(() => setBusy(false));
              }}
            >
              <label className="ki-scheduler-filter">
                <span className="ki-dashboard-date-label">Source total (INR)</span>
                <input className="ki-input" value={dailySource} onChange={(e) => setDailySource(e.target.value)} />
              </label>
              <label className="ki-scheduler-filter">
                <span className="ki-dashboard-date-label">Output total (INR)</span>
                <input className="ki-input" value={dailyOutput} onChange={(e) => setDailyOutput(e.target.value)} />
              </label>
              <button type="submit" className="ki-btn ki-btn-primary" disabled={busy}>
                Record daily reconciliation
              </button>
            </form>
          ) : null}

          {dailyQuery.data?.reconciliations?.length ? (
            <table className="ki-dashboard-table ki-patient-table">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Variance (minor)</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {dailyQuery.data.reconciliations.slice(0, 5).map((row) => (
                  <tr key={row.reconciliation_date}>
                    <td>{row.reconciliation_date}</td>
                    <td>{row.variance_minor}</td>
                    <td>{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
