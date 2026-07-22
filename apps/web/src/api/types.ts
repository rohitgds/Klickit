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

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
