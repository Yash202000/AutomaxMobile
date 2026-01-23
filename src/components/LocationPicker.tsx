import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import MapView, { Marker, MapPressEvent, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';

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
  const [isLoading, setIsLoading] = useState(false);
  const mapRef = useRef<MapView>(null);

  // Default region (Dubai)
  const defaultRegion: Region = {
    latitude: 25.276987,
    longitude: 55.296249,
    latitudeDelta: 0.1,
    longitudeDelta: 0.1,
  };

  const reverseGeocode = async (latitude: number, longitude: number): Promise<Partial<LocationData>> => {
    try {
      const results = await Location.reverseGeocodeAsync({ latitude, longitude });
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
      console.error('Reverse geocoding error:', error);
      return {};
    }
  };

  const handleGetCurrentLocation = useCallback(async () => {
    try {
      setIsLoading(true);

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Location permission is required to get your current location.');
        setIsLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const { latitude, longitude } = location.coords;

      // Reverse geocode
      const addressData = await reverseGeocode(latitude, longitude);

      const locationData: LocationData = {
        latitude,
        longitude,
        ...addressData,
      };

      onChange(locationData);

      // Animate map to new location
      mapRef.current?.animateToRegion({
        latitude,
        longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 500);

    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Error', 'Failed to get current location');
    } finally {
      setIsLoading(false);
    }
  }, [onChange]);

  const handleMapPress = useCallback(async (event: MapPressEvent) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;

    setIsLoading(true);

    // Reverse geocode
    const addressData = await reverseGeocode(latitude, longitude);

    const locationData: LocationData = {
      latitude,
      longitude,
      ...addressData,
    };

    onChange(locationData);
    setIsLoading(false);
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
            {isLoading ? 'Getting location...' : 'Get Current Location'}
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
          style={styles.map}
          initialRegion={value ? {
            latitude: value.latitude,
            longitude: value.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          } : defaultRegion}
          onPress={handleMapPress}
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

        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#2EC4B6" />
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

          {value.address && (
            <Text style={styles.address}>{value.address}</Text>
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
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
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
