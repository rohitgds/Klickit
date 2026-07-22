import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { ErrorState, FormField, LoadingState } from "@klickit/ui";
import { admitUnscheduledEncounter } from "../api/clinicalQueue.js";
import { searchPatients } from "../api/patients.js";
import type { SchedulingMasters, StaffMember } from "../api/types.js";
import { unscheduledEncounterSchema, type UnscheduledEncounterFormValues } from "../config/clinicalQueue.js";
import { useAuth } from "../auth/AuthContext.js";

export function UnscheduledEncounterPanel(props: {
  open: boolean;
  onClose: () => void;
  encounterDate: string;
  masters: SchedulingMasters | undefined;
  staff: StaffMember[];
  onSaved: () => void;
}) {
  const auth = useAuth();
  const canAdmit = auth.hasPermission("queue.admit");

  const defaultClinician = props.staff.find((member) => member.staffType === "clinician")?.id ?? "";
  const defaultReason = props.masters?.bookingReasons.find((reason) => reason.active)?.id ?? "";
  const defaultChair = props.masters?.chairs.find((chair) => chair.active)?.id ?? "";

  const form = useForm<UnscheduledEncounterFormValues>({
    resolver: zodResolver(unscheduledEncounterSchema),
    defaultValues: {
      patientId: "",
      leadClinicianId: defaultClinician,
      reasonId: defaultReason,
      encounterDate: props.encounterDate,
      chairId: defaultChair,
      scheduledTime: "",
    },
  });

  const [patientQuery, setPatientQuery] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!props.open) {
      return;
    }
    form.reset({
      patientId: "",
      leadClinicianId: defaultClinician,
      reasonId: defaultReason,
      encounterDate: props.encounterDate,
      chairId: defaultChair,
      scheduledTime: "",
    });
    setPatientQuery("");
    setSubmitError(null);
  }, [props.open, props.encounterDate, defaultChair, defaultClinician, defaultReason, form]);

  const patientSearch = useQuery({
    queryKey: ["patients", "queue-admit-search", patientQuery, auth.token],
    queryFn: () => searchPatients(auth.token!, { q: patientQuery, limit: 10 }),
    enabled: Boolean(auth.token && props.open && patientQuery.trim().length >= 2),
  });

  if (!props.open) {
    return null;
  }

  async function onSubmit(values: UnscheduledEncounterFormValues) {
    if (!auth.token || !canAdmit) {
      return;
    }
    setBusy(true);
    setSubmitError(null);
    try {
      await admitUnscheduledEncounter(auth.token, {
        ...values,
        chairId: values.chairId || undefined,
        scheduledTime: values.scheduledTime || undefined,
      });
      props.onSaved();
      props.onClose();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Could not admit encounter");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ki-modal-backdrop" role="presentation" onClick={props.onClose}>
      <div
        className="ki-modal ki-booking-editor"
        role="dialog"
        aria-labelledby="unscheduled-encounter-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="unscheduled-encounter-title" className="ki-modal-title">
          Add unscheduled encounter
        </h2>

        <form className="ki-patient-form" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="ki-booking-patient-search">
            <FormField label="Patient lookup" htmlFor="queue-patient-search">
              <input
                id="queue-patient-search"
                className="ki-input"
                value={patientQuery}
                onChange={(event) => setPatientQuery(event.target.value)}
                placeholder="Name, ID or mobile"
              />
            </FormField>
            {patientSearch.isLoading ? <LoadingState label="Searching patients…" /> : null}
            {patientSearch.data?.patients.length ? (
              <div className="ki-booking-patient-options">
                {patientSearch.data.patients.map((patient) => (
                  <button
                    key={patient.id}
                    type="button"
                    className={`ki-btn ${form.watch("patientId") === patient.id ? "ki-tab-active" : ""}`}
                    onClick={() => form.setValue("patientId", patient.id)}
                  >
                    {patient.displayName} ({patient.patientNo})
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="ki-patient-form-grid">
            <FormField label="Operational date" htmlFor="queue-encounter-date" error={form.formState.errors.encounterDate?.message}>
              <input id="queue-encounter-date" className="ki-input" type="date" {...form.register("encounterDate")} />
            </FormField>
            <FormField label="Lead clinician" htmlFor="queue-clinician" error={form.formState.errors.leadClinicianId?.message}>
              <select id="queue-clinician" className="ki-input" {...form.register("leadClinicianId")}>
                {props.staff
                  .filter((member) => member.staffType === "clinician")
                  .map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.displayName}
                    </option>
                  ))}
              </select>
            </FormField>
            <FormField label="Reason" htmlFor="queue-reason" error={form.formState.errors.reasonId?.message}>
              <select id="queue-reason" className="ki-input" {...form.register("reasonId")}>
                {(props.masters?.bookingReasons ?? []).map((reason) => (
                  <option key={reason.id} value={reason.id}>
                    {reason.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Chair" htmlFor="queue-chair">
              <select id="queue-chair" className="ki-input" {...form.register("chairId")}>
                <option value="">Unassigned</option>
                {(props.masters?.chairs ?? []).map((chair) => (
                  <option key={chair.id} value={chair.id}>
                    {chair.name ?? chair.code}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          {submitError ? <ErrorState title="Admit failed" message={submitError} /> : null}

          <div className="ki-patient-form-actions">
            <button type="submit" className="ki-btn ki-btn-primary" disabled={busy || !canAdmit}>
              {busy ? "Admitting…" : "Admit to queue"}
            </button>
            <button type="button" className="ki-btn" onClick={props.onClose}>
              Discard
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
