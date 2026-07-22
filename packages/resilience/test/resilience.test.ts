import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildBackupChecksum,
  buildMigrationAcceptanceReport,
  evaluateReadinessDrill,
  validateRestoreDrill,
} from "../src/index.js";

describe("@klickit/resilience", () => {
  it("builds deterministic backup checksums", () => {
    const checksum = buildBackupChecksum({
      clinicCode: "DEV",
      startedAt: "2026-07-22T00:00:00.000Z",
      artifactPath: "./artifacts/backup.sql",
    });
    assert.match(checksum, /^[0-9a-f]{8}$/);
  });

  it("requires matching restore checksums", () => {
    const result = validateRestoreDrill({ backupChecksum: "abc", restoredChecksum: "def" });
    assert.equal(result.ok, false);
  });

  it("passes OFF-003 readiness drill when writes are blocked", () => {
    const result = evaluateReadinessDrill({
      drillCode: "OFF-003",
      writeBlocked: true,
      readsAllowed: true,
    });
    assert.equal(result.ok, true);
  });

  it("balances migration acceptance counts", () => {
    const report = buildMigrationAcceptanceReport({
      sourceCount: 100,
      importedCount: 95,
      rejectedCount: 3,
      duplicateCount: 2,
    });
    assert.equal(report.balanced, true);
  });
});
