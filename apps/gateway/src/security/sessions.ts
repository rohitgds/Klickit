import type { DatabasePoolLike } from "../db/client.js";

export async function invalidateUserSessions(
  pool: DatabasePoolLike,
  userId: string,
  reason: string,
): Promise<number> {
  const result = await pool.query(
    `
      UPDATE dentos_data.user_sessions
      SET revoked_at = clock_timestamp(),
          revoked_reason = $2
      WHERE user_id = $1
        AND revoked_at IS NULL
    `,
    [userId, reason],
  );
  return result.rowCount ?? 0;
}

export async function bumpUserAuthzVersion(
  pool: DatabasePoolLike,
  userId: string,
): Promise<number> {
  const result = await pool.query<{ authz_version: string }>(
    `
      UPDATE dentos_data.users
      SET authz_version = authz_version + 1,
          updated_at = clock_timestamp()
      WHERE id = $1
      RETURNING authz_version
    `,
    [userId],
  );
  await invalidateUserSessions(pool, userId, "authz_change");
  return Number(result.rows[0]?.authz_version ?? 0);
}
