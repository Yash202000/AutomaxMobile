import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Linking, Dimensions, Platform, ImageBackground } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ImageView from 'react-native-image-viewing';
import MapView, { Marker, Region } from 'react-native-maps';
import { useAudioPlayer, AudioSource } from 'expo-audio';
import { useTranslation } from 'react-i18next';
import { getIncidentById, getAvailableTransitions } from '@/src/api/incidents';
import { baseURL } from '@/src/api/client';
import * as SecureStore from 'expo-secure-store';
import { crashLogger } from '@/src/utils/crashLogger';

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
  card: '#FFFFFF',
  border: '#E2E8F0',
  error: '#DC2626',
  priority: {
    critical: '#DC2626',
    high: '#EA580C',
    medium: '#F59E0B',
    low: '#3B82F6',
    veryLow: '#22C55E',
  },
};

const priorityConfig: Record<number, { key: string; color: string }> = {
  1: { key: 'critical', color: COLORS.priority.critical },
  2: { key: 'high', color: COLORS.priority.high },
  3: { key: 'medium', color: COLORS.priority.medium },
  4: { key: 'low', color: COLORS.priority.low },
  5: { key: 'veryLow', color: COLORS.priority.veryLow },
};

interface IncidentData {
  id: string;
  incident_number: string;
  title: string;
  description?: string;
  classification?: { id: string; name: string };
  classification_id?: string;
  current_state?: { name: string };
  department?: { name: string };
  department_id?: string;
  location?: { id: string; name: string; address?: string };
  location_id?: string;
  assignee?: { id: string; first_name?: string; last_name?: string; phone?: string };
  assignee_id?: string;
  assignees?: Array<{ id: string; first_name?: string; last_name?: string; phone?: string }>;
  reporter?: { username: string; first_name?: string; last_name?: string; email?: string; phone?: string };
  reporter_email?: string;
  reporter_name?: string;
  priority?: number;
  latitude?: number;
  longitude?: number;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  created_at: string;
  attachments?: Array<{ id: string; file_name: string; mime_type: string }>;
  comments?: Array<{ id: string; content: string; author: { username: string }; created_at: string }>;
  transition_history?: Array<{
    id: string;
    from_state: { name: string };
    to_state: { name: string };
    performed_by: { username: string };
    transitioned_at: string;
    comment?: string;
  }>;
}

interface TransitionData {
  can_execute: boolean;
  transition: { id: string; name: string };
}

const AudioPlayer = ({ attachment, token }: { attachment: { id: string; file_name: string }; token: string }) => {
  const audioSource: AudioSource = {
    uri: `${baseURL}/attachments/${attachment.id}`,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  const player = useAudioPlayer(audioSource);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(player.currentTime);
    }, 100);

    return () => clearInterval(interval);
  }, [player.currentTime]);

  const handlePlayPause = () => {
    if (player.playing) {
      player.pause();
    } else {
      player.play();
    }
  };

  const handleStop = () => {
    player.pause();
    player.seekTo(0);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.audioPlayer}>
      <View style={styles.audioInfo}>
        <Ionicons name="musical-notes" size={20} color={COLORS.accent} />
        <Text style={styles.audioFileName} numberOfLines={1}>{attachment.file_name}</Text>
      </View>
      <View style={styles.audioControls}>
        <TouchableOpacity onPress={handlePlayPause} style={styles.audioButton}>
          <Ionicons name={player.playing ? 'pause' : 'play'} size={24} color={COLORS.accent} />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleStop} style={styles.audioButton}>
          <Ionicons name="stop" size={24} color={COLORS.text.muted} />
        </TouchableOpacity>
        <Text style={styles.audioTime}>
          {formatTime(currentTime)} / {formatTime(player.duration || 0)}
        </Text>
      </View>
    </View>
  );
};

