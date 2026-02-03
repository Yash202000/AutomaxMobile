import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import MapView, { Marker, MapPressEvent, Region, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

export interface LocationData {
  latitude: number;
  longitude: number;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
}

interface LocationPickerProps {
  value?: LocationData;
  onChange: (location: LocationData | undefined) => void;
  required?: boolean;
  error?: string;
  label?: string;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function LocationPicker({ value, onChange, required, error, label }: LocationPickerProps) {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [tilesLoading, setTilesLoading] = useState(true);
  const mapRef = useRef<MapView>(null);

  // Default region (Dubai)
  const defaultRegion: Region = {
    latitude: 25.276987,
    longitude: 55.296249,
    latitudeDelta: 0.1,
    longitudeDelta: 0.1,
  };

  console.log('[LocationPicker] Component rendered, mapLoaded:', mapLoaded, 'tilesLoading:', tilesLoading);

  const reverseGeocode = async (latitude: number, longitude: number): Promise<Partial<LocationData>> => {
    try {
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Geocoding timeout')), 10000); // 10 second timeout
      });

      const geocodePromise = Location.reverseGeocodeAsync({ latitude, longitude });

      const results = await Promise.race([geocodePromise, timeoutPromise]);

      if (results && results.length > 0) {
        const result = results[0];
        const addressParts = [
          result.streetNumber,
          result.street,
          result.district,
          result.subregion,
        ].filter(Boolean);

        return {
          address: addressParts.join(', ') || result.name || undefined,
          city: result.city || undefined,
          state: result.region || undefined,
          country: result.country || undefined,
          postal_code: result.postalCode || undefined,
        };
      }
      return {};
    } catch (error) {
      // Silently fail - coordinates are more important than address
      console.warn('Reverse geocoding failed (using coordinates only):', error instanceof Error ? error.message : 'Unknown error');
      return {};
    }
  };

  const handleGetCurrentLocation = useCallback(async () => {
    try {
      console.log('🎯 [LocationPicker] Getting current location...');
      setIsLoading(true);

      const { status } = await Location.requestForegroundPermissionsAsync();
      console.log('🔐 [LocationPicker] Permission status:', status);

      if (status !== 'granted') {
        console.warn('⚠️ [LocationPicker] Location permission denied');
        Alert.alert('Permission Required', 'Location permission is required to get your current location.');
        setIsLoading(false);
        return;
      }

      console.log('📡 [LocationPicker] Requesting GPS position...');
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const { latitude, longitude } = location.coords;
      console.log('✅ [LocationPicker] Got GPS position:', latitude, longitude);

      // Immediately set location with coordinates
      const locationData: LocationData = {
        latitude,
        longitude,
      };

      onChange(locationData);

      // Animate map to new location
      mapRef.current?.animateToRegion({
        latitude,
        longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 500);

      setIsLoading(false); // Clear loading IMMEDIATELY after setting location

      // Try to get address in background (non-blocking)
      try {
        const addressData = await reverseGeocode(latitude, longitude);

        // Update with address if we got one
        if (Object.keys(addressData).length > 0) {
          console.log('📮 [LocationPicker] Address fetched:', addressData.address);
          onChange({
            ...locationData,
            ...addressData,
          });
        } else {
          console.log('⚠️ [LocationPicker] No address found');
        }
      } catch (error) {
        console.warn('⚠️ [LocationPicker] Could not fetch address, using coordinates only');
      }

    } catch (error) {
      console.error('❌ [LocationPicker] Error getting location:', error);
      Alert.alert('Error', 'Failed to get current location. Please check your GPS is enabled.');
      setIsLoading(false);
    }
  }, [onChange]);

  const handleMapPress = useCallback(async (event: MapPressEvent) => {
    console.log('🗺️ [LocationPicker] Map tapped');
    const { latitude, longitude } = event.nativeEvent.coordinate;
    console.log('📍 [LocationPicker] Coordinates:', latitude, longitude);

    // Immediately set location with coordinates (don't wait for address)
    const locationData: LocationData = {
      latitude,
      longitude,
    };

    onChange(locationData);

    // Try to get address in background (non-blocking) - DON'T show loading for this
    try {
      const addressData = await reverseGeocode(latitude, longitude);

      // Update with address if we got one
      if (Object.keys(addressData).length > 0) {
        console.log('📮 [LocationPicker] Address fetched for tap:', addressData.address);
        onChange({
          ...locationData,
          ...addressData,
        });
      }
    } catch (error) {
      console.warn('⚠️ [LocationPicker] Could not fetch address for tap');
    }
  }, [onChange]);

  const handleClear = useCallback(() => {
    onChange(undefined);
  }, [onChange]);

  return (
    <View style={styles.container}>
      {label && (
        <Text style={styles.label}>
          {label} {required && <Text style={styles.required}>*</Text>}
        </Text>
      )}

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.locationButton}
          onPress={handleGetCurrentLocation}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#2EC4B6" />
          ) : (
            <Ionicons name="navigate" size={20} color="#2EC4B6" />
          )}
          <Text style={styles.locationButtonText}>
            {isLoading ? t('addIncident.fetchingLocation') : t('addIncident.getCurrentLocation')}
          </Text>
        </TouchableOpacity>

        {value && (
          <TouchableOpacity style={styles.clearButton} onPress={handleClear}>
            <Ionicons name="close-circle" size={22} color="#E74C3C" />
          </TouchableOpacity>
        )}
      </View>

      {/* Map */}
      <View style={[styles.mapContainer, error && styles.mapContainerError]}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_DEFAULT}
          style={styles.map}
          initialRegion={value ? {
            latitude: value.latitude,
            longitude: value.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          } : defaultRegion}
          onPress={handleMapPress}
          showsUserLocation={false}
          showsMyLocationButton={false}
          loadingEnabled={true}
          loadingIndicatorColor="#2EC4B6"
          loadingBackgroundColor="#ffffff"
          onMapReady={() => {
            console.log('✅ [LocationPicker] Map loaded successfully!');
            setMapLoaded(true);
            setTilesLoading(false); // Hide loading immediately when map is ready
          }}
          onError={(error) => {
            console.error('❌ [LocationPicker] Map error:', error);
            console.error('❌ [LocationPicker] Error details:', JSON.stringify(error));
            setMapLoaded(true); // Consider map loaded even on error
            setTilesLoading(false);
          }}
          onLayout={() => {
            console.log('📐 [LocationPicker] MapView layout completed');
            // Hide loading after layout if map hasn't called onMapReady yet
            setTimeout(() => {
              if (tilesLoading) {
                console.log('⏱️ [LocationPicker] Forcing tiles loaded after timeout');
                setTilesLoading(false);
              }
            }, 3000);
          }}
        >
          {value && (
            <Marker
              coordinate={{
                latitude: value.latitude,
                longitude: value.longitude,
              }}
              pinColor="#2EC4B6"
            />
          )}
        </MapView>

        {tilesLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#2EC4B6" />
            <Text style={styles.loadingText}>Loading map tiles...</Text>
            <Text style={styles.loadingSubtext}>Make sure you have internet connection</Text>
          </View>
        )}
        {isLoading && !tilesLoading && (
          <View style={styles.addressLoadingOverlay}>
            <ActivityIndicator size="small" color="#2EC4B6" />
            <Text style={styles.addressLoadingText}>Getting location...</Text>
          </View>
        )}
      </View>

      <Text style={styles.hint}>
        Tap on the map to select a location, or use "Get Current Location"
      </Text>

      {/* Location Details */}
      {value && (
        <View style={styles.locationDetails}>
          <View style={styles.coordinatesRow}>
            <Ionicons name="location" size={18} color="#2EC4B6" />
            <Text style={styles.coordinates}>
              {value.latitude.toFixed(6)}, {value.longitude.toFixed(6)}
            </Text>
          </View>

          {value.address ? (
            <Text style={styles.address}>{value.address}</Text>
          ) : isLoading ? (
            <Text style={styles.addressLoading}>{t('addIncident.fetchingLocation')}</Text>
          ) : (
            <Text style={styles.addressUnavailable}>Address unavailable (coordinates saved)</Text>
          )}

          {(value.city || value.state || value.country) && (
            <View style={styles.detailsGrid}>
              {value.city && (
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>City:</Text>
                  <Text style={styles.detailValue}>{value.city}</Text>
                </View>
              )}
              {value.state && (
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>State:</Text>
                  <Text style={styles.detailValue}>{value.state}</Text>
                </View>
              )}
              {value.country && (
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Country:</Text>
                  <Text style={styles.detailValue}>{value.country}</Text>
                </View>
              )}
              {value.postal_code && (
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Postal Code:</Text>
                  <Text style={styles.detailValue}>{value.postal_code}</Text>
                </View>
              )}
            </View>
          )}
        </View>
      )}

      {/* Error */}
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  required: {
    color: '#E74C3C',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2EC4B6',
    gap: 8,
    flex: 1,
  },
  locationButtonText: {
    color: '#2EC4B6',
    fontSize: 14,
    fontWeight: '500',
  },
  clearButton: {
    padding: 8,
  },
  mapContainer: {
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    position: 'relative',
  },
  mapContainerError: {
    borderColor: '#E74C3C',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#666',
  },
  loadingSubtext: {
    marginTop: 5,
    fontSize: 12,
    color: '#999',
  },
  addressLoadingOverlay: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  addressLoadingText: {
    marginLeft: 8,
    fontSize: 12,
    color: '#666',
  },
  hint: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    marginBottom: 8,
  },
  locationDetails: {
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
  },
  coordinatesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  coordinates: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  address: {
    fontSize: 13,
    color: '#666',
    marginTop: 8,
  },
  addressLoading: {
    fontSize: 13,
    color: '#999',
    marginTop: 8,
    fontStyle: 'italic',
  },
  addressUnavailable: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
    fontStyle: 'italic',
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    gap: 8,
  },
  detailItem: {
    flexDirection: 'row',
    width: '48%',
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginRight: 4,
  },
  detailValue: {
    fontSize: 12,
    color: '#333',
    flex: 1,
  },
  errorText: {
    color: '#E74C3C',
    fontSize: 12,
    marginTop: 4,
  },
});

export default LocationPicker;
