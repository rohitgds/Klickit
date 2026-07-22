import { scryptSync, timingSafeEqual, randomBytes, createHash } from "node:crypto";
import { hash as argon2Hash, verify as argon2Verify } from "@node-rs/argon2";

export type PermissionEffect = "allow" | "deny";

export const PASSWORD_ALGORITHM_ARGON2ID = "argon2id";
export const PASSWORD_ALGORITHM_LEGACY_SCRYPT = "legacy-scrypt-v1";

const LEGACY_DEV_SALT = "klickit-dev-salt";

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

export interface HashedPassword {
  hash: string;
  algorithm: typeof PASSWORD_ALGORITHM_ARGON2ID;
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

export async function hashPassword(password: string): Promise<HashedPassword> {
  const hash = await argon2Hash(password, {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  return { hash, algorithm: PASSWORD_ALGORITHM_ARGON2ID };
}

function verifyLegacyScryptPassword(password: string, storedHash: string): boolean {
  const computed = scryptSync(password, LEGACY_DEV_SALT, 32).toString("hex");
  const left = Buffer.from(computed, "hex");
  const right = Buffer.from(storedHash, "hex");
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

export async function verifyPassword(
  password: string,
  storedHash: string,
  algorithm = PASSWORD_ALGORITHM_ARGON2ID,
): Promise<boolean> {
  if (algorithm === PASSWORD_ALGORITHM_LEGACY_SCRYPT) {
    return verifyLegacyScryptPassword(password, storedHash);
  }
  try {
    return await argon2Verify(storedHash, password);
  } catch {
    return false;
  }
}

export function createSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
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

export function sanitizeSessionForResponse(session: AuthSessionContext): AuthSessionContext {
  return {
    userId: session.userId,
    organizationId: session.organizationId,
    clinicId: session.clinicId,
    membershipId: session.membershipId,
    authzVersion: session.authzVersion,
    permissionCodes: session.permissionCodes,
  };
}
