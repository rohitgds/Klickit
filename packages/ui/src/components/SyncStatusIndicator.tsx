export type SyncDisplayStatus = "online" | "local-offline" | "read-only" | "disconnected";

export type SyncStatusMetrics = {
  pendingOutbox?: number;
  failedOutbox?: number;
  openConflicts?: number;
  deadLetters?: number;
};

const LABELS: Record<SyncDisplayStatus, { text: string; bg: string; color: string; border: string }> = {
  online: {
    text: "Sync: Online",
    bg: "var(--ki-color-success-bg)",
    color: "var(--ki-color-success)",
    border: "#86efac",
  },
  "local-offline": {
    text: "Sync: Local only",
    bg: "var(--ki-color-warning-bg)",
    color: "var(--ki-color-warning)",
    border: "#fcd34d",
  },
  "read-only": {
    text: "Sync: Read-only (72h limit)",
    bg: "var(--ki-color-error-bg)",
    color: "var(--ki-color-error)",
    border: "#fca5a5",
  },
  disconnected: {
    text: "Sync: Gateway unreachable",
    bg: "var(--ki-color-disabled-bg)",
    color: "var(--ki-color-disabled-text)",
    border: "var(--ki-color-border)",
  },
};

export function SyncStatusIndicator({
  status,
  metrics,
}: {
  status: SyncDisplayStatus;
  metrics?: SyncStatusMetrics;
}) {
  const style = LABELS[status];
  const parts: string[] = [style.text];
  if (metrics?.pendingOutbox && metrics.pendingOutbox > 0) {
    parts.push(`${metrics.pendingOutbox} pending`);
  }
  if (metrics?.failedOutbox && metrics.failedOutbox > 0) {
    parts.push(`${metrics.failedOutbox} failed`);
  }
  if (metrics?.openConflicts && metrics.openConflicts > 0) {
    parts.push(`${metrics.openConflicts} conflicts`);
  }
  const label = parts.join(" · ");
  return (
    <span
      aria-label={label}
      title={label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        minHeight: "24px",
        padding: "0 8px",
        borderRadius: "var(--ki-radius-sm)",
        border: `1px solid ${style.border}`,
        background: style.bg,
        color: style.color,
        fontSize: "var(--ki-font-size-xs)",
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}
