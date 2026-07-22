import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AppShell, LoadingState } from "@klickit/ui";
import { PRODUCT_NAME } from "@klickit/shared";
import { useAuth } from "../auth/AuthContext.js";
import { fetchSyncStatus } from "../api/sync.js";
import {
  filterNavItemsByPermission,
  mapClinicConfigToSyncStatus,
  MODULE_PLACEHOLDERS,
  PILOT_NAV_ITEMS,
} from "../config/navigation.js";

function formatOperationalDate(timezone: string | undefined): string {
  try {
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: timezone ?? "Asia/Kolkata",
      dateStyle: "medium",
    }).format(new Date());
  } catch {
    return new Date().toLocaleDateString("en-IN");
  }
}

export function ProtectedLayout() {
  const auth = useAuth();
  const location = useLocation();

  if (auth.loading) {
    return <LoadingState label="Checking session…" />;
  }

  if (!auth.token || !auth.user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  const navItems = filterNavItemsByPermission(PILOT_NAV_ITEMS, auth.user.permissionCodes).map((item) => ({
    label: item.label,
    to: item.to,
    end: item.end,
  }));

  const syncStatusQuery = useQuery({
    queryKey: ["sync", "status", auth.token],
    queryFn: () => fetchSyncStatus(auth.token!),
    enabled: Boolean(auth.token),
    refetchInterval: 30_000,
  });

  const placeholder = MODULE_PLACEHOLDERS[location.pathname];
  const pageTitle = (() => {
    if (location.pathname === "/dashboard") {
      return "Dashboard";
    }
    if (location.pathname === "/patient-registry") {
      return "Patient Registry";
    }
    if (location.pathname === "/patient-registry/register") {
      return "Register Patient";
    }
    if (location.pathname.startsWith("/patient-registry/")) {
      return "Patient Profile";
    }
    if (location.pathname === "/scheduler") {
      return "Scheduler";
    }
    if (location.pathname === "/scheduler/setup") {
      return "Scheduler Setup";
    }
    if (location.pathname === "/clinical-queue") {
      return "Clinical Queue";
    }
    if (location.pathname.startsWith("/clinical/encounters/")) {
      return "Clinical Encounter";
    }
    if (location.pathname === "/financial-operations") {
      return "Financial Operations";
    }
    if (location.pathname === "/comms-center") {
      return "Comms Center";
    }
    if (location.pathname === "/system-configuration") {
      return "System Configuration";
    }
    if (location.pathname === "/pilot-demo") {
      return "Pilot Demo";
    }
    return placeholder?.title ?? "KlickIt";
  })();

  return (
    <AppShell
      productName={PRODUCT_NAME}
      navItems={navItems}
      clinicName={auth.clinicConfig?.clinic?.name ?? "Clinic"}
      clinicCode={auth.clinicConfig?.clinicCode ?? auth.clinicConfig?.clinic?.clinicCode ?? "—"}
      operationalDate={formatOperationalDate(auth.clinicConfig?.clinic?.timezone)}
      syncStatus={
        auth.clinicConfig
          ? mapClinicConfigToSyncStatus(auth.clinicConfig)
          : "disconnected"
      }
      syncMetrics={
        syncStatusQuery.data
          ? {
              pendingOutbox: syncStatusQuery.data.pendingOutbox,
              failedOutbox: syncStatusQuery.data.failedOutbox,
              openConflicts: syncStatusQuery.data.openConflicts,
            }
          : undefined
      }
      accountLabel={`User ${auth.user.userId.slice(0, 8)}…`}
      onSignOut={() => {
        void auth.logout();
      }}
      pageTitle={pageTitle}
    >
      <Outlet />
    </AppShell>
  );
}
