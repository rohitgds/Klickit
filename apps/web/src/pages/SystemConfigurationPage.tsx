import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { EmptyState, ErrorState, LoadingState, PermissionGuard } from "@klickit/ui";
import { useAuth } from "../auth/AuthContext.js";
import { createStaffMember, fetchClinics, fetchStaffDirectory, fetchUsers } from "../api/settings.js";
import { fetchAcceptanceRecords, fetchHandoverSummary, fetchProductionGate } from "../api/pilot.js";
import { fetchBackupManifest, fetchBackupRuns, fetchOpenConflicts, fetchRecoveryStatus, fetchSyncStatus, resolveSyncConflict } from "../api/sync.js";
import { conflictResolutionLabel, formatConflictValue, staffTypeLabel, SYSTEM_TABS, type SystemTab } from "../config/system.js";

export function SystemConfigurationPage() {
  const auth = useAuth();
  const canWorkforce = auth.hasPermission("configuration.workforce.view");
  const canPractice = auth.hasPermission("configuration.practice.view");
  const canPilot = auth.hasPermission("pilot.view");

  const [tab, setTab] = useState<SystemTab>("staff");
  const [displayName, setDisplayName] = useState("");
  const [staffType, setStaffType] = useState("clinician");
  const [resolveReason, setResolveReason] = useState("Owner resolved in pilot");
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const staffQuery = useQuery({
    queryKey: ["settings", "staff", auth.token],
    queryFn: () => fetchStaffDirectory(auth.token!),
    enabled: Boolean(auth.token && canWorkforce && tab === "staff"),
  });

  const usersQuery = useQuery({
    queryKey: ["settings", "users", auth.token],
    queryFn: () => fetchUsers(auth.token!),
    enabled: Boolean(auth.token && canWorkforce && tab === "users"),
  });

  const clinicsQuery = useQuery({
    queryKey: ["settings", "clinics", auth.token],
    queryFn: () => fetchClinics(auth.token!),
    enabled: Boolean(auth.token && canPractice),
  });

  const conflictsQuery = useQuery({
    queryKey: ["sync", "conflicts", auth.token],
    queryFn: () => fetchOpenConflicts(auth.token!),
    enabled: Boolean(auth.token && tab === "sync"),
  });

  const syncStatusQuery = useQuery({
    queryKey: ["sync", "status", auth.token],
    queryFn: () => fetchSyncStatus(auth.token!),
    enabled: Boolean(auth.token && tab === "sync"),
  });

  const backupRunsQuery = useQuery({
    queryKey: ["resilience", "backup-runs", auth.token],
    queryFn: () => fetchBackupRuns(auth.token!),
    enabled: Boolean(auth.token && tab === "resilience"),
  });

  const backupManifestQuery = useQuery({
    queryKey: ["resilience", "backup-manifest", auth.token],
    queryFn: () => fetchBackupManifest(auth.token!),
    enabled: Boolean(auth.token && tab === "resilience"),
  });

  const recoveryQuery = useQuery({
    queryKey: ["resilience", "recovery", auth.token],
    queryFn: () => fetchRecoveryStatus(auth.token!),
    enabled: Boolean(auth.token && tab === "resilience"),
  });

  const handoverQuery = useQuery({
    queryKey: ["pilot", "handover", auth.token],
    queryFn: () => fetchHandoverSummary(auth.token!),
    enabled: Boolean(auth.token && canPilot && tab === "pilot"),
  });

  const gateQuery = useQuery({
    queryKey: ["pilot", "gate", auth.token],
    queryFn: () => fetchProductionGate(auth.token!),
    enabled: Boolean(auth.token && canPilot && tab === "pilot"),
  });

  const acceptanceQuery = useQuery({
    queryKey: ["pilot", "acceptance", auth.token],
    queryFn: () => fetchAcceptanceRecords(auth.token!),
    enabled: Boolean(auth.token && canPilot && tab === "pilot"),
  });

  if (!canWorkforce && !canPractice) {
    return (
      <PermissionGuard allowed={false} permissionCode="configuration.practice.view">
        <span />
      </PermissionGuard>
    );
  }

  return (
    <div className="ki-dashboard">
      <nav className="ki-tab-bar" aria-label="System configuration sections">
        {SYSTEM_TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`ki-tab ${tab === item.id ? "ki-tab-active" : ""}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {actionError ? <ErrorState title="Settings action failed" message={actionError} onRetry={() => setActionError(null)} /> : null}

      {canPractice && clinicsQuery.data ? (
        <p className="ki-dashboard-note">
          Clinics: {(clinicsQuery.data.clinics ?? []).map((c) => `${c.name} (${c.clinicCode})`).join(" · ") || "—"}
        </p>
      ) : null}

      {tab === "staff" ? (
        <section className="ki-dashboard-section">
          <h2 className="ki-dashboard-section-title">Staff directory</h2>
          {auth.hasPermission("configuration.workforce.edit") ? (
            <form
              className="ki-scheduler-filters"
              onSubmit={(event) => {
                event.preventDefault();
                if (!auth.token || !displayName.trim()) return;
                setBusy(true);
                setActionError(null);
                void createStaffMember(auth.token, { displayName: displayName.trim(), staffType })
                  .then(() => {
                    setDisplayName("");
                    return staffQuery.refetch();
                  })
                  .catch((error: unknown) =>
                    setActionError(error instanceof Error ? error.message : "Staff create failed"),
                  )
                  .finally(() => setBusy(false));
              }}
            >
              <label className="ki-scheduler-filter">
                <span className="ki-dashboard-date-label">Display name</span>
                <input className="ki-input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </label>
              <label className="ki-scheduler-filter">
                <span className="ki-dashboard-date-label">Staff type</span>
                <select className="ki-input" value={staffType} onChange={(e) => setStaffType(e.target.value)}>
                  <option value="clinician">Clinician</option>
                  <option value="front_office">Front office</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
              <button type="submit" className="ki-btn ki-btn-primary" disabled={busy}>
                Add staff
              </button>
            </form>
          ) : null}
          {staffQuery.isLoading ? <LoadingState label="Loading staff…" /> : null}
          {staffQuery.isSuccess && (staffQuery.data.staff ?? []).length === 0 ? (
            <EmptyState title="No staff" description="Add clinic staff members here." />
          ) : null}
          {staffQuery.isSuccess && (staffQuery.data.staff ?? []).length > 0 ? (
            <table className="ki-dashboard-table ki-patient-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Type</th>
                </tr>
              </thead>
              <tbody>
                {staffQuery.data.staff.map((member) => (
                  <tr key={member.id}>
                    <td>{member.displayName}</td>
                    <td>{staffTypeLabel(member.staffType)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </section>
      ) : null}

      {tab === "users" ? (
        <section className="ki-dashboard-section">
          <h2 className="ki-dashboard-section-title">User accounts</h2>
          {usersQuery.isLoading ? <LoadingState label="Loading users…" /> : null}
          {usersQuery.isSuccess && (usersQuery.data.users ?? []).length === 0 ? (
            <EmptyState title="No users" description="User accounts linked to staff will appear here." />
          ) : null}
          {usersQuery.isSuccess && (usersQuery.data.users ?? []).length > 0 ? (
            <table className="ki-dashboard-table ki-patient-table">
              <thead>
                <tr>
                  <th scope="col">Login</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {usersQuery.data.users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.loginName}</td>
                    <td>{user.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </section>
      ) : null}

      {tab === "sync" ? (
        <section className="ki-dashboard-section">
          <h2 className="ki-dashboard-section-title">Open sync conflicts</h2>
          {syncStatusQuery.data ? (
            <p className="ki-dashboard-note">
              Outbox pending: {syncStatusQuery.data.pendingOutbox} · Failed: {syncStatusQuery.data.failedOutbox} · Dead
              letters: {syncStatusQuery.data.deadLetters} · Open conflicts: {syncStatusQuery.data.openConflicts}
            </p>
          ) : null}
          {conflictsQuery.isLoading ? <LoadingState label="Loading conflicts…" /> : null}
          {conflictsQuery.isSuccess && (conflictsQuery.data.conflicts ?? []).length === 0 ? (
            <EmptyState title="No open conflicts" description="Sync conflicts between local and cloud will list here." />
          ) : null}
          {conflictsQuery.isSuccess && (conflictsQuery.data.conflicts ?? []).length > 0 ? (
            <table className="ki-dashboard-table ki-patient-table">
              <thead>
                <tr>
                  <th scope="col">Entity</th>
                  <th scope="col">Field</th>
                  <th scope="col">Local value</th>
                  <th scope="col">Cloud value</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {conflictsQuery.data.conflicts.map((conflict) => (
                  <tr key={conflict.id}>
                    <td>
                      {conflict.aggregateType} / {conflict.aggregateId.slice(0, 8)}…
                    </td>
                    <td>{conflict.fieldName}</td>
                    <td>{formatConflictValue(conflict.localValue)}</td>
                    <td>{formatConflictValue(conflict.cloudValue)}</td>
                    <td>
                      {(["keep_local", "keep_cloud"] as const).map((action) => (
                        <button
                          key={action}
                          type="button"
                          className="ki-btn ki-btn-sm"
                          disabled={busy}
                          onClick={() => {
                            if (!auth.token || !auth.user) return;
                            setBusy(true);
                            void resolveSyncConflict(auth.token, {
                              conflictId: conflict.id,
                              resolutionAction: action,
                              resolvedBy: auth.user.userId,
                              reason: resolveReason,
                            })
                              .then(() => conflictsQuery.refetch())
                              .catch((error: unknown) =>
                                setActionError(error instanceof Error ? error.message : "Resolve failed"),
                              )
                              .finally(() => setBusy(false));
                          }}
                        >
                          {conflictResolutionLabel(action)}
                        </button>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </section>
      ) : null}

      {tab === "resilience" ? (
        <section className="ki-dashboard-section">
          <h2 className="ki-dashboard-section-title">Backup &amp; recovery</h2>
          {backupRunsQuery.isLoading ? <LoadingState label="Loading backup runs…" /> : null}
          {backupManifestQuery.data ? (
            <p className="ki-dashboard-note">Backup manifest loaded — see gateway resilience endpoints for details.</p>
          ) : null}
          {recoveryQuery.data ? (
            <pre className="ki-code-block">{JSON.stringify(recoveryQuery.data, null, 2)}</pre>
          ) : null}
          {backupRunsQuery.isSuccess && (backupRunsQuery.data.runs ?? []).length > 0 ? (
            <table className="ki-dashboard-table ki-patient-table">
              <thead>
                <tr>
                  <th scope="col">Run ID</th>
                  <th scope="col">Created</th>
                </tr>
              </thead>
              <tbody>
                {backupRunsQuery.data.runs.map((run) => (
                  <tr key={run.id}>
                    <td>{run.id.slice(0, 8)}…</td>
                    <td>{run.createdAt ?? (run as { started_at?: string }).started_at ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState title="No backup runs" description="Recorded backup runs will appear here." />
          )}
        </section>
      ) : null}

      {tab === "pilot" && canPilot ? (
        <section className="ki-dashboard-section">
          <h2 className="ki-dashboard-section-title">Pilot handover snapshot</h2>
          <p className="ki-dashboard-note">
            Full end-to-end demo checklist: <Link to="/pilot-demo">Open pilot demo page</Link>
          </p>
          {gateQuery.data ? (
            <p className="ki-dashboard-note">
              Production gate: {gateQuery.data.allowed ? "Ready" : "Blocked"}
              {gateQuery.data.reason ? ` — ${gateQuery.data.reason}` : ""}
            </p>
          ) : null}
          {handoverQuery.isLoading ? <LoadingState label="Loading handover summary…" /> : null}
          {handoverQuery.data ? (
            <pre className="ki-code-block">{JSON.stringify(handoverQuery.data, null, 2)}</pre>
          ) : null}
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
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
