import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { evaluateCrossClinicClinicalAccess, isValidFdiToothCode } from "@klickit/clinical";
import { buildServer } from "../src/server.ts";
import { loadGatewayConfig } from "../src/config.ts";
import { createMockPool, TEST_BOOTSTRAP } from "./helpers.ts";

describe("milestone 5 clinical and files", () => {
  it("denies cross-clinic clinical edit in access helper", () => {
    const result = evaluateCrossClinicClinicalAccess({
      homeClinicId: "11111111-1111-4111-8111-111111111111",
      encounterClinicId: "22222222-2222-4222-8222-222222222222",
      permissionCode: "clinical.edit",
      hasCrossClinicGrant: true,
    });
    assert.equal(result.allowed, false);
    assert.equal(result.mode, "denied");
  });

  it("validates FDI tooth codes for odontogram entry", () => {
    assert.equal(isValidFdiToothCode("36"), true);
    assert.equal(isValidFdiToothCode("00"), false);
  });

  it("requires clinical.view permission for encounter workspace", async () => {
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
      method: "GET",
      url: "/clinical/encounters/99999999-9999-4999-8999-999999999999/workspace",
      headers: { "x-session-token": token },
    });
    assert.equal(response.statusCode, 403);
    await close();
  });
});
