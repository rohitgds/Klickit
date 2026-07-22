import {
  buildAgingBuckets,
  calculateFeeStatementLine,
  calculateFeeStatementTotals,
  calculatePatientExposure,
  reconcileCentVariance,
  roundMoney,
  validateCollectionReceiptTenders,
  validateDiscountCeiling,
  validateFeeAllocation,
  validateFeeStatementIssue,
  validateFeeStatementStatusTransition,
  validateRefundAmount,
  type FeeStatementStatus,
} from "@klickit/finance";
import type { DatabasePoolLike } from "../db/client.js";

type DbContext = {
  pool: DatabasePoolLike;
  organizationId: string;
  clinicId: string;
};

const DEFAULT_DISCOUNT_CEILING_PERCENT = 10;

async function loadFeeStatement(ctx: DbContext, statementId: string) {
  const result = await ctx.pool.query<Record<string, unknown>>(
    `SELECT * FROM dentos_data.fee_statements WHERE id = $1 AND clinic_id = $2`,
    [statementId, ctx.clinicId],
  );
  return result.rows[0] ?? null;
}

async function loadCollectionReceipt(ctx: DbContext, receiptId: string) {
  const result = await ctx.pool.query<Record<string, unknown>>(
    `SELECT * FROM dentos_data.collection_receipts WHERE id = $1 AND clinic_id = $2`,
    [receiptId, ctx.clinicId],
  );
  return result.rows[0] ?? null;
}

async function refreshFeeStatementTotals(ctx: DbContext, statementId: string) {
  const lines = await ctx.pool.query(
    `SELECT gross_amount, discount_amount, taxable_amount, cgst_amount, sgst_amount, igst_amount, line_total
     FROM dentos_data.fee_statement_lines WHERE fee_statement_id = $1`,
    [statementId],
  );
  const computed = calculateFeeStatementTotals(
    lines.rows.map((row) => ({
      grossAmount: Number(row.gross_amount),
      discountAmount: Number(row.discount_amount),
      taxableAmount: Number(row.taxable_amount),
      cgstAmount: Number(row.cgst_amount),
      sgstAmount: Number(row.sgst_amount),
      igstAmount: Number(row.igst_amount),
      lineTotal: Number(row.line_total),
    })),
  );
  await ctx.pool.query(
    `
      UPDATE dentos_data.fee_statements
      SET subtotal = $2, discount_total = $3, taxable_total = $4, tax_total = $5,
          grand_total = $6, outstanding_total = $6 - COALESCE(applied_total, 0) - COALESCE(credit_total, 0) - COALESCE(writeoff_total, 0),
          updated_at = clock_timestamp()
      WHERE id = $1
    `,
    [statementId, computed.subtotal, computed.discountTotal, computed.taxableTotal, computed.taxTotal, computed.grandTotal],
  );
  return computed;
}

export async function listFinanceMasters(ctx: DbContext) {
  const [taxCodes, collectionMethods, feeScheduleItems] = await Promise.all([
    ctx.pool.query(`SELECT * FROM dentos_data.tax_codes WHERE organization_id = $1 AND active = true ORDER BY code`, [
      ctx.organizationId,
    ]),
    ctx.pool.query(
      `SELECT * FROM dentos_data.collection_methods WHERE organization_id = $1 AND active = true ORDER BY code`,
      [ctx.organizationId],
    ),
    ctx.pool.query(
      `
        SELECT fsi.*, sc.code AS service_code, sc.description AS service_name
        FROM dentos_data.fee_schedule_items fsi
        JOIN dentos_data.fee_schedules fs ON fs.id = fsi.fee_schedule_id
        JOIN dentos_data.service_catalog sc ON sc.id = fsi.service_id
        WHERE fs.organization_id = $1 AND fs.active = true
      `,
      [ctx.organizationId],
    ),
  ]);
  return {
    taxCodes: taxCodes.rows,
    collectionMethods: collectionMethods.rows,
    feeScheduleItems: feeScheduleItems.rows,
  };
}

