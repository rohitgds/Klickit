import { buildDueTasksPath, buildMessageTemplatesPath, buildPatientMessagesPath } from "../config/comms.js";
import { apiFetch } from "./client.js";

export interface ContinuityTask {
  id: string;
  patientId: string;
  taskType: string;
  status: string;
  dueDate: string;
  reasonCode?: string;
}

export interface MessageTemplate {
  id: string;
  name: string;
  channel: string;
  purpose: string;
  status: string;
}

export interface OutboundMessage {
  id: string;
  channel: string;
  status: string;
  renderedBody?: string;
  createdAt?: string;
}

export async function fetchDueContinuityTasks(token: string, asOf?: string): Promise<{ tasks: ContinuityTask[] }> {
  return apiFetch<{ tasks: ContinuityTask[] }>(buildDueTasksPath(asOf), {}, token);
}

export async function completeContinuityTask(token: string, taskId: string): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(
    `/continuity/tasks/${encodeURIComponent(taskId)}/complete`,
    { method: "POST" },
    token,
  );
}

export async function fetchMessageTemplates(token: string, channel?: string): Promise<{ templates: MessageTemplate[] }> {
  return apiFetch<{ templates: MessageTemplate[] }>(buildMessageTemplatesPath(channel), {}, token);
}

export async function fetchPatientMessages(
  token: string,
  patientId: string,
): Promise<{ messages: OutboundMessage[] }> {
  return apiFetch<{ messages: OutboundMessage[] }>(buildPatientMessagesPath(patientId), {}, token);
}

export async function queueOutboundMessage(
  token: string,
  body: {
    patientId?: string;
    channel: "sms" | "whatsapp" | "email";
    purpose: "care" | "transactional";
    routeType: string;
    recipient: string;
    renderedBody: string;
    sourceType: string;
    sourceId: string;
    testMode?: boolean;
    testRecipientAllowed?: boolean;
  },
): Promise<{ id: string }> {
  return apiFetch<{ id: string }>("/messaging/outbound", { method: "POST", body: JSON.stringify(body) }, token);
}
