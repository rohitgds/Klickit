import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { evaluateReadinessDrill } from "@klickit/resilience";
import { generateSyntheticDrKlickRows } from "@klickit/test-fixtures";
import { validateDrKlickStagingRow } from "@klickit/patients";
import { buildServer } from "../src/server.ts";
import { loadGatewayConfig } from "../src/config.ts";
import { createMockPool, TEST_BOOTSTRAP } from "./helpers.ts";

describe("milestone 9 rohini readiness", () => {
  it("generates large synthetic fixture rows", () => {
    const rows = generateSyntheticDrKlickRows(5000);
    assert.equal(rows.length, 5000);
  });

  it("validates extended DrKlick demographic fields", () => {
    const result = validateDrKlickStagingRow({
      sourceRowNumber: 1,
      firstName: "Rohini",
      mobile: "9876543210",
      email: "bad-email",
    });
    assert.equal(result.valid, false);
  });

  it("passes OFF-003 drill evaluation", () => {
    const result = evaluateReadinessDrill({
      drillCode: "OFF-003",
      writeBlocked: true,
      readsAllowed: true,
    });
    assert.equal(result.ok, true);
  });

  it("requires audit.view permission for backup run route", async () => {
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
      url: "/resilience/backup/run",
      headers: { "x-session-token": token },
      payload: { artifactPath: "./artifacts/dev-backup.sql" },
    });
    assert.equal(response.statusCode, 403);
    await close();
  });
});
