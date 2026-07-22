import {
  buildDocumentPrintSnapshot,
  buildMedicationOrderSigningPayload,
  evaluateAllergyRule,
  hashMedicationOrderSignature,
  validateMedicationOrderSave,
  validateMedicationOrderSign,
  validatePrescriptionRevision,
  verifyDoctorSigningPin,
} from "@klickit/plans-prescriptions";
import type { DatabasePoolLike } from "../db/client.js";

type DbContext = {
  pool: DatabasePoolLike;
  organizationId: string;
  clinicId: string;
};

export async function searchMedicationCatalog(ctx: DbContext, query: string, limit = 20) {
  const result = await ctx.pool.query(
    `
      SELECT mc.id, mc.brand_name, mc.strength, mc.dosage_form, mc.priority_pinned, md.code AS domain_code
      FROM dentos_data.medication_catalog mc
      JOIN dentos_data.medication_domains md ON md.id = mc.primary_domain_id
      WHERE mc.organization_id = $1
        AND mc.active = true
        AND (
          lower(mc.brand_name) LIKE '%' || lower($2) || '%'
          OR lower($2) = ANY(SELECT lower(keyword) FROM unnest(mc.keywords) AS keyword)
        )
      ORDER BY mc.priority_pinned DESC, mc.brand_name
      LIMIT $3
    `,
    [ctx.organizationId, query, limit],
  );
  return result.rows;
}

export async function evaluateMedicationSafety(
  ctx: DbContext,
  input: { patientId: string; medicationId: string },
) {
  const [patientAllergies, medicationIngredients, rules] = await Promise.all([
    ctx.pool.query<{ name: string }>(
      `
        SELECT ac.name
        FROM dentos_data.patient_allergies pa
        JOIN dentos_data.allergy_catalog ac ON ac.id = pa.allergy_id
        WHERE pa.patient_id = $1
      `,
      [input.patientId],
    ),
    ctx.pool.query<{ code: string }>(
      `
        SELECT aic.code
        FROM dentos_data.medication_ingredient_links mil
        JOIN dentos_data.active_ingredient_catalog aic ON aic.id = mil.active_ingredient_id
        WHERE mil.medication_id = $1 AND mil.active = true
      `,
      [input.medicationId],
    ),
    ctx.pool.query<{ ingredient_code: string; allergy_name: string; interaction_level: "block" | "warn" | "information" }>(
      `
        SELECT aic.code AS ingredient_code, ac.name AS allergy_name, air.interaction_level
        FROM dentos_data.allergy_ingredient_rules air
        JOIN dentos_data.active_ingredient_catalog aic ON aic.id = air.active_ingredient_id
        JOIN dentos_data.allergy_catalog ac ON ac.id = air.allergy_id
        WHERE air.active = true AND aic.organization_id = $1
      `,
      [ctx.organizationId],
    ),
  ]);
  return evaluateAllergyRule({
    patientAllergies: patientAllergies.rows.map((row) => row.name),
    medicationIngredients: medicationIngredients.rows.map((row) => row.code),
    rules: rules.rows.map((row) => ({
      ingredientCode: row.ingredient_code,
      allergyName: row.allergy_name,
      action: row.interaction_level,
    })),
  });
}

async function loadMedicationOrder(ctx: DbContext, orderId: string) {
  const result = await ctx.pool.query<Record<string, unknown>>(
    `SELECT * FROM dentos_data.medication_orders WHERE id = $1 AND clinic_id = $2`,
    [orderId, ctx.clinicId],
  );
  return result.rows[0] ?? null;
}

export async function createMedicationOrderDraft(
  ctx: DbContext,
  input: {
    patientId: string;
    encounterId: string;
    clinicianStaffId: string;
    orderDate?: string;
    notes?: string;
    actorUserId: string;
  },
) {
  const id = crypto.randomUUID();
  await ctx.pool.query(
    `
      INSERT INTO dentos_data.medication_orders (
        id, clinic_id, patient_id, care_encounter_id, clinician_id, medication_order_date,
        notes, status, created_by, updated_by
      ) VALUES ($1, $2, $3, $4, $5, COALESCE($6::date, CURRENT_DATE), $7, 'draft', $8, $8)
    `,
    [
      id,
      ctx.clinicId,
      input.patientId,
      input.encounterId,
      input.clinicianStaffId,
      input.orderDate ?? null,
      input.notes ?? null,
      input.actorUserId,
    ],
  );
  return { id, status: "draft" };
}

