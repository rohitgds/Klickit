export type SyncDisplayStatus = "online" | "local-offline" | "read-only" | "disconnected";

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

export function SyncStatusIndicator({ status }: { status: SyncDisplayStatus }) {
  const style = LABELS[status];
  return (
    <span
      aria-label={style.text}
      title={style.text}
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
      {style.text}
    </span>
  );
}
