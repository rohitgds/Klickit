import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calculateFeeStatementLine,
  validateCollectionReceiptTenders,
  validateDiscountCeiling,
  validateFeeAllocation,
} from "@klickit/finance";
import { buildServer } from "../src/server.ts";
import { loadGatewayConfig } from "../src/config.ts";
import { createMockPool, TEST_BOOTSTRAP } from "./helpers.ts";

describe("milestone 7 finance", () => {
  it("calculates GST on fee statement lines", () => {
    const line = calculateFeeStatementLine({
      quantity: 1,
      unitFee: 1000,
      lineDiscount: 0,
      cgstRate: 9,
      sgstRate: 9,
    });
    assert.equal(line.lineTotal, 1180);
  });

  it("enforces discount ceilings", () => {
    const result = validateDiscountCeiling({ lineGross: 1000, requestedDiscount: 150, maxDiscountPercent: 10 });
    assert.equal(result.ok, false);
  });

  it("requires balanced allocation splits", () => {
    const result = validateFeeAllocation({
      allocationAmount: 500,
      availableOnReceipt: 800,
      outstandingOnStatement: 1000,
      lineSplitTotal: 400,
      tenderSplitTotal: 500,
    });
    assert.equal(result.ok, false);
  });

  it("accepts matching split tender totals", () => {
    const result = validateCollectionReceiptTenders({
      grossCollected: 1000,
      tenders: [{ amount: 600 }, { amount: 400 }],
    });
    assert.equal(result.ok, true);
  });

  it("requires fee_statement.create permission for fee statement route", async () => {
    const config = loadGatewayConfig({ APP_ENV: "local" });
    const { app, close } = await buildServer({
      config,
      skipDatabase: true,
      pool: createMockPool(async (sql) => {
        if (sql.includes("FROM dentos_data.users u")) {
          return {
            rows: [
              {
                user_id: "55555555-5555-4555-8555-555555555555",
                organization_id: TEST_BOOTSTRAP.clinic.organizationId,
                authz_version: "1",
                membership_id: "66666666-6666-4666-8666-666666666666",
              },
            ],
            rowCount: 1,
          };
        }
        if (sql.includes("INSERT INTO dentos_data.user_sessions")) {
          return { rows: [], rowCount: 1 };
        }
        if (sql.includes("FROM dentos_data.user_sessions s")) {
          return {
            rows: [
              {
                session_id: "99999999-9999-4999-8999-999999999999",
                user_id: "55555555-5555-4555-8555-555555555555",
                organization_id: TEST_BOOTSTRAP.clinic.organizationId,
                clinic_id: TEST_BOOTSTRAP.clinic.id,
                membership_id: "66666666-6666-4666-8666-666666666666",
                authz_version: "1",
              },
            ],
            rowCount: 1,
          };
        }
        if (sql.includes("membership_roles") || sql.includes("role_permissions")) {
          return { rows: [], rowCount: 0 };
        }
        if (sql.includes("authorization.denied")) {
          return { rows: [], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }),
      bootstrap: TEST_BOOTSTRAP,
    });

    const session = await app.inject({
      method: "POST",
      url: "/auth/dev/session",
      payload: { loginName: "dev.admin" },
    });
    const token = session.json().token as string;
    const response = await app.inject({
      method: "POST",
      url: "/finance/fee-statements",
      headers: { "x-session-token": token },
      payload: {
        patientId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        statementReference: "FS-DEV-001",
        feeScheduleId: "88888884-8888-4888-8888-888888888884",
      },
    });
    assert.equal(response.statusCode, 403);
    await close();
  });
});
