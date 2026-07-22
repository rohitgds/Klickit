import {
  buildOperationalDashboardSummary,
  buildSchedulerViewRange,
  detectCrossClinicCollision,
  intervalsOverlap,
  isActiveBookingStatus,
  validateBookingTransition,
  validateEncounterTransition,
  type CareBookingState,
  type EncounterFlowState,
  type SchedulerViewType,
} from "@klickit/scheduling";
import type { DatabasePoolLike } from "../db/client.js";
import { recordAppointmentCollisionWarning } from "../sync/conflicts.js";
import { publishLiveEvent } from "./live-events.js";

type DbContext = {
  pool: DatabasePoolLike;
  organizationId: string;
  clinicId: string;
};

function mapChair(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    clinicId: row.clinic_id as string,
    code: row.code as string | null,
    name: row.name as string | null,
    displayOrder: Number(row.display_order),
    active: Boolean(row.active),
  };
}

function mapReason(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    name: row.name as string | null,
    defaultMinutes: row.default_minutes == null ? null : Number(row.default_minutes),
    colorHex: row.color_hex as string | null,
    active: Boolean(row.active),
  };
}

function mapBooking(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    careBookingNo: row.care_booking_no as string | null,
    clinicId: row.clinic_id as string,
    patientId: row.patient_id as string | null,
    patientKind: row.patient_kind as string | null,
    startsAt: row.starts_at as string | null,
    endsAt: row.ends_at as string | null,
    leadClinicianId: row.lead_clinician_id as string,
    chairId: row.chair_id as string,
    reasonId: row.reason_id as string,
    status: row.status as CareBookingState,
    comments: row.comments as string | null,
    rowVersion: Number(row.row_version),
  };
}

function mapEncounter(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    encounterNo: row.encounter_no as string | null,
    encounterDate: row.encounter_date as string,
    queueSequence: Number(row.queue_sequence),
    patientId: row.patient_id as string,
    careBookingId: row.care_booking_id as string | null,
    encounterType: row.encounter_type as string,
    leadClinicianId: row.lead_clinician_id as string,
    chairId: row.chair_id as string | null,
    reasonId: row.reason_id as string,
    scheduledTime: row.scheduled_time as string | null,
    status: row.status as EncounterFlowState,
    arrivalAt: row.arrival_at as string | null,
    checkedInAt: row.checked_in_at as string | null,
    engagedAt: row.engaged_at as string | null,
    checkedOutAt: row.checked_out_at as string | null,
    rowVersion: Number(row.row_version),
  };
}

export async function listSchedulingMasters(ctx: DbContext) {
  const [chairs, reasons, staffHours, chairHours, blackouts] = await Promise.all([
    ctx.pool.query(`SELECT * FROM dentos_data.chairs WHERE clinic_id = $1 ORDER BY display_order`, [ctx.clinicId]),
    ctx.pool.query(
      `SELECT * FROM dentos_data.care_booking_reasons WHERE organization_id = $1 ORDER BY name`,
      [ctx.organizationId],
    ),
    ctx.pool.query(
      `SELECT * FROM dentos_data.staff_working_hours WHERE clinic_id = $1 ORDER BY weekday, starts_local`,
      [ctx.clinicId],
    ),
    ctx.pool.query(
      `
        SELECT cwh.*
        FROM dentos_data.chair_working_hours cwh
        JOIN dentos_data.chairs c ON c.id = cwh.chair_id
        WHERE c.clinic_id = $1
        ORDER BY cwh.weekday, cwh.starts_local
      `,
      [ctx.clinicId],
    ),
    ctx.pool.query(
      `SELECT * FROM dentos_data.resource_blackouts WHERE clinic_id = $1 AND status = 'active' ORDER BY starts_at`,
      [ctx.clinicId],
    ),
  ]);

  return {
    chairs: chairs.rows.map(mapChair),
    bookingReasons: reasons.rows.map(mapReason),
    staffWorkingHours: staffHours.rows,
    chairWorkingHours: chairHours.rows,
    blackouts: blackouts.rows,
  };
}

