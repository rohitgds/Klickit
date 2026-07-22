export function DemoBanner() {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        background: "var(--ki-color-demo-bg)",
        color: "var(--ki-color-demo-text)",
        textAlign: "center",
        fontSize: "var(--ki-font-size-sm)",
        fontWeight: 700,
        letterSpacing: "0.04em",
        padding: "6px var(--ki-space-3)",
        borderBottom: "1px solid #9a3412",
      }}
    >
      DEMO DATA — NOT REAL PATIENT DATA
    </div>
  );
}