export async function createFeeStatementDraft(
  ctx: DbContext,
  input: {
    patientId: string;
    careEncounterId?: string;
    statementReference: string;
    statementDate?: string;
    dueDate?: string;
    feeScheduleId: string;
    actorUserId: string;
  },
) {
  const id = crypto.randomUUID();
  await ctx.pool.query(
    `
      INSERT INTO dentos_data.fee_statements (
        id, organization_id, clinic_id, patient_id, care_encounter_id, statement_reference,
        statement_date, due_date, fee_schedule_id, status, subtotal, discount_total, taxable_total,
        tax_total, round_off, grand_total, applied_total, credit_total, writeoff_total, outstanding_total,
        created_by, updated_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, COALESCE($7::date, CURRENT_DATE), $8::date, $9, 'draft',
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, $10, $10
      )
    `,
    [
      id,
      ctx.organizationId,
      ctx.clinicId,
      input.patientId,
      input.careEncounterId ?? null,
      input.statementReference,
      input.statementDate ?? null,
      input.dueDate ?? null,
      input.feeScheduleId,
      input.actorUserId,
    ],
  );
  return { id, status: "draft" as FeeStatementStatus };
}

export async function addFeeStatementLine(
  ctx: DbContext,
  input: {
    statementId: string;
    serviceId: string;
    leadClinicianId: string;
    quantity: number;
    unitFee: number;
    lineDiscount?: number;
    description?: string;
    toothCode?: string;
    sequenceNo: number;
    actorUserId: string;
    maxDiscountPercent?: number;
  },
) {
  const statement = await loadFeeStatement(ctx, input.statementId);
  if (!statement || statement.status !== "draft") {
    throw new Error("Only draft fee statements accept new lines");
  }
  const discountCheck = validateDiscountCeiling({
    lineGross: input.quantity * input.unitFee,
    requestedDiscount: input.lineDiscount ?? 0,
    maxDiscountPercent: input.maxDiscountPercent ?? DEFAULT_DISCOUNT_CEILING_PERCENT,
  });
  if (!discountCheck.ok) {
    throw new Error(discountCheck.message);
  }
  const tax = await ctx.pool.query<{ cgst_rate: string; sgst_rate: string; igst_rate: string }>(
    `
      SELECT tc.cgst_rate, tc.sgst_rate, tc.igst_rate
      FROM dentos_data.fee_schedule_items fsi
      LEFT JOIN dentos_data.tax_codes tc ON tc.id = fsi.tax_code_id
      WHERE fsi.fee_schedule_id = $1 AND fsi.service_id = $2
    `,
    [statement.fee_schedule_id, input.serviceId],
  );
  const rates = tax.rows[0] ?? { cgst_rate: "0", sgst_rate: "0", igst_rate: "0" };
  const line = calculateFeeStatementLine({
    quantity: input.quantity,
    unitFee: input.unitFee,
    lineDiscount: input.lineDiscount,
    cgstRate: Number(rates.cgst_rate),
    sgstRate: Number(rates.sgst_rate),
    igstRate: Number(rates.igst_rate),
  });
  const id = crypto.randomUUID();
  await ctx.pool.query(
    `
      INSERT INTO dentos_data.fee_statement_lines (
        id, fee_statement_id, service_id, lead_clinician_id, description, tooth_code, quantity, unit_fee,
        gross_amount, discount_amount, taxable_amount, cgst_amount, sgst_amount, igst_amount, line_total,
        sequence_no, created_by, updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $17)
    `,
    [
      id,
      input.statementId,
      input.serviceId,
      input.leadClinicianId,
      input.description ?? null,
      input.toothCode ?? null,
      input.quantity,
      input.unitFee,
      line.grossAmount,
      line.discountAmount,
      line.taxableAmount,
      line.cgstAmount,
      line.sgstAmount,
      line.igstAmount,
      line.lineTotal,
      input.sequenceNo,
      input.actorUserId,
    ],
  );
  const totals = await refreshFeeStatementTotals(ctx, input.statementId);
  return { id, totals };
}