export async function saveMedicationOrder(
  ctx: DbContext,
  input: {
    orderId: string;
    diagnoses: Array<{
      diagnosisId: string;
      encounterDiagnosisId?: string;
      toothCode?: string;
      sequenceNo: number;
    }>;
    serviceLinks: Array<{
      serviceId: string;
      encounterServiceRecommendationId?: string;
      toothCode?: string;
      sequenceNo: number;
    }>;
    lines: Array<{
      medicationId?: string;
      administrationPatternId?: string;
      takeText: string;
      frequency: string;
      durationValue: number;
      durationPeriod: "days" | "weeks" | "months";
      instructions?: string;
      manualEntryReason?: string;
      sequenceNo: number;
    }>;
    actorUserId: string;
  },
) {
  const order = await loadMedicationOrder(ctx, input.orderId);
  if (!order) {
    throw new Error("Medication order not found");
  }
  if (order.status !== "draft" && order.status !== "saved") {
    throw new Error("Medication order cannot be edited in current status");
  }
  const validation = validateMedicationOrderSave({
    diagnosisCount: input.diagnoses.length,
    serviceLinkCount: input.serviceLinks.length,
    lineCount: input.lines.length,
  });
  if (!validation.ok) {
    throw new Error(validation.message);
  }

  await ctx.pool.query(`DELETE FROM dentos_data.medication_order_diagnoses WHERE medication_order_id = $1`, [
    input.orderId,
  ]);
  await ctx.pool.query(`DELETE FROM dentos_data.medication_order_service_links WHERE medication_order_id = $1`, [
    input.orderId,
  ]);
  await ctx.pool.query(`DELETE FROM dentos_data.medication_order_lines WHERE medication_order_id = $1`, [input.orderId]);

  for (const diagnosis of input.diagnoses) {
    const catalog = await ctx.pool.query<{ code: string; name: string }>(
      `SELECT code, name FROM dentos_data.diagnosis_catalog WHERE id = $1 AND organization_id = $2`,
      [diagnosis.diagnosisId, ctx.organizationId],
    );
    const row = catalog.rows[0];
    if (!row) {
      throw new Error("Diagnosis not found");
    }
    await ctx.pool.query(
      `
        INSERT INTO dentos_data.medication_order_diagnoses (
          id, medication_order_id, encounter_diagnosis_id, diagnosis_id, diagnosis_code_snapshot,
          diagnosis_name_snapshot, tooth_code_snapshot, sequence_no, created_by, updated_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
      `,
      [
        crypto.randomUUID(),
        input.orderId,
        diagnosis.encounterDiagnosisId ?? null,
        diagnosis.diagnosisId,
        row.code,
        row.name,
        diagnosis.toothCode ?? null,
        diagnosis.sequenceNo,
        input.actorUserId,
      ],
    );
  }

  for (const link of input.serviceLinks) {
    const service = await ctx.pool.query<{ code: string; description: string; domain_code: string }>(
      `
        SELECT sc.code, sc.description, sd.code AS domain_code
        FROM dentos_data.service_catalog sc
        JOIN dentos_data.service_domains sd ON sd.id = sc.service_domain_id
        WHERE sc.id = $1 AND sc.organization_id = $2
      `,
      [link.serviceId, ctx.organizationId],
    );
    const row = service.rows[0];
    if (!row) {
      throw new Error("Service not found");
    }
    await ctx.pool.query(
      `
        INSERT INTO dentos_data.medication_order_service_links (
          id, medication_order_id, encounter_service_recommendation_id, service_id,
          service_code_snapshot, service_name_snapshot, service_domain_snapshot,
          tooth_code_snapshot, sequence_no, created_by, updated_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
      `,
      [
        crypto.randomUUID(),
        input.orderId,
        link.encounterServiceRecommendationId ?? null,
        link.serviceId,
        row.code,
        row.description,
        row.domain_code,
        link.toothCode ?? null,
        link.sequenceNo,
        input.actorUserId,
      ],
    );
  }

  for (const line of input.lines) {
    let medicationName = "Manual entry";
    let activeIngredient: string | null = null;
    let strength: string | null = null;
    let dosageForm: string | null = null;
    if (line.medicationId) {
      const medication = await ctx.pool.query<{
        brand_name: string;
        strength: string | null;
        dosage_form: string;
        ingredient_code: string | null;
      }>(
        `
          SELECT mc.brand_name, mc.strength, mc.dosage_form, aic.code AS ingredient_code
          FROM dentos_data.medication_catalog mc
          LEFT JOIN dentos_data.active_ingredient_catalog aic ON aic.id = mc.active_ingredient_id
          WHERE mc.id = $1 AND mc.organization_id = $2
        `,
        [line.medicationId, ctx.organizationId],
      );
      const med = medication.rows[0];
      if (!med) {
        throw new Error("Medication not found");
      }
      medicationName = med.brand_name;
      activeIngredient = med.ingredient_code;
      strength = med.strength;
      dosageForm = med.dosage_form;
    }
    await ctx.pool.query(
      `
        INSERT INTO dentos_data.medication_order_lines (
          id, medication_order_id, medication_id, administration_pattern_id, medication_name_snapshot,
          active_ingredient_snapshot, strength_snapshot, dosage_form_snapshot, take_text, frequency,
          duration_value, duration_period, instructions, manual_entry_reason, sequence_no, created_by, updated_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $16)
      `,
      [
        crypto.randomUUID(),
        input.orderId,
        line.medicationId ?? null,
        line.administrationPatternId ?? null,
        medicationName,
        activeIngredient,
        strength,
        dosageForm,
        line.takeText,
        line.frequency,
        line.durationValue,
        line.durationPeriod,
        line.instructions ?? "",
        line.manualEntryReason ?? null,
        line.sequenceNo,
        input.actorUserId,
      ],
    );
  }

  await ctx.pool.query(
    `
      UPDATE dentos_data.medication_orders
      SET status = 'saved', saved_at = clock_timestamp(), saved_by = $2, updated_by = $2, updated_at = clock_timestamp()
      WHERE id = $1
    `,
    [input.orderId, input.actorUserId],
  );
  return { id: input.orderId, status: "saved" };
}

