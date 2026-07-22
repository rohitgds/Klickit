import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createDevSession, fetchClinicConfig, fetchEffectivePermissions, fetchSession, loginWithPassword, logoutSession } from "../api/auth.js";
import type { ClinicConfigResponse } from "../api/types.js";
import {
  clearSession,
  readSessionToken,
  readStoredSessionUser,
  writeSession,
  type StoredSessionUser,
} from "./sessionStorage.js";

interface AuthContextValue {
  token: string | null;
  user: StoredSessionUser | null;
  clinicConfig: ClinicConfigResponse | null;
  loading: boolean;
  error: string | null;
  loginDemo: (loginName?: string) => Promise<void>;
  loginPassword: (loginName: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshClinicConfig: () => Promise<void>;
  hasPermission: (code: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function toStoredUser(session: {
  userId: string;
  clinicId: string;
  organizationId: string;
  permissionCodes: string[];
}): StoredSessionUser {
  return {
    userId: session.userId,
    clinicId: session.clinicId,
    organizationId: session.organizationId,
    permissionCodes: [...session.permissionCodes],
  };
}

export function AuthProvider(props: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => readSessionToken());
  const [user, setUser] = useState<StoredSessionUser | null>(() => readStoredSessionUser());
  const [clinicConfig, setClinicConfig] = useState<ClinicConfigResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshClinicConfig = useCallback(async () => {
    const config = await fetchClinicConfig();
    setClinicConfig(config);
  }, []);

  const applyLogin = useCallback(async (result: Awaited<ReturnType<typeof createDevSession>>) => {
    const storedUser = toStoredUser(result.session);
    writeSession({ token: result.token, user: storedUser });
    setToken(result.token);
    setUser(storedUser);
    setError(null);
    await refreshClinicConfig();
  }, [refreshClinicConfig]);

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      setLoading(true);
      setError(null);
      try {
        if (token) {
          const sessionResponse = await fetchSession(token);
          const effective = await fetchEffectivePermissions(token);
          const storedUser = toStoredUser({
            ...sessionResponse.session,
            permissionCodes: effective.permissionCodes,
          });
          writeSession({ token, user: storedUser });
          if (!cancelled) {
            setUser(storedUser);
          }
        }
        await refreshClinicConfig();
      } catch (bootstrapError) {
        clearSession();
        if (!cancelled) {
          setToken(null);
          setUser(null);
          setError(bootstrapError instanceof Error ? bootstrapError.message : "Session expired");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [token, refreshClinicConfig]);

  const loginDemo = useCallback(async (loginName = "dev.admin") => {
    const result = await createDevSession(loginName);
    await applyLogin(result);
  }, [applyLogin]);

  const loginPassword = useCallback(async (loginName: string, password: string) => {
    const result = await loginWithPassword({ loginName, password });
    await applyLogin(result);
  }, [applyLogin]);

  const logout = useCallback(async () => {
    if (token) {
      try {
        await logoutSession(token);
      } catch {
        // Clear local session even if network logout fails.
      }
    }
    clearSession();
    setToken(null);
    setUser(null);
  }, [token]);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      clinicConfig,
      loading,
      error,
      loginDemo,
      loginPassword,
      logout,
      refreshClinicConfig,
      hasPermission: (code: string) => Boolean(user?.permissionCodes.includes(code)),
    }),
    [token, user, clinicConfig, loading, error, loginDemo, loginPassword, logout, refreshClinicConfig],
  );

  return <AuthContext.Provider value={value}>{props.children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