export async function issueFeeStatement(ctx: DbContext, input: { statementId: string; actorUserId: string }) {
  const statement = await loadFeeStatement(ctx, input.statementId);
  if (!statement) {
    throw new Error("Fee statement not found");
  }
  const lineCount = await ctx.pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM dentos_data.fee_statement_lines WHERE fee_statement_id = $1`,
    [input.statementId],
  );
  const issueCheck = validateFeeStatementIssue({
    status: statement.status as FeeStatementStatus,
    lineCount: Number(lineCount.rows[0]?.count ?? 0),
  });
  if (!issueCheck.ok) {
    throw new Error(issueCheck.message);
  }
  const transition = validateFeeStatementStatusTransition({
    fromStatus: statement.status as FeeStatementStatus,
    toStatus: "issued",
  });
  if (!transition.ok) {
    throw new Error(transition.message);
  }
  await ctx.pool.query(
    `
      UPDATE dentos_data.fee_statements
      SET status = 'issued', issued_at = clock_timestamp(), outstanding_total = grand_total,
          updated_by = $2, updated_at = clock_timestamp()
      WHERE id = $1
    `,
    [input.statementId, input.actorUserId],
  );
  return { id: input.statementId, status: "issued" };
}

export async function createCollectionReceipt(
  ctx: DbContext,
  input: {
    patientId: string;
    careEncounterId?: string;
    collectionReference: string;
    collectionDate?: string;
    leadClinicianId: string;
    collectionOperatorId: string;
    notes?: string;
    tenders: Array<{ collectionMethodId: string; amount: number; referenceNo?: string }>;
    actorUserId: string;
  },
) {
  const grossCollected = roundMoney(input.tenders.reduce((sum, tender) => sum + tender.amount, 0));
  const tenderCheck = validateCollectionReceiptTenders({ grossCollected, tenders: input.tenders });
  if (!tenderCheck.ok) {
    throw new Error(tenderCheck.message);
  }
  const id = crypto.randomUUID();
  await ctx.pool.query(
    `
      INSERT INTO dentos_data.collection_receipts (
        id, organization_id, clinic_id, patient_id, care_encounter_id, lead_clinician_id_snapshot,
        collection_reference, collection_date, status, gross_collected, refunded_total, available_total,
        applied_total, unapplied_total, collection_operator_id, notes, created_by, updated_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, COALESCE($8::date, CURRENT_DATE), 'active', $9, 0, $9, 0, $9, $10, $11, $12, $12
      )
    `,
    [
      id,
      ctx.organizationId,
      ctx.clinicId,
      input.patientId,
      input.careEncounterId ?? null,
      input.leadClinicianId,
      input.collectionReference,
      input.collectionDate ?? null,
      grossCollected,
      input.collectionOperatorId,
      input.notes ?? null,
      input.actorUserId,
    ],
  );
  for (const tender of input.tenders) {
    await ctx.pool.query(
      `
        INSERT INTO dentos_data.collection_tenders (
          id, collection_receipt_id, collection_method_id, amount, reference_no, settlement_status, created_by, updated_by
        ) VALUES ($1, $2, $3, $4, $5, 'settled', $6, $6)
      `,
      [crypto.randomUUID(), id, tender.collectionMethodId, tender.amount, tender.referenceNo ?? null, input.actorUserId],
    );
  }
  return { id, grossCollected, unappliedTotal: grossCollected };
}

export async function createFeeAllocation(
  ctx: DbContext,
  input: {
    collectionReceiptId: string;
    feeStatementId: string;
    allocationDate?: string;
    amount: number;
    lineSplits: Array<{ feeStatementLineId: string; amount: number }>;
    tenderSplits: Array<{ collectionTenderId: string; amount: number }>;
    clinicianSplits?: Array<{ feeStatementLineId: string; collectionTenderId: string; amount: number }>;
    actorUserId: string;
  },
) {
  const [receipt, statement] = await Promise.all([
    loadCollectionReceipt(ctx, input.collectionReceiptId),
    loadFeeStatement(ctx, input.feeStatementId),
  ]);
  if (!receipt || !statement) {
    throw new Error("Collection receipt or fee statement not found");
  }
  const allocationCheck = validateFeeAllocation({
    allocationAmount: input.amount,
    availableOnReceipt: Number(receipt.unapplied_total),
    outstandingOnStatement: Number(statement.outstanding_total),
    lineSplitTotal: input.lineSplits.reduce((sum, split) => sum + split.amount, 0),
    tenderSplitTotal: input.tenderSplits.reduce((sum, split) => sum + split.amount, 0),
  });
  if (!allocationCheck.ok) {
    throw new Error(allocationCheck.message);
  }
  const id = crypto.randomUUID();
  await ctx.pool.query(
    `
      INSERT INTO dentos_data.fee_allocations (
        id, clinic_id, collection_receipt_id, fee_statement_id, patient_id, allocation_date,
        amount, status, applied_by, created_by, updated_by
      ) VALUES ($1, $2, $3, $4, $5, COALESCE($6::date, CURRENT_DATE), $7, 'active', $8, $8, $8)
    `,
    [
      id,
      ctx.clinicId,
      input.collectionReceiptId,
      input.feeStatementId,
      statement.patient_id,
      input.allocationDate ?? null,
      input.amount,
      input.actorUserId,
    ],
  );
  for (const split of input.lineSplits) {
    await ctx.pool.query(
      `INSERT INTO dentos_data.allocation_fee_line_splits (id, fee_allocation_id, fee_statement_line_id, amount, created_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [crypto.randomUUID(), id, split.feeStatementLineId, split.amount, input.actorUserId],
    );
  }
  for (const split of input.tenderSplits) {
    await ctx.pool.query(
      `INSERT INTO dentos_data.allocation_tender_splits (id, fee_allocation_id, collection_tender_id, amount, created_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [crypto.randomUUID(), id, split.collectionTenderId, split.amount, input.actorUserId],
    );
  }
  for (const split of input.clinicianSplits ?? []) {
    await ctx.pool.query(
      `INSERT INTO dentos_data.clinician_value_allocations (id, fee_allocation_id, fee_statement_line_id, collection_tender_id, amount, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [crypto.randomUUID(), id, split.feeStatementLineId, split.collectionTenderId, split.amount, input.actorUserId],
    );
  }
  await ctx.pool.query(
    `
      UPDATE dentos_data.collection_receipts
      SET applied_total = COALESCE(applied_total, 0) + $2,
          unapplied_total = COALESCE(unapplied_total, 0) - $2,
          updated_by = $3, updated_at = clock_timestamp()
      WHERE id = $1
    `,
    [input.collectionReceiptId, input.amount, input.actorUserId],
  );
  const newOutstanding = roundMoney(Number(statement.outstanding_total) - input.amount);
  const newStatus = newOutstanding <= 0 ? "paid" : "part_paid";
  await ctx.pool.query(
    `
      UPDATE dentos_data.fee_statements
      SET applied_total = COALESCE(applied_total, 0) + $2,
          outstanding_total = $3,
          status = $4,
          updated_by = $5,
          updated_at = clock_timestamp()
      WHERE id = $1
    `,
    [input.feeStatementId, input.amount, Math.max(0, newOutstanding), newStatus, input.actorUserId],
  );
  return { id, status: "active", statementStatus: newStatus };
}

