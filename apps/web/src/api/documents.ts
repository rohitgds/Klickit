import { apiFetch } from "./client.js";

export async function createPrintSnapshot(
  token: string,
  body: {
    documentType: "care_plan" | "medication_order" | "consent";
    sourceEntityType: string;
    sourceEntityId: string;
    templateGroupCode: string;
    templateKey: string;
    templateVersion: number;
    layout: Record<string, unknown>;
    payload: Record<string, unknown>;
  },
): Promise<{ id: string }> {
  return apiFetch<{ id: string }>("/documents/print-snapshots", { method: "POST", body: JSON.stringify(body) }, token);
}

export async function fetchPrintCatalog(token: string): Promise<{ templates: Array<{ groupCode: string; key: string }> }> {
  return apiFetch<{ templates: Array<{ groupCode: string; key: string }> }>("/documents/print-catalog", {}, token);
}
