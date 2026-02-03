import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { getIncidents, getRequests } from '@/src/api/incidents';

const COLORS = {
  primary: '#1A237E',
  accent: '#2EC4B6',
  background: '#F5F7FA',
  white: '#FFFFFF',
  text: {
    primary: '#1A1A2E',
    secondary: '#64748B',
    muted: '#94A3B8',
  },
  error: '#DC2626',
};

interface IncidentMarker {
  id: string;
  incident_number: string;
  title: string;
  latitude: number;
  longitude: number;
  priority?: number;
  current_state?: { name: string };
}

const MapViewScreen = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const { type } = useLocalSearchParams<{ type?: string }>();
  const recordType = type || 'incident';
  const webViewRef = useRef<WebView>(null);

  const [incidents, setIncidents] = useState<IncidentMarker[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    fetchIncidentsWithLocation();
  }, []);

  const fetchIncidentsWithLocation = async () => {
    setLoading(true);
    try {
      const fetchFunction = recordType === 'request' ? getRequests : getIncidents;
      const response = await fetchFunction({
        page: 1,
        limit: 1000,
        has_location: true
      });

      if (response.success && response.data) {
        const incidentsWithLocation = response.data.filter(
          (inc: any) =>
            inc.latitude !== null &&
            inc.latitude !== undefined &&
            inc.longitude !== null &&
            inc.longitude !== undefined &&
            !isNaN(inc.latitude) &&
            !isNaN(inc.longitude)
        );
        setIncidents(incidentsWithLocation);
        console.log('✅ [MapView OSM] Loaded', incidentsWithLocation.length, 'incidents with location');

        // Update map markers
        if (mapReady && incidentsWithLocation.length > 0) {
          updateMapMarkers(incidentsWithLocation);
        }
      }
    } catch (error) {
      console.error('❌ [MapView OSM] Error fetching incidents:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateMapMarkers = (incidentList: IncidentMarker[]) => {
    const markersData = incidentList.map(inc => ({
      id: inc.id,
      lat: parseFloat(String(inc.latitude)),
      lng: parseFloat(String(inc.longitude)),
      title: inc.title,
      number: inc.incident_number,
      priority: inc.priority || 0,
      state: inc.current_state?.name || 'N/A',
    }));

    const markersJson = JSON.stringify(markersData);
    webViewRef.current?.injectJavaScript(`
      updateMarkers(${markersJson});
      true;
    `);
  };

  const getMarkerColor = (priority?: number) => {
    switch (priority) {
      case 1: return '#DC2626'; // Critical - Red
      case 2: return '#EA580C'; // High - Orange
      case 3: return '#F59E0B'; // Medium - Yellow
      case 4: return '#3B82F6'; // Low - Blue
      case 5: return '#22C55E'; // Very Low - Green
      default: return '#2EC4B6'; // Default - Teal
    }
  };

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === 'mapReady') {
        console.log('✅ [MapView OSM] Map ready');
        setMapReady(true);
        if (incidents.length > 0) {
          updateMapMarkers(incidents);
        }
      } else if (data.type === 'markerClicked') {
        console.log('📍 [MapView OSM] Marker clicked:', data.id);
        const detailsPage = recordType === 'request' ? '/request-details' : '/incident-details';
        router.push(`${detailsPage}?id=${data.id}`);
      }
    } catch (error) {
      console.error('❌ [MapView OSM] Error handling message:', error);
    }
  };

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
    .custom-marker {
      width: 30px;
      height: 30px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      border: 2px solid white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    }
    .custom-marker::after {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      width: 10px;
      height: 10px;
      background: white;
      border-radius: 50%;
      transform: translate(-50%, -50%);
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    // Initialize map centered on Dubai/Riyadh
    const map = L.map('map').setView([24.7136, 46.6753], 10);

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);

    let markers = [];

    // Update markers function
    window.updateMarkers = function(incidentsData) {
      // Clear existing markers
      markers.forEach(marker => map.removeLayer(marker));
      markers = [];

      if (!incidentsData || incidentsData.length === 0) {
        console.log('No incidents to display');
        return;
      }

      console.log('Adding', incidentsData.length, 'markers to map');

      // Get priority colors
      const getPriorityColor = (priority) => {
        switch (priority) {
          case 1: return '#DC2626'; // Critical
          case 2: return '#EA580C'; // High
          case 3: return '#F59E0B'; // Medium
          case 4: return '#3B82F6'; // Low
          case 5: return '#22C55E'; // Very Low
          default: return '#2EC4B6';
        }
      };

      // Add markers
      incidentsData.forEach(incident => {
        const color = getPriorityColor(incident.priority);

        // Create custom marker
        const markerHtml = '<div class="custom-marker" style="background-color: ' + color + ';"></div>';
        const customIcon = L.divIcon({
          html: markerHtml,
          className: 'custom-div-icon',
          iconSize: [30, 30],
          iconAnchor: [15, 30],
          popupAnchor: [0, -30]
        });

        const marker = L.marker([incident.lat, incident.lng], { icon: customIcon })
          .addTo(map)
          .bindPopup(\`
            <div style="min-width: 200px;">
              <strong style="color: #1A237E; font-size: 14px;">\${incident.number}</strong><br/>
              <span style="font-size: 13px; font-weight: 600;">\${incident.title}</span><br/>
              <span style="font-size: 12px; color: #64748B;">Status: \${incident.state}</span><br/>
              <button onclick="handleMarkerClick('\${incident.id}')" style="
                margin-top: 8px;
                padding: 6px 12px;
                background: #2EC4B6;
                color: white;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 12px;
                font-weight: 600;
              ">View Details</button>
            </div>
          \`);

        markers.push(marker);
      });

      // Fit map to show all markers
      if (markers.length > 0) {
        const group = L.featureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.1));
      }

      console.log('Markers added successfully');
    };

    // Handle marker click
    window.handleMarkerClick = function(incidentId) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'markerClicked',
        id: incidentId
      }));
    };

    // Notify React Native that map is ready
    map.whenReady(function() {
      console.log('Map initialized');
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'mapReady'
      }));
    });
  </script>
</body>
</html>
  `;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {recordType === 'request' ? t('map.requests', 'Requests Map') : t('map.incidents', 'Incidents Map')}
        </Text>
        <TouchableOpacity onPress={fetchIncidentsWithLocation} style={styles.refreshButton}>
          <Ionicons name="refresh" size={24} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      {loading && !mapReady ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      ) : (
        <>
          <WebView
            ref={webViewRef}
            source={{ html: mapHtml }}
            style={styles.map}
            onMessage={handleMessage}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={false}
          />

          {/* Info Badge */}
          <View style={styles.infoBadge}>
            <Ionicons name="location" size={20} color={COLORS.accent} />
            <Text style={styles.infoBadgeText}>
              {incidents.length} {recordType === 'request' ? t('map.requestsOnMap', 'requests on map') : t('map.incidentsOnMap', 'incidents on map')}
            </Text>
          </View>

          {/* Loading overlay for refresh */}
          {loading && mapReady && (
            <View style={styles.refreshOverlay}>
              <ActivityIndicator size="small" color={COLORS.white} />
            </View>
          )}
        </>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  refreshButton: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: COLORS.text.secondary,
    fontSize: 14,
  },
  map: {
    flex: 1,
  },
  infoBadge: {
    position: 'absolute',
    top: 80,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    gap: 6,
  },
  infoBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  refreshOverlay: {
    position: 'absolute',
    top: 80,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
});

export default MapViewScreen;
