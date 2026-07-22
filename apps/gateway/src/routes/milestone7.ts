import type { FastifyInstance } from "fastify";
import type { GatewayDependencies } from "./index.js";
import { evaluateOfflineWritePolicy } from "../sync/engine.js";
import { requirePermission, requireSession } from "../security/middleware.js";
import {
  addFeeStatementLine,
  createCollectionReceipt,
  createCollectionRefund,
  createFeeAllocation,
  createFeeStatementDraft,
  getFeeStatementDetail,
  getPatientAging,
  getPatientBalance,
  issueFeeStatement,
  listFinanceMasters,
  postJournalEntry,
  reconcileFeeStatement,
  verifyOpeningBalance,
} from "../finance/repository.js";

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

export async function registerMilestone7Routes(app: FastifyInstance, deps: GatewayDependencies) {
  app.get(
    "/finance/masters",
    { preHandler: [requireSession(deps), requirePermission(deps, "fee_statement.view")] },
    async () => listFinanceMasters(dbContext(deps)),
  );

  app.post<{
    Body: {
      patientId: string;
      careEncounterId?: string;
      statementReference: string;
      statementDate?: string;
      dueDate?: string;
      feeScheduleId: string;
    };
  }>(
    "/finance/fee-statements",
    { preHandler: [requireSession(deps), requirePermission(deps, "fee_statement.create")] },
    async (request, reply) => {
      try {
        enforceWriteAllowed(deps);
        return await createFeeStatementDraft(dbContext(deps), {
          ...request.body,
          actorUserId: actorUserId(request),
        });
      } catch (error) {
        reply.code(409);
        return { error: error instanceof Error ? error.message : "Fee statement rejected" };
      }
    },
  );

  app.get<{ Params: { id: string } }>(
    "/finance/fee-statements/:id",
    { preHandler: [requireSession(deps), requirePermission(deps, "fee_statement.view")] },
    async (request, reply) => {
      try {
        return await getFeeStatementDetail(dbContext(deps), request.params.id);
      } catch (error) {
        reply.code(404);
        return { error: error instanceof Error ? error.message : "Fee statement not found" };
      }
    },
  );

  app.post<{
    Params: { id: string };
    Body: {
      serviceId: string;
      leadClinicianId: string;
      quantity: number;
      unitFee: number;
      lineDiscount?: number;
      description?: string;
      toothCode?: string;
      sequenceNo: number;
      maxDiscountPercent?: number;
    };
  }>(
    "/finance/fee-statements/:id/lines",
    { preHandler: [requireSession(deps), requirePermission(deps, "fee_statement.edit_draft")] },
    async (request, reply) => {
      try {
        enforceWriteAllowed(deps);
        return await addFeeStatementLine(dbContext(deps), {
          statementId: request.params.id,
          ...request.body,
          actorUserId: actorUserId(request),
        });
      } catch (error) {
        reply.code(409);
        return { error: error instanceof Error ? error.message : "Line rejected" };
      }
    },
  );

  app.post<{ Params: { id: string } }>(
    "/finance/fee-statements/:id/issue",
    { preHandler: [requireSession(deps), requirePermission(deps, "fee_statement.issue")] },
    async (request, reply) => {
      try {
        enforceWriteAllowed(deps);
        return await issueFeeStatement(dbContext(deps), {
          statementId: request.params.id,
          actorUserId: actorUserId(request),
        });
      } catch (error) {
        reply.code(409);
        return { error: error instanceof Error ? error.message : "Issue rejected" };
      }
    },
  );

  app.post<{
    Body: {
      patientId: string;
      careEncounterId?: string;
      collectionReference: string;
      collectionDate?: string;
      leadClinicianId: string;
      collectionOperatorId: string;
      notes?: string;
      tenders: Array<{ collectionMethodId: string; amount: number; referenceNo?: string }>;
    };
  }>(
    "/finance/collections",
    { preHandler: [requireSession(deps), requirePermission(deps, "collection.create")] },
    async (request, reply) => {
      try {
        enforceWriteAllowed(deps);
        return await createCollectionReceipt(dbContext(deps), {
          ...request.body,
          actorUserId: actorUserId(request),
        });
      } catch (error) {
        reply.code(409);
        return { error: error instanceof Error ? error.message : "Collection rejected" };
      }
    },
  );

  app.post<{
    Body: {
      collectionReceiptId: string;
      feeStatementId: string;
      allocationDate?: string;
      amount: number;
      lineSplits: Array<{ feeStatementLineId: string; amount: number }>;
      tenderSplits: Array<{ collectionTenderId: string; amount: number }>;
      clinicianSplits?: Array<{ feeStatementLineId: string; collectionTenderId: string; amount: number }>;
    };
  }>(
    "/finance/allocations",
    { preHandler: [requireSession(deps), requirePermission(deps, "fee_allocation.create")] },
    async (request, reply) => {
      try {
        enforceWriteAllowed(deps);
        return await createFeeAllocation(dbContext(deps), {
          ...request.body,
          actorUserId: actorUserId(request),
        });
      } catch (error) {
        reply.code(409);
        return { error: error instanceof Error ? error.message : "Allocation rejected" };
      }
    },
  );

  app.post<{
    Body: {
      collectionReceiptId: string;
      refundNo: string;
      refundDate?: string;
      amount: number;
      originalTenderId: string;
      collectionMethodId: string;
      processedBy: string;
      approvedBy: string;
    };
  }>(
    "/finance/refunds",
    { preHandler: [requireSession(deps), requirePermission(deps, "collection.refund")] },
    async (request, reply) => {
      try {
        enforceWriteAllowed(deps);
        return await createCollectionRefund(dbContext(deps), {
          ...request.body,
          actorUserId: actorUserId(request),
        });
      } catch (error) {
        reply.code(409);
        return { error: error instanceof Error ? error.message : "Refund rejected" };
      }
    },
  );

  app.post<{
    Body: {
      entryDate?: string;
      sourceType: string;
      sourceId: string;
      lines: Array<{ accountId: string; debit?: number; credit?: number; memo?: string }>;
    };
  }>(
    "/finance/journal-entries",
    { preHandler: [requireSession(deps), requirePermission(deps, "fee_allocation.create")] },
    async (request, reply) => {
      try {
        enforceWriteAllowed(deps);
        return await postJournalEntry(dbContext(deps), {
          ...request.body,
          actorUserId: actorUserId(request),
        });
      } catch (error) {
        reply.code(409);
        return { error: error instanceof Error ? error.message : "Journal entry rejected" };
      }
    },
  );

  app.get<{ Params: { patientId: string } }>(
    "/finance/patients/:patientId/balance",
    { preHandler: [requireSession(deps), requirePermission(deps, "fee_statement.view")] },
    async (request) => getPatientBalance(dbContext(deps), request.params.patientId),
  );

  app.get<{ Params: { patientId: string }; Querystring: { asOf?: string } }>(
    "/finance/patients/:patientId/aging",
    { preHandler: [requireSession(deps), requirePermission(deps, "analytics.financial.view")] },
    async (request) => getPatientAging(dbContext(deps), request.params.patientId, request.query.asOf),
  );

  app.post<{
    Body: { patientId: string; balanceDate?: string; receivableAmount: number; advanceAmount: number };
  }>(
    "/finance/opening-balances",
    { preHandler: [requireSession(deps), requirePermission(deps, "fee_statement.create")] },
    async (request, reply) => {
      try {
        enforceWriteAllowed(deps);
        return await verifyOpeningBalance(dbContext(deps), {
          ...request.body,
          actorUserId: actorUserId(request),
        });
      } catch (error) {
        reply.code(409);
        return { error: error instanceof Error ? error.message : "Opening balance rejected" };
      }
    },
  );

  app.get<{ Params: { id: string } }>(
    "/finance/fee-statements/:id/reconcile",
    { preHandler: [requireSession(deps), requirePermission(deps, "analytics.financial.view")] },
    async (request, reply) => {
      try {
        return await reconcileFeeStatement(dbContext(deps), request.params.id);
      } catch (error) {
        reply.code(409);
        return { error: error instanceof Error ? error.message : "Reconciliation failed" };
      }
    },
  );
}
