import type { ReactNode } from "react";
import { DemoBanner } from "./DemoBanner.js";
import { GlobalNavigation, type NavItem } from "./GlobalNavigation.js";
import { ClinicContextBar } from "./ClinicContextBar.js";
import type { SyncDisplayStatus } from "./SyncStatusIndicator.js";

export interface AppShellProps {
  productName: string;
  navItems: NavItem[];
  clinicName: string;
  clinicCode: string;
  operationalDate: string;
  syncStatus: SyncDisplayStatus;
  accountLabel: string;
  onSignOut: () => void;
  pageTitle: string;
  children: ReactNode;
}

export function AppShell(props: AppShellProps) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <DemoBanner />
      <GlobalNavigation productName={props.productName} items={props.navItems} />
      <ClinicContextBar
        clinicName={props.clinicName}
        clinicCode={props.clinicCode}
        operationalDate={props.operationalDate}
        syncStatus={props.syncStatus}
        accountLabel={props.accountLabel}
        onSignOut={props.onSignOut}
      />
      <div style={{ padding: "var(--ki-space-3) var(--ki-space-4) 0" }}>
        <h1 style={{ margin: "0 0 var(--ki-space-3)", fontSize: "18px", fontWeight: 700 }}>{props.pageTitle}</h1>
      </div>
      <main style={{ flex: 1, padding: "0 var(--ki-space-4) var(--ki-space-4)" }}>{props.children}</main>
    </div>
  );
}

export type { NavItem, SyncDisplayStatus };
