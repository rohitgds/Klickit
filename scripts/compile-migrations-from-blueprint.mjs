import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const blueprintPath = join(root, "blueprints/original/01_database_schema.md");
const outputDir = join(root, "supabase/migrations");

const blueprint = readFileSync(blueprintPath, "utf8");

function extractSqlBlocks(source) {
  const blocks = [];
  const pattern = /```sql\r?\n([\s\S]*?)```/g;
  let match = pattern.exec(source);
  while (match) {
    blocks.push(match[1].trim());
    match = pattern.exec(source);
  }
  return blocks;
}

function extractTableDDL(block, tableName) {
  const regex = new RegExp(`CREATE TABLE ${tableName}\\s*\\([\\s\\S]*?\\n\\);`, "i");
  const match = block.match(regex);
  return match?.[0] ?? "";
}

function extractTables(block, tableNames) {
  return tableNames
    .map((name) => extractTableDDL(block, name))
    .filter(Boolean)
    .map((sql) => sql.replace(/^CREATE TABLE /i, "CREATE TABLE dentos_data."))
    .join("\n\n");
}

function extractAlterLines(block, tableNames) {
  const allowed = new Set(tableNames);
  return block
    .split("\n")
    .filter((line) => {
      const match = line.match(/^ALTER TABLE ([a-z_]+)/i);
      return match && allowed.has(match[1].toLowerCase());
    })
    .map((line) => line.replace(/^ALTER TABLE /i, "ALTER TABLE dentos_data."))
    .join("\n");
}

function extractTriggerLines(block, tableNames) {
  const allowed = new Set(tableNames);
  return block
    .split("\n")
    .filter((line) => {
      const match = line.match(/^CREATE TRIGGER trg_([a-z_]+)_/i);
      return match && allowed.has(match[1].toLowerCase());
    })
    .map((line) => line.replace(/ ON ([a-z_]+) /i, " ON dentos_data.$1 "))
    .join("\n");
}

function extractIndexLines(block, tableNames) {
  const allowed = new Set(tableNames);
  return block
    .split("\n")
    .filter((line) => {
      if (!line.startsWith("CREATE INDEX")) {
        return false;
      }
      const match = line.match(/ ON ([a-z_]+) /i);
      return match && allowed.has(match[1].toLowerCase());
    })
    .map((line) => line.replace(/ ON ([a-z_]+) /i, " ON dentos_data.$1 "))
    .join("\n");
}

const blocks = extractSqlBlocks(blueprint);
const extensionsBlock = blocks[0];
const tableBlock = blocks.find((block) => block.includes("CREATE TABLE organizations")) ?? "";
const fkBlock = blocks.find((block) => block.includes("ALTER TABLE organizations ADD CONSTRAINT")) ?? "";
const auditFunctionBlockRaw = blocks.find((block) => block.includes("touch_mutable_row")) ?? "";
const auditFunctionBlock = auditFunctionBlockRaw
  .replace(
    "nullif(current_setting('dentos_runtime.request_id', true), '')",
    "nullif(current_setting('dentos_runtime.request_id', true), '')::uuid",
  )
  .replace(/INSERT INTO audit_events/g, "INSERT INTO dentos_data.audit_events");
const triggerBlock = blocks.find((block) => block.includes("trg_organizations_touch")) ?? "";
const permissionSeedBlock =
  blocks.find((block) => block.startsWith("INSERT INTO permissions")) ?? "";

const identityTables = [
  "organizations",
  "clinics",
  "users",
  "user_credentials",
  "password_reset_tokens",
  "user_sessions",
  "staff",
  "staff_clinics",
  "staff_user_links",
  "clinic_memberships",
  "roles",
  "permissions",
  "role_permissions",
  "membership_roles",
  "membership_permission_overrides",
];

const runtimeTables = ["audit_events", "outbox_events", "job_runs", "idempotency_keys"];

const patientMasterTables = [
  "patient_initials",
  "patient_categories",
  "patient_flags",
  "occupations",
  "referral_sources",
  "fee_schedules",
  "document_series",
  "document_number_reservations",
];

const patientCoreTables = [
  "patients",
  "patient_clinics",
  "patient_contacts",
  "patient_addresses",
  "patient_family_links",
  "custom_field_definitions",
  "patient_custom_field_values",
  "medical_question_definitions",
  "patient_medical_responses",
  "allergy_catalog",
  "patient_allergies",
  "patient_consents",
  "patient_merge_events",
];