export async function createChair(
  ctx: DbContext,
  input: { code: string; name: string; displayOrder: number; createdBy: string },
) {
  const id = crypto.randomUUID();
  await ctx.pool.query(
    `
      INSERT INTO dentos_data.chairs (
        id, clinic_id, code, name, display_order, active, created_by, updated_by
      ) VALUES ($1, $2, $3, $4, $5, true, $6, $6)
    `,
    [id, ctx.clinicId, input.code, input.name, input.displayOrder, input.createdBy],
  );
  publishLiveEvent({
    clinicId: ctx.clinicId,
    type: "scheduling.master.updated",
    aggregateType: "chair",
    aggregateId: id,
    payload: { action: "created" },
  });
  return { id };
}

export async function createBookingReason(
  ctx: DbContext,
  input: { name: string; defaultMinutes: number; colorHex?: string; createdBy: string },
) {
  const id = crypto.randomUUID();
  await ctx.pool.query(
    `
      INSERT INTO dentos_data.care_booking_reasons (
        id, organization_id, name, default_minutes, color_hex, active, created_by, updated_by
      ) VALUES ($1, $2, $3, $4, $5, true, $6, $6)
    `,
    [id, ctx.organizationId, input.name, input.defaultMinutes, input.colorHex ?? null, input.createdBy],
  );
  return { id };
}

export async function createStaffWorkingHours(
  ctx: DbContext,
  input: {
    staffId: string;
    weekday: number;
    startsLocal: string;
    endsLocal: string;
    createdBy: string;
  },
) {
  const id = crypto.randomUUID();
  await ctx.pool.query(
    `
      INSERT INTO dentos_data.staff_working_hours (
        id, clinic_id, staff_id, weekday, starts_local, ends_local, active, created_by, updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, true, $7, $7)
    `,
    [id, ctx.clinicId, input.staffId, input.weekday, input.startsLocal, input.endsLocal, input.createdBy],
  );
  return { id };
}

export async function createResourceBlackout(
  ctx: DbContext,
  input: {
    startsAt: string;
    endsAt: string;
    reason: string;
    chairId?: string;
    clinicianId?: string;
    createdBy: string;
  },
) {
  const id = crypto.randomUUID();
  await ctx.pool.query(
    `
      INSERT INTO dentos_data.resource_blackouts (
        id, clinic_id, clinician_id, chair_id, starts_at, ends_at, reason, status, created_by, updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8, $8)
    `,
    [
      id,
      ctx.clinicId,
      input.clinicianId ?? null,
      input.chairId ?? null,
      input.startsAt,
      input.endsAt,
      input.reason,
      input.createdBy,
    ],
  );
  return { id };
}

async function findBookingConflicts(
  ctx: DbContext,
  input: { startsAt: string; endsAt: string; chairId: string; leadClinicianId: string; excludeBookingId?: string },
) {
  const result = await ctx.pool.query<Record<string, unknown>>(
    `
      SELECT id, starts_at, ends_at, chair_id, lead_clinician_id, status
      FROM dentos_data.care_bookings
      WHERE clinic_id = $1
        AND status IN ('scheduled', 'confirmed', 'arrived')
        AND starts_at IS NOT NULL
        AND ends_at IS NOT NULL
        AND ($4::uuid IS NULL OR id <> $4)
        AND (
          (chair_id = $2 AND tstzrange(starts_at, ends_at, '[)') && tstzrange($5::timestamptz, $6::timestamptz, '[)'))
          OR
          (lead_clinician_id = $3 AND tstzrange(starts_at, ends_at, '[)') && tstzrange($5::timestamptz, $6::timestamptz, '[)'))
        )
    `,
    [ctx.clinicId, input.chairId, input.leadClinicianId, input.excludeBookingId ?? null, input.startsAt, input.endsAt],
  );
  return result.rows;
}

