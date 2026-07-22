export type SyntheticDrKlickRow = {
  sourceRowNumber: number;
  sourcePatientKey: string;
  firstName: string;
  lastName: string;
  mobile: string;
  email: string;
  birthDate: string;
  addressLine1: string;
  categoryCode: string;
  clinicCode: string;
};

export function generateSyntheticDrKlickRows(count: number, clinicCode = "DEV"): SyntheticDrKlickRow[] {
  const rows: SyntheticDrKlickRow[] = [];
  for (let index = 1; index <= count; index += 1) {
    rows.push({
      sourceRowNumber: index,
      sourcePatientKey: `DRK-SYN-${String(index).padStart(5, "0")}`,
      firstName: `Synthetic${index}`,
      lastName: "Patient",
      mobile: `9${String(100000000 + index).slice(-9)}`,
      email: `synthetic${index}@example.test`,
      birthDate: "1990-01-01",
      addressLine1: `${index} Training Street`,
      categoryCode: "GENERAL",
      clinicCode,
    });
  }
  return rows;
}

export type SyntheticSyncClinic = {
  organizationId: string;
  clinicId: string;
  clinicCode: string;
  gatewayId: string;
  gatewayCode: string;
};

/** Development clinic IDs aligned with supabase/seed.sql. */
export const SYNTHETIC_SYNC_CLINIC_A: SyntheticSyncClinic = {
  organizationId: "11111111-1111-4111-8111-111111111111",
  clinicId: "22222222-2222-4222-8222-222222222222",
  clinicCode: "DEV",
  gatewayId: "44444444-4444-4444-8444-444444444444",
  gatewayCode: "DEV-GW-01",
};

/** Second synthetic clinic for two-clinic replay envelopes (not seeded — tests use clinic A only). */
export const SYNTHETIC_SYNC_CLINIC_B: SyntheticSyncClinic = {
  organizationId: "11111111-1111-4111-8111-111111111111",
  clinicId: "33333333-3333-4333-8333-333333333333",
  clinicCode: "SYN-B",
  gatewayId: "55555555-5555-4555-8555-555555555555",
  gatewayCode: "SYN-B-GW-01",
};

export type SyntheticSyncEventInput = {
  clinic: SyntheticSyncClinic;
  aggregateType?: string;
  aggregateId?: string;
  eventType?: string;
  payloadJson?: Record<string, unknown>;
  idempotencyKey?: string;
  aggregateVersion?: number;
  deviceId?: string;
};

export function buildSyntheticSyncEvent(input: SyntheticSyncEventInput) {
  const aggregateId = input.aggregateId ?? "99999999-9999-4999-8999-999999999999";
  const aggregateType = input.aggregateType ?? "patient";
  const eventType = input.eventType ?? "patient.updated";
  const aggregateVersion = input.aggregateVersion ?? 1;
  const payloadJson = input.payloadJson ?? { name: "Synthetic Patient" };

  return {
    organizationId: input.clinic.organizationId,
    clinicId: input.clinic.clinicId,
    gatewayId: input.clinic.gatewayId,
    deviceId: input.deviceId,
    aggregateType,
    aggregateId,
    eventType,
    payloadJson,
    idempotencyKey:
      input.idempotencyKey ??
      `${input.clinic.clinicCode}:${aggregateType}:${aggregateId}:${eventType}:${aggregateVersion}`,
    aggregateVersion,
    schemaVersion: 1 as const,
  };
}

export function buildTwoClinicSyncScenario() {
  const sharedIdempotencyKey = "sync-fixture-replay-key";
  return {
    clinicAEvent: buildSyntheticSyncEvent({
      clinic: SYNTHETIC_SYNC_CLINIC_A,
      idempotencyKey: sharedIdempotencyKey,
      payloadJson: { name: "Clinic A Patient", phone: "9000000001" },
    }),
    clinicBEvent: buildSyntheticSyncEvent({
      clinic: SYNTHETIC_SYNC_CLINIC_B,
      idempotencyKey: sharedIdempotencyKey,
      payloadJson: { name: "Clinic B Patient", phone: "9000000002" },
    }),
  };
}
