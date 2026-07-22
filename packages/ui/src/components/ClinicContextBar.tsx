import type { ReactNode } from "react";
import { SyncStatusIndicator, type SyncDisplayStatus, type SyncStatusMetrics } from "./SyncStatusIndicator.js";

export function ClinicContextBar(props: {
  clinicName: string;
  clinicCode: string;
  operationalDate: string;
  syncStatus: SyncDisplayStatus;
  syncMetrics?: SyncStatusMetrics;
  accountLabel: string;
  onSignOut: () => void;
  actions?: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--ki-space-3)",
        minHeight: "var(--ki-toolbar-height)",
        padding: "0 var(--ki-space-3)",
        borderBottom: "1px solid var(--ki-color-border)",
        background: "#eef2f6",
        flexWrap: "wrap",
      }}
    >
      <span style={{ fontWeight: 600 }}>
        Clinic: {props.clinicName} ({props.clinicCode})
      </span>
      <span style={{ color: "var(--ki-color-text-muted)" }}>Date: {props.operationalDate}</span>
      <SyncStatusIndicator status={props.syncStatus} metrics={props.syncMetrics} />
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "var(--ki-space-2)" }}>
        {props.actions}
        <span style={{ fontSize: "var(--ki-font-size-sm)", color: "var(--ki-color-text-muted)" }}>
          {props.accountLabel}
        </span>
        <button type="button" className="ki-btn" onClick={props.onSignOut}>
          Sign Out
        </button>
      </div>
    </div>
  );
}