export async function queryAvailability(
  ctx: DbContext,
  input: { startsAt: string; endsAt: string; chairId?: string; leadClinicianId?: string },
) {
  const conflicts = await ctx.pool.query<Record<string, unknown>>(
    `
      SELECT id, starts_at, ends_at, chair_id, lead_clinician_id, status
      FROM dentos_data.care_bookings
      WHERE clinic_id = $1
        AND status IN ('scheduled', 'confirmed', 'arrived')
        AND starts_at < $3::timestamptz
        AND ends_at > $2::timestamptz
        AND ($4::uuid IS NULL OR chair_id = $4)
        AND ($5::uuid IS NULL OR lead_clinician_id = $5)
      ORDER BY starts_at
    `,
    [ctx.clinicId, input.startsAt, input.endsAt, input.chairId ?? null, input.leadClinicianId ?? null],
  );

  const blackouts = await ctx.pool.query<Record<string, unknown>>(
    `
      SELECT id, starts_at, ends_at, chair_id, clinician_id, reason
      FROM dentos_data.resource_blackouts
      WHERE clinic_id = $1
        AND status = 'active'
        AND starts_at < $3::timestamptz
        AND ends_at > $2::timestamptz
    `,
    [ctx.clinicId, input.startsAt, input.endsAt],
  );

  return {
    available: conflicts.rows.length === 0 && blackouts.rows.length === 0,
    conflicts: conflicts.rows.map(mapBooking),
    blackouts: blackouts.rows,
  };
}

export async function listSchedulerView(
  ctx: DbContext,
  input: { view: SchedulerViewType; anchorDate: string; chairId?: string; leadClinicianId?: string },
) {
  const range = buildSchedulerViewRange({ view: input.view, anchorDate: input.anchorDate });
  const result = await ctx.pool.query<Record<string, unknown>>(
    `
      SELECT *
      FROM dentos_data.care_bookings
      WHERE clinic_id = $1
        AND starts_at >= $2::timestamptz
        AND starts_at < $3::timestamptz
        AND ($4::uuid IS NULL OR chair_id = $4)
        AND ($5::uuid IS NULL OR lead_clinician_id = $5)
      ORDER BY starts_at, chair_id
    `,
    [ctx.clinicId, range.startsAt, range.endsAt, input.chairId ?? null, input.leadClinicianId ?? null],
  );
  return {
    view: input.view,
    anchorDate: input.anchorDate,
    range,
    bookings: result.rows.map(mapBooking),
  };
}

export async function listBookings(ctx: DbContext, input: { date?: string; status?: CareBookingState }) {
  const result = await ctx.pool.query<Record<string, unknown>>(
    `
      SELECT *
      FROM dentos_data.care_bookings
      WHERE clinic_id = $1
        AND ($2::date IS NULL OR starts_at::date = $2::date)
        AND ($3::text IS NULL OR status = $3::dentos_data.care_booking_state)
      ORDER BY starts_at NULLS LAST
    `,
    [ctx.clinicId, input.date ?? null, input.status ?? null],
  );
  return result.rows.map(mapBooking);
}

