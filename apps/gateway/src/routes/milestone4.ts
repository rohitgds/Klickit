import type { FastifyInstance } from "fastify";
import { buildKeyboardShortcuts, type CareBookingState, type SchedulerViewType } from "@klickit/scheduling";
import type { GatewayDependencies } from "./index.js";
import { evaluateOfflineWritePolicy } from "../sync/engine.js";
import { requirePermission, requireSession } from "../security/middleware.js";
import { listLiveEventsSince } from "../scheduling/live-events.js";
import {
  checkInBooking,
  createBookingReason,
  createCareBooking,
  createChair,
  createResourceBlackout,
  createStaffWorkingHours,
  createUnscheduledEncounter,
  getBookingHistory,
  getOperationalDashboard,
  listBookings,
  listClinicalQueue,
  listSchedulerView,
  listSchedulingMasters,
  queryAvailability,
  reconcileCrossClinicCollisions,
  transitionCareBooking,
  transitionEncounter,
} from "../scheduling/repository.js";

function dbContext(deps: GatewayDependencies) {
  if (!deps.pool || !deps.bootstrap) {
    throw new Error("Gateway database bootstrap is unavailable");
  }
  return {
    pool: deps.pool,
    organizationId: deps.bootstrap.clinic.organizationId,
    clinicId: deps.bootstrap.clinic.id,
  };
}

function enforceWriteAllowed(deps: GatewayDependencies) {
  if (!deps.bootstrap) {
    return;
  }
  const policy = evaluateOfflineWritePolicy(deps.bootstrap.gateway);
  if (!policy.writeAllowed || policy.readOnly) {
    throw new Error("Clinic gateway is read-only after the 72-hour offline limit");
  }
}

function actorUserId(request: { klickitSession?: { userId: string } }): string {
  return request.klickitSession?.userId ?? "00000000-0000-4000-8000-000000000000";
}

