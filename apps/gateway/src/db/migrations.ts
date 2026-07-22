import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { DatabasePoolLike } from "./client.js";

export interface MigrationApplyResult {
  applied: readonly string[];
  skipped: readonly string[];
}

export async function listMigrationFiles(migrationsDir: string): Promise<string[]> {
  const entries = await readdir(migrationsDir);
  return entries.filter((name) => name.endsWith(".sql")).sort();
}

export async function applyMigrations(
  pool: DatabasePoolLike,
  migrationsDir: string,
): Promise<MigrationApplyResult> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.klickit_schema_migrations (
      filename varchar PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT clock_timestamp()
    )
  `);

  const files = await listMigrationFiles(migrationsDir);
  const applied: string[] = [];
  const skipped: string[] = [];

  for (const filename of files) {
    const existing = await pool.query<{ filename: string }>(
      "SELECT filename FROM public.klickit_schema_migrations WHERE filename = $1",
      [filename],
    );
    if (existing.rows[0]) {
      skipped.push(filename);
      continue;
    }

    const sql = await readFile(path.join(migrationsDir, filename), "utf8");
    await pool.query("BEGIN");
    try {
      await pool.query(sql);
      await pool.query("INSERT INTO public.klickit_schema_migrations (filename) VALUES ($1)", [filename]);
      await pool.query("COMMIT");
      applied.push(filename);
    } catch (error) {
      await pool.query("ROLLBACK");
      throw error;
    }
  }

  return { applied, skipped };
}

export function resolveMigrationsDir(fromUrl = import.meta.url): string {
  const dir = path.dirname(fileURLToPath(fromUrl));
  return path.resolve(dir, "../../../../supabase/migrations");
}
