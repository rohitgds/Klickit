export interface AuthSessionResponse {
  userId: string;
  organizationId: string;
  clinicId: string;
  membershipId: string;
  authzVersion: number;
  permissionCodes: string[];
}

export interface LoginResponse {
  token: string;
  expiresAt: string;
  session: AuthSessionResponse;
}

export interface ClinicConfigResponse {
  clinicCode: string;
  gatewayCode: string;
  softwareVersion: string;
  databaseConnected: boolean;
  databaseError?: string;
  clinic: {
    id: string;
    name: string;
    clinicCode: string;
    timezone: string;
  } | null;
  gateway: {
    id: string;
    gatewayCode: string;
    lastSuccessfulCloudSyncAt: string | null;
    readOnlyAt: string | null;
  } | null;
  offlinePolicy: {
    offlineHours: number;
    writeAllowed: boolean;
    readOnly: boolean;
  };
  cloudSyncUrl: string | null;
}

export interface ApiErrorBody {
  error?: string;
}

export interface OperationalDashboardSummary {
  date: string;
  bookingsScheduled: number;
  bookingsConfirmed: number;
  arrivalsExpected: number;
  queueWaiting: number;
  queueEngaged: number;
  noShowsToday: number;
  cancellationsToday: number;
  quickActions: readonly string[];
}

export interface PatientSearchHit {
  id: string;
  patientNo: string;
  displayName: string;
  cellPhone: string | null;
  homeClinicId: string;
  active: boolean;
}

export interface PatientRegisterRequest {
  firstName: string;
  middleName?: string;
  lastName?: string;
  cellPhone?: string;
  birthDate?: string;
}

export interface PatientRegisterResponse {
  id: string;
  patientNo: string;
  displayName: string;
}

export interface PatientProfileResponse {
  patient: Record<string, unknown> | null;
  allergies: Array<{ name: string }>;
  consents: Record<string, unknown>[];
  medicalResponses: Record<string, unknown>[];
}

export interface PatientSafetySummary {
  patientId: string;
  readOnly: boolean;
  allergies: readonly string[];
  lastClinicalNoteSummary: string | null;
  lastUpdatedClinicCode: string | null;
}

export interface CareBooking {
  id: string;
  careBookingNo: string | null;
  clinicId: string;
  patientId: string | null;
  patientKind: string | null;
  startsAt: string | null;
  endsAt: string | null;
  leadClinicianId: string;
  chairId: string;
  reasonId: string;
  status: string;
  comments: string | null;
  rowVersion: number;
}

export interface SchedulerViewResponse {
  view: string;
  anchorDate: string;
  range: { startsAt: string; endsAt: string };
  bookings: CareBooking[];
}

export interface SchedulingChair {
  id: string;
  clinicId: string;
  code: string | null;
  name: string | null;
  displayOrder: number;
  active: boolean;
}

export interface SchedulingReason {
  id: string;
  organizationId: string;
  name: string | null;
  defaultMinutes: number | null;
  colorHex: string | null;
  active: boolean;
}

export interface SchedulingMasters {
  chairs: SchedulingChair[];
  bookingReasons: SchedulingReason[];
  staffWorkingHours: Record<string, unknown>[];
  chairWorkingHours: Record<string, unknown>[];
  blackouts: Record<string, unknown>[];
}

export interface StaffMember {
  id: string;
  displayName: string;
  staffType: string | null;
  active: boolean;
}

export interface AvailabilityResponse {
  available: boolean;
  conflicts: CareBooking[];
  blackouts: Record<string, unknown>[];
}

export interface QueueEncounter {
  id: string;
  encounterNo: string | null;
  encounterDate: string;
  queueSequence: number;
  patientId: string;
  careBookingId: string | null;
  encounterType: string;
  leadClinicianId: string;
  chairId: string | null;
  reasonId: string;
  scheduledTime: string | null;
  status: string;
  arrivalAt: string | null;
  checkedInAt: string | null;
  engagedAt: string | null;
  checkedOutAt: string | null;
  rowVersion: number;
}

export interface ClinicalQueueResponse {
  date: string;
  encounters: QueueEncounter[];
  arrivalCandidates: CareBooking[];
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
