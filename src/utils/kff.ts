// KFF Dispatcher client switch.
// The env var name intentionally matches the key already defined in .env
// (EXPO_PUBLIC_KFF_DISPATHER). It must be read via a static
// `process.env.EXPO_PUBLIC_*` access so Expo can inline it at build time.
export const isKffDispatcher = (): boolean =>
  process.env.EXPO_PUBLIC_KFF_DISPATHER === 'true';

// KFF passcode login (EXPO_PUBLIC_KFF_DISPATHER_Login): profile carousel +
// 4-digit code, admin device setup and passcode registration. Replaces the
// Automax login screen for KFF only; every other build keeps the normal login.
export const isKffPasscodeLogin = (): boolean =>
  isKffDispatcher() && process.env.EXPO_PUBLIC_KFF_DISPATHER_Login === 'true';

// Landing route for KFF users after login / when already authenticated.
export const KFF_HOME_ROUTE = '/(tabs)/kff-profile' as const;

// "1.0.0 (2)": EXPO_PUBLIC_APP_VERSION + EXPO_PUBLIC_APP_VERSION_CODE, the same
// .env values the native builds use for the version name / build number.
export const kffAppVersionLabel = (): string => {
  const version = process.env.EXPO_PUBLIC_APP_VERSION ?? '';
  const build = process.env.EXPO_PUBLIC_APP_VERSION_CODE ?? '';
  return build ? `${version} (${build})` : version;
};
