import {
  areValidSurfaceCodes,
  buildEncounterWorkspaceSummary,
  canEditClinicalNote,
  evaluateCrossClinicClinicalAccess,
  hashFilePayload,
  isValidFdiToothCode,
  normalizeSurfaceCodes,
  validateCareDeliveryTransition,
  validateClinicalNoteAmendment,
  validateClinicalNoteSign,
  type CareDeliveryState,
  type ClinicalNoteStatus,
} from "@klickit/clinical";
import type { DatabasePoolLike } from "../db/client.js";

type DbContext = {
  pool: DatabasePoolLike;
  organizationId: string;
  clinicId: string;
};

async function loadEncounter(ctx: DbContext, encounterId: string) {
  const result = await ctx.pool.query<Record<string, unknown>>(
    `SELECT * FROM dentos_data.care_encounters WHERE id = $1 AND clinic_id = $2`,
    [encounterId, ctx.clinicId],
  );
  return result.rows[0] ?? null;
}

async function loadPatientHomeClinic(ctx: DbContext, patientId: string) {
  const result = await ctx.pool.query<{ home_clinic_id: string }>(
    `SELECT home_clinic_id FROM dentos_data.patients WHERE id = $1 AND organization_id = $2`,
    [patientId, ctx.organizationId],
  );
  return result.rows[0]?.home_clinic_id ?? null;
}

export async function getEncounterWorkspace(ctx: DbContext, encounterId: string) {
  const encounter = await loadEncounter(ctx, encounterId);
  if (!encounter) {
    throw new Error("Encounter not found");
  }

  const patientId = encounter.patient_id as string;
  const [allergies, findings, diagnoses, deliveries] = await Promise.all([
    ctx.pool.query<{ name: string }>(
      `
        SELECT ac.name
        FROM dentos_data.patient_allergies pa
        JOIN dentos_data.allergy_catalog ac ON ac.id = pa.allergy_id
        WHERE pa.patient_id = $1
      `,
      [patientId],
    ),
    ctx.pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM dentos_data.odontogram_findings WHERE care_encounter_id = $1`,
      [encounterId],
    ),
    ctx.pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM dentos_data.encounter_diagnoses WHERE care_encounter_id = $1`,
      [encounterId],
    ),
    ctx.pool.query<{ count: string }>(
      `
        SELECT COUNT(*)::text AS count
        FROM dentos_data.care_deliveries
        WHERE care_encounter_id = $1 AND status IN ('planned','in_progress')
      `,
      [encounterId],
    ),
  ]);

  return buildEncounterWorkspaceSummary({
    encounterId,
    patientId,
    clinicId: encounter.clinic_id as string,
    leadClinicianId: encounter.lead_clinician_id as string,
    status: encounter.status as string,
    allergies: allergies.rows.map((row) => row.name),
    findingCount: Number(findings.rows[0]?.count ?? 0),
    diagnosisCount: Number(diagnoses.rows[0]?.count ?? 0),
    openDeliveryCount: Number(deliveries.rows[0]?.count ?? 0),
  });
}

export async function listOdontogramFindings(ctx: DbContext, encounterId: string) {
  const result = await ctx.pool.query(
    `SELECT * FROM dentos_data.odontogram_findings WHERE care_encounter_id = $1 ORDER BY tooth_code, recorded_at`,
    [encounterId],
  );
  return result.rows;
}

export async function createOdontogramFinding(
  ctx: DbContext,
  input: {
    encounterId: string;
    patientId: string;
    toothCode: string;
    surfaceCodes: string[];
    findingCode: string;
    notes?: string;
    recordedBy: string;
  },
) {
  if (!isValidFdiToothCode(input.toothCode)) {
    throw new Error("Invalid FDI tooth code");
  }
  const surfaces = normalizeSurfaceCodes(input.surfaceCodes);
  if (!areValidSurfaceCodes(surfaces)) {
    throw new Error("Invalid tooth surface codes");
  }
  const id = crypto.randomUUID();
  await ctx.pool.query(
    `
      INSERT INTO dentos_data.odontogram_findings (
        id, patient_id, care_encounter_id, tooth_code, surface_codes, finding_code,
        notes, status, recorded_by, recorded_at, created_by, updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8, clock_timestamp(), $8, $8)
    `,
    [
      id,
      input.patientId,
      input.encounterId,
      input.toothCode,
      surfaces,
      input.findingCode,
      input.notes ?? null,
      input.recordedBy,
    ],
  );
  return { id };
}

