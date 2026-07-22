import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildKeyboardShortcuts, validateBookingTransition } from "@klickit/scheduling";
import { buildServer } from "../src/server.ts";
import { loadGatewayConfig } from "../src/config.ts";
import { createMockPool, TEST_BOOTSTRAP } from "./helpers.ts";
import { listLiveEventsSince, publishLiveEvent, resetLiveEventsForTests } from "../src/scheduling/live-events.ts";

describe("milestone 4 scheduler and queue", () => {
  it("exposes scheduler keyboard shortcuts", async () => {
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
                user_authz_version: "1",
                user_status: "active",
                membership_active: true,
              },
            ],
            rowCount: 1,
          };
        }
        if (sql.includes("membership_roles") || sql.includes("role_permissions")) {
          return { rows: [{ code: "scheduler.view" }], rowCount: 1 };
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
      url: "/scheduling/keyboard-shortcuts",
      headers: { "x-session-token": token },
    });
    assert.equal(response.statusCode, 200);
    assert.ok(response.json().shortcuts.length >= 4);
    await close();
  });

  it("publishes LAN live refresh events", () => {
    resetLiveEventsForTests();
    publishLiveEvent({
      clinicId: TEST_BOOTSTRAP.clinic.id,
      type: "care_booking.created",
      aggregateType: "care_booking",
      aggregateId: "booking-1",
    });
    const events = listLiveEventsSince(TEST_BOOTSTRAP.clinic.id);
    assert.equal(events.length, 1);
    assert.equal(events[0]?.type, "care_booking.created");
  });

  it("keeps booking transition matrix in scheduling package", () => {
    assert.deepEqual(
      validateBookingTransition({ fromStatus: "scheduled", toStatus: "confirmed", reason: "PATIENT_CORE" }),
      { ok: true },
    );
    assert.ok(buildKeyboardShortcuts().some((item) => item.action === "create_booking"));
  });
});
