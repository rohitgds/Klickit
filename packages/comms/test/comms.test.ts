import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  WHATSAPP_AUTOMATIONS,
  buildMessageDeduplicationKey,
  calculateContinuityDueDate,
  hashRecipient,
  validateAutomationSend,
  validateContinuityTaskTransition,
  validateMessageConsent,
  validatePrintDocumentType,
  validateWebhookDedup,
} from "../src/index.js";

describe("@klickit/comms", () => {
  it("defines ten WhatsApp automations", () => {
    assert.equal(WHATSAPP_AUTOMATIONS.length, 10);
  });

  it("calculates continuity due dates from interval rules", () => {
    const due = calculateContinuityDueDate({
      sourceDate: "2026-07-01",
      intervalValue: 6,
      intervalUnit: "month",
    });
    assert.equal(due.dueDate, "2027-01-01");
    assert.equal(due.dueLocalTime, "09:00:00");
  });

  it("builds stable deduplication keys", () => {
    const key = buildMessageDeduplicationKey({
      clinicId: "clinic-a",
      routeType: "welcome_new_patient",
      sourceType: "patient",
      sourceId: "patient-a",
      recipientHash: hashRecipient("+919999999999"),
    });
    assert.match(key, /^clinic-a:welcome_new_patient:patient:patient-a:/);
  });

  it("blocks invalid continuity transitions", () => {
    const result = validateContinuityTaskTransition({ fromStatus: "completed", toStatus: "due" });
    assert.equal(result.ok, false);
  });

  it("requires marketing opt-in", () => {
    const result = validateMessageConsent({
      channel: "whatsapp",
      purpose: "marketing",
      consentStatus: "unknown",
    });
    assert.equal(result.ok, false);
  });

  it("blocks test-mode sends outside allow-list", () => {
    const result = validateAutomationSend({
      routeType: "welcome_new_patient",
      automationEnabled: true,
      testMode: true,
      recipientAllowed: false,
    });
    assert.equal(result.ok, false);
  });

  it("deduplicates provider webhook events", () => {
    const result = validateWebhookDedup({
      providerEventId: "evt-1",
      seenProviderEventIds: ["evt-1"],
    });
    assert.equal(result.ok, false);
  });

  it("accepts extended print document types", () => {
    const result = validatePrintDocumentType("thermal_receipt");
    assert.equal(result.ok, true);
  });
});