const InfoRow = ({ icon, label, value, iconColor = COLORS.text.secondary }: { icon: string; label: string; value: string; iconColor?: string }) => (
  <View style={styles.infoRow}>
    <View style={styles.infoRowLeft}>
      <Ionicons name={icon as any} size={18} color={iconColor} />
      <Text style={styles.infoLabel}>{label}</Text>
    </View>
    <Text style={styles.infoValue}>{value || 'N/A'}</Text>
  </View>
);

const SectionHeader = ({ title, icon }: { title: string; icon: string }) => (
  <View style={styles.sectionHeader}>
    <Ionicons name={icon as any} size={20} color={COLORS.accent} />
    <Text style={styles.sectionTitle}>{title}</Text>
  </View>
);

const IncidentDetailsScreen = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [incident, setIncident] = useState<IncidentData | null>(null);
  const [availableTransitions, setAvailableTransitions] = useState<TransitionData[]>([]);
  const [attachments, setAttachments] = useState<Array<{ id: string; file_name: string; mime_type: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [isImageViewerVisible, setImageViewerVisible] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [mapRegion, setMapRegion] = useState<Region | null>(null);
  const mapRef = useRef<MapView>(null);

  const imageAttachments = attachments.filter(att => att.mime_type?.startsWith('image/'));
  const audioAttachments = attachments.filter(att => att.mime_type?.startsWith('audio/'));
  const otherAttachments = attachments.filter(att => !att.mime_type?.startsWith('image/') && !att.mime_type?.startsWith('audio/'));

  useEffect(() => {
    const fetchToken = async () => {
      const storedToken = await SecureStore.getItemAsync('authToken');
      setToken(storedToken);
    };
    fetchToken();
  }, []);

  const fetchDetails = useCallback(async () => {
    const incidentId = Array.isArray(id) ? id[0] : id;
    if (!incidentId) return;

    setLoading(true);

    try {
      const [detailsResponse, transitionsResponse] = await Promise.all([
        getIncidentById(incidentId),
        getAvailableTransitions(incidentId),
      ]);

      if (detailsResponse.success) {
        setIncident(detailsResponse.data);
        setAttachments(detailsResponse.data.attachments || []);
      } else {
        setError(detailsResponse.error);

        // Log failed API response
        crashLogger.logWarning('Failed to fetch incident details', {
          screen: 'IncidentDetailsScreen',
          action: 'fetchDetails',
          incidentId: incidentId,
          error: detailsResponse.error,
        }).catch(err => console.error('Failed to log warning:', err));

        Alert.alert(t('common.error'), `${t('details.fetchError')}: ${detailsResponse.error}`);
      }

      if (transitionsResponse.success) {
        const executableTransitions = transitionsResponse.data.filter((t: TransitionData) => t.can_execute);
        setAvailableTransitions(executableTransitions);
      } else {
        setAvailableTransitions([]);
      }
    } catch (error) {
      console.error('Error fetching incident details:', error);

      // Log unexpected error
      crashLogger.logError(error as Error, {
        screen: 'IncidentDetailsScreen',
        action: 'fetchDetails',
        incidentId: incidentId,
        context: 'Unexpected error while fetching incident details',
      }).catch(err => console.error('Failed to log error:', err));

      setError('Failed to load incident details');
      Alert.alert(
        t('common.error'),
        'An unexpected error occurred while loading incident details. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useFocusEffect(
    useCallback(() => {
      fetchDetails();
    }, [fetchDetails])
  );

  const handleZoomIn = () => {
    if (mapRef.current && mapRegion) {
      const newRegion = {
        ...mapRegion,
        latitudeDelta: mapRegion.latitudeDelta / 2,
        longitudeDelta: mapRegion.longitudeDelta / 2,
      };
      mapRef.current.animateToRegion(newRegion, 300);
      setMapRegion(newRegion);
    }
  };

  const handleZoomOut = () => {
    if (mapRef.current && mapRegion) {
      const newRegion = {
        ...mapRegion,
        latitudeDelta: Math.min(mapRegion.latitudeDelta * 2, 180),
        longitudeDelta: Math.min(mapRegion.longitudeDelta * 2, 360),
      };
      mapRef.current.animateToRegion(newRegion, 300);
      setMapRegion(newRegion);
    }
  };

  const handleOpenDirections = () => {
    if (incident?.latitude && incident?.longitude) {
      const destination = `${incident.latitude},${incident.longitude}`;
      const url = Platform.select({
        ios: `maps://app?daddr=${destination}`,
        android: `google.navigation:q=${destination}`,
      });
      const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${destination}`;

      Linking.canOpenURL(url || webUrl)
        .then((supported) => {
          if (supported && url) {
            return Linking.openURL(url);
          } else {
            return Linking.openURL(webUrl);
          }
        })
        .catch((error) => {
          console.error('Error opening directions:', error);

          // Log error
          crashLogger.logError(error as Error, {
            screen: 'IncidentDetailsScreen',
            action: 'openDirections',
            incidentId: incident?.id,
            latitude: incident?.latitude,
            longitude: incident?.longitude,
            context: 'Failed to open maps directions',
          }).catch(err => console.error('Failed to log error:', err));

          Alert.alert(
            t('common.error'),
            'Failed to open maps. Please check if you have a maps app installed.'
          );
        });
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !incident) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={64} color={COLORS.text.muted} />
          <Text style={styles.errorTitle}>{t('errors.oops')}</Text>
          <Text style={styles.errorText}>{error || t('details.notFound')}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchDetails}>
            <Ionicons name="refresh" size={20} color={COLORS.white} />
            <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const config = priorityConfig[incident.priority as number] || { key: 'unknown', color: COLORS.text.muted };
  const priorityText = t(`priorities.${config.key}`, config.key);

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <ImageBackground source={require('@/assets/images/background.png')} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{incident.incident_number}</Text>
          <Text style={styles.headerSubtitle}>{t('incidents.incidentDetails')}</Text>
        </View>
        <View style={{ width: 40 }} />
      </ImageBackground>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Title Card */}
        <View style={styles.titleCard}>
          <View style={[styles.priorityBar, { backgroundColor: config.color }]} />
          <View style={styles.titleCardContent}>
            <View style={styles.titleHeader}>
              <View style={[styles.priorityBadge, { backgroundColor: config.color }]}>
                <Ionicons name="flag" size={12} color={COLORS.white} />
                <Text style={styles.priorityBadgeText}>{priorityText}</Text>
              </View>
              <Text style={styles.dateText}>{new Date(incident.created_at).toLocaleDateString()}</Text>
            </View>
            <Text style={styles.incidentTitle}>{incident.title}</Text>
            {incident.current_state && (
              <View style={styles.statusContainer}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>{incident.current_state.name}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Details Card */}
        <View style={styles.card}>
          <SectionHeader title={t('incidents.incidentDetails')} icon="information-circle" />
          <View style={styles.infoContainer}>
            <InfoRow icon="grid-outline" label={t('details.classification')} value={incident.classification?.name || ''} iconColor={COLORS.accent} />
            <InfoRow icon="business-outline" label={t('details.department')} value={incident.department?.name || ''} iconColor="#8B5CF6" />
            <InfoRow icon="person-outline" label={t('details.assignees')}
              value={incident.assignees?.length
                ? incident.assignees.map(a => `${a.first_name || ''} ${a.last_name || ''}`.trim()).join(', ')
                : incident.assignee
                  ? `${incident.assignee.first_name || ''} ${incident.assignee.last_name || ''}`.trim()
                  : ''
              }
              iconColor="#EC4899"
            />
            {incident.location && (
              <InfoRow icon="location-outline" label={t('details.location')} value={incident.location.name} iconColor={COLORS.error} />
            )}
          </View>
        </View>

        {/* Description Card */}
        {incident.description && (
          <View style={styles.card}>
            <SectionHeader title={t('details.description')} icon="document-text" />
            <Text style={styles.descriptionText}>{incident.description}</Text>
          </View>
        )}

        {/* Reporter Card */}
        <View style={styles.card}>
          <SectionHeader title={t('details.reporter')} icon="person-circle" />
          <View style={styles.reporterCard}>
            <View style={styles.reporterAvatar}>
              <Text style={styles.reporterAvatarText}>
                {incident.reporter?.first_name?.[0] || incident.reporter?.username?.[0] || 'U'}
              </Text>
            </View>
            <View style={styles.reporterInfo}>
              <Text style={styles.reporterName}>
                {incident.reporter?.first_name
                  ? `${incident.reporter.first_name} ${incident.reporter.last_name || ''}`
                  : incident.reporter?.username || incident.reporter_name || 'Unknown'}
              </Text>
              {(incident.reporter_email || incident.reporter?.email) && (
                <Text style={styles.reporterEmail}>{incident.reporter_email || incident.reporter?.email}</Text>
              )}
            </View>
            <View style={styles.reporterActions}>
              {(incident.reporter_email || incident.reporter?.email) && (
                <TouchableOpacity
                  style={styles.reporterActionButton}
                  onPress={() => Linking.openURL(`mailto:${incident.reporter_email || incident.reporter?.email}`)}
                >
                  <Ionicons name="mail" size={18} color={COLORS.accent} />
                </TouchableOpacity>
              )}
              {incident.reporter?.phone && (
                <TouchableOpacity
                  style={styles.reporterActionButton}
                  onPress={() => Linking.openURL(`tel:${incident.reporter?.phone}`)}
                >
                  <Ionicons name="call" size={18} color={COLORS.accent} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* Comments Card */}
        <View style={styles.card}>
          <SectionHeader title={t('details.comments')} icon="chatbubbles" />
          {incident.comments && incident.comments.length > 0 ? (
            incident.comments.map(comment => (
              <View style={styles.commentItem} key={comment.id}>
                <View style={styles.commentHeader}>
                  <View style={styles.commentAvatar}>
                    <Text style={styles.commentAvatarText}>{comment.author.username[0]}</Text>
                  </View>
                  <View style={styles.commentMeta}>
                    <Text style={styles.commentAuthor}>{comment.author.username}</Text>
                    <Text style={styles.commentDate}>{new Date(comment.created_at).toLocaleString()}</Text>
                  </View>
                </View>
                <Text style={styles.commentContent}>{comment.content}</Text>
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="chatbubble-outline" size={32} color={COLORS.text.muted} />
              <Text style={styles.emptyStateText}>{t('details.noComments')}</Text>
            </View>
          )}
        </View>

        {/* Attachments Card */}
        <View style={styles.card}>
          <SectionHeader title={t('details.attachments')} icon="attach" />
          {imageAttachments.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
              {imageAttachments.map((att, index) => (
                <TouchableOpacity
                  key={att.id}
                  onPress={() => { setCurrentImageIndex(index); setImageViewerVisible(true); }}
                  style={styles.imageThumb}
                >
                  <Image
                    source={{ uri: `${baseURL}/attachments/${att.id}`, headers: { Authorization: `Bearer ${token}` } }}
                    style={styles.attachmentImage}
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
          {audioAttachments.map(att => (
            <AudioPlayer key={att.id} attachment={att} token={token || ''} />
          ))}
          {otherAttachments.map(att => (
            <TouchableOpacity
              key={att.id}
              onPress={() => Linking.openURL(`${baseURL}/attachments/${att.id}`)}
              style={styles.fileAttachment}
            >
              <View style={styles.fileIconContainer}>
                <Ionicons name="document" size={20} color={COLORS.accent} />
              </View>
              <Text style={styles.fileName} numberOfLines={1}>{att.file_name}</Text>
              <Ionicons name="download-outline" size={20} color={COLORS.text.muted} />
            </TouchableOpacity>
          ))}
          {attachments.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="images-outline" size={32} color={COLORS.text.muted} />
              <Text style={styles.emptyStateText}>{t('details.noAttachments')}</Text>
            </View>
          )}
        </View>

        <ImageView
          images={imageAttachments.map(att => ({ uri: `${baseURL}/attachments/${att.id}`, headers: { Authorization: `Bearer ${token}` } }))}
          imageIndex={currentImageIndex}
          visible={isImageViewerVisible}
          onRequestClose={() => setImageViewerVisible(false)}
        />

        {/* Geolocation Card */}
        {(incident.latitude !== undefined && incident.longitude !== undefined) && (
          <View style={styles.card}>
            <SectionHeader title={t('details.geolocation')} icon="navigate" />
            <View style={styles.mapContainer}>
              <MapView
                ref={mapRef}
                style={styles.map}
                initialRegion={{
                  latitude: incident.latitude,
                  longitude: incident.longitude,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }}
                onRegionChangeComplete={(region) => setMapRegion(region)}
                onMapReady={() => {
                  setMapRegion({
                    latitude: incident.latitude!,
                    longitude: incident.longitude!,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                  });
                }}
              >
                <Marker
                  coordinate={{ latitude: incident.latitude, longitude: incident.longitude }}
                  title={incident.title}
                  description={incident.address || 'Incident Location'}
                  pinColor={COLORS.error}
                />
              </MapView>
              {/* Zoom Controls */}
              <View style={styles.mapControls}>
                <TouchableOpacity style={styles.mapControlButton} onPress={handleZoomIn}>
                  <Ionicons name="add" size={22} color={COLORS.text.primary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.mapControlButton} onPress={handleZoomOut}>
                  <Ionicons name="remove" size={22} color={COLORS.text.primary} />
                </TouchableOpacity>
              </View>
            </View>
            {/* Address and Directions */}
            <View style={styles.mapFooter}>
              {incident.address && (
                <View style={styles.addressContainer}>
                  <Ionicons name="location" size={16} color={COLORS.error} />
                  <Text style={styles.addressText}>{incident.address}</Text>
                </View>
              )}
              <TouchableOpacity style={styles.directionsButton} onPress={handleOpenDirections}>
                <Ionicons name="navigate" size={18} color={COLORS.white} />
                <Text style={styles.directionsButtonText}>{t('details.directions') || 'Directions'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Transition History Card */}
        <View style={[styles.card, { marginBottom: availableTransitions.length > 0 ? 100 : 30 }]}>
          <SectionHeader title={t('details.transitionHistory')} icon="git-compare" />
          {incident.transition_history && incident.transition_history.length > 0 ? (
            <View style={styles.timeline}>
              {incident.transition_history.map((item, index) => (
                <View key={item.id} style={styles.timelineItem}>
                  <View style={styles.timelineLeft}>
                    <View style={[styles.timelineDot, { backgroundColor: COLORS.accent }]} />
                    {index < incident.transition_history!.length - 1 && <View style={styles.timelineLine} />}
                  </View>
                  <View style={styles.timelineContent}>
                    <View style={styles.transitionBadges}>
                      <View style={styles.fromBadge}>
                        <Text style={styles.fromBadgeText}>{item.from_state.name}</Text>
                      </View>
                      <Ionicons name="arrow-forward" size={14} color={COLORS.text.muted} />
                      <View style={styles.toBadge}>
                        <Text style={styles.toBadgeText}>{item.to_state.name}</Text>
                      </View>
                    </View>
                    <Text style={styles.transitionMeta}>
                      {t('details.by')} {item.performed_by.username} • {new Date(item.transitioned_at).toLocaleDateString()}
                    </Text>
                    {item.comment && (
                      <View style={styles.transitionComment}>
                        <Ionicons name="chatbubble-ellipses-outline" size={14} color={COLORS.text.secondary} />
                        <Text style={styles.transitionCommentText}>"{item.comment}"</Text>
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="time-outline" size={32} color={COLORS.text.muted} />
              <Text style={styles.emptyStateText}>{t('details.noTransitionHistory')}</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Update Button */}
      {availableTransitions.length > 0 && (
        <TouchableOpacity
          style={styles.updateButton}
          onPress={() => router.push({
            pathname: '/update-status',
            params: {
              id: incident.id,
              transitions: JSON.stringify(availableTransitions),
              incident: JSON.stringify({
                id: incident.id,
                classification_id: incident.classification_id,
                location_id: incident.location_id,
                department_id: incident.department_id,
                assignee_id: incident.assignee_id,
              }),
            },
          })}
          activeOpacity={0.8}
        >
          <Ionicons name="sync" size={20} color={COLORS.white} />
          <Text style={styles.updateButtonText}>{t('details.update')}</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.primary },
  centered: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: COLORS.background, paddingHorizontal: 40,
  },
  loadingText: { marginTop: 12, color: COLORS.text.secondary, fontSize: 14 },
  errorTitle: { fontSize: 20, fontWeight: '600', color: COLORS.text.primary, marginTop: 16 },
  errorText: { fontSize: 14, color: COLORS.text.secondary, textAlign: 'center', marginTop: 8 },
  retryButton: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.accent,
    paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginTop: 24, gap: 8,
  },
  retryButtonText: { color: COLORS.white, fontSize: 16, fontWeight: '600' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20,
  },
  backButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { color: COLORS.white, fontSize: 18, fontWeight: 'bold' },
  headerSubtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },

  container: { flex: 1, backgroundColor: COLORS.background },

  titleCard: {
    backgroundColor: COLORS.white, marginHorizontal: 16, marginTop: -10,
    borderRadius: 16, flexDirection: 'row', overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12 },
      android: { elevation: 4 },
    }),
  },
  priorityBar: { width: 5 },
  titleCardContent: { flex: 1, padding: 16 },
  titleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  priorityBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, gap: 4 },
  priorityBadgeText: { color: COLORS.white, fontSize: 11, fontWeight: 'bold' },
  dateText: { fontSize: 12, color: COLORS.text.muted },
  incidentTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text.primary, marginBottom: 8 },
  statusContainer: { flexDirection: 'row', alignItems: 'center' },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.accent, marginRight: 8 },
  statusText: { fontSize: 14, color: COLORS.accent, fontWeight: '600' },

  card: {
    backgroundColor: COLORS.white, marginHorizontal: 16, marginTop: 16, borderRadius: 16, padding: 16,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
      android: { elevation: 2 },
    }),
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.text.primary },

  infoContainer: {},
  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  infoRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoLabel: { fontSize: 14, color: COLORS.text.secondary },
  infoValue: { fontSize: 14, fontWeight: '600', color: COLORS.text.primary, maxWidth: '50%', textAlign: 'right' },

  descriptionText: { fontSize: 14, color: COLORS.text.secondary, lineHeight: 22 },

  reporterCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.background, borderRadius: 12, padding: 12 },
  reporterAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  reporterAvatarText: { color: COLORS.white, fontSize: 18, fontWeight: 'bold' },
  reporterInfo: { flex: 1, marginLeft: 12 },
  reporterName: { fontSize: 15, fontWeight: '600', color: COLORS.text.primary },
  reporterEmail: { fontSize: 12, color: COLORS.text.secondary, marginTop: 2 },
  reporterActions: { flexDirection: 'row', gap: 8 },
  reporterActionButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.white, justifyContent: 'center', alignItems: 'center' },

  commentItem: { backgroundColor: COLORS.background, borderRadius: 12, padding: 12, marginBottom: 10 },
  commentHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  commentAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.accent, justifyContent: 'center', alignItems: 'center' },
  commentAvatarText: { color: COLORS.white, fontSize: 13, fontWeight: 'bold' },
  commentMeta: { marginLeft: 10 },
  commentAuthor: { fontSize: 13, fontWeight: '600', color: COLORS.text.primary },
  commentDate: { fontSize: 11, color: COLORS.text.muted },
  commentContent: { fontSize: 14, color: COLORS.text.secondary, lineHeight: 20 },

  emptyState: { alignItems: 'center', paddingVertical: 24 },
  emptyStateText: { fontSize: 14, color: COLORS.text.muted, marginTop: 8 },

  imageScroll: { marginBottom: 12 },
  imageThumb: { marginRight: 10, borderRadius: 12, overflow: 'hidden' },
  attachmentImage: { width: 120, height: 90, borderRadius: 12 },
  fileAttachment: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.background, borderRadius: 10, padding: 12, marginBottom: 8 },
  fileIconContainer: { width: 36, height: 36, borderRadius: 8, backgroundColor: `${COLORS.accent}20`, justifyContent: 'center', alignItems: 'center' },
  fileName: { flex: 1, marginLeft: 12, fontSize: 14, color: COLORS.text.primary },

  audioPlayer: { backgroundColor: COLORS.background, borderRadius: 10, padding: 12, marginBottom: 8 },
  audioInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  audioFileName: { flex: 1, marginLeft: 8, fontSize: 14, color: COLORS.text.primary, fontWeight: '500' },
  audioPlayerControl: { width: '100%', height: 50 },
  audioControls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  audioButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: `${COLORS.accent}20`, justifyContent: 'center', alignItems: 'center' },
  audioTime: { fontSize: 12, color: COLORS.text.secondary, marginLeft: 'auto' },

  mapContainer: { height: 200, borderRadius: 12, overflow: 'hidden', marginBottom: 12, position: 'relative' },
  map: { width: '100%', height: '100%' },
  mapControls: {
    position: 'absolute',
    right: 10,
    top: 10,
    backgroundColor: COLORS.white,
    borderRadius: 8,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4 },
      android: { elevation: 4 },
    }),
  },
  mapControlButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  mapFooter: { gap: 12 },
  addressContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addressText: { fontSize: 13, color: COLORS.text.secondary, flex: 1 },
  directionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    gap: 8,
  },
  directionsButtonText: { color: COLORS.white, fontSize: 14, fontWeight: '600' },

  timeline: {},
  timelineItem: { flexDirection: 'row' },
  timelineLeft: { alignItems: 'center', marginRight: 12 },
  timelineDot: { width: 12, height: 12, borderRadius: 6 },
  timelineLine: { width: 2, flex: 1, backgroundColor: COLORS.border, marginVertical: 4 },
  timelineContent: { flex: 1, paddingBottom: 20 },
  transitionBadges: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  fromBadge: { backgroundColor: '#FEE2E2', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  fromBadgeText: { fontSize: 12, color: COLORS.error, fontWeight: '600' },
  toBadge: { backgroundColor: '#D1FAE5', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  toBadgeText: { fontSize: 12, color: '#059669', fontWeight: '600' },
  transitionMeta: { fontSize: 12, color: COLORS.text.muted },
  transitionComment: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 8, gap: 6 },
  transitionCommentText: { fontSize: 13, color: COLORS.text.secondary, fontStyle: 'italic', flex: 1 },

  updateButton: {
    position: 'absolute', bottom: 30, left: 20, right: 20,
    backgroundColor: COLORS.accent, flexDirection: 'row', justifyContent: 'center',
    alignItems: 'center', paddingVertical: 16, borderRadius: 14, gap: 8,
    ...Platform.select({
      ios: { shadowColor: COLORS.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12 },
      android: { elevation: 8 },
    }),
  },
  updateButtonText: { color: COLORS.white, fontSize: 16, fontWeight: 'bold' },
});

export default IncidentDetailsScreen;