export async function signMedicationOrder(
  ctx: DbContext,
  input: { orderId: string; clinicianStaffId: string; signingPin: string; actorUserId: string },
) {
  const order = await loadMedicationOrder(ctx, input.orderId);
  if (!order) {
    throw new Error("Medication order not found");
  }
  const pinRow = await ctx.pool.query<{ pin_hash: string; pin_algorithm: string; locked_until: Date | null }>(
    `SELECT pin_hash, pin_algorithm, locked_until FROM dentos_data.staff_signing_pins WHERE staff_id = $1`,
    [input.clinicianStaffId],
  );
  const pin = pinRow.rows[0];
  if (!pin) {
    throw new Error("Signing PIN is not configured for clinician");
  }
  const pinCheck = verifyDoctorSigningPin({
    providedPin: input.signingPin,
    storedPinHash: pin.pin_hash,
    algorithm: pin.pin_algorithm,
    lockedUntil: pin.locked_until,
  });
  const signValidation = validateMedicationOrderSign({
    status: order.status as "draft" | "saved" | "signed" | "void",
    clinicianStaffId: order.clinician_id as string,
    signingStaffId: input.clinicianStaffId,
    pinVerified: pinCheck.ok,
  });
  if (!signValidation.ok) {
    throw new Error(signValidation.message);
  }

  const payload = await buildOrderSigningPayload(ctx, input.orderId);
  const signatureHash = hashMedicationOrderSignature(buildMedicationOrderSigningPayload(payload));
  await ctx.pool.query(
    `
      UPDATE dentos_data.medication_orders
      SET status = 'signed', signed_at = clock_timestamp(), signed_by = $2,
          signature_hash = $3, signature_algorithm = 'sha256', updated_by = $2, updated_at = clock_timestamp()
      WHERE id = $1
    `,
    [input.orderId, input.actorUserId, signatureHash],
  );
  return { id: input.orderId, status: "signed", signatureHash };
}

async function buildOrderSigningPayload(ctx: DbContext, orderId: string) {
  const [order, diagnoses, services, lines] = await Promise.all([
    loadMedicationOrder(ctx, orderId),
    ctx.pool.query(`SELECT * FROM dentos_data.medication_order_diagnoses WHERE medication_order_id = $1 ORDER BY sequence_no`, [
      orderId,
    ]),
    ctx.pool.query(
      `SELECT * FROM dentos_data.medication_order_service_links WHERE medication_order_id = $1 ORDER BY sequence_no`,
      [orderId],
    ),
    ctx.pool.query(`SELECT * FROM dentos_data.medication_order_lines WHERE medication_order_id = $1 ORDER BY sequence_no`, [
      orderId,
    ]),
  ]);
  return {
    order,
    diagnoses: diagnoses.rows,
    services: services.rows,
    lines: lines.rows,
  };
}

