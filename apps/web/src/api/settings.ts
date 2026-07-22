import { apiFetch } from "./client.js";

export interface StaffMember {
  id: string;
  displayName: string;
  staffType: string;
}

export interface UserAccount {
  id: string;
  loginName: string;
  status: string;
}

export async function fetchStaffDirectory(token: string): Promise<{ staff: StaffMember[] }> {
  return apiFetch<{ staff: StaffMember[] }>("/identity/staff", {}, token);
}

export async function createStaffMember(
  token: string,
  body: { displayName: string; staffType: string },
): Promise<{ id: string }> {
  return apiFetch<{ id: string }>("/identity/staff", { method: "POST", body: JSON.stringify(body) }, token);
}

export async function fetchUsers(token: string): Promise<{ users: UserAccount[] }> {
  return apiFetch<{ users: UserAccount[] }>("/identity/users", {}, token);
}

export async function fetchClinics(token: string): Promise<{ clinics: Array<{ id: string; name: string; clinicCode: string }> }> {
  return apiFetch<{ clinics: Array<{ id: string; name: string; clinicCode: string }> }>("/identity/clinics", {}, token);
}
