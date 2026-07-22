import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { EmptyState, ErrorState, LoadingState, PermissionGuard } from "@klickit/ui";
import { fetchPatientProfile, fetchPatientSafetySummary } from "../api/patients.js";
import { useAuth } from "../auth/AuthContext.js";
import { patientProfileDisplayName, patientProfileField, formatPatientProfileActive } from "../config/patients.js";

type ProfileTab = "overview" | "safety";

export function PatientProfilePage() {
  const auth = useAuth();
  const { patientId = "" } = useParams();
  const [tab, setTab] = useState<ProfileTab>("overview");
  const canView = auth.hasPermission("patient.view");

  const profileQuery = useQuery({
    queryKey: ["patients", "profile", patientId, auth.token],
    queryFn: () => fetchPatientProfile(auth.token!, patientId),
    enabled: Boolean(auth.token && canView && patientId),
  });

  const safetyQuery = useQuery({
    queryKey: ["patients", "safety", patientId, auth.token],
    queryFn: () => fetchPatientSafetySummary(auth.token!, patientId),
    enabled: Boolean(auth.token && canView && patientId && tab === "safety"),
  });

  if (!canView) {
    return (
      <PermissionGuard allowed={false} permissionCode="patient.view">
        <span />
      </PermissionGuard>
    );
  }

  if (!patientId) {
    return <EmptyState title="Patient not found" description="No patient ID was provided in the route." />;
  }

  return (
    <div className="ki-patient-profile">
      <div className="ki-dashboard-toolbar">
        <Link to="/patient-registry" className="ki-btn">
          Back to registry
        </Link>
      </div>

      {profileQuery.isLoading ? <LoadingState label="Loading patient profile…" /> : null}

      {profileQuery.isError ? (
        <ErrorState
          title="Profile unavailable"
          message={profileQuery.error instanceof Error ? profileQuery.error.message : "Could not load profile."}
          onRetry={() => {
            void profileQuery.refetch();
          }}
        />
      ) : null}

      {profileQuery.data?.patient ? (
        <>
          <header className="ki-patient-profile-header">
            <h2 className="ki-patient-profile-name">{patientProfileDisplayName(profileQuery.data.patient)}</h2>
            <p className="ki-dashboard-note">
              Patient ID {patientProfileField(profileQuery.data.patient, "patient_no")} ·{" "}
              {formatPatientProfileActive(profileQuery.data.patient)}
            </p>
          </header>

          <div className="ki-patient-tabs" role="tablist" aria-label="Patient profile sections">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "overview"}
              className={`ki-btn ${tab === "overview" ? "ki-tab-active" : ""}`}
              onClick={() => setTab("overview")}
            >
              Care overview
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "safety"}
              className={`ki-btn ${tab === "safety" ? "ki-tab-active" : ""}`}
              onClick={() => setTab("safety")}
            >
              Safety summary
            </button>
          </div>

          {tab === "overview" ? (
            <section className="ki-dashboard-section" aria-label="Patient overview">
              <table className="ki-dashboard-table ki-patient-table">
                <tbody>
                  <tr>
                    <th scope="row">Given name</th>
                    <td>{patientProfileField(profileQuery.data.patient, "first_name")}</td>
                  </tr>
                  <tr>
                    <th scope="row">Family name</th>
                    <td>{patientProfileField(profileQuery.data.patient, "last_name")}</td>
                  </tr>
                  <tr>
                    <th scope="row">Mobile</th>
                    <td>{patientProfileField(profileQuery.data.patient, "cell_phone")}</td>
                  </tr>
                  <tr>
                    <th scope="row">Birth date</th>
                    <td>{patientProfileField(profileQuery.data.patient, "birth_date")}</td>
                  </tr>
                  <tr>
                    <th scope="row">Intent tier</th>
                    <td>{patientProfileField(profileQuery.data.patient, "intent_tier")}</td>
                  </tr>
                  <tr>
                    <th scope="row">Registration notes</th>
                    <td>{patientProfileField(profileQuery.data.patient, "notes")}</td>
                  </tr>
                </tbody>
              </table>
              <p className="ki-dashboard-note">
                Full care workspace tabs (odontogram, fee statements, etc.) will be built in later UI modules.
              </p>
            </section>
          ) : null}

          {tab === "safety" ? (
            <section className="ki-dashboard-section" aria-label="Safety summary">
              {safetyQuery.isLoading ? <LoadingState label="Loading safety summary…" /> : null}
              {safetyQuery.isError ? (
                <ErrorState
                  title="Safety summary unavailable"
                  message={
                    safetyQuery.error instanceof Error ? safetyQuery.error.message : "Could not load safety data."
                  }
                  onRetry={() => {
                    void safetyQuery.refetch();
                  }}
                />
              ) : null}
              {safetyQuery.data ? (
                <>
                  <p className="ki-dashboard-note">
                    Read-only cross-clinic safety view. Last updated clinic:{" "}
                    {safetyQuery.data.lastUpdatedClinicCode ?? "—"}
                  </p>
                  {safetyQuery.data.allergies.length ? (
                    <ul className="ki-patient-alert-list">
                      {safetyQuery.data.allergies.map((allergy) => (
                        <li key={allergy}>{allergy}</li>
                      ))}
                    </ul>
                  ) : (
                    <EmptyState title="No active allergies recorded" description="Safety alerts will appear here when documented." />
                  )}
                  {safetyQuery.data.lastClinicalNoteSummary ? (
                    <p className="ki-dashboard-note">Latest note: {safetyQuery.data.lastClinicalNoteSummary}</p>
                  ) : null}
                </>
              ) : null}
            </section>
          ) : null}
        </>
      ) : null}

      {profileQuery.isSuccess && !profileQuery.data.patient ? (
        <EmptyState title="Patient not found" description="This patient ID does not exist in the current clinic scope." />
      ) : null}
    </div>
  );
}