export async function createEncounterDiagnosis(
  ctx: DbContext,
  input: {
    encounterId: string;
    diagnosisId: string;
    toothCode?: string;
    surfaceCodes?: string[];
    clinicalNote?: string;
    diagnosedBy: string;
  },
) {
  if (input.toothCode && !isValidFdiToothCode(input.toothCode)) {
    throw new Error("Invalid FDI tooth code");
  }
  const catalog = await ctx.pool.query<{
    code: string;
    name: string;
  }>(
    `SELECT code, name FROM dentos_data.diagnosis_catalog WHERE id = $1 AND organization_id = $2 AND active = true`,
    [input.diagnosisId, ctx.organizationId],
  );
  const row = catalog.rows[0];
  if (!row) {
    throw new Error("Diagnosis not found");
  }
  const id = crypto.randomUUID();
  await ctx.pool.query(
    `
      INSERT INTO dentos_data.encounter_diagnoses (
        id, care_encounter_id, diagnosis_id, diagnosis_code_snapshot, diagnosis_name_snapshot,
        tooth_code, surface_codes, clinical_note, diagnosed_by, diagnosed_at, created_by, updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, clock_timestamp(), $9, $9)
    `,
    [
      id,
      input.encounterId,
      input.diagnosisId,
      row.code,
      row.name,
      input.toothCode ?? null,
      normalizeSurfaceCodes(input.surfaceCodes ?? []),
      input.clinicalNote ?? null,
      input.diagnosedBy,
    ],
  );
  return { id };
}

export async function createServiceRecommendation(
  ctx: DbContext,
  input: {
    encounterId: string;
    serviceId: string;
    encounterDiagnosisId?: string;
    toothCode?: string;
    surfaceCodes?: string[];
    clinicalNote?: string;
    suggestedBy: string;
  },
) {
  const service = await ctx.pool.query<{
    code: string;
    description: string;
    domain_code: string;
  }>(
    `
      SELECT sc.code, sc.description, sd.code AS domain_code
      FROM dentos_data.service_catalog sc
      JOIN dentos_data.service_domains sd ON sd.id = sc.service_domain_id
      WHERE sc.id = $1 AND sc.organization_id = $2 AND sc.active = true
    `,
    [input.serviceId, ctx.organizationId],
  );
  const row = service.rows[0];
  if (!row) {
    throw new Error("Service not found");
  }
  const id = crypto.randomUUID();
  await ctx.pool.query(
    `
      INSERT INTO dentos_data.encounter_service_recommendations (
        id, care_encounter_id, encounter_diagnosis_id, service_id,
        service_code_snapshot, service_name_snapshot, service_domain_snapshot,
        tooth_code, surface_codes, clinical_note, suggested_by, suggested_at,
        created_by, updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, clock_timestamp(), $11, $11)
    `,
    [
      id,
      input.encounterId,
      input.encounterDiagnosisId ?? null,
      input.serviceId,
      row.code,
      row.description,
      row.domain_code,
      input.toothCode ?? null,
      normalizeSurfaceCodes(input.surfaceCodes ?? []),
      input.clinicalNote ?? null,
      input.suggestedBy,
    ],
  );
  return { id };
}

export async function createCareDelivery(
  ctx: DbContext,
  input: {
    patientId: string;
    encounterId: string;
    serviceId: string;
    leadClinicianId: string;
    toothCode?: string;
    surfaceCodes?: string[];
    fee?: number;
    createdBy: string;
  },
) {
  const id = crypto.randomUUID();
  await ctx.pool.query(
    `
      INSERT INTO dentos_data.care_deliveries (
        id, patient_id, care_encounter_id, service_id, lead_clinician_id,
        tooth_code, surface_codes, fee, status, created_by, updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'planned', $9, $9)
    `,
    [
      id,
      input.patientId,
      input.encounterId,
      input.serviceId,
      input.leadClinicianId,
      input.toothCode ?? null,
      normalizeSurfaceCodes(input.surfaceCodes ?? []),
      input.fee ?? null,
      input.createdBy,
    ],
  );
  return { id, status: "planned" as const };
}

async function loadCareDelivery(ctx: DbContext, deliveryId: string) {
  const result = await ctx.pool.query<Record<string, unknown>>(
    `
      SELECT cd.*
      FROM dentos_data.care_deliveries cd
      JOIN dentos_data.care_encounters ce ON ce.id = cd.care_encounter_id
      WHERE cd.id = $1 AND ce.clinic_id = $2
    `,
    [deliveryId, ctx.clinicId],
  );
  return result.rows[0] ?? null;
}

