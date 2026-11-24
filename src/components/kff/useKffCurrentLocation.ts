import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

// KFF Dispatcher: the unit's own position (device GPS) for the incident detail
// "Current Location" row and map. Address comes from the OS geocoder (no
// Google Maps key needed); falls back to "lat, lng" when it can't resolve one.

interface KffCurrentLocation {
  latitude: number;
  longitude: number;
  address: string;
}

type KffCurrentLocationStatus = 'loading' | 'ready' | 'denied' | 'unavailable';

const formatAddress = (place?: Location.LocationGeocodedAddress): string => {
  if (!place) return '';
  const street = [place.streetNumber, place.street].filter(Boolean).join(' ');
  return [place.name !== street ? place.name : '', street, place.district, place.city, place.region]
    .filter((part, index, all) => !!part && all.indexOf(part) === index)
    .join(', ');
};

/**
 * The unit's position: `location` (coords + address) for maps, `text` for the
 * "Current Location" row (address, or a locating / permission note).
 */
export const useKffCurrentLocation = () => {
  const { t } = useTranslation();
  const [location, setLocation] = useState<KffCurrentLocation | null>(null);
  const [status, setStatus] = useState<KffCurrentLocationStatus>('loading');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { status: permission } = await Location.requestForegroundPermissionsAsync();
        if (permission !== 'granted') {
          if (!cancelled) setStatus('denied');
          return;
        }
        // Fresh fix; fall back to the last known one if it can't be obtained.
        const position =
          (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(
            () => null,
          )) ?? (await Location.getLastKnownPositionAsync());
        if (!position) {
          if (!cancelled) setStatus('unavailable');
          return;
        }
        // Show coordinates at once, then replace them with the address.
        const { latitude, longitude } = position.coords;
        if (!cancelled) {
          setLocation({ latitude, longitude, address: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}` });
          setStatus('ready');
        }
        const [place] = await Location.reverseGeocodeAsync({ latitude, longitude }).catch(() => []);
        const address = formatAddress(place);
        if (!cancelled && address) setLocation({ latitude, longitude, address });
      } catch {
        if (!cancelled) setStatus('unavailable');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const text =
    location?.address ||
    (status === 'loading'
      ? t('kff.detail.locating')
      : status === 'denied'
        ? t('kff.detail.locationDenied')
        : '');

  return { location, text };
};
