import type { DuplicateCandidate } from "../config/patients.js";

export function DuplicateReviewDialog(props: {
  open: boolean;
  candidates: DuplicateCandidate[];
  onClose: () => void;
  onSaveAnyway?: () => void;
  onQueueReview: (candidateId: string) => void;
  canMerge: boolean;
  canQueueReview: boolean;
  busy?: boolean;
  error?: string | null;
}) {
  if (!props.open) {
    return null;
  }

  return (
    <div className="ki-modal-backdrop" role="presentation" onClick={props.onClose}>
      <div
        className="ki-modal"
        role="dialog"
        aria-labelledby="duplicate-review-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="duplicate-review-title" className="ki-modal-title">
          Possible duplicate patients
        </h2>
        <p className="ki-modal-text">
          Review these matches before saving. Queue a duplicate review only when you believe two records
          represent the same person.
        </p>
        {props.error ? <p className="ki-error-text">{props.error}</p> : null}
        <table className="ki-dashboard-table ki-patient-table">
          <thead>
            <tr>
              <th scope="col">Patient ID</th>
              <th scope="col">Name</th>
              <th scope="col">Mobile</th>
              <th scope="col">Score</th>
              <th scope="col">Signals</th>
              <th scope="col">Action</th>
            </tr>
          </thead>
          <tbody>
            {props.candidates.map((candidate) => (
              <tr key={candidate.patient.id}>
                <td>{candidate.patient.patientNo}</td>
                <td>{candidate.patient.displayName}</td>
                <td>{candidate.patient.cellPhone ?? "—"}</td>
                <td>{candidate.score}</td>
                <td>{candidate.signals.join(", ") || "—"}</td>
                <td>
                  {props.canQueueReview && props.canMerge ? (
                    <button
                      type="button"
                      className="ki-btn"
                      disabled={props.busy}
                      onClick={() => props.onQueueReview(candidate.patient.id)}
                    >
                      Queue review
                    </button>
                  ) : (
                    <span className="ki-muted-text">
                      {props.canMerge ? "Save patient first" : "No merge permission"}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="ki-modal-actions">
          {props.onSaveAnyway ? (
            <button type="button" className="ki-btn ki-btn-primary" disabled={props.busy} onClick={props.onSaveAnyway}>
              Save anyway
            </button>
          ) : null}
          <button type="button" className="ki-btn" onClick={props.onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