export async function createCollectionRefund(
  ctx: DbContext,
  input: {
    collectionReceiptId: string;
    refundNo: string;
    refundDate?: string;
    amount: number;
    originalTenderId: string;
    collectionMethodId: string;
    processedBy: string;
    approvedBy: string;
    actorUserId: string;
  },
) {
  const receipt = await loadCollectionReceipt(ctx, input.collectionReceiptId);
  if (!receipt) {
    throw new Error("Collection receipt not found");
  }
  const refundCheck = validateRefundAmount({
    refundAmount: input.amount,
    availableOnReceipt: Number(receipt.available_total),
  });
  if (!refundCheck.ok) {
    throw new Error(refundCheck.message);
  }
  const id = crypto.randomUUID();
  await ctx.pool.query(
    `
      INSERT INTO dentos_data.collection_refunds (
        id, clinic_id, patient_id, collection_receipt_id, refund_no, refund_date, amount, status,
        processed_by, approved_by, created_by
      ) VALUES ($1, $2, $3, $4, $5, COALESCE($6::date, CURRENT_DATE), $7, 'posted', $8, $9, $10)
    `,
    [
      id,
      ctx.clinicId,
      receipt.patient_id,
      input.collectionReceiptId,
      input.refundNo,
      input.refundDate ?? null,
      input.amount,
      input.processedBy,
      input.approvedBy,
      input.actorUserId,
    ],
  );
  await ctx.pool.query(
    `
      INSERT INTO dentos_data.collection_refund_tenders (
        id, collection_refund_id, original_tender_id, collection_method_id, amount, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `,
    [crypto.randomUUID(), id, input.originalTenderId, input.collectionMethodId, input.amount, input.actorUserId],
  );
  await ctx.pool.query(
    `
      UPDATE dentos_data.collection_receipts
      SET refunded_total = COALESCE(refunded_total, 0) + $2,
          available_total = COALESCE(available_total, 0) - $2,
          unapplied_total = GREATEST(COALESCE(unapplied_total, 0) - $2, 0),
          status = CASE WHEN COALESCE(refunded_total, 0) + $2 >= gross_collected THEN 'refunded' ELSE 'part_refunded' END,
          updated_by = $3, updated_at = clock_timestamp()
      WHERE id = $1
    `,
    [input.collectionReceiptId, input.amount, input.actorUserId],
  );
  return { id, status: "posted" };
}

