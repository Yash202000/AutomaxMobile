import AsyncStorage from '@react-native-async-storage/async-storage';

import { registerApiBaseURLLoader, setApiBaseURL } from '../api/client';

// KFF device setup, entered by the admin profile on the KFF login screen.
// Stored locally (nothing secret in it). The Web Service URL becomes the API
// server for every request; the Device ID is the unit whose users are listed
// on the login screen. Only used when isKffPasscodeLogin() is true.

export interface KffDeviceConfig {
  deviceId: string;
  syncIntervalMs: string;
  baudRate: string;
  dispatchRadioId: string;
  webServiceUrl: string;
  network: KffNetwork;
}

export const KFF_NETWORKS = ['3G', '4G', '5G'] as const;
export type KffNetwork = (typeof KFF_NETWORKS)[number];

const STORAGE_KEY = 'kff.deviceConfig';

export const KFF_DEFAULT_DEVICE_CONFIG: KffDeviceConfig = {
  deviceId: '',
  syncIntervalMs: '5000',
  baudRate: '57600',
  dispatchRadioId: '',
  webServiceUrl: '',
  network: '4G',
};

/**
 * Turns the entered Web Service URL into the API base URL: trims trailing
 * slashes and appends `/api/v1` when no `/api/vN` suffix is present (every
 * endpoint in this app lives under it). Returns null when it isn't http(s).
 */
export const toKffApiBaseURL = (webServiceUrl: string): string | null => {
  const trimmed = webServiceUrl.trim().replace(/\/+$/, '');
  if (!/^https?:\/\/[^/\s]+/i.test(trimmed)) return null;
  return /\/api\/v\d+$/i.test(trimmed) ? trimmed : `${trimmed}/api/v1`;
};

export const loadKffDeviceConfig = async (): Promise<KffDeviceConfig> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...KFF_DEFAULT_DEVICE_CONFIG };
    return { ...KFF_DEFAULT_DEVICE_CONFIG, ...(JSON.parse(raw) as Partial<KffDeviceConfig>) };
  } catch {
    return { ...KFF_DEFAULT_DEVICE_CONFIG };
  }
};

/** Saves the setup and switches the API server immediately. */
export const saveKffDeviceConfig = async (config: KffDeviceConfig): Promise<void> => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  setApiBaseURL(toKffApiBaseURL(config.webServiceUrl));
};

/** True once the admin has entered both a Device ID and a usable URL. */
export const isKffDeviceConfigured = (config: KffDeviceConfig): boolean =>
  !!config.deviceId.trim() && !!toKffApiBaseURL(config.webServiceUrl);

/**
 * Call once at app start (KFF passcode login only). API requests wait until
 * the stored Web Service URL has been applied. With no setup saved yet they
 * fall back to EXPO_PUBLIC_API_URL, which is optional for KFF — without it,
 * requests are refused until the admin saves the device setup.
 */
export const initKffDeviceConfig = () => {
  registerApiBaseURLLoader(async () => {
    const config = await loadKffDeviceConfig();
    return toKffApiBaseURL(config.webServiceUrl);
  });
};
