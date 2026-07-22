export function buildDueTasksPath(asOf?: string): string {
  return asOf ? `/continuity/tasks/due?asOf=${encodeURIComponent(asOf)}` : "/continuity/tasks/due";
}

export function buildMessageTemplatesPath(channel?: string): string {
  return channel ? `/messaging/templates?channel=${encodeURIComponent(channel)}` : "/messaging/templates";
}

export function buildPatientMessagesPath(patientId: string): string {
  return `/messaging/patients/${encodeURIComponent(patientId)}/messages`;
}

export function continuityTaskStatusLabel(status: string): string {
  return status.replaceAll("_", " ");
}

export function continuityTaskPatientId(task: { patientId?: string; patient_id?: string }): string {
  return task.patientId ?? task.patient_id ?? "";
}

export function continuityTaskDueDate(task: { dueDate?: string; due_date?: string }): string {
  return task.dueDate ?? task.due_date ?? "—";
}

export function continuityTaskType(task: { taskType?: string; task_type?: string }): string {
  return task.taskType ?? task.task_type ?? "—";
}

export function filterDueTasksByPatient<T extends { patientId?: string; patient_id?: string }>(
  tasks: T[],
  query: string,
): T[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return tasks;
  }
  return tasks.filter((task) => continuityTaskPatientId(task).toLowerCase().includes(trimmed));
}
