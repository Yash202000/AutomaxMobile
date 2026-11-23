import { useSyncExternalStore } from "react";
import { Platform, UIManager } from "react-native";

// Which map the app uses is decided by whether a Google Maps API key is
// configured at build time: key present → native Google Maps, otherwise the
// existing Leaflet + OpenStreetMap WebView maps. The same key is injected into
// the native iOS/Android projects by app.config.js.
export const getGoogleMapsApiKey = (): string =>
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "";

export const isGoogleMapsConfigured = (): boolean => !!getGoogleMapsApiKey();

// On iOS the Google Maps SDK is only linked into builds prebuilt WITH the key
// (the react-native-google-maps pod). An older build, or one made before the
// key was set, would fail with "AirGoogleMaps dir must be added to your Xcode
// project" — so fall back to OSM there instead of erroring.
const googleNativeMissing = (): boolean =>
  Platform.OS === "ios" && !UIManager.hasViewManagerConfig("AIRGoogleMap");

// ── Google health ────────────────────────────────────────────────────────────
// The native Google SDKs expose no "key rejected" callback, so the only signal
// is the map never finishing its first render (see NativeGoogleMap). When that
// happens every map switches to OSM for the rest of the app session and says why.

interface GoogleState {
  failed: boolean;
  reason: string | null;
}

let state: GoogleState = { failed: false, reason: null };
const listeners = new Set<() => void>();

export function reportGoogleFailure(reason: string) {
  if (state.failed) return;
  console.warn("Google Maps unavailable, using OpenStreetMap instead:", reason);
  state = { failed: true, reason };
  listeners.forEach((listener) => listener());
}

export type MapProvider = "google" | "osm";

export function useMapProvider(): {
  provider: MapProvider;
  googleError: string | null;
} {
  const current = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => state,
  );
  const configured = isGoogleMapsConfigured();
  if (configured && googleNativeMissing()) {
    return {
      provider: "osm",
      googleError:
        "This build does not include the Google Maps SDK — run expo prebuild with the key set, then rebuild",
    };
  }
  return {
    provider: configured && !current.failed ? "google" : "osm",
    googleError: configured ? current.reason : null,
  };
}
