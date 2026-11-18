// KFF Dispatcher client switch.
// The env var name intentionally matches the key already defined in .env
// (EXPO_PUBLIC_KFF_DISPATHER). It must be read via a static
// `process.env.EXPO_PUBLIC_*` access so Expo can inline it at build time.
export const isKffDispatcher = (): boolean =>
  process.env.EXPO_PUBLIC_KFF_DISPATHER === 'true';

// Landing route for KFF users after login / when already authenticated.
export const KFF_HOME_ROUTE = '/(tabs)/kff-profile' as const;
