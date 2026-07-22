import type { ReactNode } from "react";

export function PermissionGuard(props: {
  allowed: boolean;
  permissionCode: string;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  if (props.allowed) {
    return <>{props.children}</>;
  }
  return (
    <>
      {props.fallback ?? (
        <div
          role="alert"
          style={{
            border: "1px solid var(--ki-color-border)",
            background: "var(--ki-color-surface)",
            padding: "var(--ki-space-3)",
            borderRadius: "var(--ki-radius-sm)",
          }}
        >
          Access denied. Required permission: <code>{props.permissionCode}</code>
        </div>
      )}
    </>
  );
}