export async function reviseMedicationOrder(
  ctx: DbContext,
  input: {
    orderId: string;
    reason: string;
    patientId: string;
    encounterId: string;
    clinicianStaffId: string;
    actorUserId: string;
  },
) {
  const order = await loadMedicationOrder(ctx, input.orderId);
  if (!order) {
    throw new Error("Medication order not found");
  }
  const revisionValidation = validatePrescriptionRevision({
    replacedStatus: order.status as "draft" | "saved" | "signed" | "void",
    reason: input.reason,
  });
  if (!revisionValidation.ok) {
    throw new Error(revisionValidation.message);
  }
  const replacement = await createMedicationOrderDraft(ctx, {
    patientId: input.patientId,
    encounterId: input.encounterId,
    clinicianStaffId: input.clinicianStaffId,
    notes: `Revision of ${input.orderId}: ${input.reason}`,
    actorUserId: input.actorUserId,
  });
  await ctx.pool.query(
    `
      INSERT INTO dentos_data.medication_order_revisions (
        id, replaced_order_id, replacement_order_id, revision_no, reason, created_by
      ) VALUES ($1, $2, $3, 1, $4, $5)
    `,
    [crypto.randomUUID(), input.orderId, replacement.id, input.reason, input.actorUserId],
  );
  return replacement;
}

export async function upsertDoctorSigningPin(
  ctx: DbContext,
  input: { staffId: string; pin: string; actorUserId: string },
) {
  const pinHash = hashMedicationOrderSignature(input.pin);
  await ctx.pool.query(
    `
      INSERT INTO dentos_data.staff_signing_pins (staff_id, pin_hash, pin_algorithm, updated_by)
      VALUES ($1, $2, 'sha256', $3)
      ON CONFLICT (staff_id) DO UPDATE
      SET pin_hash = EXCLUDED.pin_hash, pin_algorithm = EXCLUDED.pin_algorithm, updated_by = EXCLUDED.updated_by, updated_at = clock_timestamp()
    `,
    [input.staffId, pinHash, input.actorUserId],
  );
  return { staffId: input.staffId };
}

export async function getDocumentPrintTemplate(
  ctx: DbContext,
  input: { groupCode: string; key: string },
) {
  const result = await ctx.pool.query<Record<string, unknown>>(
    `
      SELECT *
      FROM dentos_data.clinic_settings
      WHERE organization_id = $1
        AND clinic_id = $2
        AND group_code = $3
        AND key = $4
    `,
    [ctx.organizationId, ctx.clinicId, input.groupCode, input.key],
  );
  return result.rows[0] ?? null;
}

export async function createDocumentPrintSnapshot(
  ctx: DbContext,
  input: {
    documentType: string;
    sourceEntityType: string;
    sourceEntityId: string;
    templateGroupCode: string;
    templateKey: string;
    templateVersion: number;
    layout: Record<string, unknown>;
    payload: Record<string, unknown>;
    actorUserId: string;
    reprintNo?: number;
  },
) {
  const snapshot = buildDocumentPrintSnapshot({
    documentType: input.documentType as import("@klickit/plans-prescriptions").DocumentPrintType,
    templateVersion: input.templateVersion,
    sourceEntityType: input.sourceEntityType,
    sourceEntityId: input.sourceEntityId,
    layout: input.layout,
    payload: input.payload,
    reprintNo: input.reprintNo,
  });
  const id = crypto.randomUUID();
  await ctx.pool.query(
    `
      INSERT INTO dentos_data.document_print_snapshots (
        id, organization_id, clinic_id, document_type, source_entity_type, source_entity_id,
        template_group_code, template_key, template_version, layout_json, payload_json,
        reprint_no, printed_by, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12, $13, $13)
    `,
    [
      id,
      ctx.organizationId,
      ctx.clinicId,
      input.documentType,
      input.sourceEntityType,
      input.sourceEntityId,
      input.templateGroupCode,
      input.templateKey,
      input.templateVersion,
      JSON.stringify(snapshot.layoutJson),
      JSON.stringify(snapshot.payloadJson),
      snapshot.reprintNo,
      input.actorUserId,
    ],
  );
  return { id, snapshotHash: snapshot.snapshotHash, reprintNo: snapshot.reprintNo };
}
