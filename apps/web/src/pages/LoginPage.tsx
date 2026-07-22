import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { DemoBanner, ErrorState, FormField } from "@klickit/ui";
import { PRODUCT_NAME } from "@klickit/shared";
import { useAuth } from "../auth/AuthContext.js";
import { useState } from "react";

const passwordSchema = z.object({
  loginName: z.string().min(1, "Login name is required"),
  password: z.string().min(1, "Password is required"),
});

type PasswordForm = z.infer<typeof passwordSchema>;

export function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [demoLoading, setDemoLoading] = useState(false);

  const form = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { loginName: "dev.admin", password: "" },
  });

  if (!auth.loading && auth.token && auth.user) {
    const redirectTo = (location.state as { from?: string } | null)?.from ?? "/dashboard";
    return <Navigate to={redirectTo} replace />;
  }

  async function handleDemoLogin() {
    setSubmitError(null);
    setDemoLoading(true);
    try {
      await auth.loginDemo("dev.admin");
      navigate("/dashboard", { replace: true });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Demo login failed");
    } finally {
      setDemoLoading(false);
    }
  }

  async function handlePasswordLogin(values: PasswordForm) {
    setSubmitError(null);
    try {
      await auth.loginPassword(values.loginName, values.password);
      navigate("/dashboard", { replace: true });
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Password login failed. Use Owner Demo Login until credentials are seeded.",
      );
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--ki-color-bg)" }}>
      <DemoBanner />
      <div style={{ maxWidth: 480, margin: "48px auto", padding: "0 16px" }}>
        <h1 style={{ marginTop: 0 }}>{PRODUCT_NAME} — Sign In</h1>
        <p style={{ color: "var(--ki-color-text-muted)" }}>
          Owner Demo Mode uses synthetic data only. Start with the one-click demo login below.
        </p>

        {auth.error ? <ErrorState title="Previous session cleared" message={auth.error} /> : null}
        {submitError ? <ErrorState title="Sign in failed" message={submitError} /> : null}

        <section
          style={{
            background: "var(--ki-color-surface)",
            border: "1px solid var(--ki-color-border)",
            padding: "16px",
            borderRadius: "var(--ki-radius-sm)",
            marginBottom: "16px",
          }}
        >
          <h2 style={{ marginTop: 0, fontSize: "15px" }}>Owner Demo Login</h2>
          <p style={{ marginTop: 0, color: "var(--ki-color-text-muted)", fontSize: "12px" }}>
            Signs in as <strong>dev.admin</strong> with full clinic permissions in local development.
          </p>
          <button type="button" className="ki-btn ki-btn-primary" disabled={demoLoading} onClick={() => void handleDemoLogin()}>
            {demoLoading ? "Signing in…" : "Sign In with Demo Account"}
          </button>
        </section>

        <section
          style={{
            background: "var(--ki-color-surface)",
            border: "1px solid var(--ki-color-border)",
            padding: "16px",
            borderRadius: "var(--ki-radius-sm)",
          }}
        >
          <h2 style={{ marginTop: 0, fontSize: "15px" }}>Password Login (advanced)</h2>
          <form onSubmit={form.handleSubmit((values) => void handlePasswordLogin(values))}>
            <div style={{ display: "grid", gap: "12px" }}>
              <FormField label="Login name" htmlFor="loginName" error={form.formState.errors.loginName?.message}>
                <input id="loginName" className="ki-input" {...form.register("loginName")} autoComplete="username" />
              </FormField>
              <FormField label="Password" htmlFor="password" error={form.formState.errors.password?.message}>
                <input
                  id="password"
                  type="password"
                  className="ki-input"
                  {...form.register("password")}
                  autoComplete="current-password"
                />
              </FormField>
              <button type="submit" className="ki-btn">
                Sign In with Password
              </button>
            </div>
          </form>
          <p style={{ marginBottom: 0, color: "var(--ki-color-text-muted)", fontSize: "12px" }}>
            Password login requires seeded credentials. Until then, use Owner Demo Login.
          </p>
        </section>
      </div>
    </div>
  );
}
