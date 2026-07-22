import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { ErrorState, FormField, LoadingState } from "@klickit/ui";
import {
  cancelBooking,
  confirmBooking,
  createBooking,
  fetchAvailability,
  fetchBookingHistory,
  markBookingNoShow,
  rescheduleBooking,
} from "../api/scheduling.js";
import { searchPatients } from "../api/patients.js";
import type { CareBooking, SchedulingMasters, StaffMember } from "../api/types.js";
import {
  bookingCreateSchema,
  buildBookingIsoRange,
  formatBookingDateTime,
  toBookingCreatePayload,
  type BookingCreateFormValues,
} from "../config/scheduling.js";
import { useAuth } from "../auth/AuthContext.js";

export function BookingEditorPanel(props: {
  open: boolean;
  onClose: () => void;
  masters: SchedulingMasters | undefined;
  staff: StaffMember[];
  defaultDate: string;
  booking?: CareBooking | null;
  onSaved: () => void;
}) {
  const auth = useAuth();
  const isEdit = Boolean(props.booking);
  const canCreate = auth.hasPermission("scheduler.create");
  const canEdit = auth.hasPermission("scheduler.edit");
  const canCancel = auth.hasPermission("scheduler.cancel");

  const defaultReason = props.masters?.bookingReasons.find((reason) => reason.active)?.id ?? "";
  const defaultClinician = props.staff.find((member) => member.staffType === "clinician")?.id ?? "";
  const defaultChair = props.masters?.chairs.find((chair) => chair.active)?.id ?? "";

  const form = useForm<BookingCreateFormValues>({
    resolver: zodResolver(bookingCreateSchema),
    defaultValues: {
      patientMode: "quick",
      bookingDate: props.defaultDate,
      startTime: "10:00",
      durationMinutes: 30,
      leadClinicianId: defaultClinician,
      chairId: defaultChair,
      reasonId: defaultReason,
      comments: "",
    },
  });

  const [patientQuery, setPatientQuery] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!props.open) {
      return;
    }
    if (props.booking) {
      const startsAt = props.booking.startsAt ? new Date(props.booking.startsAt) : null;
      form.reset({
        patientMode: props.booking.patientId ? "registered" : "quick",
        patientId: props.booking.patientId ?? undefined,
        bookingDate: startsAt ? startsAt.toISOString().slice(0, 10) : props.defaultDate,
        startTime: startsAt
          ? `${String(startsAt.getHours()).padStart(2, "0")}:${String(startsAt.getMinutes()).padStart(2, "0")}`
          : "10:00",
        durationMinutes:
          props.booking.startsAt && props.booking.endsAt
            ? Math.max(
                5,
                Math.round(
                  (new Date(props.booking.endsAt).getTime() - new Date(props.booking.startsAt).getTime()) / 60_000,
                ),
              )
            : 30,
        leadClinicianId: props.booking.leadClinicianId,
        chairId: props.booking.chairId,
        reasonId: props.booking.reasonId,
        comments: props.booking.comments ?? "",
      });
      return;
    }
    form.reset({
      patientMode: "quick",
      bookingDate: props.defaultDate,
      startTime: "10:00",
      durationMinutes: 30,
      leadClinicianId: defaultClinician,
      chairId: defaultChair,
      reasonId: defaultReason,
      comments: "",
      firstNameSnapshot: "",
      lastNameSnapshot: "",
      cellPhoneSnapshot: "",
    });
  }, [props.open, props.booking, props.defaultDate, defaultChair, defaultClinician, defaultReason, form]);

  const patientMode = form.watch("patientMode");
  const watched = form.watch(["bookingDate", "startTime", "durationMinutes", "chairId", "leadClinicianId"]);

  const patientSearch = useQuery({
    queryKey: ["patients", "booking-search", patientQuery, auth.token],
    queryFn: () => searchPatients(auth.token!, { q: patientQuery, limit: 10 }),
    enabled: Boolean(auth.token && patientMode === "registered" && patientQuery.trim().length >= 2),
  });

  const availabilityQuery = useQuery({
    queryKey: ["scheduling", "availability", watched, auth.token],
    queryFn: () => {
      const [bookingDate, startTime, durationMinutes, chairId, leadClinicianId] = watched;
      const range = buildBookingIsoRange(bookingDate, startTime, Number(durationMinutes));
      return fetchAvailability(auth.token!, {
        startsAt: range.startsAt,
        endsAt: range.endsAt,
        chairId,
        leadClinicianId,
      });
    },
    enabled: Boolean(auth.token && props.open && !isEdit),
  });

  const historyQuery = useQuery({
    queryKey: ["scheduling", "history", props.booking?.id, auth.token],
    queryFn: () => fetchBookingHistory(auth.token!, props.booking!.id),
    enabled: Boolean(auth.token && props.open && props.booking?.id),
  });

  const clinicians = useMemo(
    () => props.staff.filter((member) => member.staffType === "clinician"),
    [props.staff],
  );

  if (!props.open) {
    return null;
  }

  async function onCreate(values: BookingCreateFormValues) {
    if (!auth.token || !canCreate) {
      return;
    }
    setBusy(true);
    setSubmitError(null);
    try {
      if (values.patientMode === "registered" && !values.patientId) {
        throw new Error("Select a registered patient or switch to quick registration.");
      }
      if (values.patientMode === "quick" && !values.firstNameSnapshot?.trim()) {
        throw new Error("Given name is required for quick registration.");
      }
      await createBooking(auth.token, toBookingCreatePayload(values));
      props.onSaved();
      props.onClose();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Booking failed");
    } finally {
      setBusy(false);
    }
  }

  async function onReschedule(values: BookingCreateFormValues) {
    if (!auth.token || !canEdit || !props.booking) {
      return;
    }
    setBusy(true);
    setSubmitError(null);
    try {
      const range = buildBookingIsoRange(values.bookingDate, values.startTime, values.durationMinutes);
      await rescheduleBooking(auth.token, props.booking.id, {
        startsAt: range.startsAt,
        endsAt: range.endsAt,
        leadClinicianId: values.leadClinicianId,
        chairId: values.chairId,
        resetConfirmation: true,
      });
      props.onSaved();
      props.onClose();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Reschedule failed");
    } finally {
      setBusy(false);
    }
  }

  async function runTransition(action: "confirm" | "cancel" | "no-show") {
    if (!auth.token || !props.booking) {
      return;
    }
    setBusy(true);
    setSubmitError(null);
    try {
      if (action === "confirm") {
        await confirmBooking(auth.token, props.booking.id);
      } else if (action === "cancel") {
        await cancelBooking(auth.token, props.booking.id, "OWNER_CANCELLED");
      } else {
        await markBookingNoShow(auth.token, props.booking.id, "OWNER_MARKED_NO_SHOW");
      }
      props.onSaved();
      props.onClose();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Transition failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ki-modal-backdrop" role="presentation" onClick={props.onClose}>
      <div className="ki-modal ki-booking-editor" role="dialog" aria-labelledby="booking-editor-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="booking-editor-title" className="ki-modal-title">
          {isEdit ? "Booking details" : "Create booking"}
        </h2>

        {isEdit && props.booking ? (
          <p className="ki-dashboard-note">
            Status: <strong>{props.booking.status}</strong> · {formatBookingDateTime(props.booking.startsAt)} to{" "}
            {formatBookingDateTime(props.booking.endsAt)}
          </p>
        ) : null}

        <form
          className="ki-patient-form"
          onSubmit={form.handleSubmit(isEdit ? onReschedule : onCreate)}
        >
          {!isEdit ? (
            <div className="ki-patient-form-grid ki-booking-mode-row">
              <FormField label="Patient mode" htmlFor="booking-patient-mode">
                <select id="booking-patient-mode" className="ki-input" {...form.register("patientMode")}>
                  <option value="quick">Quick registration</option>
                  <option value="registered">Registered patient</option>
                </select>
              </FormField>
            </div>
          ) : null}

          {patientMode === "registered" && !isEdit ? (
            <div className="ki-booking-patient-search">
              <FormField label="Patient lookup" htmlFor="booking-patient-search">
                <input
                  id="booking-patient-search"
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
          ) : null}

          {patientMode === "quick" && !isEdit ? (
            <div className="ki-patient-form-grid">
              <FormField label="Given name" htmlFor="booking-first-name">
                <input id="booking-first-name" className="ki-input" {...form.register("firstNameSnapshot")} />
              </FormField>
              <FormField label="Family name" htmlFor="booking-last-name">
                <input id="booking-last-name" className="ki-input" {...form.register("lastNameSnapshot")} />
              </FormField>
              <FormField label="Mobile" htmlFor="booking-mobile">
                <input id="booking-mobile" className="ki-input" {...form.register("cellPhoneSnapshot")} />
              </FormField>
            </div>
          ) : null}

          <div className="ki-patient-form-grid">
            <FormField label="Booking date" htmlFor="booking-date" error={form.formState.errors.bookingDate?.message}>
              <input id="booking-date" className="ki-input" type="date" {...form.register("bookingDate")} />
            </FormField>
            <FormField label="Start time" htmlFor="booking-start" error={form.formState.errors.startTime?.message}>
              <input id="booking-start" className="ki-input" type="time" {...form.register("startTime")} />
            </FormField>
            <FormField label="Duration (min)" htmlFor="booking-duration" error={form.formState.errors.durationMinutes?.message}>
              <input
                id="booking-duration"
                className="ki-input"
                type="number"
                min={5}
                step={5}
                {...form.register("durationMinutes", { valueAsNumber: true })}
              />
            </FormField>
            <FormField label="Reason" htmlFor="booking-reason" error={form.formState.errors.reasonId?.message}>
              <select id="booking-reason" className="ki-input" {...form.register("reasonId")}>
                {(props.masters?.bookingReasons ?? []).map((reason) => (
                  <option key={reason.id} value={reason.id}>
                    {reason.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Lead clinician" htmlFor="booking-clinician" error={form.formState.errors.leadClinicianId?.message}>
              <select id="booking-clinician" className="ki-input" {...form.register("leadClinicianId")}>
                {clinicians.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.displayName}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Chair" htmlFor="booking-chair" error={form.formState.errors.chairId?.message}>
              <select id="booking-chair" className="ki-input" {...form.register("chairId")}>
                {(props.masters?.chairs ?? []).map((chair) => (
                  <option key={chair.id} value={chair.id}>
                    {chair.name ?? chair.code}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          <FormField label="Comments" htmlFor="booking-comments">
            <input id="booking-comments" className="ki-input" {...form.register("comments")} />
          </FormField>

          {!isEdit && availabilityQuery.data ? (
            <p className={`ki-dashboard-note ${availabilityQuery.data.available ? "ki-available-ok" : "ki-available-blocked"}`}>
              {availabilityQuery.data.available
                ? "Selected slot appears available."
                : `Conflict detected (${availabilityQuery.data.conflicts.length} booking(s), ${availabilityQuery.data.blackouts.length} blackout(s)).`}
            </p>
          ) : null}

          {submitError ? <ErrorState title="Booking error" message={submitError} /> : null}

          <div className="ki-patient-form-actions">
            {!isEdit && canCreate ? (
              <button type="submit" className="ki-btn ki-btn-primary" disabled={busy}>
                {busy ? "Saving…" : "Save booking"}
              </button>
            ) : null}
            {isEdit && canEdit ? (
              <button type="submit" className="ki-btn ki-btn-primary" disabled={busy}>
                {busy ? "Saving…" : "Reschedule"}
              </button>
            ) : null}
            {isEdit && canEdit && props.booking?.status === "scheduled" ? (
              <button type="button" className="ki-btn" disabled={busy} onClick={() => void runTransition("confirm")}>
                Confirm
              </button>
            ) : null}
            {isEdit && canCancel ? (
              <button type="button" className="ki-btn" disabled={busy} onClick={() => void runTransition("cancel")}>
                Cancel
              </button>
            ) : null}
            {isEdit && canEdit ? (
              <button type="button" className="ki-btn" disabled={busy} onClick={() => void runTransition("no-show")}>
                No-show
              </button>
            ) : null}
            <button type="button" className="ki-btn" onClick={props.onClose}>
              Close
            </button>
          </div>
        </form>

        {isEdit && historyQuery.data?.history.length ? (
          <section className="ki-dashboard-section" aria-label="Booking history">
            <h3 className="ki-dashboard-section-title">Status history</h3>
            <table className="ki-dashboard-table ki-patient-table">
              <thead>
                <tr>
                  <th scope="col">From</th>
                  <th scope="col">To</th>
                  <th scope="col">Reason</th>
                </tr>
              </thead>
              <tbody>
                {historyQuery.data.history.map((entry, index) => (
                  <tr key={String(entry.id ?? index)}>
                    <td>{String(entry.from_status ?? "—")}</td>
                    <td>{String(entry.to_status ?? "—")}</td>
                    <td>{String(entry.reason ?? "—")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}
      </div>
    </div>
  );
}
