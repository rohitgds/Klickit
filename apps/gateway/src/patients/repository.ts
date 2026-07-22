import {
  buildCrossClinicSafetySummary,
  buildPatientDisplayName,
  normalizePhone,
  normalizeSearchText,
  renderPatientNumber,
  validateDrKlickStagingRow,
  type DrKlickStagingRow,
} from "@klickit/patients";
import type { DatabasePoolLike } from "../db/client.js";
import { queueDuplicateCandidate } from "../sync/conflicts.js";

export async function searchPatients(
  pool: DatabasePoolLike,
  input: { organizationId: string; clinicId?: string; query?: string; limit?: number; offset?: number },
) {
  const limit = input.limit ?? 25;
  const offset = input.offset ?? 0;
  const query = normalizeSearchText(input.query);
  const phone = normalizePhone(input.query ?? "");

  const result = await pool.query<{
    id: string;
    patient_no: string;
    display_name: string | null;
    cell_phone: string | null;
    home_clinic_id: string;
    active: boolean | null;
  }>(
    `
      SELECT p.id, p.patient_no, p.display_name, p.cell_phone, p.home_clinic_id, p.active
      FROM dentos_data.patients p
      LEFT JOIN dentos_data.patient_clinics pc ON pc.patient_id = p.id
      WHERE p.organization_id = $1
        AND ($2::uuid IS NULL OR pc.clinic_id = $2 OR p.home_clinic_id = $2)
        AND (
          $3 = ''
          OR lower(coalesce(p.display_name, '')) LIKE '%' || $3 || '%'
          OR lower(p.patient_no) LIKE '%' || $3 || '%'
          OR ($4 <> '' AND regexp_replace(coalesce(p.cell_phone, ''), '\\D', '', 'g') LIKE '%' || $4)
        )
      GROUP BY p.id
      ORDER BY p.created_at DESC
      LIMIT $5 OFFSET $6
    `,
    [input.organizationId, input.clinicId ?? null, query, phone ?? "", limit, offset],
  );

  return result.rows.map((row) => ({
    id: row.id,
    patientNo: row.patient_no,
    displayName: row.display_name ?? "",
    cellPhone: row.cell_phone,
    homeClinicId: row.home_clinic_id,
    active: row.active ?? true,
  }));
}

export async function registerPatient(
  pool: DatabasePoolLike,
  input: {
    organizationId: string;
    clinicId: string;
    firstName: string;
    middleName?: string;
    lastName?: string;
    cellPhone?: string;
    birthDate?: string;
    createdBy: string;
    masters: {
      initialsId: string;
      categoryId: string;
      referralSourceId: string;
      feeScheduleId: string;
      documentSeriesId: string;
    };
  },
) {
  const patientId = crypto.randomUUID();
  const displayName = buildPatientDisplayName(input);
  const series = await pool.query<{ next_number: string; prefix: string; separator: string; number_width: string }>(
    `
      SELECT next_number, prefix, separator, number_width
      FROM dentos_data.document_series
      WHERE id = $1
      FOR UPDATE
    `,
    [input.masters.documentSeriesId],
  );
  const seriesRow = series.rows[0];
  if (!seriesRow) {
    throw new Error("Patient document series not configured");
  }
  const nextNumber = Number(seriesRow.next_number);
  const patientNo = renderPatientNumber({
    prefix: seriesRow.prefix,
    separator: seriesRow.separator,
    number: nextNumber,
    width: Number(seriesRow.number_width),
  });

  await pool.query(
    `
      INSERT INTO dentos_data.patients (
        id, organization_id, home_clinic_id, patient_no, initials_id, first_name, middle_name, last_name,
        display_name, cell_phone, birth_date, fee_schedule_id, category_id, referral_source_id,
        intent_tier, intent_tier_reason_code, intent_tier_assessed_at, intent_tier_assessed_by,
        active, created_by, updated_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14,
        'three_star_high_intent_friction', 'short_logistical_delay', clock_timestamp(), $15,
        true, $15, $15
      )
    `,
    [
      patientId,
      input.organizationId,
      input.clinicId,
      patientNo,
      input.masters.initialsId,
      input.firstName,
      input.middleName ?? null,
      input.lastName ?? null,
      displayName,
      input.cellPhone ?? null,
      input.birthDate ?? null,
      input.masters.feeScheduleId,
      input.masters.categoryId,
      input.masters.referralSourceId,
      input.createdBy,
    ],
  );

  await pool.query(
    `
      INSERT INTO dentos_data.patient_clinics (patient_id, clinic_id, first_seen_at, created_by, updated_by)
      VALUES ($1, $2, clock_timestamp(), $3, $3)
    `,
    [patientId, input.clinicId, input.createdBy],
  );

  await pool.query(
    `
      UPDATE dentos_data.document_series
      SET next_number = next_number + 1, updated_at = clock_timestamp()
      WHERE id = $1
    `,
    [input.masters.documentSeriesId],
  );

  await pool.query(
    `
      INSERT INTO dentos_data.document_number_reservations (
        id, series_id, allocated_number, rendered_number, entity_type, entity_id,
        allocated_at, allocated_by, status, created_by, updated_by
      ) VALUES ($1, $2, $3, $4, 'patient', $5, clock_timestamp(), $6, 'used', $6, $6)
    `,
    [crypto.randomUUID(), input.masters.documentSeriesId, nextNumber, patientNo, patientId, input.createdBy],
  );

  return { id: patientId, patientNo, displayName };
}

