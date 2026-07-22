import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { EmptyState, ErrorState, LoadingState, PermissionGuard } from "@klickit/ui";
import {
  checkInBooking,
  checkoutEncounter,
  engageEncounter,
  fetchClinicalQueue,
  releaseEncounter,
} from "../api/clinicalQueue.js";
import { fetchSchedulingMasters, fetchStaff } from "../api/scheduling.js";
import { UnscheduledEncounterPanel } from "../components/UnscheduledEncounterPanel.js";
import { useAuth } from "../auth/AuthContext.js";
import { formatDateParamInTimezone } from "../config/dashboard.js";
import {
  encounterActionAvailability,
  filterEncountersByClinician,
  filterEncountersByPatientQuery,
  formatEncounterStatus,
} from "../config/clinicalQueue.js";
import { formatBookingTime, lookupMasterName, lookupStaffName } from "../config/scheduling.js";
import type { QueueEncounter } from "../api/types.js";

export function ClinicalQueuePage() {
  const auth = useAuth();
  const timezone = auth.clinicConfig?.clinic?.timezone ?? "Asia/Kolkata";
  const canView = auth.hasPermission("queue.view");
  const canAdmit = auth.hasPermission("queue.admit");
  const canEngage = auth.hasPermission("queue.engage");
  const canRelease = auth.hasPermission("queue.release");

  const [encounterDate, setEncounterDate] = useState(() => formatDateParamInTimezone(new Date(), timezone));
  const [clinicianFilter, setClinicianFilter] = useState("");
  const [patientFilter, setPatientFilter] = useState("");
  const [admitOpen, setAdmitOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyEncounterId, setBusyEncounterId] = useState<string | null>(null);

  const queueQuery = useQuery({
    queryKey: ["clinical-queue", encounterDate, auth.token],
    queryFn: () => fetchClinicalQueue(auth.token!, encounterDate),
    enabled: Boolean(auth.token && canView),
  });

  const mastersQuery = useQuery({
    queryKey: ["scheduling", "masters", auth.token],
    queryFn: () => fetchSchedulingMasters(auth.token!),
    enabled: Boolean(auth.token && canView),
  });

  const staffQuery = useQuery({
    queryKey: ["identity", "staff", auth.token],
    queryFn: () => fetchStaff(auth.token!),
    enabled: Boolean(auth.token && canView),
  });

  const encounters = useMemo(() => {
    const filtered = filterEncountersByClinician(queueQuery.data?.encounters ?? [], clinicianFilter);
    return filterEncountersByPatientQuery(filtered, patientFilter);
  }, [queueQuery.data?.encounters, clinicianFilter, patientFilter]);

  if (!canView) {
    return (
      <PermissionGuard allowed={false} permissionCode="queue.view">
        <span />
      </PermissionGuard>
    );
  }

  async function refreshQueue() {
    setActionError(null);
    await queueQuery.refetch();
  }

  async function runEncounterAction(
    encounterId: string,
    action: "engage" | "release" | "checkout",
  ) {
    if (!auth.token) {
      return;
    }
    setBusyEncounterId(encounterId);
    setActionError(null);
    try {
      if (action === "engage") {
        await engageEncounter(auth.token, encounterId);
      } else if (action === "release") {
        await releaseEncounter(auth.token, encounterId);
      } else {
        await checkoutEncounter(auth.token, encounterId);
      }
      await refreshQueue();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Queue action failed");
    } finally {
      setBusyEncounterId(null);
    }
  }

  async function runCheckIn(bookingId: string) {
    if (!auth.token || !canAdmit) {
      return;
    }
    setBusyEncounterId(bookingId);
    setActionError(null);
    try {
      await checkInBooking(auth.token, bookingId, encounterDate);
      await refreshQueue();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Check-in failed");
    } finally {
      setBusyEncounterId(null);
    }
  }

  function renderEncounterActions(encounter: QueueEncounter) {
    const actions = encounterActionAvailability(encounter.status);
    return (
      <div className="ki-queue-actions">
        {actions.canEngage && canEngage ? (
          <button
            type="button"
            className="ki-btn"
            disabled={busyEncounterId === encounter.id}
            onClick={() => {
              void runEncounterAction(encounter.id, "engage");
            }}
          >
            Begin care
          </button>
        ) : null}
        {actions.canRelease && canRelease ? (
          <button
            type="button"
            className="ki-btn"
            disabled={busyEncounterId === encounter.id}
            onClick={() => {
              void runEncounterAction(encounter.id, "release");
            }}
          >
            Release
          </button>
        ) : null}
        {actions.canCheckout && canRelease ? (
          <button
            type="button"
            className="ki-btn"
            disabled={busyEncounterId === encounter.id}
            onClick={() => {
              void runEncounterAction(encounter.id, "checkout");
            }}
          >
            Checkout
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="ki-clinical-queue">
      <div className="ki-dashboard-toolbar">
        <button
          type="button"
          className="ki-btn ki-dashboard-icon-btn"
          title="Refresh queue"
          aria-label="Refresh queue"
          onClick={() => {
            void refreshQueue();
          }}
        >
          ↻
        </button>
        {canAdmit ? (
          <button type="button" className="ki-btn ki-btn-primary" onClick={() => setAdmitOpen(true)}>
            Add Unscheduled Encounter
          </button>
        ) : null}
        <label className="ki-dashboard-date-field">
          <span className="ki-dashboard-date-label">Operational date</span>
          <input
            className="ki-input ki-dashboard-date-input"
            type="date"
            value={encounterDate}
            onChange={(event) => setEncounterDate(event.target.value)}
          />
        </label>
      </div>

      <div className="ki-scheduler-filters">
        <label className="ki-scheduler-filter">
          <span className="ki-dashboard-date-label">Lead clinician</span>
          <select className="ki-input" value={clinicianFilter} onChange={(event) => setClinicianFilter(event.target.value)}>
            <option value="">All clinicians</option>
            {(staffQuery.data?.staff ?? [])
              .filter((member) => member.staffType === "clinician")
              .map((member) => (
                <option key={member.id} value={member.id}>
                  {member.displayName}
                </option>
              ))}
          </select>
        </label>
        <label className="ki-scheduler-filter">
          <span className="ki-dashboard-date-label">Patient lookup</span>
          <input
            className="ki-input"
            value={patientFilter}
            onChange={(event) => setPatientFilter(event.target.value)}
            placeholder="Patient ID fragment"
          />
        </label>
      </div>

      {actionError ? <ErrorState title="Queue action failed" message={actionError} onRetry={() => void refreshQueue()} /> : null}

      {queueQuery.isLoading ? <LoadingState label="Loading clinical queue…" /> : null}

      {queueQuery.isError ? (
        <ErrorState
          title="Queue unavailable"
          message={queueQuery.error instanceof Error ? queueQuery.error.message : "Could not load queue."}
          onRetry={() => {
            void queueQuery.refetch();
          }}
        />
      ) : null}

      {queueQuery.isSuccess ? (
        <>
          <section className="ki-dashboard-section" aria-label="Queue encounters">
            <h2 className="ki-dashboard-section-title">Active queue — {encounterDate}</h2>
            {encounters.length === 0 ? (
              <EmptyState
                title="No encounters in queue"
                description="Admit a walk-in patient or check in a booking for this date."
                action={
                  canAdmit ? (
                    <button type="button" className="ki-btn ki-btn-primary" onClick={() => setAdmitOpen(true)}>
                      Add Unscheduled Encounter
                    </button>
                  ) : undefined
                }
              />
            ) : (
              <table className="ki-dashboard-table ki-patient-table">
                <thead>
                  <tr>
                    <th scope="col" className="ki-dashboard-index-col">
                      #
                    </th>
                    <th scope="col">Patient</th>
                    <th scope="col">Type</th>
                    <th scope="col">Status</th>
                    <th scope="col">Clinician</th>
                    <th scope="col">Chair</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {encounters.map((encounter) => (
                    <tr key={encounter.id}>
                      <td className="ki-dashboard-num-col">{encounter.queueSequence}</td>
                      <td>
                        <Link to={`/patient-registry/${encounter.patientId}`}>
                          {encounter.patientId.slice(0, 8)}…
                        </Link>
                      </td>
                      <td>{encounter.encounterType}</td>
                      <td>{formatEncounterStatus(encounter.status)}</td>
                      <td>{lookupStaffName(staffQuery.data?.staff ?? [], encounter.leadClinicianId)}</td>
                      <td>
                        {encounter.chairId
                          ? lookupMasterName(mastersQuery.data?.chairs ?? [], encounter.chairId)
                          : "—"}
                      </td>
                      <td>{renderEncounterActions(encounter)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="ki-dashboard-section" aria-label="Arrival candidates">
            <h2 className="ki-dashboard-section-title">Arrivals expected (bookings)</h2>
            {(queueQuery.data.arrivalCandidates ?? []).length === 0 ? (
              <p className="ki-dashboard-note">No scheduled or confirmed bookings for this date.</p>
            ) : (
              <table className="ki-dashboard-table ki-patient-table">
                <thead>
                  <tr>
                    <th scope="col">Time</th>
                    <th scope="col">Patient</th>
                    <th scope="col">Status</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {queueQuery.data.arrivalCandidates.map((booking) => (
                    <tr key={booking.id}>
                      <td>{formatBookingTime(booking.startsAt)}</td>
                      <td>
                        {booking.patientId ? (
                          <Link to={`/patient-registry/${booking.patientId}`}>{booking.patientId.slice(0, 8)}…</Link>
                        ) : (
                          "Walk-in booking"
                        )}
                      </td>
                      <td>{booking.status}</td>
                      <td>
                        {canAdmit ? (
                          <button
                            type="button"
                            className="ki-btn"
                            disabled={busyEncounterId === booking.id}
                            onClick={() => {
                              void runCheckIn(booking.id);
                            }}
                          >
                            Check in
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      ) : null}

      <UnscheduledEncounterPanel
        open={admitOpen}
        onClose={() => setAdmitOpen(false)}
        encounterDate={encounterDate}
        masters={mastersQuery.data}
        staff={staffQuery.data?.staff ?? []}
        onSaved={() => {
          void refreshQueue();
        }}
      />
    </div>
  );
}
