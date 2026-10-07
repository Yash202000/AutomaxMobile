import Constants from "expo-constants";
import { Platform } from "react-native";
import i18n from "../i18n";
import { getGoogleMapsApiKey } from "./mapProvider";

// Google Places (New) REST — address search for the location picker. Needs the
// "Places API (New)" enabled on the same key the native maps use.

export interface PlaceSuggestion {
  placeId: string;
  label: string;
}

export interface PlaceLocation {
  latitude: number;
  longitude: number;
  label: string;
}

const PLACES_URL = "https://places.googleapis.com/v1";

// A key restricted to this iOS/Android app (the recommended setup) only accepts
// REST calls that identify the app. For Android the signing-certificate SHA-1
// is also required; supply it through EXPO_PUBLIC_GOOGLE_ANDROID_CERT_SHA1.
const appRestrictionHeaders = (): Record<string, string> => {
  if (Platform.OS === "ios") {
    const bundleId = Constants.expoConfig?.ios?.bundleIdentifier;
    return bundleId ? { "X-Ios-Bundle-Identifier": bundleId } : {};
  }
  const pkg = Constants.expoConfig?.android?.package;
  const cert = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CERT_SHA1;
  return {
    ...(pkg ? { "X-Android-Package": pkg } : {}),
    ...(pkg && cert ? { "X-Android-Cert": cert } : {}),
  };
};

const headers = (fieldMask?: string): Record<string, string> => ({
  "Content-Type": "application/json",
  "X-Goog-Api-Key": getGoogleMapsApiKey(),
  ...(fieldMask ? { "X-Goog-FieldMask": fieldMask } : {}),
  ...appRestrictionHeaders(),
});

const languageCode = () => (i18n.language?.startsWith("ar") ? "ar" : "en");

async function request<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    let detail = "";
    try {
      detail = (await response.json())?.error?.message ?? "";
    } catch {
      // ignore — status code is enough
    }
    throw new Error(`Google Places request failed (${response.status})${detail ? `: ${detail}` : ""}`);
  }
  return response.json();
}

/** One session token per search → place pick keeps Places billing to one session. */
export const newPlacesSessionToken = (): string =>
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });

export async function autocompletePlaces(
  query: string,
  sessionToken: string,
): Promise<PlaceSuggestion[]> {
  const data = await request<{
    suggestions?: {
      placePrediction?: { placeId: string; text?: { text: string } };
    }[];
  }>(`${PLACES_URL}/places:autocomplete`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ input: query, sessionToken, languageCode: languageCode() }),
  });

  return (data.suggestions ?? []).flatMap((s) =>
    s.placePrediction?.text?.text
      ? [{ placeId: s.placePrediction.placeId, label: s.placePrediction.text.text }]
      : [],
  );
}

export async function getPlaceLocation(
  placeId: string,
  sessionToken: string,
): Promise<PlaceLocation | null> {
  const data = await request<{
    location?: { latitude: number; longitude: number };
    formattedAddress?: string;
  }>(
    `${PLACES_URL}/places/${encodeURIComponent(placeId)}?languageCode=${languageCode()}&sessionToken=${encodeURIComponent(sessionToken)}`,
    { headers: headers("location,formattedAddress") },
  );
  if (!data.location) return null;
  return { ...data.location, label: data.formattedAddress ?? "" };
}

/** Free-text search (the picker's Search button / keyboard "search" key). */
export async function searchTopPlace(query: string): Promise<PlaceLocation | null> {
  const data = await request<{
    places?: {
      location?: { latitude: number; longitude: number };
      formattedAddress?: string;
    }[];
  }>(`${PLACES_URL}/places:searchText`, {
    method: "POST",
    headers: headers("places.location,places.formattedAddress"),
    body: JSON.stringify({ textQuery: query, pageSize: 1, languageCode: languageCode() }),
  });
  const place = data.places?.[0];
  if (!place?.location) return null;
  return { ...place.location, label: place.formattedAddress ?? "" };
}
