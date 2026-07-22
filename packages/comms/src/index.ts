export type ContinuityTaskStatus = "scheduled" | "due" | "snoozed" | "completed" | "cancelled";
export type CommunicationChannel = "sms" | "whatsapp" | "email";
export type CommunicationPurpose = "care" | "transactional" | "marketing" | "otp";
export type ConsentStatus = "opted_in" | "opted_out" | "unknown";
export type TemplateApprovalStatus = "draft" | "pending" | "approved" | "rejected" | "retired";
export type OutboundMessageStatus =
  | "draft"
  | "queued"
  | "submitted"
  | "sent"
  | "delivered"
  | "retry"
  | "failed"
  | "suppressed"
  | "cancelled";

export const WHATSAPP_AUTOMATIONS = [
  { routeType: "welcome_new_patient", name: "New-patient welcome", defaultPurpose: "transactional" as const },
  { routeType: "appointment_confirmation", name: "Appointment confirmation", defaultPurpose: "transactional" as const },
  { routeType: "appointment_reminder", name: "Appointment reminder", defaultPurpose: "transactional" as const },
  { routeType: "missed_appointment_follow_up", name: "Missed-appointment follow-up", defaultPurpose: "care" as const },
  { routeType: "treatment_follow_up", name: "Treatment follow-up", defaultPurpose: "care" as const },
  { routeType: "recall_reminder", name: "Recall reminder", defaultPurpose: "care" as const },
  { routeType: "payment_reminder", name: "Payment reminder", defaultPurpose: "transactional" as const },
  { routeType: "birthday_message", name: "Birthday message", defaultPurpose: "marketing" as const },
  { routeType: "review_request", name: "Review request", defaultPurpose: "marketing" as const },
  { routeType: "marketing_campaign", name: "Marketing campaign", defaultPurpose: "marketing" as const },
] as const;

export type AutomationRouteType = (typeof WHATSAPP_AUTOMATIONS)[number]["routeType"];

export const EXTENDED_PRINT_DOCUMENT_TYPES = [
  "care_plan",
  "medication_order",
  "consent",
  "fee_statement",
  "collection_receipt",
  "appointment_slip",
  "patient_label",
  "thermal_receipt",
  "cghs_form",
  "corporate_form",
] as const;

export type PrintDocumentType = (typeof EXTENDED_PRINT_DOCUMENT_TYPES)[number];

function addInterval(date: Date, value: number, unit: "day" | "week" | "month" | "year"): Date {
  const next = new Date(date);
  if (unit === "day") {
    next.setUTCDate(next.getUTCDate() + value);
  } else if (unit === "week") {
    next.setUTCDate(next.getUTCDate() + value * 7);
  } else if (unit === "month") {
    next.setUTCMonth(next.getUTCMonth() + value);
  } else {
    next.setUTCFullYear(next.getUTCFullYear() + value);
  }
  return next;
}

export function calculateContinuityDueDate(input: {
  sourceDate: string;
  intervalValue: number;
  intervalUnit: "day" | "week" | "month" | "year";
  dueLocalTime?: string;
}): { dueDate: string; dueLocalTime: string } {
  const due = addInterval(new Date(`${input.sourceDate}T00:00:00Z`), input.intervalValue, input.intervalUnit);
  return {
    dueDate: due.toISOString().slice(0, 10),
    dueLocalTime: input.dueLocalTime ?? "09:00:00",
  };
}

export function buildMessageDeduplicationKey(input: {
  clinicId: string;
  routeType: string;
  sourceType: string;
  sourceId: string;
  recipientHash: string;
}): string {
  return [input.clinicId, input.routeType, input.sourceType, input.sourceId, input.recipientHash].join(":");
}

export function validateContinuityTaskTransition(input: {
  fromStatus: ContinuityTaskStatus;
  toStatus: ContinuityTaskStatus;
}): { ok: true } | { ok: false; code: string; message: string } {
  const allowed: Record<ContinuityTaskStatus, readonly ContinuityTaskStatus[]> = {
    scheduled: ["due", "snoozed", "completed", "cancelled"],
    due: ["snoozed", "completed", "cancelled"],
    snoozed: ["due", "completed", "cancelled"],
    completed: [],
    cancelled: [],
  };
  if (!allowed[input.fromStatus].includes(input.toStatus)) {
    return {
      ok: false,
      code: "INVALID_CONTINUITY_TRANSITION",
      message: `Cannot move continuity task from ${input.fromStatus} to ${input.toStatus}`,
    };
  }
  return { ok: true };
}

export function validateMessageConsent(input: {
  channel: CommunicationChannel;
  purpose: CommunicationPurpose;
  consentStatus: ConsentStatus;
}): { ok: true } | { ok: false; code: string; message: string } {
  if (input.consentStatus === "opted_out") {
    return { ok: false, code: "CONSENT_OPTED_OUT", message: "Patient opted out of this channel" };
  }
  if (input.purpose === "marketing" && input.consentStatus !== "opted_in") {
    return {
      ok: false,
      code: "MARKETING_CONSENT_REQUIRED",
      message: "Marketing messages require explicit opt-in",
    };
  }
  if (input.consentStatus === "unknown" && input.purpose === "marketing") {
    return {
      ok: false,
      code: "MARKETING_CONSENT_UNKNOWN",
      message: "Marketing consent is unknown",
    };
  }
  return { ok: true };
}

export function validateTemplateApproval(input: {
  approvalStatus: TemplateApprovalStatus;
}): { ok: true } | { ok: false; code: string; message: string } {
  if (input.approvalStatus !== "approved") {
    return { ok: false, code: "TEMPLATE_NOT_APPROVED", message: "Message template is not approved" };
  }
  return { ok: true };
}

export function validateAutomationSend(input: {
  routeType: AutomationRouteType;
  automationEnabled: boolean;
  testMode: boolean;
  recipientAllowed: boolean;
}): { ok: true } | { ok: false; code: string; message: string } {
  if (!input.automationEnabled) {
    return { ok: false, code: "AUTOMATION_DISABLED", message: `Automation ${input.routeType} is disabled` };
  }
  if (input.testMode && !input.recipientAllowed) {
    return {
      ok: false,
      code: "TEST_RECIPIENT_BLOCKED",
      message: "Recipient is not on the development test allow-list",
    };
  }
  return { ok: true };
}

export function validateWebhookDedup(input: {
  providerEventId: string;
  seenProviderEventIds: readonly string[];
}): { ok: true } | { ok: false; code: string; message: string } {
  if (input.seenProviderEventIds.includes(input.providerEventId)) {
    return { ok: false, code: "DUPLICATE_PROVIDER_EVENT", message: "Provider event already processed" };
  }
  return { ok: true };
}

export function validatePrintDocumentType(
  documentType: string,
): { ok: true; documentType: PrintDocumentType } | { ok: false; code: string; message: string } {
  if (!EXTENDED_PRINT_DOCUMENT_TYPES.includes(documentType as PrintDocumentType)) {
    return { ok: false, code: "UNKNOWN_PRINT_TYPE", message: "Unsupported print document type" };
  }
  return { ok: true, documentType: documentType as PrintDocumentType };
}

export function buildReminderOffsets(reminderOffsetsMinutes: readonly number[]): readonly number[] {
  return [...reminderOffsetsMinutes].sort((a, b) => b - a);
}

export function hashRecipient(value: string): string {
  let hash = 0;
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}
