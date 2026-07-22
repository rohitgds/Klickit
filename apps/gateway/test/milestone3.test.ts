import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildServer } from "../src/server.ts";
import { loadGatewayConfig } from "../src/config.ts";
import { createMockPool, TEST_BOOTSTRAP } from "./helpers.ts";

describe("milestone 3 access and patients", () => {
  it("bootstraps a local development session", async () => {
    const config = loadGatewayConfig({ APP_ENV: "local" });
    const { app, close } = await buildServer({
      config,
      skipDatabase: true,
      pool: createMockPool(async (sql) => {
        if (sql.includes("FROM dentos_data.users u")) {
          return {
            rows: [
              {
                user_id: TEST_BOOTSTRAP.gateway.id.replace("4444", "5555"),
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
        if (sql.includes("membership_roles") || sql.includes("membership_permission_overrides") || sql.includes("role_permissions")) {
          return { rows: [{ code: "patient.view" }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }),
      bootstrap: TEST_BOOTSTRAP,
    });

    const response = await app.inject({
      method: "POST",
      url: "/auth/dev/session",
      payload: { loginName: "dev.admin" },
    });
    assert.equal(response.statusCode, 200);
    assert.ok(response.json().token);
    await close();
  });

  it("denies dev session bootstrap outside local APP_ENV", async () => {
    const config = loadGatewayConfig({ APP_ENV: "production" });
    const { app, close } = await buildServer({
      config,
      skipDatabase: true,
      pool: createMockPool(),
      bootstrap: TEST_BOOTSTRAP,
    });
    const response = await app.inject({ method: "POST", url: "/auth/dev/session", payload: {} });
    assert.equal(response.statusCode, 403);
    await close();
  });
});
