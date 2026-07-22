import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext.js";
import { LoginPage } from "./pages/LoginPage.js";
import { DashboardPage } from "./pages/DashboardPage.js";
import { PatientProfilePage } from "./pages/PatientProfilePage.js";
import { PatientRegisterPage } from "./pages/PatientRegisterPage.js";
import { PatientRegistryPage } from "./pages/PatientRegistryPage.js";
import { ClinicalQueuePage } from "./pages/ClinicalQueuePage.js";
import { SchedulerPage } from "./pages/SchedulerPage.js";
import { SchedulerSetupPage } from "./pages/SchedulerSetupPage.js";
import { ProtectedLayout } from "./routes/ProtectedLayout.js";
import { ModulePlaceholderPage } from "./pages/ModulePlaceholderPage.js";

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/clinical-queue" element={<ClinicalQueuePage />} />
          <Route path="/scheduler" element={<SchedulerPage />} />
          <Route path="/scheduler/setup" element={<SchedulerSetupPage />} />
          <Route path="/patient-registry" element={<PatientRegistryPage />} />
          <Route path="/patient-registry/register" element={<PatientRegisterPage />} />
          <Route path="/patient-registry/:patientId" element={<PatientProfilePage />} />
          <Route path="/financial-operations" element={<ModulePlaceholderPage />} />
          <Route path="/comms-center" element={<ModulePlaceholderPage />} />
          <Route path="/system-configuration" element={<ModulePlaceholderPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AuthProvider>
  );
}
