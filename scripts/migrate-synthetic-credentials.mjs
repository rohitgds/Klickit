#!/usr/bin/env node
/**
 * Synthetic-only credential migration — re-hash legacy dev passwords to Argon2id.
 * Never run against production without explicit owner approval.
 *
 * Usage (local only):
 *   APP_ENV=local node scripts/migrate-synthetic-credentials.mjs
 */
import pg from "pg";
import { hashPassword, verifyPassword, PASSWORD_ALGORITHM_LEGACY_SCRYPT } from "@klickit/identity";

const DEV_DEFAULT_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const SYNTHETIC_PASSWORD = process.env.SYNTHETIC_DEV_PASSWORD ?? "DevPass123!";

function assertLocalOnly() {
  const appEnv = process.env.APP_ENV ?? "local";
  if (appEnv !== "local" && appEnv !== "development") {
    console.error("FAIL: migrate-synthetic-credentials may only run when APP_ENV=local");
    process.exit(1);
  }
}

async function main() {
  assertLocalOnly();
  const databaseUrl = process.env.GATEWAY_DATABASE_URL ?? process.env.DATABASE_URL ?? DEV_DEFAULT_URL;
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 3 });

  try {
    const legacy = await pool.query<{ user_id: string; password_hash: string; login_name: string }>(
      `
        SELECT uc.user_id, uc.password_hash, u.login_name
        FROM dentos_data.user_credentials uc
        JOIN dentos_data.users u ON u.id = uc.user_id
        WHERE uc.password_algorithm = $1
      `,
      [PASSWORD_ALGORITHM_LEGACY_SCRYPT],
    );

    let upgraded = 0;
    for (const row of legacy.rows) {
      const valid = await verifyPassword(SYNTHETIC_PASSWORD, row.password_hash, PASSWORD_ALGORITHM_LEGACY_SCRYPT);
      if (!valid) {
        console.warn(`SKIP: ${row.login_name} — legacy hash does not match synthetic password`);
        continue;
      }
      const next = await hashPassword(SYNTHETIC_PASSWORD);
      await pool.query(
        `
          UPDATE dentos_data.user_credentials
          SET password_hash = $2,
              password_algorithm = $3,
              password_changed_at = clock_timestamp(),
              updated_at = clock_timestamp()
          WHERE user_id = $1
        `,
        [row.user_id, next.hash, next.algorithm],
      );
      upgraded += 1;
      console.log(`UPGRADED: ${row.login_name}`);
    }

    console.log(`Done. Upgraded ${upgraded} synthetic credential(s).`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
