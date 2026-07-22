import { evaluateDailyReconciliation } from "@klickit/pilot";

const today = new Date().toISOString().slice(0, 10);
const result = evaluateDailyReconciliation({
  sourceTotalMinor: 125000,
  outputTotalMinor: 125000,
});

console.log(`Daily reconciliation preview for ${today}:`, result);

if (!result.ok) {
  process.exitCode = 1;
}

console.log("Record balanced totals through POST /pilot/reconciliation/daily in development.");
