import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calculateCarePlanTotals,
  validateMedicationOrderSign,
  validateTreatmentBundleTier,
} from "@klickit/plans-prescriptions";
import { buildServer } from "../src/server.ts";
import { loadGatewayConfig } from "../src/config.ts";
import { createMockPool, TEST_BOOTSTRAP } from "./helpers.ts";

describe("milestone 6 plans and prescriptions", () => {
  it("accepts primary secondary tertiary bundle tiers", () => {
    assert.equal(validateTreatmentBundleTier("primary"), true);
    assert.equal(validateTreatmentBundleTier("secondary"), true);
    assert.equal(validateTreatmentBundleTier("tertiary"), true);
    assert.equal(validateTreatmentBundleTier("optional"), false);
  });

  it("derives care plan totals from service lines", () => {
    const totals = calculateCarePlanTotals([{ proposedFee: 2500, discount: 0, accepted: true }]);
    assert.equal(totals.estimatedTotal, 2500);
  });

  it("requires prescribing clinician for medication order signing", () => {
    const result = validateMedicationOrderSign({
      status: "saved",
      clinicianStaffId: "clinician-a",
      signingStaffId: "clinician-b",
      pinVerified: true,
    });
    assert.equal(result.ok, false);
  });

  it("requires care_plan.create permission for care plan route", async () => {
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
      url: "/plans/care-plans",
      headers: { "x-session-token": token },
      payload: { patientId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
    });
    assert.equal(response.statusCode, 403);
    await close();
  });
});
