export type BackupRunStatus = "started" | "completed" | "failed";
export type RestoreDrillStatus = "started" | "passed" | "failed";
export type ReadinessDrillCode = "OFF-003" | "SYNC-001" | "BCP-001" | "REBUILD-001" | "SEC-001";

export function buildBackupChecksum(input: { clinicCode: string; startedAt: string; artifactPath: string }): string {
  let hash = 0;
  const value = `${input.clinicCode}:${input.startedAt}:${input.artifactPath}`;
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function validateRestoreDrill(input: {
  backupChecksum: string;
  restoredChecksum: string;
}): { ok: true } | { ok: false; code: string; message: string } {
  if (input.backupChecksum !== input.restoredChecksum) {
    return { ok: false, code: "CHECKSUM_MISMATCH", message: "Restore checksum does not match backup manifest" };
  }
  return { ok: true };
}

export function evaluateReadinessDrill(input: {
  drillCode: ReadinessDrillCode;
  writeBlocked: boolean;
  readsAllowed: boolean;
  duplicateEventsIgnored?: number;
}): { ok: true; status: "passed" } | { ok: false; status: "failed"; message: string } {
  if (input.drillCode === "OFF-003") {
    if (!input.writeBlocked || !input.readsAllowed) {
      return { ok: false, status: "failed", message: "72-hour drill requires blocked writes and allowed reads" };
    }
  }
  if (input.drillCode === "SYNC-001" && (input.duplicateEventsIgnored ?? 0) < 1) {
    return { ok: false, status: "failed", message: "Sync interruption drill requires duplicate event suppression" };
  }
  return { ok: true, status: "passed" };
}

export function buildMigrationAcceptanceReport(input: {
  sourceCount: number;
  importedCount: number;
  rejectedCount: number;
  duplicateCount: number;
}): {
  balanced: boolean;
  variance: number;
  report: Record<string, number>;
} {
  const variance = input.sourceCount - (input.importedCount + input.rejectedCount + input.duplicateCount);
  return {
    balanced: variance === 0,
    variance,
    report: {
      sourceCount: input.sourceCount,
      importedCount: input.importedCount,
      rejectedCount: input.rejectedCount,
      duplicateCount: input.duplicateCount,
    },
  };
}

export function describeAlternateRuntimeBoundary(input: {
  desktopShell: "tauri" | "browser-fallback";
  gatewayReachable: boolean;
}): { boundary: string; operationalAuthority: string } {
  return {
    boundary: input.desktopShell,
    operationalAuthority: input.gatewayReachable ? "local-gateway" : "unavailable",
  };
}
