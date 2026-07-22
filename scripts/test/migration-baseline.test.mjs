import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const migrationsDir = join(root, "supabase/migrations");

describe("migration baseline", () => {
  it("contains ordered Phase 9 migration files", () => {
    const files = readdirSync(migrationsDir).filter((name) => name.endsWith(".sql")).sort();
    assert.ok(files.includes("20260721100000_extensions_schemas_enums.sql"));
    assert.ok(files.includes("20260721107000_sync_foundation.sql"));
    assert.ok(files.includes("20260722100000_patient_registry_tables.sql"));
    assert.ok(files.includes("20260722120000_clinical_tables.sql"));
    assert.ok(files.includes("20260722130000_plan_prescription_tables.sql"));
    assert.equal(files.at(-1), "20260722134000_milestone6_supplemental.sql");
  });

  it("includes permission catalog seed content", () => {
    const seed = readFileSync(join(migrationsDir, "20260721106000_permission_catalog_seed.sql"), "utf8");
    assert.match(seed, /INSERT INTO dentos_data\.permissions/);
    assert.match(seed, /patient\.view/);
    assert.match(seed, /audit\.view/);
  });

  it("documents compile script for rebuild portability", () => {
    const compileScript = readFileSync(join(root, "scripts/compile-migrations-from-blueprint.mjs"), "utf8");
    assert.match(compileScript, /blueprints\/original\/01_database_schema\.md/);
  });
});
