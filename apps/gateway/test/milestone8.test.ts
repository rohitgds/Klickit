import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { WHATSAPP_AUTOMATIONS, validateMessageConsent, validatePrintDocumentType } from "@klickit/comms";
import { buildServer } from "../src/server.ts";
import { loadGatewayConfig } from "../src/config.ts";
import { createMockPool, TEST_BOOTSTRAP } from "./helpers.ts";

describe("milestone 8 communications and printing", () => {
  it("lists ten WhatsApp automations", () => {
    assert.equal(WHATSAPP_AUTOMATIONS.length, 10);
  });

  it("requires marketing opt-in", () => {
    const result = validateMessageConsent({
      channel: "whatsapp",
      purpose: "marketing",
      consentStatus: "unknown",
    });
    assert.equal(result.ok, false);
  });

  it("accepts thermal receipt print type", () => {
    const result = validatePrintDocumentType("thermal_receipt");
    assert.equal(result.ok, true);
  });

  it("requires message.send permission for outbound route", async () => {
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
      url: "/messaging/outbound",
      headers: { "x-session-token": token },
      payload: {
        channel: "whatsapp",
        purpose: "transactional",
        routeType: "welcome_new_patient",
        recipient: "+919999999999",
        renderedBody: "Welcome",
        sourceType: "patient",
        sourceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      },
    });
    assert.equal(response.statusCode, 403);
    await close();
  });
});
