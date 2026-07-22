import { evaluateReadinessDrill } from "@klickit/resilience";

const offline = evaluateReadinessDrill({
  drillCode: "OFF-003",
  writeBlocked: true,
  readsAllowed: true,
});

const sync = evaluateReadinessDrill({
  drillCode: "SYNC-001",
  duplicateSuppressed: true,
});

console.log("72-hour offline drill (OFF-003):", offline);
console.log("Sync duplicate suppression drill (SYNC-001):", sync);

if (!offline.ok || !sync.ok) {
  process.exitCode = 1;
}
