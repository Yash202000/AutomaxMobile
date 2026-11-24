import apiClient from './client';

// KFF Dispatcher passcode-login APIs (isKffPasscodeLogin() only).
//   getKffUnitUsers       GET  /auth/unit/{deviceUniqueId}/user
//   kffPasscodeLogin      POST /auth/login/passcode
//   verifyKffCredentials  POST /auth/login            (register step 1)
//   registerKffPasscode   PUT  /users/passcode        (register step 2)
// The pre-login ones are listed in `publicEndpoints` in ./client.ts.

export interface KffUnitUser {
  id: string;
  name: string;
  imageUrl?: string;
  /** Unit (resource) id — saved at login and sent on every KFF API call. */
  unitId?: string;
  plateNumber?: string;
  uniqueId?: string;
}

export interface KffLoginData {
  token: string;
  refreshToken?: string;
  userId: string;
  userName: string;
  userEmail: string;
  profileImage: string;
  mobile: string;
  /** Not sent by the backend yet; the unit-user lookup provides it. */
  unitId?: string;
}

export type KffApiResult<T> = { success: true; data: T } | { success: false; error: string };

const errorMessage = (error: any): string =>
  error?.response?.data?.error || error?.response?.data?.message || error?.message || 'Request failed';

// Responses come either wrapped ({ success, data }) or flat (passcode login).
const payload = (body: any) => body?.data ?? body;

/**
 * The user(s) registered on this device's unit — the login profile cards.
 * `deviceId` is the device unique id from device setup (e.g. DEVMWBS45JM5532).
 */
export const getKffUnitUsers = async (deviceId: string): Promise<KffApiResult<KffUnitUser[]>> => {
  try {
    const response = await apiClient.get(`/auth/unit/${encodeURIComponent(deviceId)}/user`);
    const data = payload(response.data);
    const users = (Array.isArray(data) ? data : data ? [data] : [])
      .filter((user: any) => user?.userId)
      .map((user: any) => ({
        id: String(user.userId),
        name: user.userName || user.userEmail || '',
        imageUrl: user.profileImage || undefined,
        unitId: user.unitId || undefined,
        plateNumber: user.plateNumber || undefined,
        uniqueId: user.uniqueId || undefined,
      }));
    return { success: true, data: users };
  } catch (error: any) {
    // 404 = no user registered on this unit yet: an empty list, not an error.
    if (error?.response?.status === 404) return { success: true, data: [] };
    return { success: false, error: errorMessage(error) };
  }
};

/** Login: the user picked on the profile carousel + their passcode. */
export const kffPasscodeLogin = async (
  userId: string,
  passcode: string,
): Promise<KffApiResult<KffLoginData>> => {
  try {
    const response = await apiClient.post('/auth/login/passcode', { user_id: userId, passcode });
    const data = payload(response.data);
    if (!data?.token) return { success: false, error: response.data?.message || 'Invalid response from server' };
    return {
      success: true,
      data: {
        token: data.token,
        refreshToken: data.refresh_token ?? data.refreshToken,
        userId: String(data.user_id ?? data.userId ?? userId),
        userName: data.userName ?? data.user_name ?? '',
        userEmail: data.userEmail ?? data.email ?? '',
        profileImage: data.profileImage ?? '',
        mobile: data.mobile ?? '',
        unitId: data.unit_id ?? data.unitId,
      },
    };
  } catch (error: any) {
    return { success: false, error: errorMessage(error) };
  }
};

/**
 * Register step 1: checks email + password with the normal login. The token
 * only authorises step 2 and is not stored — registering doesn't sign in.
 */
export const verifyKffCredentials = async (
  email: string,
  password: string,
): Promise<KffApiResult<{ token: string }>> => {
  try {
    const response = await apiClient.post('/auth/login', { email, password });
    const token = payload(response.data)?.token;
    if (response.data?.success && token) return { success: true, data: { token } };
    // No token back means the account needs 2FA, which this flow doesn't support.
    return { success: false, error: response.data?.message || 'Invalid response from server' };
  } catch (error: any) {
    return { success: false, error: errorMessage(error) };
  }
};

/** Register step 2: saves the passcode for the user verified in step 1. */
export const registerKffPasscode = async (
  authToken: string,
  passcode: string,
): Promise<KffApiResult<void>> => {
  try {
    const response = await apiClient.put(
      '/users/passcode',
      { passcode },
      { headers: { Authorization: `Bearer ${authToken}` } },
    );
    if (response.data?.success === false) {
      return { success: false, error: response.data?.error || response.data?.message || 'Request failed' };
    }
    return { success: true, data: undefined };
  } catch (error: any) {
    return { success: false, error: errorMessage(error) };
  }
};
