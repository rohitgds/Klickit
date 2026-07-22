import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { SchedulerViewType } from "@klickit/scheduling";
import { useQuery } from "@tanstack/react-query";
import { EmptyState, ErrorState, LoadingState, PermissionGuard } from "@klickit/ui";
import { fetchSchedulerView, fetchSchedulingMasters, fetchStaff } from "../api/scheduling.js";
import { BookingEditorPanel } from "../components/BookingEditorPanel.js";
import { useAuth } from "../auth/AuthContext.js";
import { formatDateParamInTimezone } from "../config/dashboard.js";
import {
  formatBookingDateTime,
  formatBookingTime,
  groupBookingsByDay,
  lookupMasterName,
  lookupStaffName,
  SCHEDULER_VIEW_OPTIONS,
  shiftSchedulerAnchorDate,
} from "../config/scheduling.js";
import type { CareBooking } from "../api/types.js";

export function SchedulerPage() {
  const auth = useAuth();
  const timezone = auth.clinicConfig?.clinic?.timezone ?? "Asia/Kolkata";
  const canView = auth.hasPermission("scheduler.view");
  const canCreate = auth.hasPermission("scheduler.create");

  const [viewType, setViewType] = useState<SchedulerViewType>("day");
  const [anchorDate, setAnchorDate] = useState(() => formatDateParamInTimezone(new Date(), timezone));
  const [chairFilter, setChairFilter] = useState("");
  const [clinicianFilter, setClinicianFilter] = useState("");
  const [selectedBooking, setSelectedBooking] = useState<CareBooking | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [createMode, setCreateMode] = useState(false);

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

  const viewQuery = useQuery({
    queryKey: ["scheduling", "view", viewType, anchorDate, chairFilter, clinicianFilter, auth.token],
    queryFn: () =>
      fetchSchedulerView(auth.token!, {
        viewType,
        date: anchorDate,
        chairId: chairFilter || undefined,
        leadClinicianId: clinicianFilter || undefined,
      }),
    enabled: Boolean(auth.token && canView),
  });

  const bookings = viewQuery.data?.bookings ?? [];
  const grouped = useMemo(() => groupBookingsByDay(bookings), [bookings]);

  if (!canView) {
    return (
      <PermissionGuard allowed={false} permissionCode="scheduler.view">
        <span />
      </PermissionGuard>
    );
  }

  function openCreateBooking() {
    setSelectedBooking(null);
    setCreateMode(true);
    setEditorOpen(true);
  }

  function openBooking(booking: CareBooking) {
    setSelectedBooking(booking);
    setCreateMode(false);
    setEditorOpen(true);
  }

  function renderBookingRows(rows: CareBooking[]) {
    if (!rows.length) {
      return (
        <tr>
          <td colSpan={6} className="ki-dashboard-grid-empty">
            No bookings in this range.
          </td>
        </tr>
      );
    }
    return rows.map((booking) => (
      <tr key={booking.id}>
        <td>{formatBookingTime(booking.startsAt)}</td>
        <td>{formatBookingTime(booking.endsAt)}</td>
        <td>{lookupMasterName(mastersQuery.data?.chairs ?? [], booking.chairId)}</td>
        <td>{lookupStaffName(staffQuery.data?.staff ?? [], booking.leadClinicianId)}</td>
        <td>{booking.status}</td>
        <td>
          <button type="button" className="ki-btn" onClick={() => openBooking(booking)}>
            Open
          </button>
        </td>
      </tr>
    ));
  }

  return (
    <div className="ki-scheduler">
      <div className="ki-dashboard-toolbar">
        <button
          type="button"
          className="ki-btn ki-dashboard-icon-btn"
          title="Refresh scheduler"
          aria-label="Refresh scheduler"
          onClick={() => {
            void viewQuery.refetch();
          }}
        >
          ↻
        </button>
        {canCreate ? (
          <button type="button" className="ki-btn ki-btn-primary" onClick={openCreateBooking}>
            Create Booking
          </button>
        ) : null}
        <Link to="/scheduler/setup" className="ki-btn">
          Setup
        </Link>
        <div className="ki-scheduler-view-switch" role="tablist" aria-label="Scheduler views">
          {SCHEDULER_VIEW_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={viewType === option.value}
              className={`ki-btn ${viewType === option.value ? "ki-tab-active" : ""}`}
              onClick={() => setViewType(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="ki-btn"
          onClick={() => setAnchorDate(shiftSchedulerAnchorDate(viewType, anchorDate, -1))}
        >
          Previous
        </button>
        <label className="ki-dashboard-date-field">
          <span className="ki-dashboard-date-label">Anchor date</span>
          <input
            className="ki-input ki-dashboard-date-input"
            type="date"
            value={anchorDate}
            onChange={(event) => setAnchorDate(event.target.value)}
          />
        </label>
        <button
          type="button"
          className="ki-btn"
          onClick={() => setAnchorDate(formatDateParamInTimezone(new Date(), timezone))}
        >
          Today
        </button>
        <button
          type="button"
          className="ki-btn"
          onClick={() => setAnchorDate(shiftSchedulerAnchorDate(viewType, anchorDate, 1))}
        >
          Next
        </button>
      </div>

      <div className="ki-scheduler-filters">
        <label className="ki-scheduler-filter">
          <span className="ki-dashboard-date-label">Chair</span>
          <select className="ki-input" value={chairFilter} onChange={(event) => setChairFilter(event.target.value)}>
            <option value="">All chairs</option>
            {(mastersQuery.data?.chairs ?? []).map((chair) => (
              <option key={chair.id} value={chair.id}>
                {chair.name ?? chair.code}
              </option>
            ))}
          </select>
        </label>
        <label className="ki-scheduler-filter">
          <span className="ki-dashboard-date-label">Lead clinician</span>
          <select
            className="ki-input"
            value={clinicianFilter}
            onChange={(event) => setClinicianFilter(event.target.value)}
          >
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
      </div>

      {viewQuery.isLoading || mastersQuery.isLoading ? <LoadingState label="Loading scheduler…" /> : null}

      {viewQuery.isError ? (
        <ErrorState
          title="Scheduler unavailable"
          message={viewQuery.error instanceof Error ? viewQuery.error.message : "Could not load scheduler view."}
          onRetry={() => {
            void viewQuery.refetch();
          }}
        />
      ) : null}

      {viewQuery.isSuccess ? (
        <>
          {bookings.length === 0 ? (
            <EmptyState
              title="No bookings in view"
              description="Create a booking or change the date range."
              action={
                canCreate ? (
                  <button type="button" className="ki-btn ki-btn-primary" onClick={openCreateBooking}>
                    Create Booking
                  </button>
                ) : undefined
              }
            />
          ) : (
            <section className="ki-dashboard-section" aria-label="Scheduler bookings">
              {viewType === "month" ? (
                [...grouped.entries()].map(([day, dayBookings]) => (
                  <div key={day} className="ki-scheduler-day-group">
                    <h3 className="ki-scheduler-day-title">{day}</h3>
                    <table className="ki-dashboard-table ki-patient-table">
                      <thead>
                        <tr>
                          <th scope="col">Start</th>
                          <th scope="col">End</th>
                          <th scope="col">Chair</th>
                          <th scope="col">Clinician</th>
                          <th scope="col">Status</th>
                          <th scope="col">Actions</th>
                        </tr>
                      </thead>
                      <tbody>{renderBookingRows(dayBookings)}</tbody>
                    </table>
                  </div>
                ))
              ) : viewType === "resource" ? (
                (mastersQuery.data?.chairs ?? []).map((chair) => {
                  const chairBookings = bookings.filter((booking) => booking.chairId === chair.id);
                  return (
                    <div key={chair.id} className="ki-scheduler-day-group">
                      <h3 className="ki-scheduler-day-title">{chair.name ?? chair.code}</h3>
                      <table className="ki-dashboard-table ki-patient-table">
                        <thead>
                          <tr>
                            <th scope="col">Start</th>
                            <th scope="col">End</th>
                            <th scope="col">Clinician</th>
                            <th scope="col">Status</th>
                            <th scope="col">When</th>
                            <th scope="col">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {chairBookings.length ? (
                            chairBookings.map((booking) => (
                              <tr key={booking.id}>
                                <td>{formatBookingTime(booking.startsAt)}</td>
                                <td>{formatBookingTime(booking.endsAt)}</td>
                                <td>{lookupStaffName(staffQuery.data?.staff ?? [], booking.leadClinicianId)}</td>
                                <td>{booking.status}</td>
                                <td>{formatBookingDateTime(booking.startsAt)}</td>
                                <td>
                                  <button type="button" className="ki-btn" onClick={() => openBooking(booking)}>
                                    Open
                                  </button>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={6} className="ki-dashboard-grid-empty">
                                No bookings on this chair.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  );
                })
              ) : (
                <table className="ki-dashboard-table ki-patient-table">
                  <thead>
                    <tr>
                      <th scope="col">Start</th>
                      <th scope="col">End</th>
                      <th scope="col">Chair</th>
                      <th scope="col">Clinician</th>
                      <th scope="col">Status</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>{renderBookingRows(bookings)}</tbody>
                </table>
              )}
            </section>
          )}
        </>
      ) : null}

      <BookingEditorPanel
        open={editorOpen}
        onClose={() => {
          setEditorOpen(false);
          setCreateMode(false);
        }}
        masters={mastersQuery.data}
        staff={staffQuery.data?.staff ?? []}
        defaultDate={anchorDate}
        booking={createMode ? null : selectedBooking}
        onSaved={() => {
          void viewQuery.refetch();
        }}
      />
    </div>
  );
}
