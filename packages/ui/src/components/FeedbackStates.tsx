import type { ReactNode } from "react";

export function EmptyState(props: { title: string; description: string; action?: ReactNode }) {
  return (
    <div
      style={{
        border: "1px dashed var(--ki-color-border)",
        borderRadius: "var(--ki-radius-sm)",
        padding: "var(--ki-space-4)",
        background: "var(--ki-color-surface)",
        textAlign: "center",
      }}
    >
      <h2 style={{ margin: "0 0 8px", fontSize: "var(--ki-font-size-lg)" }}>{props.title}</h2>
      <p style={{ margin: "0 0 12px", color: "var(--ki-color-text-muted)" }}>{props.description}</p>
      {props.action}
    </div>
  );
}

export function LoadingState(props: { label?: string }) {
  return (
    <div role="status" aria-live="polite" style={{ padding: "var(--ki-space-4)", color: "var(--ki-color-text-muted)" }}>
      {props.label ?? "Loading…"}
    </div>
  );
}

export function ErrorState(props: { title: string; message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      style={{
        border: "1px solid #fca5a5",
        background: "var(--ki-color-error-bg)",
        color: "var(--ki-color-error)",
        padding: "var(--ki-space-3)",
        borderRadius: "var(--ki-radius-sm)",
      }}
    >
      <strong>{props.title}</strong>
      <p style={{ margin: "8px 0" }}>{props.message}</p>
      {props.onRetry ? (
        <button type="button" className="ki-btn" onClick={props.onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  );
}
