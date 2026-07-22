import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext.js";
import { LoginPage } from "./pages/LoginPage.js";
import { ProtectedLayout } from "./routes/ProtectedLayout.js";
import { ModulePlaceholderPage } from "./pages/ModulePlaceholderPage.js";

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<ModulePlaceholderPage />} />
          <Route path="/clinical-queue" element={<ModulePlaceholderPage />} />
          <Route path="/scheduler" element={<ModulePlaceholderPage />} />
          <Route path="/patient-registry" element={<ModulePlaceholderPage />} />
          <Route path="/financial-operations" element={<ModulePlaceholderPage />} />
          <Route path="/comms-center" element={<ModulePlaceholderPage />} />
          <Route path="/system-configuration" element={<ModulePlaceholderPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AuthProvider>
  );
}
