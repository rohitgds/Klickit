import { apiFetch } from "./client.js";
import type { ClinicConfigResponse, LoginResponse } from "./types.js";

export async function createDevSession(loginName = "dev.admin"): Promise<LoginResponse> {
  return apiFetch<LoginResponse>("/auth/dev/session", {
    method: "POST",
    body: JSON.stringify({ loginName }),
  });
}

export async function loginWithPassword(input: {
  loginName: string;
  password: string;
}): Promise<LoginResponse> {
  return apiFetch<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function logoutSession(token: string): Promise<void> {
  await apiFetch("/auth/logout", { method: "POST" }, token);
}

export async function fetchSession(token: string): Promise<{ session: LoginResponse["session"] }> {
  return apiFetch("/auth/session", {}, token);
}

export async function fetchClinicConfig(): Promise<ClinicConfigResponse> {
  return apiFetch<ClinicConfigResponse>("/clinic/config");
}

export async function fetchEffectivePermissions(token: string): Promise<{ permissionCodes: string[] }> {
  return apiFetch<{ permissionCodes: string[] }>("/security/permissions/effective", {}, token);
}
