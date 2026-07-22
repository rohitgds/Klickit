import type { ApiErrorBody } from "./types.js";
import { ApiError } from "./types.js";

export function resolveApiBase(): string {
  const configured =
    typeof import.meta !== "undefined" &&
    typeof import.meta.env !== "undefined" &&
    typeof import.meta.env.VITE_API_BASE === "string"
      ? import.meta.env.VITE_API_BASE
      : undefined;
  if (configured) {
    return configured.replace(/\/$/, "");
  }
  return "/api";
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const headers = new Headers(options.headers);
  if (token) {
    headers.set("x-session-token", token);
  }
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${resolveApiBase()}${path}`, {
    ...options,
    headers,
  });

  const text = await response.text();
  const data = text ? (JSON.parse(text) as T & ApiErrorBody) : ({} as T & ApiErrorBody);

  if (!response.ok) {
    throw new ApiError(data.error ?? `Request failed (${response.status})`, response.status);
  }

  return data as T;
}
