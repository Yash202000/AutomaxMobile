import { Linking } from 'react-native';

interface LatLng {
  latitude: number;
  longitude: number;
}

/**
 * KFF: opens Google Maps directions from the unit's current position to the
 * incident. The https link opens the Google Maps app when installed (Android
 * app link / iOS universal link), otherwise the browser. Without an origin,
 * Google Maps starts from the device's own location.
 */
export const openKffDirections = (destination: LatLng, origin?: LatLng | null) => {
  const params = [
    'api=1',
    `destination=${destination.latitude},${destination.longitude}`,
    'travelmode=driving',
  ];
  if (origin) params.push(`origin=${origin.latitude},${origin.longitude}`);
  return Linking.openURL(`https://www.google.com/maps/dir/?${params.join('&')}`);
};