export async function createCareBooking(
  ctx: DbContext,
  input: {
    patientId?: string;
    patientKind: "new" | "established";
    firstNameSnapshot?: string;
    lastNameSnapshot?: string;
    cellPhoneSnapshot?: string;
    startsAt: string;
    endsAt: string;
    leadClinicianId: string;
    chairId: string;
    reasonId: string;
    comments?: string;
    createdBy: string;
  },
) {
  const transition = validateBookingTransition({
    fromStatus: null,
    toStatus: "scheduled",
    reason: "CARE_BOOKING_CREATED",
  });
  if (!transition.ok) {
    throw new Error(transition.message);
  }

  const conflicts = await findBookingConflicts(ctx, {
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    chairId: input.chairId,
    leadClinicianId: input.leadClinicianId,
  });
  if (conflicts.length > 0) {
    throw new Error("Chair or clinician conflict detected");
  }

  const id = crypto.randomUUID();
  await ctx.pool.query(
    `
      INSERT INTO dentos_data.care_bookings (
        id, organization_id, clinic_id, patient_id, patient_kind,
        first_name_snapshot, last_name_snapshot, cell_phone_snapshot,
        starts_at, ends_at, lead_clinician_id, chair_id, reason_id,
        comments, status, source, created_by, updated_by
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8,
        $9, $10, $11, $12, $13,
        $14, 'scheduled', 'gateway', $15, $15
      )
    `,
    [
      id,
      ctx.organizationId,
      ctx.clinicId,
      input.patientId ?? null,
      input.patientKind,
      input.firstNameSnapshot ?? null,
      input.lastNameSnapshot ?? null,
      input.cellPhoneSnapshot ?? null,
      input.startsAt,
      input.endsAt,
      input.leadClinicianId,
      input.chairId,
      input.reasonId,
      input.comments ?? null,
      input.createdBy,
    ],
  );

  await ctx.pool.query(
    `
      INSERT INTO dentos_data.care_booking_state_events (
        id, care_booking_id, sequence_no, from_status, to_status, changed_by, reason, created_by
      ) VALUES ($1, $2, 1, NULL, 'scheduled', $3, 'CARE_BOOKING_CREATED', $3)
    `,
    [crypto.randomUUID(), id, input.createdBy],
  );

  publishLiveEvent({
    clinicId: ctx.clinicId,
    type: "care_booking.created",
    aggregateType: "care_booking",
    aggregateId: id,
  });

  return { id, status: "scheduled" as const };
}

async function appendBookingStateEvent(
  ctx: DbContext,
  input: {
    bookingId: string;
    fromStatus: CareBookingState | null;
    toStatus: CareBookingState;
    changedBy: string;
    reason: string;
  },
) {
  const next = await ctx.pool.query<{ next_seq: string }>(
    `
      SELECT COALESCE(MAX(sequence_no), 0) + 1 AS next_seq
      FROM dentos_data.care_booking_state_events
      WHERE care_booking_id = $1
    `,
    [input.bookingId],
  );
  await ctx.pool.query(
    `
      INSERT INTO dentos_data.care_booking_state_events (
        id, care_booking_id, sequence_no, from_status, to_status, changed_by, reason, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $6)
    `,
    [
      crypto.randomUUID(),
      input.bookingId,
      Number(next.rows[0]?.next_seq ?? 1),
      input.fromStatus,
      input.toStatus,
      input.changedBy,
      input.reason,
    ],
  );
}

async function loadBooking(ctx: DbContext, bookingId: string) {
  const result = await ctx.pool.query<Record<string, unknown>>(
    `SELECT * FROM dentos_data.care_bookings WHERE id = $1 AND clinic_id = $2`,
    [bookingId, ctx.clinicId],
  );
  return result.rows[0] ?? null;
}

