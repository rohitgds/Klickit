import { NavLink } from "react-router-dom";

export interface NavItem {
  label: string;
  to: string;
  end?: boolean;
}

export function GlobalNavigation(props: { productName: string; items: NavItem[] }) {
  return (
    <nav
      aria-label="Primary"
      style={{
        display: "flex",
        alignItems: "stretch",
        minHeight: "var(--ki-nav-height)",
        borderBottom: "1px solid var(--ki-color-border)",
        background: "var(--ki-color-surface)",
        overflowX: "auto",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "0 var(--ki-space-3)",
          fontWeight: 700,
          fontSize: "var(--ki-font-size-lg)",
          whiteSpace: "nowrap",
          borderRight: "1px solid var(--ki-color-border)",
        }}
      >
        {props.productName}
      </div>
      <div style={{ display: "flex", alignItems: "stretch" }}>
        {props.items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            style={({ isActive }) => ({
              display: "inline-flex",
              alignItems: "center",
              padding: "0 var(--ki-space-3)",
              minHeight: "var(--ki-nav-height)",
              borderRight: "1px solid var(--ki-color-border)",
              textDecoration: "none",
              color: isActive ? "var(--ki-color-primary)" : "var(--ki-color-text)",
              fontWeight: isActive ? 700 : 500,
              background: isActive ? "#eef6fb" : "transparent",
              whiteSpace: "nowrap",
            })}
          >
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
