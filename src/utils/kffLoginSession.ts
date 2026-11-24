// In-memory state for the KFF passcode-login flow. Never persisted: the
// registration token and the admin unlock last only until the app restarts.

let registrationToken: string | null = null;
let adminUnlocked = false;

/** Token from register step 1 (credentials check), used by step 2. */
export const setKffRegistrationToken = (token: string | null) => {
  registrationToken = token;
};
export const getKffRegistrationToken = () => registrationToken;

/** Set after the admin profile's code is accepted; gates the device setup screen. */
export const setKffAdminUnlocked = (value: boolean) => {
  adminUnlocked = value;
};
export const isKffAdminUnlocked = () => adminUnlocked;

/**
 * Admin profile code. Front-end only (bundled into the app): it gates the
 * device setup screen, not any server data. Unset -> admin login is refused.
 */
export const KFF_ADMIN_PASSCODE = process.env.EXPO_PUBLIC_KFF_ADMIN_PASSCODE ?? '';
