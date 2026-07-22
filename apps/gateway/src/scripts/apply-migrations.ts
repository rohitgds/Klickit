import { loadGatewayConfig } from "../config.js";
import { createDatabasePool } from "../db/client.js";
import { applyMigrations, resolveMigrationsDir } from "../db/migrations.js";

async function main() {
  const config = loadGatewayConfig();
  const pool = await createDatabasePool(config.databaseUrl);
  try {
    const result = await applyMigrations(pool, resolveMigrationsDir());
    console.log(JSON.stringify({ ok: true, ...result }, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
