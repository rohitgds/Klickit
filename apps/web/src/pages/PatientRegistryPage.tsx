import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { EmptyState, ErrorState, LoadingState, PermissionGuard } from "@klickit/ui";
import { searchPatients } from "../api/patients.js";
import { useAuth } from "../auth/AuthContext.js";
import {
  formatPatientActive,
  formatPatientPhone,
  isPatientSearchQueryValid,
  PATIENT_SEARCH_MIN_CHARS,
  PATIENT_SEARCH_PAGE_SIZE,
} from "../config/patients.js";

export function PatientRegistryPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [page, setPage] = useState(0);

  const canView = auth.hasPermission("patient.view");
  const canCreate = auth.hasPermission("patient.create");
  const offset = page * PATIENT_SEARCH_PAGE_SIZE;

  const searchQuery = useQuery({
    queryKey: ["patients", "search", submittedQuery, page, auth.token],
    queryFn: () =>
      searchPatients(auth.token!, {
        q: submittedQuery || undefined,
        limit: PATIENT_SEARCH_PAGE_SIZE,
        offset,
      }),
    enabled: Boolean(auth.token && canView),
  });

  const patients = searchQuery.data?.patients ?? [];
  const canGoBack = page > 0;
  const canGoForward = patients.length === PATIENT_SEARCH_PAGE_SIZE;

  const searchHint = useMemo(() => {
    if (!query.trim()) {
      return "Leave blank to list recent patients, or enter at least 2 characters.";
    }
    if (!isPatientSearchQueryValid(query)) {
      return `Enter at least ${PATIENT_SEARCH_MIN_CHARS} characters for name search.`;
    }
    return null;
  }, [query]);

  if (!canView) {
    return (
      <PermissionGuard allowed={false} permissionCode="patient.view">
        <span />
      </PermissionGuard>
    );
  }

  function runSearch() {
    if (!isPatientSearchQueryValid(query)) {
      return;
    }
    setPage(0);
    setSubmittedQuery(query.trim());
  }

  return (
    <div className="ki-patient-registry">
      <div className="ki-dashboard-toolbar">
        {canCreate ? (
          <Link to="/patient-registry/register" className="ki-btn ki-dashboard-action-btn">
            Register Patient
          </Link>
        ) : null}
        <label className="ki-patient-search-field">
          <span className="ki-dashboard-date-label">Search</span>
          <input
            className="ki-input"
            type="search"
            placeholder="Name / Patient ID / Mobile"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                runSearch();
              }
            }}
          />
        </label>
        <button type="button" className="ki-btn" onClick={runSearch} disabled={Boolean(searchHint && query.trim())}>
          Search
        </button>
      </div>

      {searchHint ? <p className="ki-dashboard-note">{searchHint}</p> : null}

      {searchQuery.isLoading ? <LoadingState label="Searching patient registry…" /> : null}

      {searchQuery.isError ? (
        <ErrorState
          title="Search failed"
          message={searchQuery.error instanceof Error ? searchQuery.error.message : "Could not search patients."}
          onRetry={() => {
            void searchQuery.refetch();
          }}
        />
      ) : null}

      {searchQuery.isSuccess ? (
        <>
          {patients.length === 0 ? (
            <EmptyState
              title="No patients found"
              description={
                submittedQuery
                  ? "Try another name, patient ID, or mobile number."
                  : "Register a patient to populate the registry."
              }
              action={
                canCreate ? (
                  <Link to="/patient-registry/register" className="ki-btn ki-btn-primary">
                    Register Patient
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <section className="ki-dashboard-section" aria-label="Patient registry results">
              <table className="ki-dashboard-table ki-patient-table">
                <thead>
                  <tr>
                    <th scope="col" className="ki-dashboard-index-col">
                      Sr
                    </th>
                    <th scope="col" className="ki-patient-id-col">
                      Patient ID
                    </th>
                    <th scope="col">Patient name</th>
                    <th scope="col" className="ki-patient-mobile-col">
                      Mobile
                    </th>
                    <th scope="col" className="ki-patient-status-col">
                      Status
                    </th>
                    <th scope="col" className="ki-patient-actions-col">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {patients.map((patient, index) => (
                    <tr key={patient.id}>
                      <td className="ki-dashboard-num-col">{offset + index + 1}</td>
                      <td>{patient.patientNo}</td>
                      <td>{patient.displayName}</td>
                      <td>{formatPatientPhone(patient.cellPhone)}</td>
                      <td>{formatPatientActive(patient.active)}</td>
                      <td>
                        <button
                          type="button"
                          className="ki-btn"
                          onClick={() => navigate(`/patient-registry/${patient.id}`)}
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="ki-patient-pager">
                <button type="button" className="ki-btn" disabled={!canGoBack} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </button>
                <span>
                  Page {page + 1} · showing {patients.length} row{patients.length === 1 ? "" : "s"}
                </span>
                <button
                  type="button"
                  className="ki-btn"
                  disabled={!canGoForward}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            </section>
          )}
        </>
      ) : null}
    </div>
  );
}
