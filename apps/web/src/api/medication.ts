import { apiFetch } from "./client.js";

export interface MedicationCatalogItem {
  id: string;
  generic_name?: string;
  genericName?: string;
  brand_name?: string;
  brandName?: string;
}

export async function searchMedicationCatalog(
  token: string,
  query: string,
): Promise<{ medications: MedicationCatalogItem[] }> {
  return apiFetch<{ medications: MedicationCatalogItem[] }>(
    `/medication/catalog/search?q=${encodeURIComponent(query)}`,
    {},
    token,
  );
}

export async function createMedicationOrderDraft(
  token: string,
  body: { patientId: string; encounterId: string; clinicianStaffId: string; notes?: string },
): Promise<{ id: string }> {
  return apiFetch<{ id: string }>("/medication/orders", { method: "POST", body: JSON.stringify(body) }, token);
}

export async function saveMedicationOrder(
  token: string,
  orderId: string,
  body: {
    diagnoses: Array<{ diagnosisId: string; sequenceNo: number }>;
    serviceLinks: Array<{ serviceId: string; sequenceNo: number }>;
    lines: Array<{
      medicationId?: string;
      takeText: string;
      frequency: string;
      durationValue: number;
      durationPeriod: "days" | "weeks" | "months";
      sequenceNo: number;
      instructions?: string;
    }>;
  },
): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(
    `/medication/orders/${encodeURIComponent(orderId)}/save`,
    { method: "POST", body: JSON.stringify(body) },
    token,
  );
}

export async function signMedicationOrder(
  token: string,
  orderId: string,
  body: { clinicianStaffId: string; signingPin: string },
): Promise<{ id: string; status: string }> {
  return apiFetch<{ id: string; status: string }>(
    `/medication/orders/${encodeURIComponent(orderId)}/sign`,
    { method: "POST", body: JSON.stringify(body) },
    token,
  );
}
