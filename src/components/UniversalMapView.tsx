/**
 * UniversalMapView Component
 *
 * A flexible map component that supports multiple providers:
 * - Google Maps (when API key is available)
 * - Native Maps (Apple Maps on iOS, basic Google on Android)
 *
 * Automatically falls back to available providers if primary fails
 */

import React, { forwardRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MapView, {
  MapViewProps,
  PROVIDER_GOOGLE,
} from 'react-native-maps';
import { getMapProvider } from '../config/maps';

interface UniversalMapViewProps extends MapViewProps {
  fallbackMessage?: string;
}

export const UniversalMapView = forwardRef<MapView, UniversalMapViewProps>(
  ({ children, ...props }, ref) => {
    // Determine which provider to use
    const mapProvider = getMapProvider();

    // Only set provider prop if we want Google Maps specifically
    // Otherwise, let react-native-maps use the default native map
    const mapProps: MapViewProps = {
      ...props,
      ...(mapProvider === 'google' ? { provider: PROVIDER_GOOGLE } : {}),
    };

    return (
      <>
        <MapView ref={ref} {...mapProps}>
          {children}
        </MapView>
        {/* Show provider indicator in development */}
        {__DEV__ && (
          <View style={styles.providerBadge}>
            <Text style={styles.providerText}>
              {mapProvider === 'google' ? '📍 Google' : '🗺️ Native'}
            </Text>
          </View>
        )}
      </>
    );
  }
);

UniversalMapView.displayName = 'UniversalMapView';

const styles = StyleSheet.create({
  providerBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    zIndex: 1000,
  },
  providerText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
});

export default UniversalMapView;