export async function transitionCareBooking(
  ctx: DbContext,
  input: {
    bookingId: string;
    toStatus: CareBookingState;
    reason: string;
    changedBy: string;
    allowTerminalCorrection?: boolean;
    cancellationReason?: string;
    noShowReason?: string;
    reschedule?: {
      startsAt: string;
      endsAt: string;
      leadClinicianId?: string;
      chairId?: string;
      resetConfirmation?: boolean;
    };
  },
) {
  const booking = await loadBooking(ctx, input.bookingId);
  if (!booking) {
    throw new Error("Care booking not found");
  }
  const fromStatus = booking.status as CareBookingState;

  if (input.reschedule) {
    if (fromStatus === "completed") {
      throw new Error("Completed care bookings cannot be rescheduled");
    }
    const conflicts = await findBookingConflicts(ctx, {
      startsAt: input.reschedule.startsAt,
      endsAt: input.reschedule.endsAt,
      chairId: (input.reschedule.chairId ?? booking.chair_id) as string,
      leadClinicianId: (input.reschedule.leadClinicianId ?? booking.lead_clinician_id) as string,
      excludeBookingId: input.bookingId,
    });
    if (conflicts.length > 0) {
      throw new Error("Chair or clinician conflict detected");
    }
    const nextStatus =
      input.reschedule.resetConfirmation && fromStatus === "confirmed" ? "scheduled" : fromStatus;
    await ctx.pool.query(
      `
        UPDATE dentos_data.care_bookings
        SET starts_at = $2,
            ends_at = $3,
            lead_clinician_id = COALESCE($4, lead_clinician_id),
            chair_id = COALESCE($5, chair_id),
            status = $6,
            updated_by = $7
        WHERE id = $1
      `,
      [
        input.bookingId,
        input.reschedule.startsAt,
        input.reschedule.endsAt,
        input.reschedule.leadClinicianId ?? null,
        input.reschedule.chairId ?? null,
        nextStatus,
        input.changedBy,
      ],
    );
    if (nextStatus !== fromStatus) {
      await appendBookingStateEvent(ctx, {
        bookingId: input.bookingId,
        fromStatus,
        toStatus: nextStatus,
        changedBy: input.changedBy,
        reason: "CONFIRMATION_RESET_BY_RESCHEDULE",
      });
    }
    publishLiveEvent({
      clinicId: ctx.clinicId,
      type: "care_booking.rescheduled",
      aggregateType: "care_booking",
      aggregateId: input.bookingId,
    });
    return { id: input.bookingId, status: nextStatus };
  }

  const validation = validateBookingTransition({
    fromStatus,
    toStatus: input.toStatus,
    reason: input.reason,
    allowTerminalCorrection: input.allowTerminalCorrection,
  });
  if (!validation.ok) {
    throw new Error(validation.message);
  }

  if (input.toStatus === "cancelled") {
    await ctx.pool.query(
      `
        UPDATE dentos_data.care_bookings
        SET status = 'cancelled',
            cancellation_reason = $2,
            cancelled_at = clock_timestamp(),
            cancelled_by = $3,
            updated_by = $3
        WHERE id = $1
      `,
      [input.bookingId, input.cancellationReason ?? input.reason, input.changedBy],
    );
  } else if (input.toStatus === "no_show") {
    await ctx.pool.query(
      `
        UPDATE dentos_data.care_bookings
        SET status = 'no_show',
            no_show_reason = $2,
            no_show_marked_at = clock_timestamp(),
            no_show_marked_by = $3,
            updated_by = $3
        WHERE id = $1
      `,
      [input.bookingId, input.noShowReason ?? input.reason, input.changedBy],
    );
  } else {
    await ctx.pool.query(
      `
        UPDATE dentos_data.care_bookings
        SET status = $2, updated_by = $3
        WHERE id = $1
      `,
      [input.bookingId, input.toStatus, input.changedBy],
    );
  }

  await appendBookingStateEvent(ctx, {
    bookingId: input.bookingId,
    fromStatus,
    toStatus: input.toStatus,
    changedBy: input.changedBy,
    reason: input.reason,
  });

  publishLiveEvent({
    clinicId: ctx.clinicId,
    type: `care_booking.${input.toStatus}`,
    aggregateType: "care_booking",
    aggregateId: input.bookingId,
  });

  return { id: input.bookingId, status: input.toStatus };
}

export async function getBookingHistory(ctx: DbContext, bookingId: string) {
  const result = await ctx.pool.query(
    `
      SELECT sequence_no, from_status, to_status, changed_at, changed_by, reason
      FROM dentos_data.care_booking_state_events
      WHERE care_booking_id = $1
      ORDER BY sequence_no
    `,
    [bookingId],
  );
  return result.rows;
}

export async function listClinicalQueue(ctx: DbContext, encounterDate: string) {
  const [encounters, arrivalCandidates] = await Promise.all([
    ctx.pool.query<Record<string, unknown>>(
      `
        SELECT *
        FROM dentos_data.care_encounters
        WHERE clinic_id = $1 AND encounter_date = $2::date
        ORDER BY queue_sequence
      `,
      [ctx.clinicId, encounterDate],
    ),
    ctx.pool.query<Record<string, unknown>>(
      `
        SELECT *
        FROM dentos_data.care_bookings
        WHERE clinic_id = $1
          AND starts_at::date = $2::date
          AND status IN ('scheduled', 'confirmed')
        ORDER BY starts_at
      `,
      [ctx.clinicId, encounterDate],
    ),
  ]);

  return {
    date: encounterDate,
    encounters: encounters.rows.map(mapEncounter),
    arrivalCandidates: arrivalCandidates.rows.map(mapBooking),
  };
}

