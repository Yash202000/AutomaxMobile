/**
 * Maps Configuration
 * Supports multiple map providers with automatic fallback
 */

export type MapProvider = 'google' | 'default' | 'osm';

export interface MapConfig {
  provider: MapProvider;
  googleMapsApiKey?: string;
  osmTileServer?: string;
  defaultRegion: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
}

// Default configuration
export const DEFAULT_MAP_CONFIG: MapConfig = {
  provider: 'default', // Will use native maps (Apple Maps on iOS, basic Google Maps on Android)
  googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
  osmTileServer: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  defaultRegion: {
    latitude: 25.276987, // Dubai
    longitude: 55.296249,
    latitudeDelta: 0.1,
    longitudeDelta: 0.1,
  },
};

/**
 * Determines which map provider to use based on configuration and availability
 */
export function getMapProvider(): MapProvider {
  // Check if Google Maps API key is configured
  const hasGoogleKey = !!DEFAULT_MAP_CONFIG.googleMapsApiKey;

  // Priority: Google (if key available) -> Default (native) -> OSM
  if (hasGoogleKey) {
    return 'google';
  }

  // Use default native maps (Apple Maps on iOS, basic Google on Android)
  return 'default';
}

/**
 * Get the appropriate tile URL for OSM
 */
export function getOSMTileUrl(): string {
  return DEFAULT_MAP_CONFIG.osmTileServer || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
}
