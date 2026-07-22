import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { EmptyState, ErrorState, LoadingState, PermissionGuard } from "@klickit/ui";
import { useAuth } from "../auth/AuthContext.js";
import {
  completeContinuityTask,
  fetchDueContinuityTasks,
  fetchMessageTemplates,
  fetchPatientMessages,
  queueOutboundMessage,
} from "../api/comms.js";
import { continuityTaskStatusLabel, continuityTaskDueDate, continuityTaskPatientId, continuityTaskType, filterDueTasksByPatient } from "../config/comms.js";
import { formatDateParamInTimezone } from "../config/dashboard.js";

export function CommsCenterPage() {
  const auth = useAuth();
  const timezone = auth.clinicConfig?.clinic?.timezone ?? "Asia/Kolkata";
  const canView = auth.hasPermission("message.view");
  const canSend = auth.hasPermission("message.send");
  const canClinical = auth.hasPermission("clinical.view");

  const [asOf, setAsOf] = useState(() => formatDateParamInTimezone(new Date(), timezone));
  const [patientFilter, setPatientFilter] = useState("");
  const [messagePatientId, setMessagePatientId] = useState("");
  const [recipient, setRecipient] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const tasksQuery = useQuery({
    queryKey: ["continuity", "due", asOf, auth.token],
    queryFn: () => fetchDueContinuityTasks(auth.token!, asOf),
    enabled: Boolean(auth.token && canClinical),
  });

  const templatesQuery = useQuery({
    queryKey: ["messaging", "templates", auth.token],
    queryFn: () => fetchMessageTemplates(auth.token!),
    enabled: Boolean(auth.token && canView),
  });

  const messagesQuery = useQuery({
    queryKey: ["messaging", "patient", messagePatientId, auth.token],
    queryFn: () => fetchPatientMessages(auth.token!, messagePatientId),
    enabled: Boolean(auth.token && canView && messagePatientId),
  });

  const filteredTasks = useMemo(
    () => filterDueTasksByPatient(tasksQuery.data?.tasks ?? [], patientFilter),
    [tasksQuery.data?.tasks, patientFilter],
  );

  if (!canView && !canClinical) {
    return (
      <PermissionGuard allowed={false} permissionCode="message.view">
        <span />
      </PermissionGuard>
    );
  }

  return (
    <div className="ki-dashboard">
      {actionError ? <ErrorState title="Comms action failed" message={actionError} onRetry={() => setActionError(null)} /> : null}

      <section className="ki-dashboard-section">
        <h2 className="ki-dashboard-section-title">Due continuity tasks</h2>
        <div className="ki-scheduler-filters">
          <label className="ki-scheduler-filter">
            <span className="ki-dashboard-date-label">As of</span>
            <input className="ki-input" type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
          </label>
          <label className="ki-scheduler-filter">
            <span className="ki-dashboard-date-label">Patient filter</span>
            <input className="ki-input" value={patientFilter} onChange={(e) => setPatientFilter(e.target.value)} />
          </label>
        </div>
        {tasksQuery.isLoading ? <LoadingState label="Loading tasks…" /> : null}
        {tasksQuery.isSuccess && filteredTasks.length === 0 ? (
          <EmptyState title="No due tasks" description="Continuity recalls and follow-ups will appear here." />
        ) : null}
        {filteredTasks.length > 0 ? (
          <table className="ki-dashboard-table ki-patient-table">
            <thead>
              <tr>
                <th scope="col">Patient</th>
                <th scope="col">Type</th>
                <th scope="col">Due</th>
                <th scope="col">Status</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((task) => (
                <tr key={task.id}>
                  <td>{continuityTaskPatientId(task).slice(0, 8)}…</td>
                  <td>{continuityTaskType(task)}</td>
                  <td>{continuityTaskDueDate(task)}</td>
                  <td>{continuityTaskStatusLabel(task.status)}</td>
                  <td>
                    {canClinical ? (
                      <button
                        type="button"
                        className="ki-btn ki-btn-sm"
                        disabled={busy}
                        onClick={() => {
                          if (!auth.token) return;
                          setBusy(true);
                          void completeContinuityTask(auth.token, task.id)
                            .then(() => tasksQuery.refetch())
                            .catch((error: unknown) =>
                              setActionError(error instanceof Error ? error.message : "Complete failed"),
                            )
                            .finally(() => setBusy(false));
                        }}
                      >
                        Complete
                      </button>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>

      <section className="ki-dashboard-section">
        <h2 className="ki-dashboard-section-title">Message templates</h2>
        {templatesQuery.isLoading ? <LoadingState label="Loading templates…" /> : null}
        {templatesQuery.isSuccess && (templatesQuery.data.templates ?? []).length === 0 ? (
          <EmptyState title="No templates" description="Approved message templates will list here." />
        ) : null}
        {templatesQuery.isSuccess && (templatesQuery.data.templates ?? []).length > 0 ? (
          <table className="ki-dashboard-table ki-patient-table">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Channel</th>
                <th scope="col">Purpose</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {templatesQuery.data.templates.map((template) => (
                <tr key={template.id}>
                  <td>{template.name}</td>
                  <td>{template.channel}</td>
                  <td>{template.purpose}</td>
                  <td>{template.status ?? (template as { approval_status?: string }).approval_status ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>

      <section className="ki-dashboard-section">
        <h2 className="ki-dashboard-section-title">Patient messages</h2>
        <form
          className="ki-scheduler-filters"
          onSubmit={(event) => {
            event.preventDefault();
            setMessagePatientId(patientFilter.trim() || messagePatientId);
          }}
        >
          <label className="ki-scheduler-filter">
            <span className="ki-dashboard-date-label">Patient ID</span>
            <input
              className="ki-input"
              value={messagePatientId}
              onChange={(e) => setMessagePatientId(e.target.value)}
            />
          </label>
          <button type="submit" className="ki-btn">
            Load messages
          </button>
        </form>
        {messagesQuery.isLoading ? <LoadingState label="Loading messages…" /> : null}
        {messagesQuery.isSuccess && (messagesQuery.data.messages ?? []).length > 0 ? (
          <table className="ki-dashboard-table ki-patient-table">
            <thead>
              <tr>
                <th scope="col">Channel</th>
                <th scope="col">Status</th>
                <th scope="col">Body</th>
              </tr>
            </thead>
            <tbody>
              {messagesQuery.data.messages.map((message) => (
                <tr key={message.id}>
                  <td>{message.channel}</td>
                  <td>{message.status}</td>
                  <td>{message.renderedBody ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
        {canSend ? (
          <form
            className="ki-form-stack"
            onSubmit={(event) => {
              event.preventDefault();
              if (!auth.token || !recipient.trim() || !messageBody.trim()) return;
              setBusy(true);
              setActionError(null);
              void queueOutboundMessage(auth.token, {
                patientId: messagePatientId || undefined,
                channel: "sms",
                purpose: "care",
                routeType: "manual",
                recipient: recipient.trim(),
                renderedBody: messageBody.trim(),
                sourceType: "comms_center",
                sourceId: messagePatientId || "manual",
                testMode: true,
                testRecipientAllowed: true,
              })
                .then(() => {
                  setMessageBody("");
                  if (messagePatientId) return messagesQuery.refetch();
                })
                .catch((error: unknown) =>
                  setActionError(error instanceof Error ? error.message : "Send failed"),
                )
                .finally(() => setBusy(false));
            }}
          >
            <h3 className="ki-dashboard-section-title">Queue test outbound message</h3>
            <label className="ki-form-field">
              <span className="ki-dashboard-date-label">Recipient</span>
              <input className="ki-input" value={recipient} onChange={(e) => setRecipient(e.target.value)} />
            </label>
            <label className="ki-form-field">
              <span className="ki-dashboard-date-label">Message body</span>
              <textarea className="ki-input" rows={3} value={messageBody} onChange={(e) => setMessageBody(e.target.value)} />
            </label>
            <button type="submit" className="ki-btn ki-btn-primary" disabled={busy}>
              Queue message (test mode)
            </button>
          </form>
        ) : null}
      </section>
    </div>
  );
}