async function nextQueueSequence(ctx: DbContext, encounterDate: string): Promise<number> {
  const result = await ctx.pool.query<{ next_seq: string }>(
    `
      SELECT COALESCE(MAX(queue_sequence), 0) + 1 AS next_seq
      FROM dentos_data.care_encounters
      WHERE clinic_id = $1 AND encounter_date = $2::date
    `,
    [ctx.clinicId, encounterDate],
  );
  return Number(result.rows[0]?.next_seq ?? 1);
}

export async function createUnscheduledEncounter(
  ctx: DbContext,
  input: {
    patientId: string;
    leadClinicianId: string;
    reasonId: string;
    encounterDate: string;
    scheduledTime?: string;
    chairId?: string;
    createdBy: string;
  },
) {
  const id = crypto.randomUUID();
  const queueSequence = await nextQueueSequence(ctx, input.encounterDate);
  await ctx.pool.query(
    `
      INSERT INTO dentos_data.care_encounters (
        id, organization_id, clinic_id, encounter_date, queue_sequence,
        patient_id, encounter_type, lead_clinician_id, chair_id, reason_id,
        scheduled_time, status, checked_in_at, created_by, updated_by
      ) VALUES (
        $1, $2, $3, $4::date, $5,
        $6, 'unscheduled', $7, $8, $9,
        $10, 'checked_in', clock_timestamp(), $11, $11
      )
    `,
    [
      id,
      ctx.organizationId,
      ctx.clinicId,
      input.encounterDate,
      queueSequence,
      input.patientId,
      input.leadClinicianId,
      input.chairId ?? null,
      input.reasonId,
      input.scheduledTime ?? null,
      input.createdBy,
    ],
  );

  publishLiveEvent({
    clinicId: ctx.clinicId,
    type: "care_encounter.created",
    aggregateType: "care_encounter",
    aggregateId: id,
    payload: { encounterType: "unscheduled" },
  });

  return { id, queueSequence, status: "checked_in" as const };
}

export async function checkInBooking(
  ctx: DbContext,
  input: { bookingId: string; encounterDate: string; changedBy: string },
) {
  const booking = await loadBooking(ctx, input.bookingId);
  if (!booking) {
    throw new Error("Care booking not found");
  }

  const existing = await ctx.pool.query(
    `SELECT id FROM dentos_data.care_encounters WHERE care_booking_id = $1`,
    [input.bookingId],
  );
  if (existing.rows[0]) {
    return { encounterId: existing.rows[0].id as string, idempotent: true };
  }

  await transitionCareBooking(ctx, {
    bookingId: input.bookingId,
    toStatus: "arrived",
    reason: "PATIENT_ARRIVED",
    changedBy: input.changedBy,
  });

  const encounterId = crypto.randomUUID();
  const queueSequence = await nextQueueSequence(ctx, input.encounterDate);
  await ctx.pool.query(
    `
      INSERT INTO dentos_data.care_encounters (
        id, organization_id, clinic_id, encounter_no, encounter_date, queue_sequence,
        patient_id, care_booking_id, encounter_type, lead_clinician_id, chair_id, reason_id,
        scheduled_time, status, arrival_at, checked_in_at, created_by, updated_by
      ) VALUES (
        $1, $2, $3, NULL, $4::date, $5,
        $6, $7, 'care_booking', $8, $9, $10,
        ($11::timestamptz)::time, 'checked_in', clock_timestamp(), clock_timestamp(), $12, $12
      )
    `,
    [
      encounterId,
      ctx.organizationId,
      ctx.clinicId,
      input.encounterDate,
      queueSequence,
      booking.patient_id,
      input.bookingId,
      booking.lead_clinician_id,
      booking.chair_id,
      booking.reason_id,
      booking.starts_at,
      input.changedBy,
    ],
  );

  publishLiveEvent({
    clinicId: ctx.clinicId,
    type: "care_encounter.checked_in",
    aggregateType: "care_encounter",
    aggregateId: encounterId,
    payload: { careBookingId: input.bookingId },
  });

  return { encounterId, queueSequence, status: "checked_in" as const };
}