export async function postJournalEntry(
  ctx: DbContext,
  input: {
    entryDate?: string;
    sourceType: string;
    sourceId: string;
    lines: Array<{ accountId: string; debit?: number; credit?: number; memo?: string }>;
    actorUserId: string;
  },
) {
  const id = crypto.randomUUID();
  await ctx.pool.query(
    `
      INSERT INTO dentos_data.journal_entries (
        id, organization_id, clinic_id, entry_date, source_type, source_id, status, posted_at, created_by, updated_by
      ) VALUES ($1, $2, $3, COALESCE($4::date, CURRENT_DATE), $5, $6, 'posted', clock_timestamp(), $7, $7)
    `,
    [id, ctx.organizationId, ctx.clinicId, input.entryDate ?? null, input.sourceType, input.sourceId, input.actorUserId],
  );
  for (const line of input.lines) {
    await ctx.pool.query(
      `
        INSERT INTO dentos_data.journal_lines (
          id, journal_entry_id, account_id, debit, credit, memo, created_by, updated_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
      `,
      [
        crypto.randomUUID(),
        id,
        line.accountId,
        line.debit ?? 0,
        line.credit ?? 0,
        line.memo ?? null,
        input.actorUserId,
      ],
    );
  }
  return { id, status: "posted" };
}

