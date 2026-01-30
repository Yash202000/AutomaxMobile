import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import MapView, { Marker, Callout, Region } from 'react-native-maps';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { getIncidents, getRequests, getIncidentById, getRequestById } from '@/src/api/incidents';
import { baseURL } from '@/src/api/client';
import * as SecureStore from 'expo-secure-store';

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
  attachments_count?: number;
  attachments?: Array<{ id: string; file_name: string; mime_type: string; url?: string }>;
}

const MapViewScreen = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const { type } = useLocalSearchParams<{ type?: string }>();
  const recordType = type || 'incident';
  const mapRef = useRef<MapView>(null);

  const [incidents, setIncidents] = useState<IncidentMarker[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [mapRegion, setMapRegion] = useState<Region>({
    latitude: 24.7136,
    longitude: 46.6753,
    latitudeDelta: 0.5,
    longitudeDelta: 0.5,
  });

  useEffect(() => {
    const fetchToken = async () => {
      const storedToken = await SecureStore.getItemAsync('authToken');
      setToken(storedToken);
      console.log('Auth token retrieved:', storedToken ? 'Token exists' : 'No token found');
    };
    fetchToken();
  }, []);

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

        // Center map on first incident or use default location
        if (incidentsWithLocation.length > 0) {
          const firstIncident = incidentsWithLocation[0];
          setMapRegion({
            latitude: parseFloat(firstIncident.latitude),
            longitude: parseFloat(firstIncident.longitude),
            latitudeDelta: 0.5,
            longitudeDelta: 0.5,
          });
        }
      }
    } catch (error) {
      console.error('Error fetching incidents:', error);
    } finally {
      setLoading(false);
    }
  };

  const getMarkerColor = (priority?: number) => {
    switch (priority) {
      case 1: return '#DC2626'; // Critical
      case 2: return '#EA580C'; // High
      case 3: return '#F59E0B'; // Medium
      case 4: return '#3B82F6'; // Low
      case 5: return '#22C55E'; // Very Low
      default: return COLORS.accent;
    }
  };

  const getFirstImageAttachment = (attachments?: Array<{ id: string; mime_type: string }>) => {
    if (!attachments) return null;
    return attachments.find(att => att.mime_type?.startsWith('image/'));
  };


  const handleMarkerPress = async (incident: IncidentMarker) => {
    console.log('Marker pressed for incident:', incident.id);

    // Center map on the selected marker
    mapRef.current?.animateToRegion({
      latitude: incident.latitude,
      longitude: incident.longitude,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    }, 1000);

    // Fetch full incident details with attachments
    setSelectedIncidentId(incident.id);
    try {
      const fetchFunction = recordType === 'request' ? getRequestById : getIncidentById;
      console.log('Fetching details for:', incident.id, 'Type:', recordType);
      const response = await fetchFunction(incident.id);
      console.log('Details response:', response);

      if (response.success && response.data) {
        console.log('Attachments in response:', response.data.attachments);
        console.log('Attachments count:', response.data.attachments?.length);

        // Update the incident in the list with full details including attachments
        setIncidents(prevIncidents =>
          prevIncidents.map(inc =>
            inc.id === incident.id
              ? { ...inc, attachments: response.data.attachments }
              : inc
          )
        );

        console.log('Updated incident with attachments');
      }
    } catch (error) {
      console.error('Error fetching incident details:', error);
    }
  };

  const handleCalloutPress = (incidentId: string) => {
    const detailsPage = recordType === 'request' ? '/request-details' : '/incident-details';
    router.push(`${detailsPage}?id=${incidentId}`);
  };

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

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      ) : (
        <>
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={mapRegion}
            showsUserLocation
            showsMyLocationButton
          >
            {incidents.map((incident) => {
              // Double-check coordinates are valid before rendering
              if (
                !incident.latitude ||
                !incident.longitude ||
                isNaN(incident.latitude) ||
                isNaN(incident.longitude)
              ) {
                return null;
              }

              const imageAttachment = getFirstImageAttachment(incident.attachments);
              const hasAttachmentsCount = incident.attachments_count && incident.attachments_count > 0;
              const hasLoadedAttachments = incident.attachments && incident.attachments.length > 0;

              if (incident.attachments) {
                console.log('Rendering marker with attachments for:', incident.id, incident.attachments.length);
                console.log('First image attachment:', imageAttachment);
                if (imageAttachment) {
                  console.log('Pre-signed URL from API:', imageAttachment.url);
                  console.log('Using backend URL instead:', `${baseURL}/attachments/${imageAttachment.id}`);
                }
              }

              return (
                <Marker
                  key={`${incident.id}-${incident.attachments?.length || 0}`}
                  coordinate={{
                    latitude: parseFloat(String(incident.latitude)),
                    longitude: parseFloat(String(incident.longitude)),
                  }}
                  pinColor={getMarkerColor(incident.priority)}
                  onPress={() => handleMarkerPress(incident)}
                >
                  <Callout
                    tooltip={false}
                    onPress={() => handleCalloutPress(incident.id)}
                  >
                    <View style={styles.calloutContainer}>
                      <View style={styles.calloutHeader}>
                        <Text style={styles.calloutNumber}>{incident.incident_number}</Text>
                        <View style={[styles.priorityDot, { backgroundColor: getMarkerColor(incident.priority) }]} />
                      </View>
                      <Text style={styles.calloutTitle} numberOfLines={2}>
                        {incident.title}
                      </Text>
                      <Text style={styles.calloutStatus}>
                        {incident.current_state?.name || 'N/A'}
                      </Text>
                      {imageAttachment ? (
                        <Image
                          source={{
                            uri: `${baseURL}/attachments/${imageAttachment.id}`,
                            headers: { Authorization: `Bearer ${token}` }
                          }}
                          style={styles.calloutImage}
                          contentFit="cover"
                          onLoad={() => console.log('Image loaded successfully for:', incident.id)}
                          onError={(error) => console.log('Image load error:', error, 'URL:', `${baseURL}/attachments/${imageAttachment.id}`)}
                        />
                      ) : hasLoadedAttachments ? (
                        <View style={styles.attachmentPlaceholder}>
                          <Ionicons name="document-attach" size={32} color={COLORS.accent} />
                          <Text style={styles.attachmentText}>
                            {incident.attachments.length} {incident.attachments.length === 1 ? t('details.attachment', 'Attachment') : t('details.attachments', 'Attachments')}
                          </Text>
                        </View>
                      ) : hasAttachmentsCount ? (
                        <View style={styles.attachmentPlaceholder}>
                          <Ionicons name="images" size={32} color={COLORS.text.muted} />
                          <Text style={styles.attachmentText}>
                            {incident.attachments_count} {incident.attachments_count === 1 ? t('details.attachment', 'Attachment') : t('details.attachments', 'Attachments')}
                          </Text>
                          <Text style={styles.tapToLoadText}>{t('map.tapToLoad', 'Tap marker to load')}</Text>
                        </View>
                      ) : null}
                      <TouchableOpacity
                        style={styles.viewButton}
                        onPress={() => handleCalloutPress(incident.id)}
                      >
                        <Text style={styles.viewButtonText}>{t('common.viewDetails', 'View Details')}</Text>
                        <Ionicons name="arrow-forward" size={16} color={COLORS.accent} />
                      </TouchableOpacity>
                    </View>
                  </Callout>
                </Marker>
              );
            })}
          </MapView>

          {/* Info Badge */}
          <View style={styles.infoBadge}>
            <Ionicons name="location" size={20} color={COLORS.accent} />
            <Text style={styles.infoBadgeText}>
              {incidents.length} {recordType === 'request' ? t('map.requestsOnMap', 'requests on map') : t('map.incidentsOnMap', 'incidents on map')}
            </Text>
          </View>
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
  calloutContainer: {
    width: 250,
    padding: 12,
    backgroundColor: COLORS.white,
    borderRadius: 12,
  },
  calloutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  calloutNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  priorityDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  calloutTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: 4,
  },
  calloutStatus: {
    fontSize: 12,
    color: COLORS.text.secondary,
    marginBottom: 8,
  },
  calloutImage: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    marginBottom: 8,
  },
  attachmentPlaceholder: {
    width: '100%',
    height: 80,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  attachmentText: {
    fontSize: 12,
    color: COLORS.text.muted,
    fontWeight: '500',
  },
  tapToLoadText: {
    fontSize: 10,
    color: COLORS.text.muted,
    fontStyle: 'italic',
    marginTop: 2,
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${COLORS.accent}20`,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 4,
  },
  viewButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.accent,
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
});

export default MapViewScreen;