const patientTables = [...patientMasterTables, ...patientCoreTables];
const indexBlock = blocks.find((block) => block.includes("ix_patients_scope_lookup")) ?? "";

mkdirSync(outputDir, { recursive: true });

const migrations = [
  {
    file: "20260721100000_extensions_schemas_enums.sql",
    body: `-- Generated from Blueprint 01 — extensions, schemas and enums\n\n${extensionsBlock}\n`,
  },
  {
    file: "20260721101000_runtime_audit_functions.sql",
    body: `-- Generated from Blueprint 01 — audit and row-version functions\n\nSET search_path = dentos_data, dentos_runtime, public;\n\n${auditFunctionBlock}\n`,
  },
  {
    file: "20260721102000_identity_access_tables.sql",
    body: `-- Generated from Blueprint 01 — Phase 1 identity and access tables\n\nSET search_path = dentos_data, dentos_runtime, public;\n\n${extractTables(tableBlock, identityTables)}\n`,
  },
  {
    file: "20260721103000_runtime_infrastructure_tables.sql",
    body: `-- Generated from Blueprint 01 — audit, outbox, jobs and idempotency\n\nSET search_path = dentos_data, dentos_runtime, public;\n\n${extractTables(tableBlock, runtimeTables)}\n`,
  },
  {
    file: "20260721104000_identity_runtime_foreign_keys.sql",
    body: `-- Generated from Blueprint 01 — foreign keys for baseline tables\n\nSET search_path = dentos_data, dentos_runtime, public;\n\n${extractAlterLines(fkBlock, [...identityTables, ...runtimeTables])}\n`,
  },
  {
    file: "20260721105000_identity_audit_triggers.sql",
    body: `-- Generated from Blueprint 01 — audit triggers for identity tables\n\nSET search_path = dentos_data, dentos_runtime, public;\n\n${extractTriggerLines(triggerBlock, identityTables)}\n`,
  },
  {
    file: "20260721106000_permission_catalog_seed.sql",
    body: `-- Generated from Blueprint 01 — permission catalog seed\n\nSET search_path = dentos_data, dentos_runtime, public;\n\n${permissionSeedBlock
      .replace(
        "INSERT INTO permissions (id, code, module, resource, action, description, sensitive, created_at) VALUES",
        "INSERT INTO dentos_data.permissions (id, code, module, resource, action, description, sensitive) VALUES",
      )
      .replace(/;\s*$/, "")}\nON CONFLICT (code) DO NOTHING;\n`,
  },
  {
    file: "20260722100000_patient_registry_tables.sql",
    body: `-- Generated from Blueprint 01 — patient registry foundation (Milestone 3)\n\nSET search_path = dentos_data, dentos_runtime, public;\n\n${extractTables(tableBlock, patientTables)}\n`,
  },
  {
    file: "20260722101000_patient_registry_foreign_keys.sql",
    body: `-- Generated from Blueprint 01 — patient registry foreign keys\n\nSET search_path = dentos_data, dentos_runtime, public;\n\n${extractAlterLines(fkBlock, patientTables)}\n`,
  },
  {
    file: "20260722102000_patient_registry_triggers.sql",
    body: `-- Generated from Blueprint 01 — patient registry audit triggers\n\nSET search_path = dentos_data, dentos_runtime, public;\n\n${extractTriggerLines(triggerBlock, patientTables)}\n`,
  },
  {
    file: "20260722103000_patient_registry_indexes.sql",
    body: `-- Generated from Blueprint 01 — patient registry indexes\n\nSET search_path = dentos_data, dentos_runtime, public;\n\n${extractIndexLines(indexBlock, patientTables)}\n`,
  },
];

for (const migration of migrations) {
  writeFileSync(join(outputDir, migration.file), `${migration.body}\n`, "utf8");
}

const extractedIdentityCount = identityTables.filter((name) => extractTableDDL(tableBlock, name)).length;
const extractedRuntimeCount = runtimeTables.filter((name) => extractTableDDL(tableBlock, name)).length;

console.log(`Wrote ${migrations.length} migration files to ${outputDir}`);
console.log(`Identity tables extracted: ${extractedIdentityCount}/${identityTables.length}`);
console.log(`Runtime tables extracted: ${extractedRuntimeCount}/${runtimeTables.length}`);
console.log(`Patient tables extracted: ${patientTables.filter((name) => extractTableDDL(tableBlock, name)).length}/${patientTables.length}`);
console.log(`Permission seed bytes: ${permissionSeedBlock.length}`);
