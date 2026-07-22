import {
  buildEncounterNotesPath,
  buildEncounterOdontogramPath,
  buildEncounterWorkspacePath,
} from "../config/clinical.js";
import { apiFetch } from "./client.js";

export interface EncounterWorkspace {
  encounterId: string;
  patientId: string;
  clinicId: string;
  leadClinicianId: string;
  status: string;
  safety: { allergies: string[]; readOnlyCrossClinic: boolean };
  counts: { findings: number; diagnoses: number; openDeliveries: number };
}

export interface ClinicalNote {
  id: string;
  note_type?: string;
  noteType?: string;
  body: string;
  signed_at?: string | null;
  signedAt?: string | null;
  created_at?: string;
  createdAt?: string;
}

export interface OdontogramFinding {
  id: string;
  tooth_code?: string;
  toothCode?: string;
  finding_code?: string;
  findingCode?: string;
  notes?: string | null;
}

export async function fetchEncounterWorkspace(token: string, encounterId: string): Promise<EncounterWorkspace> {
  return apiFetch<EncounterWorkspace>(buildEncounterWorkspacePath(encounterId), {}, token);
}

export async function fetchEncounterNotes(
  token: string,
  encounterId: string,
): Promise<{ notes: ClinicalNote[] }> {
  return apiFetch<{ notes: ClinicalNote[] }>(buildEncounterNotesPath(encounterId), {}, token);
}

export async function createClinicalNote(
  token: string,
  encounterId: string,
  body: { patientId: string; clinicianId: string; noteType: string; body: string },
): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(
    buildEncounterNotesPath(encounterId),
    { method: "POST", body: JSON.stringify(body) },
    token,
  );
}

export async function signClinicalNote(token: string, noteId: string): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(`/clinical/notes/${encodeURIComponent(noteId)}/sign`, { method: "POST" }, token);
}

export async function fetchOdontogramFindings(
  token: string,
  encounterId: string,
): Promise<{ findings: OdontogramFinding[] }> {
  return apiFetch<{ findings: OdontogramFinding[] }>(buildEncounterOdontogramPath(encounterId), {}, token);
}

export async function createOdontogramFinding(
  token: string,
  encounterId: string,
  body: { patientId: string; toothCode: string; findingCode: string; notes?: string },
): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(
    `/clinical/encounters/${encodeURIComponent(encounterId)}/findings`,
    { method: "POST", body: JSON.stringify(body) },
    token,
  );
}

export async function registerPatientFile(
  token: string,
  body: {
    patientId: string;
    encounterId?: string;
    storageKey: string;
    mimeType: string;
    byteSize: number;
    payload: string;
    category?: string;
    caption?: string;
  },
): Promise<{ id: string; pdfWarning?: boolean }> {
  return apiFetch<{ id: string; pdfWarning?: boolean }>(
    "/clinical/files/register",
    { method: "POST", body: JSON.stringify(body) },
    token,
  );
}
