import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { EmptyState, ErrorState, LoadingState, PermissionGuard } from "@klickit/ui";
import { fetchOperationalDashboard } from "../api/dashboard.js";
import { useAuth } from "../auth/AuthContext.js";
import {
  buildDashboardMetricRows,
  DASHBOARD_QUICK_ACTIONS,
  dashboardHasActivity,
  filterQuickActionsByPermission,
  formatDateParamInTimezone,
} from "../config/dashboard.js";

export function DashboardPage() {
  const auth = useAuth();
  const timezone = auth.clinicConfig?.clinic?.timezone ?? "Asia/Kolkata";
  const [selectedDate, setSelectedDate] = useState(() => formatDateParamInTimezone(new Date(), timezone));

  const canView = auth.hasPermission("scheduler.view");

  const dashboardQuery = useQuery({
    queryKey: ["dashboard", "operational-daily", selectedDate, auth.token],
    queryFn: () => fetchOperationalDashboard(auth.token!, selectedDate),
    enabled: Boolean(auth.token && canView),
  });

  const quickActions = useMemo(
    () => filterQuickActionsByPermission(DASHBOARD_QUICK_ACTIONS, auth.user?.permissionCodes ?? []),
    [auth.user?.permissionCodes],
  );

  const metricRows = dashboardQuery.data ? buildDashboardMetricRows(dashboardQuery.data) : [];
  const hasActivity = dashboardQuery.data ? dashboardHasActivity(dashboardQuery.data) : false;

  if (!canView) {
    return (
      <PermissionGuard allowed={false} permissionCode="scheduler.view">
        <span />
      </PermissionGuard>
    );
  }

  return (
    <div className="ki-dashboard">
      <div className="ki-dashboard-toolbar">
        <label className="ki-dashboard-date-field">
          <span className="ki-dashboard-date-label">Operational date</span>
          <input
            className="ki-input ki-dashboard-date-input"
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
          />
        </label>
        <button
          type="button"
          className="ki-btn ki-dashboard-icon-btn"
          title="Refresh dashboard"
          aria-label="Refresh dashboard"
          onClick={() => {
            void dashboardQuery.refetch();
          }}
          disabled={dashboardQuery.isFetching}
        >
          ↻
        </button>
      </div>

      <div className="ki-dashboard-actions" aria-label="Dashboard quick actions">
        {quickActions.map((action) => (
          <Link
            key={action.label}
            to={action.route}
            className="ki-btn ki-dashboard-action-btn"
            title={`Opens ${action.route} (${action.targetModule})`}
          >
            {action.label}
          </Link>
        ))}
      </div>

      {dashboardQuery.isLoading ? <LoadingState label="Loading operational summary…" /> : null}

      {dashboardQuery.isError ? (
        <ErrorState
          title="Dashboard unavailable"
          message={
            dashboardQuery.error instanceof Error
              ? dashboardQuery.error.message
              : "Could not load operational summary."
          }
          onRetry={() => {
            void dashboardQuery.refetch();
          }}
        />
      ) : null}

      {dashboardQuery.data ? (
        <>
          <section className="ki-dashboard-section" aria-label="Operational counts">
            <h2 className="ki-dashboard-section-title">Today&apos;s counts</h2>
            <table className="ki-dashboard-table ki-dashboard-metrics">
              <thead>
                <tr>
                  <th scope="col">Metric</th>
                  <th scope="col" className="ki-dashboard-num-col">
                    Count
                  </th>
                </tr>
              </thead>
              <tbody>
                {metricRows.map((row) => (
                  <tr key={row.key}>
                    <td>{row.label}</td>
                    <td className="ki-dashboard-num-col">{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="ki-dashboard-section" aria-label="Operational activity">
            <h2 className="ki-dashboard-section-title">Operational activity</h2>
            {hasActivity ? (
              <p className="ki-dashboard-note">
                Detailed patient and booking rows will appear here when scheduler and queue modules are
                connected. Counts above are live from the gateway for {dashboardQuery.data.date}.
              </p>
            ) : (
              <EmptyState
                title="No activity for this date"
                description="There are no bookings, queue entries, no-shows or cancellations recorded for the selected operational date."
              />
            )}
            <table className="ki-dashboard-table ki-dashboard-grid">
              <thead>
                <tr>
                  <th scope="col" className="ki-dashboard-index-col">
                    #
                  </th>
                  <th scope="col">Name</th>
                  <th scope="col" className="ki-dashboard-time-col">
                    Time
                  </th>
                  <th scope="col" className="ki-dashboard-clinician-col">
                    Lead clinician
                  </th>
                  <th scope="col" className="ki-dashboard-status-col">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={5} className="ki-dashboard-grid-empty">
                    Activity rows are not yet exposed by the gateway API. Module 2 shows live summary
                    counts only.
                  </td>
                </tr>
              </tbody>
            </table>
          </section>
        </>
      ) : null}
    </div>
  );
}
