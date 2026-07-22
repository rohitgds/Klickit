import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { scoreDuplicateCandidate } from "@klickit/patients";
import { ErrorState, FormField, LoadingState, PermissionGuard } from "@klickit/ui";
import { queueDuplicateReview, registerPatient, searchPatients } from "../api/patients.js";
import { DuplicateReviewDialog } from "../components/DuplicateReviewDialog.js";
import { useAuth } from "../auth/AuthContext.js";
import {
  patientRegisterSchema,
  rankDuplicateCandidates,
  type PatientRegisterFormValues,
} from "../config/patients.js";

export function PatientRegisterPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const canCreate = auth.hasPermission("patient.create");
  const canMerge = auth.hasPermission("patient.merge");

  const form = useForm<PatientRegisterFormValues>({
    resolver: zodResolver(patientRegisterSchema),
    defaultValues: {
      firstName: "",
      middleName: "",
      lastName: "",
      cellPhone: "",
      birthDate: "",
    },
  });

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [duplicateCandidates, setDuplicateCandidates] = useState<
    ReturnType<typeof rankDuplicateCandidates>
  >([]);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [createdPatientId, setCreatedPatientId] = useState<string | null>(null);
  const [duplicateBusy, setDuplicateBusy] = useState(false);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const [pendingValues, setPendingValues] = useState<PatientRegisterFormValues | null>(null);

  const watched = form.watch(["firstName", "lastName", "cellPhone", "birthDate"]);

  useEffect(() => {
    let cancelled = false;
    async function checkDuplicates() {
      const [firstName, lastName, cellPhone, birthDate] = watched;
      if (!auth.token || !firstName.trim() || (!cellPhone?.trim() && !lastName?.trim())) {
        setDuplicateCandidates([]);
        return;
      }
      const searchTerm = cellPhone?.trim() || `${firstName} ${lastName ?? ""}`.trim();
      try {
        const result = await searchPatients(auth.token, { q: searchTerm, limit: 10, offset: 0 });
        if (cancelled) {
          return;
        }
        const ranked = rankDuplicateCandidates(
          result.patients,
          {
            firstName,
            lastName,
            cellPhone,
            birthDate,
          },
          scoreDuplicateCandidate,
        );
        setDuplicateCandidates(ranked);
      } catch {
        if (!cancelled) {
          setDuplicateCandidates([]);
        }
      }
    }
    const timer = window.setTimeout(() => {
      void checkDuplicates();
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [auth.token, watched]);

  const duplicateBanner = useMemo(() => {
    if (!duplicateCandidates.length) {
      return null;
    }
    return `${duplicateCandidates.length} possible duplicate${duplicateCandidates.length === 1 ? "" : "s"} found.`;
  }, [duplicateCandidates]);

  if (!canCreate) {
    return (
      <PermissionGuard allowed={false} permissionCode="patient.create">
        <span />
      </PermissionGuard>
    );
  }

  async function savePatient(values: PatientRegisterFormValues, keepDialogOpen = false) {
    if (!auth.token) {
      return;
    }
    setSubmitError(null);
    setSubmitting(true);
    try {
      const created = await registerPatient(auth.token, {
        firstName: values.firstName.trim(),
        middleName: values.middleName?.trim() || undefined,
        lastName: values.lastName?.trim() || undefined,
        cellPhone: values.cellPhone?.trim() || undefined,
        birthDate: values.birthDate || undefined,
      });
      setCreatedPatientId(created.id);
      if (duplicateCandidates.length > 0 && canMerge && keepDialogOpen) {
        setDuplicateDialogOpen(true);
        setPendingValues(null);
        return;
      }
      navigate(`/patient-registry/${created.id}`);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Registration failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function onSubmit(values: PatientRegisterFormValues) {
    if (duplicateCandidates.length > 0 && !createdPatientId) {
      setPendingValues(values);
      setDuplicateDialogOpen(true);
      return;
    }
    await savePatient(values);
  }

  async function handleQueueReview(candidateId: string) {
    if (!auth.token || !createdPatientId) {
      setDuplicateError("Save the patient before queueing duplicate review.");
      return;
    }
    setDuplicateBusy(true);
    setDuplicateError(null);
    try {
      await queueDuplicateReview(auth.token, {
        patientIdA: createdPatientId,
        patientIdB: candidateId,
      });
      setDuplicateDialogOpen(false);
      navigate(`/patient-registry/${createdPatientId}`);
    } catch (error) {
      setDuplicateError(error instanceof Error ? error.message : "Could not queue duplicate review.");
    } finally {
      setDuplicateBusy(false);
    }
  }

  return (
    <div className="ki-patient-register">
      <div className="ki-dashboard-toolbar">
        <Link to="/patient-registry" className="ki-btn">
          Back to registry
        </Link>
      </div>

      <form className="ki-patient-form" onSubmit={form.handleSubmit(onSubmit)}>
        <div className="ki-patient-form-grid">
          <FormField label="Mobile number" htmlFor="patient-cell-phone" error={form.formState.errors.cellPhone?.message}>
            <input id="patient-cell-phone" className="ki-input" type="tel" {...form.register("cellPhone")} />
          </FormField>
          <FormField label="Given name" htmlFor="patient-first-name" error={form.formState.errors.firstName?.message}>
            <input id="patient-first-name" className="ki-input" {...form.register("firstName")} />
          </FormField>
          <FormField label="Family name" htmlFor="patient-last-name" error={form.formState.errors.lastName?.message}>
            <input id="patient-last-name" className="ki-input" {...form.register("lastName")} />
          </FormField>
          <FormField label="Birth date" htmlFor="patient-birth-date" error={form.formState.errors.birthDate?.message}>
            <input id="patient-birth-date" className="ki-input" type="date" {...form.register("birthDate")} />
          </FormField>
        </div>

        <p className="ki-dashboard-note">
          Patient ID is assigned automatically. Intent tier and extended profile fields will be added in a
          later module.
        </p>

        {duplicateBanner ? (
          <div className="ki-patient-duplicate-banner" role="status">
            {duplicateBanner}{" "}
            <button type="button" className="ki-btn" onClick={() => setDuplicateDialogOpen(true)}>
              Review duplicates
            </button>
          </div>
        ) : null}

        {submitError ? <ErrorState title="Registration failed" message={submitError} /> : null}

        <div className="ki-patient-form-actions">
          <button type="submit" className="ki-btn ki-btn-primary" disabled={submitting}>
            {submitting ? "Saving…" : "Save profile"}
          </button>
          <Link to="/patient-registry" className="ki-btn">
            Discard
          </Link>
        </div>
      </form>

      {submitting ? <LoadingState label="Saving patient profile…" /> : null}

      <DuplicateReviewDialog
        open={duplicateDialogOpen}
        candidates={duplicateCandidates}
        onClose={() => {
          setDuplicateDialogOpen(false);
          if (createdPatientId) {
            navigate(`/patient-registry/${createdPatientId}`);
          }
        }}
        onSaveAnyway={
          pendingValues
            ? () => {
                void savePatient(pendingValues, true);
              }
            : undefined
        }
        onQueueReview={(candidateId) => {
          void handleQueueReview(candidateId);
        }}
        canMerge={canMerge}
        canQueueReview={Boolean(createdPatientId)}
        busy={duplicateBusy || submitting}
        error={duplicateError}
      />
    </div>
  );
}