export async function registerMilestone4Routes(app: FastifyInstance, deps: GatewayDependencies) {
  app.get(
    "/scheduling/masters",
    { preHandler: [requireSession(deps), requirePermission(deps, "scheduler.view")] },
    async () => {
      const ctx = dbContext(deps);
      return listSchedulingMasters(ctx);
    },
  );

  app.post<{ Body: { code: string; name: string; displayOrder: number } }>(
    "/scheduling/chairs",
    { preHandler: [requireSession(deps), requirePermission(deps, "scheduler.edit")] },
    async (request) => {
      enforceWriteAllowed(deps);
      const ctx = dbContext(deps);
      return createChair(ctx, { ...request.body, createdBy: actorUserId(request) });
    },
  );

  app.post<{ Body: { name: string; defaultMinutes: number; colorHex?: string } }>(
    "/scheduling/booking-reasons",
    { preHandler: [requireSession(deps), requirePermission(deps, "scheduler.edit")] },
    async (request) => {
      enforceWriteAllowed(deps);
      const ctx = dbContext(deps);
      return createBookingReason(ctx, { ...request.body, createdBy: actorUserId(request) });
    },
  );

  app.post<{
    Body: { staffId: string; weekday: number; startsLocal: string; endsLocal: string };
  }>(
    "/scheduling/staff-hours",
    { preHandler: [requireSession(deps), requirePermission(deps, "scheduler.edit")] },
    async (request) => {
      enforceWriteAllowed(deps);
      const ctx = dbContext(deps);
      return createStaffWorkingHours(ctx, { ...request.body, createdBy: actorUserId(request) });
    },
  );

  app.post<{
    Body: {
      startsAt: string;
      endsAt: string;
      reason: string;
      chairId?: string;
      clinicianId?: string;
    };
  }>(
    "/scheduling/blackouts",
    { preHandler: [requireSession(deps), requirePermission(deps, "scheduler.edit")] },
    async (request) => {
      enforceWriteAllowed(deps);
      const ctx = dbContext(deps);
      return createResourceBlackout(ctx, { ...request.body, createdBy: actorUserId(request) });
    },
  );

  app.get<{ Querystring: { startsAt: string; endsAt: string; chairId?: string; leadClinicianId?: string } }>(
    "/scheduling/availability",
    { preHandler: [requireSession(deps), requirePermission(deps, "scheduler.view")] },
    async (request) => {
      const ctx = dbContext(deps);
      return queryAvailability(ctx, request.query);
    },
  );

  app.get<{ Params: { viewType: SchedulerViewType }; Querystring: { date: string; chairId?: string; leadClinicianId?: string } }>(
    "/scheduling/views/:viewType",
    { preHandler: [requireSession(deps), requirePermission(deps, "scheduler.view")] },
    async (request) => {
      const ctx = dbContext(deps);
      return listSchedulerView(ctx, {
        view: request.params.viewType,
        anchorDate: request.query.date,
        chairId: request.query.chairId,
        leadClinicianId: request.query.leadClinicianId,
      });
    },
  );

  app.get("/scheduling/keyboard-shortcuts", { preHandler: requireSession(deps) }, async () => ({
    shortcuts: buildKeyboardShortcuts(),
  }));

  app.get<{ Querystring: { date?: string; status?: CareBookingState } }>(
    "/scheduling/bookings",
    { preHandler: [requireSession(deps), requirePermission(deps, "scheduler.view")] },
    async (request) => {
      const ctx = dbContext(deps);
      const bookings = await listBookings(ctx, request.query);
      return { bookings };
    },
  );

  app.post<{
    Body: {
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
    };
  }>(
    "/scheduling/bookings",
    { preHandler: [requireSession(deps), requirePermission(deps, "scheduler.create")] },
    async (request, reply) => {
      try {
        enforceWriteAllowed(deps);
        const ctx = dbContext(deps);
        return await createCareBooking(ctx, { ...request.body, createdBy: actorUserId(request) });
      } catch (error) {
        reply.code(409);
        return { error: error instanceof Error ? error.message : "Booking rejected" };
      }
    },
  );

  app.post<{ Params: { id: string }; Body: { reason?: string } }>(
    "/scheduling/bookings/:id/confirm",
    { preHandler: [requireSession(deps), requirePermission(deps, "scheduler.edit")] },
    async (request, reply) => {
      try {
        enforceWriteAllowed(deps);
        const ctx = dbContext(deps);
        return await transitionCareBooking(ctx, {
          bookingId: request.params.id,
          toStatus: "confirmed",
          reason: request.body.reason ?? "PATIENT_CORE",
          changedBy: actorUserId(request),
        });
      } catch (error) {
        reply.code(409);
        return { error: error instanceof Error ? error.message : "Confirm rejected" };
      }
    },
  );

  app.post<{
    Params: { id: string };
    Body: {
      startsAt: string;
      endsAt: string;
      leadClinicianId?: string;
      chairId?: string;
      resetConfirmation?: boolean;
    };
  }>(
    "/scheduling/bookings/:id/reschedule",
    { preHandler: [requireSession(deps), requirePermission(deps, "scheduler.edit")] },
    async (request, reply) => {
      try {
        enforceWriteAllowed(deps);
        const ctx = dbContext(deps);
        return await transitionCareBooking(ctx, {
          bookingId: request.params.id,
          toStatus: "scheduled",
          reason: "RESCHEDULED",
          changedBy: actorUserId(request),
          reschedule: request.body,
        });
      } catch (error) {
        reply.code(409);
        return { error: error instanceof Error ? error.message : "Reschedule rejected" };
      }
    },
  );

  app.post<{ Params: { id: string }; Body: { reason: string } }>(
    "/scheduling/bookings/:id/cancel",
    { preHandler: [requireSession(deps), requirePermission(deps, "scheduler.cancel")] },
    async (request, reply) => {
      try {
        enforceWriteAllowed(deps);
        const ctx = dbContext(deps);
        return await transitionCareBooking(ctx, {
          bookingId: request.params.id,
          toStatus: "cancelled",
          reason: request.body.reason,
          cancellationReason: request.body.reason,
          changedBy: actorUserId(request),
        });
      } catch (error) {
        reply.code(409);
        return { error: error instanceof Error ? error.message : "Cancel rejected" };
      }
    },
  );

  app.post<{ Params: { id: string }; Body: { reason: string } }>(
    "/scheduling/bookings/:id/no-show",
    { preHandler: [requireSession(deps), requirePermission(deps, "scheduler.edit")] },
    async (request, reply) => {
      try {
        enforceWriteAllowed(deps);
        const ctx = dbContext(deps);
        return await transitionCareBooking(ctx, {
          bookingId: request.params.id,
          toStatus: "no_show",
          reason: request.body.reason,
          noShowReason: request.body.reason,
          changedBy: actorUserId(request),
        });
      } catch (error) {
        reply.code(409);
        return { error: error instanceof Error ? error.message : "No-show rejected" };
      }
    },
  );

  app.get<{ Params: { id: string } }>(
    "/scheduling/bookings/:id/history",
    { preHandler: [requireSession(deps), requirePermission(deps, "scheduler.view")] },
    async (request) => {
      const ctx = dbContext(deps);
      const history = await getBookingHistory(ctx, request.params.id);
      return { history };
    },
  );

  app.get<{ Querystring: { date: string } }>(
    "/clinical-queue",
    { preHandler: [requireSession(deps), requirePermission(deps, "queue.view")] },
    async (request) => {
      const ctx = dbContext(deps);
      return listClinicalQueue(ctx, request.query.date);
    },
  );

  app.post<{
    Body: {
      patientId: string;
      leadClinicianId: string;
      reasonId: string;
      encounterDate: string;
      scheduledTime?: string;
      chairId?: string;
    };
  }>(
    "/clinical-queue/unscheduled",
    { preHandler: [requireSession(deps), requirePermission(deps, "queue.admit")] },
    async (request) => {
      enforceWriteAllowed(deps);
      const ctx = dbContext(deps);
      return createUnscheduledEncounter(ctx, { ...request.body, createdBy: actorUserId(request) });
    },
  );

  app.post<{ Params: { id: string }; Body: { encounterDate: string } }>(
    "/clinical-queue/bookings/:id/check-in",
    { preHandler: [requireSession(deps), requirePermission(deps, "queue.admit")] },
    async (request, reply) => {
      try {
        enforceWriteAllowed(deps);
        const ctx = dbContext(deps);
        return await checkInBooking(ctx, {
          bookingId: request.params.id,
          encounterDate: request.body.encounterDate,
          changedBy: actorUserId(request),
        });
      } catch (error) {
        reply.code(409);
        return { error: error instanceof Error ? error.message : "Check-in rejected" };
      }
    },
  );

  app.post<{ Params: { id: string }; Body: { reason?: string; allowDirectEngage?: boolean } }>(
    "/clinical-queue/encounters/:id/engage",
    { preHandler: [requireSession(deps), requirePermission(deps, "queue.engage")] },
    async (request, reply) => {
      try {
        enforceWriteAllowed(deps);
        const ctx = dbContext(deps);
        return await transitionEncounter(ctx, {
          encounterId: request.params.id,
          toStatus: "engaged",
          changedBy: actorUserId(request),
          reason: request.body.reason,
          allowDirectEngage: request.body.allowDirectEngage,
        });
      } catch (error) {
        reply.code(409);
        return { error: error instanceof Error ? error.message : "Engage rejected" };
      }
    },
  );

  app.post<{ Params: { id: string }; Body: { reason?: string } }>(
    "/clinical-queue/encounters/:id/release",
    { preHandler: [requireSession(deps), requirePermission(deps, "queue.release")] },
    async (request, reply) => {
      try {
        enforceWriteAllowed(deps);
        const ctx = dbContext(deps);
        return await transitionEncounter(ctx, {
          encounterId: request.params.id,
          toStatus: "checked_in",
          changedBy: actorUserId(request),
          reason: request.body.reason,
          allowCorrection: true,
        });
      } catch (error) {
        reply.code(409);
        return { error: error instanceof Error ? error.message : "Release rejected" };
      }
    },
  );

  app.post<{ Params: { id: string }; Body: { reason?: string } }>(
    "/clinical-queue/encounters/:id/checkout",
    { preHandler: [requireSession(deps), requirePermission(deps, "queue.release")] },
    async (request, reply) => {
      try {
        enforceWriteAllowed(deps);
        const ctx = dbContext(deps);
        return await transitionEncounter(ctx, {
          encounterId: request.params.id,
          toStatus: "checked_out",
          changedBy: actorUserId(request),
          reason: request.body.reason,
        });
      } catch (error) {
        reply.code(409);
        return { error: error instanceof Error ? error.message : "Checkout rejected" };
      }
    },
  );

  app.get<{ Querystring: { since?: string } }>(
    "/scheduling/live/events",
    { preHandler: [requireSession(deps), requirePermission(deps, "scheduler.view")] },
    async (request) => {
      const ctx = dbContext(deps);
      return { events: listLiveEventsSince(ctx.clinicId, request.query.since) };
    },
  );

  app.post(
    "/scheduling/reconciliation/check-collisions",
    { preHandler: [requireSession(deps), requirePermission(deps, "scheduler.view")] },
    async () => {
      const ctx = dbContext(deps);
      return reconcileCrossClinicCollisions(ctx);
    },
  );

  app.get<{ Querystring: { date: string } }>(
    "/dashboard/operational/daily",
    { preHandler: [requireSession(deps), requirePermission(deps, "scheduler.view")] },
    async (request) => {
      const ctx = dbContext(deps);
      return getOperationalDashboard(ctx, request.query.date);
    },
  );
}