async function loadEncounter(ctx: DbContext, encounterId: string) {
  const result = await ctx.pool.query<Record<string, unknown>>(
    `SELECT * FROM dentos_data.care_encounters WHERE id = $1 AND clinic_id = $2`,
    [encounterId, ctx.clinicId],
  );
  return result.rows[0] ?? null;
}

export async function transitionEncounter(
  ctx: DbContext,
  input: {
    encounterId: string;
    toStatus: EncounterFlowState;
    changedBy: string;
    reason?: string;
    allowDirectEngage?: boolean;
    allowCorrection?: boolean;
  },
) {
  const encounter = await loadEncounter(ctx, input.encounterId);
  if (!encounter) {
    throw new Error("Encounter not found");
  }
  const fromStatus = encounter.status as EncounterFlowState;
  const validation = validateEncounterTransition({
    fromStatus,
    toStatus: input.toStatus,
    reason: input.reason,
    allowDirectEngage: input.allowDirectEngage,
    allowCorrection: input.allowCorrection,
  });
  if (!validation.ok) {
    throw new Error(validation.message);
  }

  const timestampColumn =
    input.toStatus === "engaged"
      ? "engaged_at"
      : input.toStatus === "checked_out"
        ? "checked_out_at"
        : input.toStatus === "checked_in"
          ? "checked_in_at"
          : null;

  if (timestampColumn) {
    await ctx.pool.query(
      `
        UPDATE dentos_data.care_encounters
        SET status = $2,
            ${timestampColumn} = clock_timestamp(),
            updated_by = $3
        WHERE id = $1
      `,
      [input.encounterId, input.toStatus, input.changedBy],
    );
  } else {
    await ctx.pool.query(
      `
        UPDATE dentos_data.care_encounters
        SET status = $2,
            updated_by = $3
        WHERE id = $1
      `,
      [input.encounterId, input.toStatus, input.changedBy],
    );
  }

  await ctx.pool.query(
    `
      INSERT INTO dentos_data.encounter_state_events (
        id, care_encounter_id, from_status, to_status, changed_by, reason, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $5)
    `,
    [crypto.randomUUID(), input.encounterId, fromStatus, input.toStatus, input.changedBy, input.reason ?? null],
  );

  if (input.toStatus === "checked_out" && encounter.care_booking_id) {
    await transitionCareBooking(ctx, {
      bookingId: encounter.care_booking_id as string,
      toStatus: "completed",
      reason: "ENCOUNTER_CHECKED_OUT",
      changedBy: input.changedBy,
    });
  }

  publishLiveEvent({
    clinicId: ctx.clinicId,
    type: `care_encounter.${input.toStatus}`,
    aggregateType: "care_encounter",
    aggregateId: input.encounterId,
  });

  return { id: input.encounterId, status: input.toStatus };
}

