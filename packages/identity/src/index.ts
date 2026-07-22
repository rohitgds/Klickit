import { scryptSync, timingSafeEqual, randomBytes } from "node:crypto";

export type PermissionEffect = "allow" | "deny";

export interface PermissionGrant {
  code: string;
  effect: PermissionEffect;
  source: "role" | "override";
}

export interface EffectivePermissionResult {
  allowed: boolean;
  matched?: PermissionGrant;
  evaluatedCodes: readonly string[];
}

export function evaluateEffectivePermission(
  permissionCode: string,
  grants: readonly PermissionGrant[],
): EffectivePermissionResult {
  const overrides = grants.filter((grant) => grant.source === "override");
  const denyOverride = overrides.find(
    (grant) => grant.effect === "deny" && grant.code === permissionCode,
  );
  if (denyOverride) {
    return { allowed: false, matched: denyOverride, evaluatedCodes: [permissionCode] };
  }

  const allowOverride = overrides.find(
    (grant) => grant.effect === "allow" && grant.code === permissionCode,
  );
  if (allowOverride) {
    return { allowed: true, matched: allowOverride, evaluatedCodes: [permissionCode] };
  }

  const roleGrant = grants.find(
    (grant) => grant.source === "role" && grant.effect === "allow" && grant.code === permissionCode,
  );
  if (roleGrant) {
    return { allowed: true, matched: roleGrant, evaluatedCodes: [permissionCode] };
  }

  return { allowed: false, evaluatedCodes: [permissionCode] };
}

export function hashPassword(password: string, salt = "klickit-dev-salt"): string {
  return scryptSync(password, salt, 32).toString("hex");
}

export function verifyPassword(password: string, storedHash: string, salt = "klickit-dev-salt"): boolean {
  const computed = hashPassword(password, salt);
  const left = Buffer.from(computed, "hex");
  const right = Buffer.from(storedHash, "hex");
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

export function createSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashSessionToken(token: string): string {
  return scryptSync(token, "klickit-session-salt", 32).toString("hex");
}

export interface AuthSessionContext {
  userId: string;
  organizationId: string;
  clinicId: string;
  membershipId: string;
  authzVersion: number;
  permissionCodes: readonly string[];
}

export function sessionHasPermission(session: AuthSessionContext, permissionCode: string): boolean {
  return session.permissionCodes.includes(permissionCode);
}
