import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ErrorState, FormField, LoadingState, PermissionGuard } from "@klickit/ui";
import { createBlackout, fetchSchedulingMasters } from "../api/scheduling.js";
import { useAuth } from "../auth/AuthContext.js";
import { formatBookingDateTime } from "../config/scheduling.js";

export function SchedulerSetupPage() {
  const auth = useAuth();
  const canView = auth.hasPermission("scheduler.view");
  const canEdit = auth.hasPermission("scheduler.edit");

  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [reason, setReason] = useState("");
  const [chairId, setChairId] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const mastersQuery = useQuery({
    queryKey: ["scheduling", "masters", auth.token],
    queryFn: () => fetchSchedulingMasters(auth.token!),
    enabled: Boolean(auth.token && canView),
  });

  if (!canView) {
    return (
      <PermissionGuard allowed={false} permissionCode="scheduler.view">
        <span />
      </PermissionGuard>
    );
  }

  async function onCreateBlackout(event: FormEvent) {
    event.preventDefault();
    if (!auth.token || !canEdit) {
      return;
    }
    setBusy(true);
    setSubmitError(null);
    try {
      await createBlackout(auth.token, {
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        reason: reason.trim(),
        chairId: chairId || undefined,
      });
      setStartsAt("");
      setEndsAt("");
      setReason("");
      setChairId("");
      await mastersQuery.refetch();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Could not save blackout");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ki-scheduler-setup">
      <div className="ki-dashboard-toolbar">
        <Link to="/scheduler" className="ki-btn">
          Back to scheduler
        </Link>
      </div>

      {mastersQuery.isLoading ? <LoadingState label="Loading scheduling masters…" /> : null}

      {mastersQuery.isError ? (
        <ErrorState
          title="Setup unavailable"
          message={mastersQuery.error instanceof Error ? mastersQuery.error.message : "Could not load masters."}
          onRetry={() => {
            void mastersQuery.refetch();
          }}
        />
      ) : null}

      {mastersQuery.data ? (
        <>
          <section className="ki-dashboard-section" aria-label="Scheduling chairs">
            <h2 className="ki-dashboard-section-title">Chairs</h2>
            <table className="ki-dashboard-table ki-patient-table">
              <thead>
                <tr>
                  <th scope="col">Code</th>
                  <th scope="col">Name</th>
                  <th scope="col">Order</th>
                  <th scope="col">Active</th>
                </tr>
              </thead>
              <tbody>
                {mastersQuery.data.chairs.map((chair) => (
                  <tr key={chair.id}>
                    <td>{chair.code}</td>
                    <td>{chair.name}</td>
                    <td>{chair.displayOrder}</td>
                    <td>{chair.active ? "Yes" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="ki-dashboard-section" aria-label="Booking reasons">
            <h2 className="ki-dashboard-section-title">Booking reasons</h2>
            <table className="ki-dashboard-table ki-patient-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Default minutes</th>
                  <th scope="col">Active</th>
                </tr>
              </thead>
              <tbody>
                {mastersQuery.data.bookingReasons.map((reasonRow) => (
                  <tr key={reasonRow.id}>
                    <td>{reasonRow.name}</td>
                    <td>{reasonRow.defaultMinutes ?? "—"}</td>
                    <td>{reasonRow.active ? "Yes" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="ki-dashboard-section" aria-label="Active blackouts">
            <h2 className="ki-dashboard-section-title">Active blackouts</h2>
            <table className="ki-dashboard-table ki-patient-table">
              <thead>
                <tr>
                  <th scope="col">Starts</th>
                  <th scope="col">Ends</th>
                  <th scope="col">Reason</th>
                </tr>
              </thead>
              <tbody>
                {mastersQuery.data.blackouts.length ? (
                  mastersQuery.data.blackouts.map((blackout, index) => (
                    <tr key={String(blackout.id ?? index)}>
                      <td>{formatBookingDateTime(String(blackout.starts_at ?? ""))}</td>
                      <td>{formatBookingDateTime(String(blackout.ends_at ?? ""))}</td>
                      <td>{String(blackout.reason ?? "—")}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="ki-dashboard-grid-empty">
                      No active blackouts.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          {canEdit ? (
            <section className="ki-dashboard-section" aria-label="Create blackout">
              <h2 className="ki-dashboard-section-title">Reserve resource time</h2>
              <form className="ki-patient-form" onSubmit={onCreateBlackout}>
                <div className="ki-patient-form-grid">
                  <FormField label="Starts at" htmlFor="blackout-starts">
                    <input
                      id="blackout-starts"
                      className="ki-input"
                      type="datetime-local"
                      value={startsAt}
                      onChange={(event) => setStartsAt(event.target.value)}
                      required
                    />
                  </FormField>
                  <FormField label="Ends at" htmlFor="blackout-ends">
                    <input
                      id="blackout-ends"
                      className="ki-input"
                      type="datetime-local"
                      value={endsAt}
                      onChange={(event) => setEndsAt(event.target.value)}
                      required
                    />
                  </FormField>
                  <FormField label="Chair (optional)" htmlFor="blackout-chair">
                    <select id="blackout-chair" className="ki-input" value={chairId} onChange={(event) => setChairId(event.target.value)}>
                      <option value="">All resources</option>
                      {mastersQuery.data.chairs.map((chair) => (
                        <option key={chair.id} value={chair.id}>
                          {chair.name ?? chair.code}
                        </option>
                      ))}
                    </select>
                  </FormField>
                  <FormField label="Reason" htmlFor="blackout-reason">
                    <input
                      id="blackout-reason"
                      className="ki-input"
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      required
                    />
                  </FormField>
                </div>
                {submitError ? <ErrorState title="Blackout failed" message={submitError} /> : null}
                <div className="ki-patient-form-actions">
                  <button type="submit" className="ki-btn ki-btn-primary" disabled={busy}>
                    {busy ? "Saving…" : "Save blackout"}
                  </button>
                </div>
              </form>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
