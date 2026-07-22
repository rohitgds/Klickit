import type { ReactNode } from "react";

export function FormField(props: {
  label: string;
  htmlFor: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="ki-field">
      <label className="ki-label" htmlFor={props.htmlFor}>
        {props.label}
      </label>
      {props.children}
      {props.error ? <span className="ki-error-text">{props.error}</span> : null}
    </div>
  );
}
