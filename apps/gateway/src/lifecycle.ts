import type { GatewayConfig } from "./config.js";

export type ServiceLifecycleState = "starting" | "ready" | "stopping" | "stopped";

export interface ServiceLifecycle {
  state: ServiceLifecycleState;
  startedAt: string | null;
  stoppedAt: string | null;
}

export function createServiceLifecycle(): ServiceLifecycle {
  return {
    state: "starting",
    startedAt: null,
    stoppedAt: null,
  };
}

export function markServiceReady(lifecycle: ServiceLifecycle) {
  lifecycle.state = "ready";
  lifecycle.startedAt = new Date().toISOString();
}

export function markServiceStopping(lifecycle: ServiceLifecycle) {
  lifecycle.state = "stopping";
}

export function markServiceStopped(lifecycle: ServiceLifecycle) {
  lifecycle.state = "stopped";
  lifecycle.stoppedAt = new Date().toISOString();
}

export function getServiceStatus(config: GatewayConfig, lifecycle: ServiceLifecycle) {
  return {
    service: config.serviceName,
    clinicCode: config.clinicCode,
    lifecycle: lifecycle.state,
    startedAt: lifecycle.startedAt,
    stoppedAt: lifecycle.stoppedAt,
  };
}
