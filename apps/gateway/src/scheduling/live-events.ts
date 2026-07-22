export interface LiveEvent {
  id: string;
  occurredAt: string;
  clinicId: string;
  type: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
}

const events: LiveEvent[] = [];
const MAX_EVENTS = 500;

export function publishLiveEvent(input: {
  clinicId: string;
  type: string;
  aggregateType: string;
  aggregateId: string;
  payload?: Record<string, unknown>;
}): LiveEvent {
  const event: LiveEvent = {
    id: crypto.randomUUID(),
    occurredAt: new Date().toISOString(),
    clinicId: input.clinicId,
    type: input.type,
    aggregateType: input.aggregateType,
    aggregateId: input.aggregateId,
    payload: input.payload ?? {},
  };
  events.push(event);
  if (events.length > MAX_EVENTS) {
    events.shift();
  }
  return event;
}

export function listLiveEventsSince(clinicId: string, since?: string): LiveEvent[] {
  return events.filter((event) => event.clinicId === clinicId && (!since || event.occurredAt > since));
}

export function resetLiveEventsForTests(): void {
  events.length = 0;
}