export async function transitionCareDelivery(
  ctx: DbContext,
  input: { deliveryId: string; toStatus: CareDeliveryState; changedBy: string },
) {
  const delivery = await loadCareDelivery(ctx, input.deliveryId);
  if (!delivery) {
    throw new Error("Care delivery not found");
  }
  const fromStatus = delivery.status as CareDeliveryState;
  const validation = validateCareDeliveryTransition({ fromStatus, toStatus: input.toStatus });
  if (!validation.ok) {
    throw new Error(validation.message);
  }

  if (input.toStatus === "in_progress") {
    await ctx.pool.query(
      `
        UPDATE dentos_data.care_deliveries
        SET status = 'in_progress', started_at = clock_timestamp(), updated_by = $2
        WHERE id = $1
      `,
      [input.deliveryId, input.changedBy],
    );
  } else if (input.toStatus === "completed") {
    await ctx.pool.query(
      `
        UPDATE dentos_data.care_deliveries
        SET status = 'completed', completed_at = clock_timestamp(), completed_by = $2, updated_by = $2
        WHERE id = $1
      `,
      [input.deliveryId, input.changedBy],
    );
  } else {
    await ctx.pool.query(
      `UPDATE dentos_data.care_deliveries SET status = $2, updated_by = $3 WHERE id = $1`,
      [input.deliveryId, input.toStatus, input.changedBy],
    );
  }

  return { id: input.deliveryId, status: input.toStatus };
}

export async function listClinicalNotes(ctx: DbContext, encounterId: string) {
  const result = await ctx.pool.query(
    `SELECT * FROM dentos_data.clinical_notes WHERE care_encounter_id = $1 ORDER BY created_at`,
    [encounterId],
  );
  return result.rows;
}

export async function createClinicalNote(
  ctx: DbContext,
  input: {
    patientId: string;
    encounterId: string;
    clinicianId: string;
    noteType: string;
    body: string;
    createdBy: string;
  },
) {
  const id = crypto.randomUUID();
  await ctx.pool.query(
    `
      INSERT INTO dentos_data.clinical_notes (
        id, patient_id, care_encounter_id, clinician_id, note_type, body, status, created_by, updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, 'draft', $7, $7)
    `,
    [id, input.patientId, input.encounterId, input.clinicianId, input.noteType, input.body, input.createdBy],
  );
  return { id, status: "draft" as const };
}

async function loadClinicalNote(ctx: DbContext, noteId: string) {
  const result = await ctx.pool.query<Record<string, unknown>>(
    `
      SELECT cn.*
      FROM dentos_data.clinical_notes cn
      JOIN dentos_data.care_encounters ce ON ce.id = cn.care_encounter_id
      WHERE cn.id = $1 AND ce.clinic_id = $2
    `,
    [noteId, ctx.clinicId],
  );
  return result.rows[0] ?? null;
}

export async function signClinicalNote(ctx: DbContext, input: { noteId: string; signedBy: string }) {
  const note = await loadClinicalNote(ctx, input.noteId);
  if (!note) {
    throw new Error("Clinical note not found");
  }
  const validation = validateClinicalNoteSign({
    status: (note.status as ClinicalNoteStatus) ?? "draft",
    body: note.body as string,
  });
  if (!validation.ok) {
    throw new Error(validation.message);
  }
  await ctx.pool.query(
    `
      UPDATE dentos_data.clinical_notes
      SET status = 'signed', signed_at = clock_timestamp(), updated_by = $2
      WHERE id = $1
    `,
    [input.noteId, input.signedBy],
  );
  return { id: input.noteId, status: "signed" as const };
}

export async function amendClinicalNote(
  ctx: DbContext,
  input: { noteId: string; amendedBody: string; reason: string; amendedBy: string },
) {
  const note = await loadClinicalNote(ctx, input.noteId);
  if (!note) {
    throw new Error("Clinical note not found");
  }
  const validation = validateClinicalNoteAmendment({
    status: (note.status as ClinicalNoteStatus) ?? "draft",
    reason: input.reason,
    amendedBody: input.amendedBody,
  });
  if (!validation.ok) {
    throw new Error(validation.message);
  }

  const next = await ctx.pool.query<{ next_seq: string }>(
    `
      SELECT COALESCE(MAX(sequence_no), 0) + 1 AS next_seq
      FROM dentos_data.clinical_note_amendments
      WHERE clinical_note_id = $1
    `,
    [input.noteId],
  );

  await ctx.pool.query(
    `
      INSERT INTO dentos_data.clinical_note_amendments (
        id, clinical_note_id, sequence_no, prior_body, amended_body, reason, amended_by, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
    `,
    [
      crypto.randomUUID(),
      input.noteId,
      Number(next.rows[0]?.next_seq ?? 1),
      note.body,
      input.amendedBody,
      input.reason,
      input.amendedBy,
    ],
  );

  await ctx.pool.query(
    `
      UPDATE dentos_data.clinical_notes
      SET body = $2, status = 'amended', updated_by = $3
      WHERE id = $1
    `,
    [input.noteId, input.amendedBody, input.amendedBy],
  );

  return { id: input.noteId, status: "amended" as const };
}

