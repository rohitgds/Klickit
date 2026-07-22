import type { FastifyReply, FastifyRequest } from "fastify";
import type { AuthSessionContext } from "@klickit/identity";
import { hashSessionToken } from "@klickit/identity";
import type { GatewayDependencies } from "../routes/index.js";
import { membershipHasPermission, recordAuthorizationDenial } from "./permissions.js";

export interface RequestSession extends AuthSessionContext {
  sessionId: string;
  tokenHash: string;
}

declare module "fastify" {
  interface FastifyRequest {
    klickitSession?: RequestSession;
  }
}

export async function resolveSession(
  deps: GatewayDependencies,
  request: FastifyRequest,
): Promise<RequestSession | null> {
  if (!deps.pool) {
    return null;
  }
  const token = request.headers["x-session-token"];
  if (typeof token !== "string" || !token.trim()) {
    return null;
  }
  const tokenHash = hashSessionToken(token);
  const result = await deps.pool.query<{
    session_id: string;
    user_id: string;
    organization_id: string;
    clinic_id: string;
    membership_id: string;
    authz_version: string;
  }>(
    `
      SELECT
        s.id AS session_id,
        s.user_id,
        c.organization_id,
        cm.clinic_id,
        cm.id AS membership_id,
        s.authz_version
      FROM dentos_data.user_sessions s
      JOIN dentos_data.clinic_memberships cm ON cm.user_id = s.user_id AND cm.active = true
      JOIN dentos_data.clinics c ON c.id = cm.clinic_id
      WHERE s.token_hash = $1
        AND s.revoked_at IS NULL
        AND s.expires_at > clock_timestamp()
      ORDER BY cm.is_default DESC
      LIMIT 1
    `,
    [tokenHash],
  );
  const row = result.rows[0];
  if (!row) {
    return null;
  }
  const permissionCodes = await import("./permissions.js").then((mod) =>
    mod.loadPermissionCodes(deps.pool!, row.membership_id),
  );
  return {
    sessionId: row.session_id,
    userId: row.user_id,
    organizationId: row.organization_id,
    clinicId: row.clinic_id,
    membershipId: row.membership_id,
    authzVersion: Number(row.authz_version),
    permissionCodes,
    tokenHash,
  };
}

export function requireSession(deps: GatewayDependencies) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await resolveSession(deps, request);
    if (!session) {
      reply.code(401);
      throw new Error("Authentication required");
    }
    request.klickitSession = session;
  };
}

export function requirePermission(deps: GatewayDependencies, permissionCode: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const session = request.klickitSession ?? (await resolveSession(deps, request));
    if (!session) {
      reply.code(401);
      throw new Error("Authentication required");
    }
    request.klickitSession = session;
    const allowed = await membershipHasPermission(deps.pool!, session.membershipId, permissionCode);
    if (!allowed) {
      await recordAuthorizationDenial(deps.pool!, {
        organizationId: session.organizationId,
        clinicId: session.clinicId,
        userId: session.userId,
        permissionCode,
        route: request.url,
      });
      reply.code(403);
      throw new Error(`Permission denied: ${permissionCode}`);
    }
  };
}