export async function getPatientProfile(pool: DatabasePoolLike, patientId: string) {
  const patient = await pool.query(
    `SELECT * FROM dentos_data.patients WHERE id = $1`,
    [patientId],
  );
  const allergies = await pool.query<{ name: string }>(
    `
      SELECT ac.name
      FROM dentos_data.patient_allergies pa
      JOIN dentos_data.allergy_catalog ac ON ac.id = pa.allergy_id
      WHERE pa.patient_id = $1 AND pa.active = true
    `,
    [patientId],
  );
  const consents = await pool.query(`SELECT * FROM dentos_data.patient_consents WHERE patient_id = $1`, [patientId]);
  const medical = await pool.query(`SELECT * FROM dentos_data.patient_medical_responses WHERE patient_id = $1`, [
    patientId,
  ]);
  return {
    patient: patient.rows[0] ?? null,
    allergies: allergies.rows,
    consents: consents.rows,
    medicalResponses: medical.rows,
  };
}

export async function getPatientSafetySummary(pool: DatabasePoolLike, patientId: string) {
  const allergies = await pool.query<{ name: string }>(
    `
      SELECT ac.name
      FROM dentos_data.patient_allergies pa
      JOIN dentos_data.allergy_catalog ac ON ac.id = pa.allergy_id
      WHERE pa.patient_id = $1 AND pa.active = true
    `,
    [patientId],
  );
  const patient = await pool.query<{ notes: string | null; home_clinic_id: string }>(
    `SELECT notes, home_clinic_id FROM dentos_data.patients WHERE id = $1`,
    [patientId],
  );
  const clinic = await pool.query<{ clinic_code: string }>(
    `SELECT clinic_code FROM dentos_data.clinics WHERE id = $1`,
    [patient.rows[0]?.home_clinic_id],
  );
  return buildCrossClinicSafetySummary({
    patientId,
    allergies: allergies.rows.map((row) => row.name),
    lastClinicalNoteSummary: patient.rows[0]?.notes ?? null,
    lastUpdatedClinicCode: clinic.rows[0]?.clinic_code ?? null,
  });
}

export async function queuePatientDuplicateReview(
  pool: DatabasePoolLike,
  input: { organizationId: string; clinicId: string; patientIdA: string; patientIdB: string; signals: string[] },
) {
  return queueDuplicateCandidate(pool, {
    organizationId: input.organizationId,
    clinicId: input.clinicId,
    patientIdA: input.patientIdA,
    patientIdB: input.patientIdB,
    matchSignals: input.signals,
  });
}

export async function createImportBatch(
  pool: DatabasePoolLike,
  input: { organizationId: string; clinicId: string; createdBy: string; sourceLabel?: string },
) {
  const id = crypto.randomUUID();
  await pool.query(
    `
      INSERT INTO dentos_runtime.drklick_import_batches (
        id, organization_id, clinic_id, source_label, created_by
      ) VALUES ($1, $2, $3, $4, $5)
    `,
    [id, input.organizationId, input.clinicId, input.sourceLabel ?? "synthetic-dry-run", input.createdBy],
  );
  return { id };
}

export async function stageImportRows(
  pool: DatabasePoolLike,
  input: { batchId: string; rows: DrKlickStagingRow[] },
) {
  let valid = 0;
  let invalid = 0;
  for (const row of input.rows) {
    const validation = validateDrKlickStagingRow(row);
    await pool.query(
      `
        INSERT INTO dentos_runtime.drklick_import_rows (
          id, batch_id, source_row_number, source_patient_key, payload_json,
          normalized_json, validation_status, validation_errors
        ) VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8::jsonb)
      `,
      [
        crypto.randomUUID(),
        input.batchId,
        row.sourceRowNumber,
        row.sourcePatientKey ?? null,
        JSON.stringify(row),
        JSON.stringify({
          firstName: row.firstName,
          lastName: row.lastName ?? null,
          mobile: normalizePhone(row.mobile),
          email: row.email ?? null,
          birthDate: row.birthDate ?? null,
          addressLine1: row.addressLine1 ?? null,
          categoryCode: row.categoryCode ?? null,
        }),
        validation.valid ? "valid" : "invalid",
        validation.valid ? null : JSON.stringify(validation.errors),
      ],
    );
    if (validation.valid) {
      valid += 1;
    } else {
      invalid += 1;
    }
  }
  await pool.query(
    `
      UPDATE dentos_runtime.drklick_import_batches
      SET row_count = $2, valid_count = $3, invalid_count = $4, status = 'validated', validated_at = clock_timestamp()
      WHERE id = $1
    `,
    [input.batchId, input.rows.length, valid, invalid],
  );
  return { valid, invalid, total: input.rows.length };
}

