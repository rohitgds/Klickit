import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { generateSyntheticDrKlickRows } from "@klickit/test-fixtures";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = join(root, "artifacts", "drklick-synthetic-fixture.json");
const rows = generateSyntheticDrKlickRows(500);

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, JSON.stringify(rows, null, 2), "utf8");
console.log(`Wrote ${rows.length} synthetic rows to ${outputPath}`);
