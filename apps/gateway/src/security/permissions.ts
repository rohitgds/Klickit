import type { PermissionGrant } from "@klickit/identity";
import { evaluateEffectivePermission } from "@klickit/identity";
import type { DatabasePoolLike } from "../db/client.js";

export async function loadMembershipPermissionGrants(
  pool: DatabasePoolLike,
  membershipId: string,
): Promise<PermissionGrant[]> {
  const roleGrants = await pool.query<{ code: string }>(
    `
      SELECT p.code
      FROM dentos_data.membership_roles mr
      JOIN dentos_data.role_permissions rp ON rp.role_id = mr.role_id
      JOIN dentos_data.permissions p ON p.id = rp.permission_id
      WHERE mr.membership_id = $1
    `,
    [membershipId],
  );

  const overrides = await pool.query<{ code: string; effect: "allow" | "deny" }>(
    `
      SELECT p.code, mpo.effect
      FROM dentos_data.membership_permission_overrides mpo
      JOIN dentos_data.permissions p ON p.id = mpo.permission_id
      WHERE mpo.membership_id = $1
    `,
    [membershipId],
  );

  return [
    ...roleGrants.rows.map((row) => ({
      code: row.code,
      effect: "allow" as const,
      source: "role" as const,
    })),
    ...overrides.rows.map((row) => ({
      code: row.code,
      effect: row.effect,
      source: "override" as const,
    })),
  ];
}

export async function membershipHasPermission(
  pool: DatabasePoolLike,
  membershipId: string,
  permissionCode: string,
): Promise<boolean> {
  const grants = await loadMembershipPermissionGrants(pool, membershipId);
  return evaluateEffectivePermission(permissionCode, grants).allowed;
}

export async function loadPermissionCodes(pool: DatabasePoolLike, membershipId: string): Promise<string[]> {
  const grants = await loadMembershipPermissionGrants(pool, membershipId);
  const allowed = new Set<string>();
  for (const grant of grants) {
    if (evaluateEffectivePermission(grant.code, grants).allowed) {
      allowed.add(grant.code);
    }
  }
  return [...allowed];
}

export async function recordAuthorizationDenial(
  pool: DatabasePoolLike,
  input: {
    organizationId: string;
    clinicId: string;
    userId: string;
    permissionCode: string;
    route: string;
  },
): Promise<void> {
  await pool.query(
    `
      INSERT INTO dentos_data.audit_events (
        id, organization_id, clinic_id, actor_user_id, action, entity_type, entity_id, after_json, occurred_at
      ) VALUES ($1, $2, $3, $4, 'authorization.denied', 'permission', $5, $6::jsonb, clock_timestamp())
    `,
    [
      crypto.randomUUID(),
      input.organizationId,
      input.clinicId,
      input.userId,
      input.permissionCode,
      JSON.stringify({ route: input.route, permissionCode: input.permissionCode }),
    ],
  );
}
