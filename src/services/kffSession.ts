import * as SecureStore from 'expo-secure-store';

// KFF Dispatcher: who is logged in on this unit, saved at passcode login (the
// auth tokens themselves go through AuthContext.login like any other login).
// The unitId is sent with every KFF incident call (src/api/kffIncidents.ts).
// SecureStore because it holds personal details; cached in memory after the
// first read so API calls don't hit storage each time.

export interface KffSession {
  userId: string;
  userName: string;
  userEmail: string;
  profileImage: string;
  mobile: string;
  /** Unit (resource) UUID from the unit-user lookup — sent on all KFF APIs ('' if unknown). */
  unitId: string;
  plateNumber?: string;
  /** Device unique id entered in device setup. */
  uniqueId?: string;
}

const KEY = 'kffSession';
let cached: KffSession | null | undefined; // undefined = not read yet

export const saveKffSession = async (session: KffSession) => {
  cached = session;
  await SecureStore.setItemAsync(KEY, JSON.stringify(session));
};

export const loadKffSession = async (): Promise<KffSession | null> => {
  if (cached !== undefined) return cached;
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    cached = raw ? (JSON.parse(raw) as KffSession) : null;
  } catch {
    cached = null;
  }
  return cached;
};

export const getKffUnitId = async () => (await loadKffSession())?.unitId || '';

export const clearKffSession = async () => {
  cached = null;
  await SecureStore.deleteItemAsync(KEY).catch(() => {});
};
