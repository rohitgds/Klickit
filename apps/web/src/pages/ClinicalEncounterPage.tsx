import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { EmptyState, ErrorState, LoadingState, PermissionGuard } from "@klickit/ui";
import { useAuth } from "../auth/AuthContext.js";
import {
  createClinicalNote,
  createOdontogramFinding,
  fetchEncounterNotes,
  fetchEncounterWorkspace,
  fetchOdontogramFindings,
  registerPatientFile,
  signClinicalNote,
} from "../api/clinical.js";
import {
  acceptCarePlan,
  addCarePlanStage,
  createCarePlan,
  fetchCarePlanDetail,
  proposeCarePlan,
} from "../api/plans.js";
import {
  createMedicationOrderDraft,
  saveMedicationOrder,
  searchMedicationCatalog,
  signMedicationOrder,
} from "../api/medication.js";
import { createPrintSnapshot } from "../api/documents.js";
import { fetchStaff } from "../api/scheduling.js";
import { ENCOUNTER_TABS, formatEncounterStatusLabel, type EncounterTab } from "../config/clinical.js";
import { lookupStaffName } from "../config/scheduling.js";

export function ClinicalEncounterPage() {
  const { encounterId = "" } = useParams();
  const auth = useAuth();
  const queryClient = useQueryClient();
  const canView = auth.hasPermission("clinical.view");
  const canEdit = auth.hasPermission("clinical.edit");
  const canPlan = auth.hasPermission("care_plan.edit");
  const canRx = auth.hasPermission("medication_order.create");
  const canUpload = auth.hasPermission("document.upload");
  const canPrint = auth.hasPermission("fee_statement.print");

  const [tab, setTab] = useState<EncounterTab>("summary");
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [noteBody, setNoteBody] = useState("");
  const [toothCode, setToothCode] = useState("11");
  const [findingCode, setFindingCode] = useState("caries");
  const [carePlanId, setCarePlanId] = useState("");
  const [stageName, setStageName] = useState("Phase 1");
  const [acceptedTotal, setAcceptedTotal] = useState(0);
  const [medOrderId, setMedOrderId] = useState("");
  const [medSearch, setMedSearch] = useState("");
  const [selectedMedId, setSelectedMedId] = useState("");
  const [signingPin, setSigningPin] = useState("");
  const [fileCaption, setFileCaption] = useState("");

  const workspaceQuery = useQuery({
    queryKey: ["clinical", "workspace", encounterId, auth.token],
    queryFn: () => fetchEncounterWorkspace(auth.token!, encounterId),
    enabled: Boolean(auth.token && canView && encounterId),
  });

  const notesQuery = useQuery({
    queryKey: ["clinical", "notes", encounterId, auth.token],
    queryFn: () => fetchEncounterNotes(auth.token!, encounterId),
    enabled: Boolean(auth.token && canView && encounterId && tab === "notes"),
  });

  const odontogramQuery = useQuery({
    queryKey: ["clinical", "odontogram", encounterId, auth.token],
    queryFn: () => fetchOdontogramFindings(auth.token!, encounterId),
    enabled: Boolean(auth.token && canView && encounterId && tab === "odontogram"),
  });

  const carePlanQuery = useQuery({
    queryKey: ["care-plan", carePlanId, auth.token],
    queryFn: () => fetchCarePlanDetail(auth.token!, carePlanId),
    enabled: Boolean(auth.token && carePlanId && tab === "care-plan"),
  });

  const medSearchQuery = useQuery({
    queryKey: ["medication", "catalog", medSearch, auth.token],
    queryFn: () => searchMedicationCatalog(auth.token!, medSearch),
    enabled: Boolean(auth.token && medSearch.length >= 2 && tab === "prescription"),
  });

  const staffQuery = useQuery({
    queryKey: ["identity", "staff", auth.token],
    queryFn: () => fetchStaff(auth.token!),
    enabled: Boolean(auth.token),
  });

  const workspace = workspaceQuery.data;

  async function invalidateWorkspace() {
    await queryClient.invalidateQueries({ queryKey: ["clinical", "workspace", encounterId] });
  }

  if (!canView) {
    return (
      <PermissionGuard allowed={false} permissionCode="clinical.view">
        <span />
      </PermissionGuard>
    );
  }

  if (!encounterId) {
    return <ErrorState title="Missing encounter" message="No encounter id in the URL." />;
  }

  return (
    <div className="ki-dashboard">
      <div className="ki-dashboard-toolbar">
        <Link to="/clinical-queue" className="ki-btn">
          ← Back to queue
        </Link>
        {workspace ? (
          <Link to={`/patient-registry/${workspace.patientId}`} className="ki-btn">
            Patient profile
          </Link>
        ) : null}
      </div>

      <nav className="ki-tab-bar" aria-label="Encounter sections">
        {ENCOUNTER_TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`ki-tab ${tab === item.id ? "ki-tab-active" : ""}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {actionError ? <ErrorState title="Action failed" message={actionError} onRetry={() => setActionError(null)} /> : null}

      {workspaceQuery.isLoading ? <LoadingState label="Loading encounter workspace…" /> : null}
      {workspaceQuery.isError ? (
        <ErrorState
          title="Workspace unavailable"
          message={workspaceQuery.error instanceof Error ? workspaceQuery.error.message : "Could not load encounter."}
          onRetry={() => void workspaceQuery.refetch()}
        />
      ) : null}

      {workspace && tab === "summary" ? (
        <section className="ki-dashboard-section">
          <h2 className="ki-dashboard-section-title">Encounter summary</h2>
          <table className="ki-dashboard-table ki-patient-table">
            <tbody>
              <tr>
                <th scope="row">Status</th>
                <td>{formatEncounterStatusLabel(workspace.status)}</td>
              </tr>
              <tr>
                <th scope="row">Patient</th>
                <td>{workspace.patientId}</td>
              </tr>
              <tr>
                <th scope="row">Lead clinician</th>
                <td>{lookupStaffName(staffQuery.data?.staff ?? [], workspace.leadClinicianId)}</td>
              </tr>
              <tr>
                <th scope="row">Allergies</th>
                <td>{workspace.safety.allergies.length ? workspace.safety.allergies.join(", ") : "None recorded"}</td>
              </tr>
              <tr>
                <th scope="row">Findings / diagnoses / open deliveries</th>
                <td>
                  {workspace.counts.findings} / {workspace.counts.diagnoses} / {workspace.counts.openDeliveries}
                </td>
              </tr>
            </tbody>
          </table>
        </section>
      ) : null}

      {tab === "notes" ? (
        <section className="ki-dashboard-section">
          <h2 className="ki-dashboard-section-title">Clinical notes</h2>
          {canEdit ? (
            <form
              className="ki-form-stack"
              onSubmit={(event) => {
                event.preventDefault();
                if (!auth.token || !workspace || !noteBody.trim()) {
                  return;
                }
                setBusy(true);
                setActionError(null);
                void createClinicalNote(auth.token, encounterId, {
                  patientId: workspace.patientId,
                  clinicianId: workspace.leadClinicianId,
                  noteType: "progress",
                  body: noteBody.trim(),
                })
                  .then(() => {
                    setNoteBody("");
                    return notesQuery.refetch();
                  })
                  .catch((error: unknown) => {
                    setActionError(error instanceof Error ? error.message : "Note save failed");
                  })
                  .finally(() => setBusy(false));
              }}
            >
              <label className="ki-form-field">
                <span className="ki-dashboard-date-label">Progress note</span>
                <textarea className="ki-input" rows={4} value={noteBody} onChange={(e) => setNoteBody(e.target.value)} />
              </label>
              <button type="submit" className="ki-btn ki-btn-primary" disabled={busy}>
                Save note
              </button>
            </form>
          ) : null}
          {notesQuery.isLoading ? <LoadingState label="Loading notes…" /> : null}
          {notesQuery.isSuccess && (notesQuery.data.notes ?? []).length === 0 ? (
            <EmptyState title="No notes yet" description="Add a progress note for this encounter." />
          ) : null}
          {notesQuery.isSuccess && (notesQuery.data.notes ?? []).length > 0 ? (
            <table className="ki-dashboard-table ki-patient-table">
              <thead>
                <tr>
                  <th scope="col">Type</th>
                  <th scope="col">Body</th>
                  <th scope="col">Signed</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {notesQuery.data.notes.map((note) => {
                  const signed = note.signedAt ?? note.signed_at;
                  const noteType = note.noteType ?? note.note_type ?? "note";
                  return (
                    <tr key={note.id}>
                      <td>{noteType}</td>
                      <td>{note.body}</td>
                      <td>{signed ? "Yes" : "No"}</td>
                      <td>
                        {!signed && canEdit ? (
                          <button
                            type="button"
                            className="ki-btn ki-btn-sm"
                            disabled={busy}
                            onClick={() => {
                              if (!auth.token) return;
                              setBusy(true);
                              void signClinicalNote(auth.token, note.id)
                                .then(() => notesQuery.refetch())
                                .catch((error: unknown) =>
                                  setActionError(error instanceof Error ? error.message : "Sign failed"),
                                )
                                .finally(() => setBusy(false));
                            }}
                          >
                            Sign
                          </button>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : null}
        </section>
      ) : null}

      {tab === "odontogram" && workspace ? (
        <section className="ki-dashboard-section">
          <h2 className="ki-dashboard-section-title">Odontogram findings</h2>
          {canEdit ? (
            <form
              className="ki-scheduler-filters"
              onSubmit={(event) => {
                event.preventDefault();
                if (!auth.token) return;
                setBusy(true);
                setActionError(null);
                void createOdontogramFinding(auth.token, encounterId, {
                  patientId: workspace.patientId,
                  toothCode,
                  findingCode,
                })
                  .then(() => {
                    void odontogramQuery.refetch();
                    return invalidateWorkspace();
                  })
                  .catch((error: unknown) =>
                    setActionError(error instanceof Error ? error.message : "Finding save failed"),
                  )
                  .finally(() => setBusy(false));
              }}
            >
              <label className="ki-scheduler-filter">
                <span className="ki-dashboard-date-label">Tooth</span>
                <input className="ki-input" value={toothCode} onChange={(e) => setToothCode(e.target.value)} />
              </label>
              <label className="ki-scheduler-filter">
                <span className="ki-dashboard-date-label">Finding code</span>
                <input className="ki-input" value={findingCode} onChange={(e) => setFindingCode(e.target.value)} />
              </label>
              <button type="submit" className="ki-btn ki-btn-primary" disabled={busy}>
                Add finding
              </button>
            </form>
          ) : null}
          {odontogramQuery.isLoading ? <LoadingState label="Loading findings…" /> : null}
          {odontogramQuery.isSuccess && (odontogramQuery.data.findings ?? []).length === 0 ? (
            <EmptyState title="No findings" description="Record odontogram findings for this encounter." />
          ) : null}
          {odontogramQuery.isSuccess && (odontogramQuery.data.findings ?? []).length > 0 ? (
            <table className="ki-dashboard-table ki-patient-table">
              <thead>
                <tr>
                  <th scope="col">Tooth</th>
                  <th scope="col">Finding</th>
                  <th scope="col">Notes</th>
                </tr>
              </thead>
              <tbody>
                {odontogramQuery.data.findings.map((row) => (
                  <tr key={row.id}>
                    <td>{row.toothCode ?? row.tooth_code}</td>
                    <td>{row.findingCode ?? row.finding_code}</td>
                    <td>{row.notes ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </section>
      ) : null}

      {tab === "care-plan" && workspace ? (
        <section className="ki-dashboard-section">
          <h2 className="ki-dashboard-section-title">Care plan</h2>
          {canPlan ? (
            <div className="ki-form-stack">
              <div className="ki-scheduler-filters">
                <button
                  type="button"
                  className="ki-btn ki-btn-primary"
                  disabled={busy}
                  onClick={() => {
                    if (!auth.token) return;
                    setBusy(true);
                    setActionError(null);
                    void createCarePlan(auth.token, { patientId: workspace.patientId })
                      .then((result) => setCarePlanId(result.id))
                      .catch((error: unknown) =>
                        setActionError(error instanceof Error ? error.message : "Care plan create failed"),
                      )
                      .finally(() => setBusy(false));
                  }}
                >
                  Create care plan
                </button>
                {carePlanId ? (
                  <>
                    <label className="ki-scheduler-filter">
                      <span className="ki-dashboard-date-label">Stage name</span>
                      <input className="ki-input" value={stageName} onChange={(e) => setStageName(e.target.value)} />
                    </label>
                    <button
                      type="button"
                      className="ki-btn"
                      disabled={busy}
                      onClick={() => {
                        if (!auth.token || !stageName.trim()) return;
                        setBusy(true);
                        void addCarePlanStage(auth.token, carePlanId, { phaseNo: 1, name: stageName.trim() })
                          .then(() => carePlanQuery.refetch())
                          .catch((error: unknown) =>
                            setActionError(error instanceof Error ? error.message : "Stage add failed"),
                          )
                          .finally(() => setBusy(false));
                      }}
                    >
                      Add stage
                    </button>
                    <button
                      type="button"
                      className="ki-btn"
                      disabled={busy}
                      onClick={() => {
                        if (!auth.token) return;
                        setBusy(true);
                        void proposeCarePlan(auth.token, carePlanId, workspace.leadClinicianId)
                          .then(() => carePlanQuery.refetch())
                          .catch((error: unknown) =>
                            setActionError(error instanceof Error ? error.message : "Propose failed"),
                          )
                          .finally(() => setBusy(false));
                      }}
                    >
                      Propose
                    </button>
                    <label className="ki-scheduler-filter">
                      <span className="ki-dashboard-date-label">Accepted total (minor)</span>
                      <input
                        className="ki-input"
                        type="number"
                        value={acceptedTotal}
                        onChange={(e) => setAcceptedTotal(Number(e.target.value))}
                      />
                    </label>
                    <button
                      type="button"
                      className="ki-btn"
                      disabled={busy}
                      onClick={() => {
                        if (!auth.token) return;
                        setBusy(true);
                        void acceptCarePlan(auth.token, carePlanId, {
                          method: "staff_confirmed",
                          acceptedTotal,
                        })
                          .then(() => carePlanQuery.refetch())
                          .catch((error: unknown) =>
                            setActionError(error instanceof Error ? error.message : "Accept failed"),
                          )
                          .finally(() => setBusy(false));
                      }}
                    >
                      Accept
                    </button>
                    {canPrint ? (
                      <button
                        type="button"
                        className="ki-btn"
                        disabled={busy}
                        onClick={() => {
                          if (!auth.token) return;
                          setBusy(true);
                          void createPrintSnapshot(auth.token, {
                            documentType: "care_plan",
                            sourceEntityType: "care_plan",
                            sourceEntityId: carePlanId,
                            templateGroupCode: "clinical",
                            templateKey: "care_plan_default",
                            templateVersion: 1,
                            layout: {},
                            payload: { carePlanId },
                          })
                            .catch((error: unknown) =>
                              setActionError(error instanceof Error ? error.message : "Print failed"),
                            )
                            .finally(() => setBusy(false));
                        }}
                      >
                        Print snapshot
                      </button>
                    ) : null}
                  </>
                ) : null}
              </div>
            </div>
          ) : null}
          {carePlanId && carePlanQuery.isLoading ? <LoadingState label="Loading care plan…" /> : null}
          {carePlanQuery.data ? (
            <p className="ki-dashboard-note">
              Plan {carePlanQuery.data.id.slice(0, 8)}… — status {carePlanQuery.data.status}
            </p>
          ) : (
            <p className="ki-dashboard-note">Create a care plan to propose and accept treatment for this patient.</p>
          )}
        </section>
      ) : null}

      {tab === "prescription" && workspace ? (
        <section className="ki-dashboard-section">
          <h2 className="ki-dashboard-section-title">Prescription</h2>
          {canRx ? (
            <div className="ki-form-stack">
              <button
                type="button"
                className="ki-btn ki-btn-primary"
                disabled={busy}
                onClick={() => {
                  if (!auth.token) return;
                  setBusy(true);
                  void createMedicationOrderDraft(auth.token, {
                    patientId: workspace.patientId,
                    encounterId,
                    clinicianStaffId: workspace.leadClinicianId,
                  })
                    .then((result) => setMedOrderId(result.id))
                    .catch((error: unknown) =>
                      setActionError(error instanceof Error ? error.message : "Order create failed"),
                    )
                    .finally(() => setBusy(false));
                }}
              >
                Create medication order draft
              </button>
              {medOrderId ? (
                <>
                  <label className="ki-scheduler-filter">
                    <span className="ki-dashboard-date-label">Search medication</span>
                    <input className="ki-input" value={medSearch} onChange={(e) => setMedSearch(e.target.value)} />
                  </label>
                  {(medSearchQuery.data?.medications ?? []).length > 0 ? (
                    <select className="ki-input" value={selectedMedId} onChange={(e) => setSelectedMedId(e.target.value)}>
                      <option value="">Select medication</option>
                      {medSearchQuery.data!.medications.map((med) => (
                        <option key={med.id} value={med.id}>
                          {med.genericName ?? med.generic_name ?? med.brandName ?? med.brand_name ?? med.id}
                        </option>
                      ))}
                    </select>
                  ) : null}
                  <button
                    type="button"
                    className="ki-btn"
                    disabled={busy}
                    onClick={() => {
                      if (!auth.token || !selectedMedId) return;
                      setBusy(true);
                      void saveMedicationOrder(auth.token, medOrderId, {
                        diagnoses: [{ diagnosisId: "00000000-0000-4000-8000-000000000001", sequenceNo: 1 }],
                        serviceLinks: [{ serviceId: "00000000-0000-4000-8000-000000000002", sequenceNo: 1 }],
                        lines: [
                          {
                            medicationId: selectedMedId,
                            takeText: "1 tab",
                            frequency: "BD",
                            durationValue: 5,
                            durationPeriod: "days",
                            sequenceNo: 1,
                          },
                        ],
                      })
                        .catch((error: unknown) =>
                          setActionError(error instanceof Error ? error.message : "Save order failed"),
                        )
                        .finally(() => setBusy(false));
                    }}
                  >
                    Save order line
                  </button>
                  <label className="ki-scheduler-filter">
                    <span className="ki-dashboard-date-label">Signing PIN</span>
                    <input
                      className="ki-input"
                      type="password"
                      value={signingPin}
                      onChange={(e) => setSigningPin(e.target.value)}
                    />
                  </label>
                  <button
                    type="button"
                    className="ki-btn ki-btn-primary"
                    disabled={busy || !signingPin}
                    onClick={() => {
                      if (!auth.token) return;
                      setBusy(true);
                      void signMedicationOrder(auth.token, medOrderId, {
                        clinicianStaffId: workspace.leadClinicianId,
                        signingPin,
                      })
                        .catch((error: unknown) =>
                          setActionError(error instanceof Error ? error.message : "Sign order failed"),
                        )
                        .finally(() => setBusy(false));
                    }}
                  >
                    Sign order
                  </button>
                </>
              ) : null}
              {medOrderId ? <p className="ki-dashboard-note">Draft order {medOrderId.slice(0, 8)}…</p> : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {tab === "files" && workspace ? (
        <section className="ki-dashboard-section">
          <h2 className="ki-dashboard-section-title">Files &amp; print</h2>
          {canUpload ? (
            <form
              className="ki-form-stack"
              onSubmit={(event) => {
                event.preventDefault();
                const input = (event.currentTarget.elements.namedItem("encounter-file") as HTMLInputElement | null);
                const file = input?.files?.[0];
                if (!auth.token || !file) return;
                setBusy(true);
                setActionError(null);
                const reader = new FileReader();
                reader.onload = () => {
                  const payload = typeof reader.result === "string" ? reader.result.split(",")[1] ?? "" : "";
                  void registerPatientFile(auth.token!, {
                    patientId: workspace.patientId,
                    encounterId,
                    storageKey: `encounter/${encounterId}/${file.name}`,
                    mimeType: file.type || "application/octet-stream",
                    byteSize: file.size,
                    payload,
                    caption: fileCaption || file.name,
                    category: "clinical",
                  })
                    .then(() => setFileCaption(""))
                    .catch((error: unknown) =>
                      setActionError(error instanceof Error ? error.message : "File upload failed"),
                    )
                    .finally(() => setBusy(false));
                };
                reader.readAsDataURL(file);
              }}
            >
              <label className="ki-form-field">
                <span className="ki-dashboard-date-label">Caption</span>
                <input className="ki-input" value={fileCaption} onChange={(e) => setFileCaption(e.target.value)} />
              </label>
              <label className="ki-form-field">
                <span className="ki-dashboard-date-label">File</span>
                <input className="ki-input" type="file" name="encounter-file" />
              </label>
              <button type="submit" className="ki-btn ki-btn-primary" disabled={busy}>
                Register file
              </button>
            </form>
          ) : (
            <p className="ki-dashboard-note">You do not have document upload permission.</p>
          )}
        </section>
      ) : null}
    </div>
  );
}
