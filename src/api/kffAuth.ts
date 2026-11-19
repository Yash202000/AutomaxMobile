import apiClient from './client';

// KFF Dispatcher passcode login APIs (isKffPasscodeLogin() only).
//
// Live:    verifyKffCredentials  -> existing Automax POST /auth/login
// Pending: getKffUnitUsers, registerKffPasscode, kffPasscodeLogin
//          Backend endpoints not shared yet. Each returns
//          { success: false, notAvailable: true } until wired up. When adding
//          them: unauthenticated endpoints must also be listed in
//          `publicEndpoints` in ./client.ts, or the request interceptor
//          rejects them for having no stored token.

export interface KffUnitUser {
  id: string;
  name: string;
}

export type KffApiResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; notAvailable?: boolean };

export interface KffTokens {
  token: string;
  refreshToken?: string;
}

const notAvailable = (what: string): { success: false; error: string; notAvailable: true } => ({
  success: false,
  error: `${what} API is not available yet`,
  notAvailable: true,
});

const errorMessage = (error: any): string =>
  error?.response?.data?.error || error?.response?.data?.message || error?.message || 'Request failed';

/**
 * Users registered on a unit (the admin's Device ID), shown as the profile
 * cards on the login screen.
 * TODO(KFF): call the backend once the endpoint is shared.
 */
export const getKffUnitUsers = async (_deviceId: string): Promise<KffApiResult<KffUnitUser[]>> =>
  notAvailable('Unit users');

/**
 * Register step 1: checks username + password with the normal Automax login.
 * The returned token authorises step 2 (creating the passcode) only. It is
 * NOT stored, so the user is not signed in by registering.
 */
export const verifyKffCredentials = async (
  username: string,
  password: string,
): Promise<KffApiResult<KffTokens>> => {
  try {
    const response = await apiClient.post('/auth/login', {
      email: username,
      password,
      type: 'employee',
    });
    const data = response.data?.data;
    if (response.data?.success && data?.token) {
      return { success: true, data: { token: data.token, refreshToken: data.refresh_token } };
    }
    // No token back means the account needs 2FA, which this flow doesn't support.
    return { success: false, error: response.data?.message || 'Invalid response from server' };
  } catch (error: any) {
    return { success: false, error: errorMessage(error) };
  }
};

/**
 * Register step 2: saves the 4-digit passcode for the verified user.
 * TODO(KFF): call the backend once the endpoint is shared. Send the step-1
 * token as `Authorization: Bearer <token>` (the interceptor only sets it from
 * storage, and nothing is stored during registration).
 */
export const registerKffPasscode = async (
  _authToken: string,
  _passcode: string,
  _deviceId: string,
): Promise<KffApiResult<void>> => notAvailable('Passcode registration');

/**
 * Login: the user picked on the profile carousel + their 4-digit passcode.
 * Should return the same token pair as /auth/login.
 * TODO(KFF): call the backend once the endpoint is shared.
 */
export const kffPasscodeLogin = async (
  _userId: string,
  _passcode: string,
  _deviceId: string,
): Promise<KffApiResult<KffTokens>> => notAvailable('Passcode login');
