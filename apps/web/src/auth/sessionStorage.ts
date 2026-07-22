export const SESSION_TOKEN_KEY = "klickit.session.token";
export const SESSION_USER_KEY = "klickit.session.user";

export interface StoredSessionUser {
  userId: string;
  clinicId: string;
  organizationId: string;
  permissionCodes: string[];
}

export interface SessionStorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const defaultAdapter: SessionStorageAdapter =
  typeof window !== "undefined"
    ? window.sessionStorage
    : {
        getItem: () => null,
        setItem: () => undefined,
        removeItem: () => undefined,
      };

export function readSessionToken(adapter: SessionStorageAdapter = defaultAdapter): string | null {
  return adapter.getItem(SESSION_TOKEN_KEY);
}

export function writeSession(
  input: { token: string; user: StoredSessionUser },
  adapter: SessionStorageAdapter = defaultAdapter,
): void {
  adapter.setItem(SESSION_TOKEN_KEY, input.token);
  adapter.setItem(SESSION_USER_KEY, JSON.stringify(input.user));
}

export function readStoredSessionUser(adapter: SessionStorageAdapter = defaultAdapter): StoredSessionUser | null {
  const raw = adapter.getItem(SESSION_USER_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as StoredSessionUser;
  } catch {
    return null;
  }
}

export function clearSession(adapter: SessionStorageAdapter = defaultAdapter): void {
  adapter.removeItem(SESSION_TOKEN_KEY);
  adapter.removeItem(SESSION_USER_KEY);
}

export function hasPermission(codes: readonly string[], permission: string): boolean {
  return codes.includes(permission);
}