export async function reconcileCrossClinicCollisions(ctx: DbContext) {
  const result = await ctx.pool.query<Record<string, unknown>>(
    `
      SELECT
        a.id AS booking_a_id,
        b.id AS booking_b_id,
        a.patient_id,
        a.clinic_id AS clinic_a_id,
        b.clinic_id AS clinic_b_id,
        a.starts_at AS starts_a,
        a.ends_at AS ends_a,
        b.starts_at AS starts_b,
        b.ends_at AS ends_b
      FROM dentos_data.care_bookings a
      JOIN dentos_data.care_bookings b
        ON a.patient_id = b.patient_id
       AND a.id < b.id
       AND a.clinic_id <> b.clinic_id
      WHERE a.organization_id = $1
        AND a.patient_id IS NOT NULL
        AND a.status IN ('scheduled', 'confirmed', 'arrived')
        AND b.status IN ('scheduled', 'confirmed', 'arrived')
        AND tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(b.starts_at, b.ends_at, '[)')
    `,
    [ctx.organizationId],
  );

  const warnings: string[] = [];
  for (const row of result.rows) {
    const collision = detectCrossClinicCollision({
      patientId: row.patient_id as string,
      clinicIdA: row.clinic_a_id as string,
      clinicIdB: row.clinic_b_id as string,
      bookingIdA: row.booking_a_id as string,
      bookingIdB: row.booking_b_id as string,
      startsAtA: new Date(row.starts_a as string),
      endsAtA: new Date(row.ends_a as string),
      startsAtB: new Date(row.starts_b as string),
      endsAtB: new Date(row.ends_b as string),
    });
    if (!collision) {
      continue;
    }
    const warningId = await recordAppointmentCollisionWarning(ctx.pool, {
      organizationId: ctx.organizationId,
      clinicId: ctx.clinicId,
      patientId: collision.patientId,
      appointmentIdA: collision.bookingIdA,
      appointmentIdB: collision.bookingIdB,
      clinicIdA: row.clinic_a_id as string,
      clinicIdB: row.clinic_b_id as string,
    });
    warnings.push(warningId);
    publishLiveEvent({
      clinicId: ctx.clinicId,
      type: "appointment.collision_warning",
      aggregateType: "care_booking",
      aggregateId: collision.bookingIdA,
      payload: { relatedBookingId: collision.bookingIdB },
    });
  }

  return { warningsCreated: warnings.length, warningIds: warnings };
}

export async function getOperationalDashboard(ctx: DbContext, date: string) {
  const [scheduled, confirmed, arrivals, waiting, engaged, noShows, cancellations] = await Promise.all([
    ctx.pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM dentos_data.care_bookings WHERE clinic_id = $1 AND starts_at::date = $2::date AND status = 'scheduled'`,
      [ctx.clinicId, date],
    ),
    ctx.pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM dentos_data.care_bookings WHERE clinic_id = $1 AND starts_at::date = $2::date AND status = 'confirmed'`,
      [ctx.clinicId, date],
    ),
    ctx.pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM dentos_data.care_bookings WHERE clinic_id = $1 AND starts_at::date = $2::date AND status IN ('scheduled','confirmed')`,
      [ctx.clinicId, date],
    ),
    ctx.pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM dentos_data.care_encounters WHERE clinic_id = $1 AND encounter_date = $2::date AND status IN ('waiting','checked_in')`,
      [ctx.clinicId, date],
    ),
    ctx.pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM dentos_data.care_encounters WHERE clinic_id = $1 AND encounter_date = $2::date AND status = 'engaged'`,
      [ctx.clinicId, date],
    ),
    ctx.pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM dentos_data.care_bookings WHERE clinic_id = $1 AND starts_at::date = $2::date AND status = 'no_show'`,
      [ctx.clinicId, date],
    ),
    ctx.pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM dentos_data.care_bookings WHERE clinic_id = $1 AND starts_at::date = $2::date AND status = 'cancelled'`,
      [ctx.clinicId, date],
    ),
  ]);

  return buildOperationalDashboardSummary({
    date,
    bookingsScheduled: Number(scheduled.rows[0]?.count ?? 0),
    bookingsConfirmed: Number(confirmed.rows[0]?.count ?? 0),
    arrivalsExpected: Number(arrivals.rows[0]?.count ?? 0),
    queueWaiting: Number(waiting.rows[0]?.count ?? 0),
    queueEngaged: Number(engaged.rows[0]?.count ?? 0),
    noShowsToday: Number(noShows.rows[0]?.count ?? 0),
    cancellationsToday: Number(cancellations.rows[0]?.count ?? 0),
  });
}

export { isActiveBookingStatus, intervalsOverlap };
