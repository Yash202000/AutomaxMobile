import apiClient from "./client";

// National ID login through Nafath (same backend flow as the web client):
// start sends a Nafath request, status is polled until the person approves it
// in the Nafath app (a new number is issued every few seconds while waiting),
// cancel forgets the request.

export interface NafathPending {
  status: "waiting";
  challenge_id: string;
  random: string;
  rotate_in: number;
  expires_in: number;
  poll_interval: number;
}

export interface NafathApproved {
  status: "approved";
  user: any;
  token: string;
  refresh_token?: string;
  expires_in?: number;
}

export type NafathStatus = NafathPending | NafathApproved;

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  error_code?: string;
}

// error_code values the backend returns for Nafath login.
export const NAFATH_ERROR = {
  disabled: "nafath_disabled",
  rateLimited: "rate_limited",
  invalidId: "nafath_invalid_id",
  notRegistered: "nafath_user_not_registered",
  restart: "nafath_restart",
  timeout: "nafath_timeout",
  rejected: "nafath_rejected",
  refused: "nafath_refused",
  identityMismatch: "nafath_identity_mismatch",
  unavailable: "nafath_unavailable",
} as const;

// National ID / Iqama: exactly 10 digits.
export const NATIONAL_ID_LENGTH = 10;
export const isValidNationalId = (id: string) =>
  new RegExp(`^\\d{${NATIONAL_ID_LENGTH}}$`).test(id);

export const nafathApi = {
  start: async (nationalId: string): Promise<ApiResponse<NafathPending>> => {
    const response = await apiClient.post<ApiResponse<NafathPending>>(
      "/auth/nafath/start",
      { national_id: nationalId },
    );
    return response.data;
  },

  status: async (challengeId: string): Promise<ApiResponse<NafathStatus>> => {
    const response = await apiClient.post<ApiResponse<NafathStatus>>(
      "/auth/nafath/status",
      { challenge_id: challengeId },
    );
    return response.data;
  },

  cancel: async (challengeId: string): Promise<void> => {
    await apiClient.post("/auth/nafath/cancel", { challenge_id: challengeId });
  },
};

// Pulls the backend's error_code / message out of an axios error.
export const nafathErrorOf = (
  err: any,
): { code?: string; message?: string; network: boolean } => {
  const data = err?.response?.data;
  return {
    code: data?.error_code,
    message: typeof data?.error === "string" ? data.error : undefined,
    network: !err?.response,
  };
};