export async function getPatientBalance(ctx: DbContext, patientId: string) {
  const statements = await ctx.pool.query<{
    grand_total: string;
    applied_total: string | null;
    credit_total: string | null;
    writeoff_total: string | null;
    outstanding_total: string | null;
  }>(
    `
      SELECT grand_total, applied_total, credit_total, writeoff_total, outstanding_total
      FROM dentos_data.fee_statements
      WHERE clinic_id = $1 AND patient_id = $2 AND status IN ('issued','part_paid','paid')
    `,
    [ctx.clinicId, patientId],
  );
  const exposure = statements.rows.reduce(
    (sum, row) =>
      sum +
      calculatePatientExposure({
        assessedTotal: Number(row.grand_total),
        appliedTotal: Number(row.applied_total ?? 0),
        creditTotal: Number(row.credit_total ?? 0),
        writeoffTotal: Number(row.writeoff_total ?? 0),
      }),
    0,
  );
  const receipts = await ctx.pool.query<{ unapplied_total: string | null }>(
    `
      SELECT unapplied_total FROM dentos_data.collection_receipts
      WHERE clinic_id = $1 AND patient_id = $2 AND status IN ('active','part_refunded')
    `,
    [ctx.clinicId, patientId],
  );
  const unapplied = roundMoney(receipts.rows.reduce((sum, row) => sum + Number(row.unapplied_total ?? 0), 0));
  return { openExposure: roundMoney(exposure), unappliedCollections: unapplied };
}

export async function getPatientAging(ctx: DbContext, patientId: string, asOfDate?: string) {
  const statements = await ctx.pool.query<{ due_date: string | null; outstanding_total: string }>(
    `
      SELECT due_date, outstanding_total
      FROM dentos_data.fee_statements
      WHERE clinic_id = $1 AND patient_id = $2 AND status IN ('issued','part_paid') AND outstanding_total > 0
    `,
    [ctx.clinicId, patientId],
  );
  return buildAgingBuckets(
    statements.rows.map((row) => ({
      dueDate: row.due_date,
      outstandingTotal: Number(row.outstanding_total),
    })),
    asOfDate ?? new Date().toISOString().slice(0, 10),
  );
}

export async function verifyOpeningBalance(
  ctx: DbContext,
  input: {
    patientId: string;
    balanceDate?: string;
    receivableAmount: number;
    advanceAmount: number;
    actorUserId: string;
  },
) {
  const id = crypto.randomUUID();
  await ctx.pool.query(
    `
      INSERT INTO dentos_data.legacy_balance_documents (
        id, clinic_id, patient_id, balance_date, receivable_amount, advance_amount, status, created_by, updated_by
      ) VALUES ($1, $2, $3, COALESCE($4::date, CURRENT_DATE), $5, $6, 'verified', $7, $7)
    `,
    [
      id,
      ctx.clinicId,
      input.patientId,
      input.balanceDate ?? null,
      input.receivableAmount,
      input.advanceAmount,
      input.actorUserId,
    ],
  );
  return { id, status: "verified" };
}

export async function reconcileFeeStatement(ctx: DbContext, statementId: string) {
  const statement = await loadFeeStatement(ctx, statementId);
  if (!statement) {
    throw new Error("Fee statement not found");
  }
  const lines = await ctx.pool.query<{ line_total: string }>(
    `SELECT line_total FROM dentos_data.fee_statement_lines WHERE fee_statement_id = $1`,
    [statementId],
  );
  const lineSum = roundMoney(lines.rows.reduce((sum, row) => sum + Number(row.line_total), 0));
  const headerTotal = roundMoney(Number(statement.grand_total));
  const result = reconcileCentVariance({ sourceTotal: lineSum, outputTotal: headerTotal });
  if (!result.ok) {
    throw new Error(result.message);
  }
  return { statementId, variance: result.variance, ok: true };
}

export async function getFeeStatementDetail(ctx: DbContext, statementId: string) {
  const statement = await loadFeeStatement(ctx, statementId);
  if (!statement) {
    throw new Error("Fee statement not found");
  }
  const lines = await ctx.pool.query(
    `SELECT * FROM dentos_data.fee_statement_lines WHERE fee_statement_id = $1 ORDER BY sequence_no`,
    [statementId],
  );
  return { statement, lines: lines.rows };
}
