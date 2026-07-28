import i18n from '@/src/i18n';
import { CustomAlert } from '@/src/components/CustomAlert';
import { Linking, Platform } from 'react-native';

interface MapOption {
  label: string;
  url: string;
}

// Some platforms (notably Android, due to package-visibility restrictions
// when the target app isn't installed/declared) can make canOpenURL reject
// instead of resolving false. Treat any failure to detect an app as simply
// "not available" so it never blocks the other, always-available options.
const canOpen = async (url: string): Promise<boolean> => {
  try {
    return await Linking.canOpenURL(url);
  } catch (error) {
    console.warn('canOpenURL check failed for', url, error);
    return false;
  }
};

// On iOS, `maps://` is Apple Maps' own URL scheme — it's a built-in system
// scheme, so Linking.canOpenURL() for it always resolves true regardless of
// whether Google Maps is installed. Google Maps must be probed explicitly via
// its `comgooglemaps://` scheme (requires LSApplicationQueriesSchemes).
const buildIosMapOptions = async (destination: string): Promise<MapOption[]> => {
  const options: MapOption[] = [];

  const googleMapsUrl = `comgooglemaps://?daddr=${destination}&directionsmode=driving`;
  if (await canOpen(googleMapsUrl)) {
    options.push({ label: i18n.t('details.googleMaps'), url: googleMapsUrl });
  }
  // Apple Maps is a built-in system app, always available on iOS.
  options.push({ label: i18n.t('details.appleMaps'), url: `maps://app?daddr=${destination}` });
  options.push({
    label: i18n.t('details.openInBrowser'),
    url: `https://www.google.com/maps/dir/?api=1&destination=${destination}`,
  });

  return options;
};

/**
 * Opens directions to the given coordinates.
 *
 * - Android: opens directly in Google Maps (no prompt) when it's installed,
 *   otherwise falls back to the browser — matches the platform's existing
 *   single-app "navigate" intent behavior.
 * - iOS: there's no single obvious default (Apple Maps is always present
 *   alongside Google Maps), so the user is asked which app to use.
 */
export const openMapsDirections = async (
  latitude: number,
  longitude: number,
  onError?: (error: unknown) => void,
): Promise<void> => {
  const destination = `${latitude},${longitude}`;
  const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${destination}`;

  const openAndReport = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch (error) {
      console.error('Error opening directions:', error);
      onError?.(error);
      CustomAlert.alert(
        i18n.t('common.error'),
        i18n.t('errors.mapsFailed', 'Failed to open maps. Please check if you have a maps app installed.'),
      );
    }
  };

  if (Platform.OS === 'android') {
    const googleNavUrl = `google.navigation:q=${destination}`;
    const url = (await canOpen(googleNavUrl)) ? googleNavUrl : webUrl;
    await openAndReport(url);
    return;
  }

  try {
    const options = await buildIosMapOptions(destination);

    if (options.length <= 1) {
      await openAndReport(options[0].url);
      return;
    }

    CustomAlert.alert(
      i18n.t('details.chooseMapsApp'),
      undefined,
      [
        ...options.map((option) => ({
          text: option.label,
          onPress: () => {
            openAndReport(option.url);
          },
        })),
        { text: i18n.t('common.cancel'), style: 'cancel' as const },
      ],
    );
  } catch (error) {
    console.error('Error building maps options:', error);
    onError?.(error);
    CustomAlert.alert(
      i18n.t('common.error'),
      i18n.t('errors.mapsFailed', 'Failed to open maps. Please check if you have a maps app installed.'),
    );
  }
};
