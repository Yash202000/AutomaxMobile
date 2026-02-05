import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { WebView } from 'react-native-webview';
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
  autoFetch?: boolean; // Auto-fetch location when component mounts and required is true
}

const DEFAULT_LAT = 25.276987; // Dubai
const DEFAULT_LNG = 55.296249;

// Rate limiter for Nominatim (max 1 request per second)
let lastSearchTime = 0;
const MIN_SEARCH_INTERVAL = 1000; // 1 second

export function LocationPickerOSM({ value, onChange, required, error, label, autoFetch }: LocationPickerProps) {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [autoFetched, setAutoFetched] = useState(false);
  const webViewRef = useRef<WebView>(null);
  const geocodingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (geocodingTimerRef.current) {
        clearTimeout(geocodingTimerRef.current);
      }
    };
  }, []);

  // Auto-fetch location when component mounts if required and autoFetch is enabled
  useEffect(() => {
    if (autoFetch && required && !value && !autoFetched && mapLoaded) {
      console.log('🎯 [LocationPicker] Auto-fetching current location (required field)');
      setAutoFetched(true);
      handleGetCurrentLocation();
    }
  }, [autoFetch, required, value, autoFetched, mapLoaded, handleGetCurrentLocation]);

  const reverseGeocode = async (latitude: number, longitude: number): Promise<Partial<LocationData>> => {
    try {
      // Reduce timeout from 10s to 5s to prevent long waits
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Geocoding timeout')), 5000);
      });

      const geocodePromise = Location.reverseGeocodeAsync({ latitude, longitude });
      const results = await Promise.race([geocodePromise, timeoutPromise]);

      // Check if component is still mounted
      if (!isMountedRef.current) {
        return {};
      }

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
      console.warn('Reverse geocoding failed:', error instanceof Error ? error.message : 'Unknown error');
      return {};
    }
  };

  const handleGetCurrentLocation = useCallback(async () => {
    try {
      console.log('🎯 [LocationPicker OSM] Getting current location...');
      setIsLoading(true);

      const { status } = await Location.requestForegroundPermissionsAsync();
      console.log('🔐 [LocationPicker OSM] Permission status:', status);

      if (status !== 'granted') {
        console.warn('⚠️ [LocationPicker OSM] Location permission denied');
        Alert.alert('Permission Required', 'Location permission is required to get your current location.');
        setIsLoading(false);
        return;
      }

      console.log('📡 [LocationPicker OSM] Requesting GPS position...');
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const { latitude, longitude } = location.coords;
      console.log('✅ [LocationPicker OSM] Got GPS position:', latitude, longitude);

      const locationData: LocationData = { latitude, longitude };
      console.log('🔔 [LocationPicker] Calling onChange with initial location (coordinates only):', JSON.stringify(locationData, null, 2));
      onChange(locationData);

      // Move map to location
      webViewRef.current?.injectJavaScript(`
        setMarker(${latitude}, ${longitude});
        true;
      `);

      setIsLoading(false);

      // Get address in background (non-blocking)
      try {
        const addressData = await reverseGeocode(latitude, longitude);
        console.log('📮 [LocationPicker OSM] Address data received:', JSON.stringify(addressData, null, 2));
        if (isMountedRef.current && Object.keys(addressData).length > 0) {
          const fullLocationData = { latitude, longitude, ...addressData };
          console.log('📮 [LocationPicker OSM] Updating with full location:', JSON.stringify(fullLocationData, null, 2));
          console.log('🔔 [LocationPicker] Calling onChange with full location (coordinates + address)');
          onChange(fullLocationData);
          console.log('✅ [LocationPicker] onChange called successfully with full location');
        } else {
          console.warn('⚠️ [LocationPicker] No address data to update or component unmounted');
        }
      } catch (error) {
        console.warn('⚠️ [LocationPicker OSM] Could not fetch address');
      }
    } catch (error) {
      console.error('❌ [LocationPicker OSM] Error getting location:', error);
      Alert.alert('Error', 'Failed to get current location. Please check your GPS is enabled.');
      setIsLoading(false);
    }
  }, [onChange]);

  const handleMessage = useCallback(async (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === 'mapReady') {
        console.log('✅ [LocationPicker OSM] Map ready');
        setMapLoaded(true);

        // Set initial marker if value exists
        if (value) {
          webViewRef.current?.injectJavaScript(`
            setMarker(${value.latitude}, ${value.longitude});
            true;
          `);
        }
      } else if (data.type === 'locationSelected') {
        console.log('📍 [LocationPicker OSM] Location selected:', data.lat, data.lng);
        const locationData: LocationData = {
          latitude: data.lat,
          longitude: data.lng,
        };

        onChange(locationData);

        // Clear any pending geocoding request
        if (geocodingTimerRef.current) {
          clearTimeout(geocodingTimerRef.current);
        }

        // Debounce geocoding to prevent multiple rapid requests (wait 500ms)
        geocodingTimerRef.current = setTimeout(async () => {
          try {
            const addressData = await reverseGeocode(data.lat, data.lng);
            console.log('📮 [LocationPicker OSM] Address data received:', JSON.stringify(addressData, null, 2));
            if (isMountedRef.current && Object.keys(addressData).length > 0) {
              const fullLocationData = { latitude: data.lat, longitude: data.lng, ...addressData };
              console.log('📮 [LocationPicker OSM] Updating with full location:', JSON.stringify(fullLocationData, null, 2));
              onChange(fullLocationData);
            }
          } catch (error) {
            console.warn('⚠️ [LocationPicker OSM] Could not fetch address');
          }
        }, 500);
      }
    } catch (error) {
      console.error('❌ [LocationPicker OSM] Error handling message:', error);
    }
  }, [onChange, value]);

  const handleClear = useCallback(() => {
    onChange(undefined);
    webViewRef.current?.injectJavaScript(`
      clearMarker();
      true;
    `);
  }, [onChange]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      Alert.alert('Error', 'Please enter a location to search');
      return;
    }

    // Rate limiting: ensure at least 1 second between requests
    const now = Date.now();
    const timeSinceLastSearch = now - lastSearchTime;
    if (timeSinceLastSearch < MIN_SEARCH_INTERVAL) {
      const waitTime = MIN_SEARCH_INTERVAL - timeSinceLastSearch;
      Alert.alert('Please Wait', `Please wait ${Math.ceil(waitTime / 1000)} second(s) before searching again.`);
      return;
    }

    lastSearchTime = now;
    setIsSearching(true);
    setSearchError(null);

    try {
      console.log('🔍 [LocationPicker OSM] Searching for:', searchQuery);

      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1&addressdetails=1`,
        {
          headers: {
            'Accept': 'application/json',
            'Accept-Language': 'en',
            'User-Agent': 'AutomaxMobileApp/1.0 (Contact: support@automax.com)',
          },
        }
      );

      console.log('📡 [LocationPicker OSM] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [LocationPicker OSM] API response not OK:', response.status, errorText);

        if (response.status === 403) {
          throw new Error('Access denied. The geocoding service may be temporarily unavailable.');
        } else if (response.status === 429) {
          throw new Error('Too many requests. Please wait a moment and try again.');
        } else {
          throw new Error(`Search failed (Status: ${response.status})`);
        }
      }

      const results = await response.json();
      console.log('📊 [LocationPicker OSM] Results count:', results.length);

      if (results.length === 0) {
        setSearchError('No results found');
        Alert.alert('No Results', 'No location found for your search query. Try different keywords.');
        setIsSearching(false);
        return;
      }

      const { lat, lon, display_name } = results[0];
      const latitude = parseFloat(lat);
      const longitude = parseFloat(lon);

      console.log('✅ [LocationPicker OSM] Search result:', display_name);
      console.log('📍 [LocationPicker OSM] Coordinates:', latitude, longitude);

      // Update marker and map view
      webViewRef.current?.injectJavaScript(`
        setMarker(${latitude}, ${longitude});
        true;
      `);

      const locationData: LocationData = {
        latitude,
        longitude,
      };

      onChange(locationData);

      setIsSearching(false);
      setSearchError(null);

      // Get detailed address in background
      try {
        const addressData = await reverseGeocode(latitude, longitude);
        if (isMountedRef.current && Object.keys(addressData).length > 0) {
          console.log('📮 [LocationPicker OSM] Address fetched:', addressData.address);
          onChange({ ...locationData, ...addressData });
        }
      } catch (error) {
        console.warn('⚠️ [LocationPicker OSM] Could not fetch detailed address');
      }
    } catch (error) {
      console.error('❌ [LocationPicker OSM] Search error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setSearchError(errorMessage);
      Alert.alert('Search Failed', errorMessage);
      setIsSearching(false);
    }
  }, [searchQuery, onChange]);

  const mapHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    body { margin: 0; padding: 0; }
    #map { width: 100%; height: 100vh; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    // Initialize map
    const map = L.map('map').setView([${value?.latitude || DEFAULT_LAT}, ${value?.longitude || DEFAULT_LNG}], ${value ? 15 : 11});

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);

    let marker = null;

    // Set marker function
    window.setMarker = function(lat, lng) {
      if (marker) {
        marker.setLatLng([lat, lng]);
      } else {
        marker = L.marker([lat, lng]).addTo(map);
      }
      map.setView([lat, lng], 15);
    };

    // Clear marker function
    window.clearMarker = function() {
      if (marker) {
        map.removeLayer(marker);
        marker = null;
      }
      map.setView([${DEFAULT_LAT}, ${DEFAULT_LNG}], 11);
    };

    // Handle map clicks
    map.on('click', function(e) {
      const lat = e.latlng.lat;
      const lng = e.latlng.lng;

      if (marker) {
        marker.setLatLng([lat, lng]);
      } else {
        marker = L.marker([lat, lng]).addTo(map);
      }

      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'locationSelected',
        lat: lat,
        lng: lng
      }));
    });

    // Notify React Native that map is ready
    map.whenReady(function() {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'mapReady'
      }));
    });
  </script>
</body>
</html>
  `;

  return (
    <View style={styles.container}>
      {label && (
        <Text style={styles.label}>
          {label} {required && <Text style={styles.required}>*</Text>}
        </Text>
      )}

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Ionicons name="search" size={18} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search for an address or place..."
            placeholderTextColor="#999"
            returnKeyType="search"
            onSubmitEditing={handleSearch}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#999" />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[styles.searchButton, (!searchQuery.trim() || isSearching) && styles.searchButtonDisabled]}
          onPress={handleSearch}
          disabled={!searchQuery.trim() || isSearching}
        >
          {isSearching ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="search" size={20} color="#fff" />
          )}
        </TouchableOpacity>
      </View>

      {searchError && (
        <Text style={styles.searchErrorText}>{searchError}</Text>
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
        <WebView
          ref={webViewRef}
          source={{ html: mapHtml }}
          style={styles.map}
          onMessage={handleMessage}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          renderLoading={() => (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#2EC4B6" />
              <Text style={styles.loadingText}>Loading map...</Text>
            </View>
          )}
        />
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
  searchContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 8,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchIcon: {
    marginRight: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    padding: 0,
  },
  searchButton: {
    backgroundColor: '#2EC4B6',
    borderRadius: 10,
    width: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchButtonDisabled: {
    backgroundColor: '#A0A0A0',
  },
  searchErrorText: {
    fontSize: 12,
    color: '#E74C3C',
    marginBottom: 8,
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

export default LocationPickerOSM;