export async function getImportBatchReport(pool: DatabasePoolLike, batchId: string) {
  const batch = await pool.query<Record<string, unknown>>(
    `SELECT * FROM dentos_runtime.drklick_import_batches WHERE id = $1`,
    [batchId],
  );
  if (!batch.rows[0]) {
    throw new Error("Import batch not found");
  }
  const invalidSamples = await pool.query(
    `
      SELECT source_row_number, validation_errors
      FROM dentos_runtime.drklick_import_rows
      WHERE batch_id = $1 AND validation_status = 'invalid'
      ORDER BY source_row_number
      LIMIT 10
    `,
    [batchId],
  );
  return { batch: batch.rows[0], invalidSamples: invalidSamples.rows };
}

export async function acceptImportBatch(
  pool: DatabasePoolLike,
  input: { batchId: string; actorUserId: string },
) {
  const batch = await pool.query<{ status: string }>(
    `SELECT status FROM dentos_runtime.drklick_import_batches WHERE id = $1`,
    [input.batchId],
  );
  if (!batch.rows[0] || batch.rows[0].status !== "validated") {
    throw new Error("Only validated import batches can be accepted");
  }
  await pool.query(
    `
      UPDATE dentos_runtime.drklick_import_batches
      SET status = 'accepted', validated_by = $2, validated_at = clock_timestamp()
      WHERE id = $1
    `,
    [input.batchId, input.actorUserId],
  );
  return { id: input.batchId, status: "accepted" };
}

export async function applyImportBatch(
  pool: DatabasePoolLike,
  input: { batchId: string; organizationId: string; clinicId: string; actorUserId: string },
) {
  const batch = await pool.query<{ status: string }>(
    `SELECT status FROM dentos_runtime.drklick_import_batches WHERE id = $1`,
    [input.batchId],
  );
  if (!batch.rows[0] || batch.rows[0].status !== "accepted") {
    throw new Error("Only accepted import batches can be applied");
  }
  const masters = await getDevPatientMasters(pool, input.organizationId, input.clinicId);
  if (!masters.initialsId || !masters.categoryId || !masters.referralSourceId || !masters.feeScheduleId || !masters.documentSeriesId) {
    throw new Error("Patient masters are not configured for import apply");
  }
  const rows = await pool.query<{
    id: string;
    normalized_json: Record<string, string | null>;
  }>(
    `
      SELECT id, normalized_json
      FROM dentos_runtime.drklick_import_rows
      WHERE batch_id = $1 AND validation_status = 'valid' AND mapped_patient_id IS NULL
      ORDER BY source_row_number
    `,
    [input.batchId],
  );
  let imported = 0;
  for (const row of rows.rows) {
    const normalized = row.normalized_json;
    const created = await registerPatient(pool, {
      organizationId: input.organizationId,
      clinicId: input.clinicId,
      firstName: normalized.firstName ?? "Synthetic",
      lastName: normalized.lastName ?? undefined,
      cellPhone: normalized.mobile ?? undefined,
      birthDate: normalized.birthDate ?? undefined,
      createdBy: input.actorUserId,
      masters: {
        initialsId: masters.initialsId,
        categoryId: masters.categoryId,
        referralSourceId: masters.referralSourceId,
        feeScheduleId: masters.feeScheduleId,
        documentSeriesId: masters.documentSeriesId,
      },
    });
    await pool.query(
      `UPDATE dentos_runtime.drklick_import_rows SET mapped_patient_id = $2 WHERE id = $1`,
      [row.id, created.id],
    );
    imported += 1;
  }
  await pool.query(
    `
      UPDATE dentos_runtime.drklick_import_batches
      SET status = 'applied', applied_at = clock_timestamp(), applied_by = $2
      WHERE id = $1
    `,
    [input.batchId, input.actorUserId],
  );
  return { id: input.batchId, status: "applied", importedCount: imported };
}

export async function getDevPatientMasters(pool: DatabasePoolLike, organizationId: string, clinicId: string) {
  const initials = await pool.query<{ id: string }>(
    `SELECT id FROM dentos_data.patient_initials WHERE organization_id = $1 LIMIT 1`,
    [organizationId],
  );
  const category = await pool.query<{ id: string }>(
    `SELECT id FROM dentos_data.patient_categories WHERE organization_id = $1 LIMIT 1`,
    [organizationId],
  );
  const referral = await pool.query<{ id: string }>(
    `SELECT id FROM dentos_data.referral_sources WHERE organization_id = $1 LIMIT 1`,
    [organizationId],
  );
  const feeSchedule = await pool.query<{ id: string }>(
    `SELECT id FROM dentos_data.fee_schedules WHERE organization_id = $1 LIMIT 1`,
    [organizationId],
  );
  const series = await pool.query<{ id: string }>(
    `SELECT id FROM dentos_data.document_series WHERE organization_id = $1 AND clinic_id = $2 LIMIT 1`,
    [organizationId, clinicId],
  );
  return {
    initialsId: initials.rows[0]?.id,
    categoryId: category.rows[0]?.id,
    referralSourceId: referral.rows[0]?.id,
    feeScheduleId: feeSchedule.rows[0]?.id,
    documentSeriesId: series.rows[0]?.id,
  };
}