export async function listClinicalNoteAmendments(ctx: DbContext, noteId: string) {
  const result = await ctx.pool.query(
    `
      SELECT sequence_no, prior_body, amended_body, reason, amended_by, amended_at
      FROM dentos_data.clinical_note_amendments
      WHERE clinical_note_id = $1
      ORDER BY sequence_no
    `,
    [noteId],
  );
  return result.rows;
}

export async function registerPatientFile(
  ctx: DbContext,
  input: {
    patientId: string;
    encounterId?: string;
    storageKey: string;
    mimeType: string;
    byteSize: number;
    payloadHash: string;
    encrypted?: boolean;
    category?: string;
    caption?: string;
    createdBy: string;
  },
) {
  const fileId = crypto.randomUUID();
  const patientFileId = crypto.randomUUID();
  await ctx.pool.query(
    `
      INSERT INTO dentos_data.files (
        id, organization_id, storage_key, mime_type, byte_size, sha256, encrypted, created_by, updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
    `,
    [
      fileId,
      ctx.organizationId,
      input.storageKey,
      input.mimeType,
      input.byteSize,
      input.payloadHash,
      input.encrypted ?? true,
      input.createdBy,
    ],
  );
  await ctx.pool.query(
    `
      INSERT INTO dentos_data.patient_files (
        id, patient_id, care_encounter_id, file_id, category, caption, created_by, updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
    `,
    [
      patientFileId,
      input.patientId,
      input.encounterId ?? null,
      fileId,
      input.category ?? "clinical_image",
      input.caption ?? null,
      input.createdBy,
    ],
  );
  await ctx.pool.query(
    `
      INSERT INTO dentos_runtime.file_sync_jobs (
        id, organization_id, clinic_id, file_id, direction, status, bytes_transferred, total_bytes, sha256_expected
      ) VALUES ($1, $2, $3, $4, 'upload', 'completed', $5, $5, $6)
    `,
    [crypto.randomUUID(), ctx.organizationId, ctx.clinicId, fileId, input.byteSize, input.payloadHash],
  );
  return { fileId, patientFileId };
}

export async function getFileRecord(ctx: DbContext, fileId: string) {
  const result = await ctx.pool.query(
    `SELECT * FROM dentos_data.files WHERE id = $1 AND organization_id = $2`,
    [fileId, ctx.organizationId],
  );
  return result.rows[0] ?? null;
}

export async function getFileSyncStatus(ctx: DbContext, fileId: string) {
  const result = await ctx.pool.query(
    `
      SELECT id, direction, status, bytes_transferred, total_bytes, sha256_expected, last_error, updated_at
      FROM dentos_runtime.file_sync_jobs
      WHERE file_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [fileId],
  );
  return result.rows[0] ?? null;
}

export async function verifyFileHash(ctx: DbContext, input: { fileId: string; payload: string }) {
  const file = await getFileRecord(ctx, input.fileId);
  if (!file) {
    throw new Error("File not found");
  }
  const actual = hashFilePayload(input.payload);
  const expected = file.sha256 as string;
  return { fileId: input.fileId, expected, actual, verified: actual === expected };
}

export async function evaluateClinicalAccess(
  ctx: DbContext,
  input: {
    patientId: string;
    encounterClinicId: string;
    permissionCode: string;
    hasCrossClinicGrant: boolean;
  },
) {
  const homeClinicId = await loadPatientHomeClinic(ctx, input.patientId);
  if (!homeClinicId) {
    throw new Error("Patient not found");
  }
  return evaluateCrossClinicClinicalAccess({
    homeClinicId,
    encounterClinicId: input.encounterClinicId,
    permissionCode: input.permissionCode,
    hasCrossClinicGrant: input.hasCrossClinicGrant,
  });
}

export { canEditClinicalNote };
