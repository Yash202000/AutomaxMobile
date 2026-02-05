import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Linking, Dimensions, Platform, ImageBackground } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter, useLocalSearchParams, useFocusEffect, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ImageView from 'react-native-image-viewing';
import { useTranslation } from 'react-i18next';
import { Audio } from 'expo-av';
import { getIncidentById, getAvailableTransitions } from '@/src/api/incidents';
import { baseURL } from '@/src/api/client';
import * as SecureStore from 'expo-secure-store';

const COLORS = {
  primary: '#1A237E',
  accent: '#3498DB',
  accentLight: '#E3F2FD',
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

const QueryDetailsScreen = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [query, setQuery] = useState<any>(null);
  const [availableTransitions, setAvailableTransitions] = useState<any[]>([]);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [isImageViewerVisible, setImageViewerVisible] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [audioPosition, setAudioPosition] = useState<Record<string, number>>({});
  const [audioDuration, setAudioDuration] = useState<Record<string, number>>({});

  const imageAttachments = attachments.filter(att => att.mime_type?.startsWith('image/'));
  const audioAttachments = attachments.filter(att => att.mime_type?.startsWith('audio/') || att.file_name?.match(/\.(mp3|wav|m4a|aac|ogg|webm)$/i));
  const otherAttachments = attachments.filter(att => !att.mime_type?.startsWith('image/') && !att.mime_type?.startsWith('audio/') && !att.file_name?.match(/\.(mp3|wav|m4a|aac|ogg|webm)$/i));

  useEffect(() => {
    const fetchToken = async () => {
      const storedToken = await SecureStore.getItemAsync('authToken');
      setToken(storedToken);
    };
    fetchToken();
  }, []);

  const fetchDetails = useCallback(async () => {
    const queryId = Array.isArray(id) ? id[0] : id;
    if (!queryId) return;

    setLoading(true);
    const [detailsResponse, transitionsResponse] = await Promise.all([
      getIncidentById(queryId),
      getAvailableTransitions(queryId),
    ]);

    if (detailsResponse.success) {
      setQuery(detailsResponse.data);
      setAttachments(detailsResponse.data.attachments || []);
    } else {
      setError(detailsResponse.error);
      Alert.alert(t('common.error'), `${t('details.fetchError')}: ${detailsResponse.error}`);
    }

    if (transitionsResponse.success) {
      setAvailableTransitions(transitionsResponse.data.filter((t: any) => t.can_execute));
    } else {
      setAvailableTransitions([]);
    }

    setLoading(false);
  }, [id, t]);

  useFocusEffect(
    useCallback(() => {
      fetchDetails();
    }, [fetchDetails])
  );

  // Audio playback functions
  const playAudio = async (audioId: string) => {
    try {
      // Stop currently playing audio
      if (sound) {
        await sound.unloadAsync();
      }

      const audioUrl = `${baseURL}/attachments/${audioId}`;
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: audioUrl, headers: { Authorization: `Bearer ${token}` } },
        { shouldPlay: true },
        (status) => {
          if (status.isLoaded) {
            setAudioPosition({ ...audioPosition, [audioId]: status.positionMillis });
            setAudioDuration({ ...audioDuration, [audioId]: status.durationMillis || 0 });
            if (status.didJustFinish) {
              setPlayingAudioId(null);
            }
          }
        }
      );

      setSound(newSound);
      setPlayingAudioId(audioId);
    } catch (error) {
      console.error('Error playing audio:', error);
      Alert.alert('Error', 'Failed to play audio');
    }
  };

  const pauseAudio = async () => {
    if (sound) {
      await sound.pauseAsync();
      setPlayingAudioId(null);
    }
  };

  const formatDuration = (millis: number): string => {
    const seconds = Math.floor(millis / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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

  if (error || !query) {
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

  const config = priorityConfig[query.priority] || { key: 'unknown', color: COLORS.text.muted };
  const priorityText = t(`priorities.${config.key}`, config.key);

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <ImageBackground source={require('@/assets/images/background.png')} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{query.incident_number}</Text>
          <Text style={styles.headerSubtitle}>{t('details.query')}</Text>
        </View>
        <View style={{ width: 40 }} />
      </ImageBackground>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Title Card */}
        <View style={styles.titleCard}>
          <View style={[styles.priorityBar, { backgroundColor: config.color }]} />
          <View style={styles.titleCardContent}>
            <View style={styles.titleHeader}>
              <View style={[styles.typeBadge]}>
                <Ionicons name="help-circle" size={12} color={COLORS.accent} />
                <Text style={styles.typeBadgeText}>{t('details.query')}</Text>
              </View>
              <View style={[styles.priorityBadge, { backgroundColor: config.color }]}>
                <Text style={styles.priorityBadgeText}>{priorityText}</Text>
              </View>
            </View>
            <Text style={styles.queryTitle}>{query.title}</Text>
            <Text style={styles.dateText}>{new Date(query.created_at).toLocaleString()}</Text>
            {query.current_state && (
              <View style={styles.statusContainer}>
                <View style={[styles.statusDot, { backgroundColor: COLORS.accent }]} />
                <Text style={[styles.statusText, { color: COLORS.accent }]}>{query.current_state.name}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Details Card */}
        <View style={styles.card}>
          <SectionHeader title={t('queries.title')} icon="information-circle" />
          <View style={styles.infoContainer}>
            {query.channel && (
              <InfoRow icon="megaphone-outline" label={t('details.channel')} value={query.channel} iconColor="#F59E0B" />
            )}
            <InfoRow icon="grid-outline" label={t('details.classification')} value={query.classification?.name || ''} iconColor={COLORS.accent} />
            <InfoRow icon="business-outline" label={t('details.department')} value={query.department?.name || ''} iconColor="#8B5CF6" />
            <InfoRow icon="person-outline" label={t('details.assignees')}
              value={query.assignees?.length
                ? query.assignees.map((a: any) => `${a.first_name || ''} ${a.last_name || ''}`.trim()).join(', ')
                : query.assignee
                  ? `${query.assignee.first_name || ''} ${query.assignee.last_name || ''}`.trim()
                  : ''
              }
              iconColor="#EC4899"
            />
            {query.location && (
              <InfoRow icon="location-outline" label={t('details.location')} value={query.location.name} iconColor={COLORS.error} />
            )}
            {query.source_incident && (
              <InfoRow
                icon="link-outline"
                label={t('details.sourceIncident', 'Source Incident')}
                value={`${query.source_incident.incident_number} - ${query.source_incident.title}`}
                iconColor="#06B6D4"
              />
            )}
          </View>
        </View>

        {/* Description Card */}
        {query.description && (
          <View style={styles.card}>
            <SectionHeader title={t('details.description')} icon="document-text" />
            <Text style={styles.descriptionText}>{query.description}</Text>
          </View>
        )}

        {/* Comments Card */}
        <View style={styles.card}>
          <SectionHeader title={t('details.comments')} icon="chatbubbles" />
          {query.comments && query.comments.length > 0 ? (
            query.comments.map((comment: any) => (
              <View style={styles.commentItem} key={comment.id}>
                <View style={styles.commentHeader}>
                  <View style={[styles.commentAvatar, { backgroundColor: COLORS.accent }]}>
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
          {otherAttachments.map(att => (
            <TouchableOpacity
              key={att.id}
              onPress={() => Linking.openURL(`${baseURL}/attachments/${att.id}`)}
              style={styles.fileAttachment}
            >
              <View style={[styles.fileIconContainer, { backgroundColor: `${COLORS.accent}20` }]}>
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

        {/* Location Card */}
        {query.location && (
          <View style={styles.card}>
            <SectionHeader title={t('details.location')} icon="location" />
            <View style={styles.locationInfo}>
              <Ionicons name="location" size={20} color={COLORS.error} />
              <View style={styles.locationText}>
                <Text style={styles.locationName}>{query.location.name}</Text>
                {query.location.address && <Text style={styles.locationAddress}>{query.location.address}</Text>}
              </View>
            </View>
          </View>
        )}

        {/* Transition History Card */}
        <View style={[styles.card, { marginBottom: availableTransitions.length > 0 ? 100 : 30 }]}>
          <SectionHeader title={t('details.transitionHistory')} icon="git-compare" />
          {query.transition_history && query.transition_history.length > 0 ? (
            <View style={styles.timeline}>
              {query.transition_history.map((item: any, index: number) => (
                <View key={item.id} style={styles.timelineItem}>
                  <View style={styles.timelineLeft}>
                    <View style={[styles.timelineDot, { backgroundColor: COLORS.accent }]} />
                    {index < query.transition_history.length - 1 && <View style={styles.timelineLine} />}
                  </View>
                  <View style={styles.timelineContent}>
                    <View style={styles.transitionBadges}>
                      <View style={styles.fromBadge}>
                        <Text style={styles.fromBadgeText}>{item.from_state.name}</Text>
                      </View>
                      <Ionicons name="arrow-forward" size={14} color={COLORS.text.muted} />
                      <View style={[styles.toBadge, { backgroundColor: COLORS.accentLight }]}>
                        <Text style={[styles.toBadgeText, { color: COLORS.accent }]}>{item.to_state.name}</Text>
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
              id: query.id,
              type: 'query',
              transitions: JSON.stringify(availableTransitions),
              incident: JSON.stringify({
                id: query.id,
                classification_id: query.classification_id,
                location_id: query.location_id,
                department_id: query.department_id,
                assignee_id: query.assignee_id,
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
  typeBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.accentLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, gap: 4 },
  typeBadgeText: { color: COLORS.accent, fontSize: 11, fontWeight: 'bold' },
  priorityBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  priorityBadgeText: { color: COLORS.white, fontSize: 11, fontWeight: 'bold' },
  queryTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text.primary, marginBottom: 4 },
  dateText: { fontSize: 12, color: COLORS.text.muted, marginBottom: 8 },
  statusContainer: { flexDirection: 'row', alignItems: 'center' },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  statusText: { fontSize: 14, fontWeight: '600' },

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

  commentItem: { backgroundColor: COLORS.background, borderRadius: 12, padding: 12, marginBottom: 10 },
  commentHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  commentAvatar: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
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
  fileIconContainer: { width: 36, height: 36, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  fileName: { flex: 1, marginLeft: 12, fontSize: 14, color: COLORS.text.primary },

  locationInfo: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: COLORS.background, borderRadius: 12, padding: 12 },
  locationText: { marginLeft: 12, flex: 1 },
  locationName: { fontSize: 15, fontWeight: '600', color: COLORS.text.primary },
  locationAddress: { fontSize: 13, color: COLORS.text.secondary, marginTop: 4 },

  timeline: {},
  timelineItem: { flexDirection: 'row' },
  timelineLeft: { alignItems: 'center', marginRight: 12 },
  timelineDot: { width: 12, height: 12, borderRadius: 6 },
  timelineLine: { width: 2, flex: 1, backgroundColor: COLORS.border, marginVertical: 4 },
  timelineContent: { flex: 1, paddingBottom: 20 },
  transitionBadges: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  fromBadge: { backgroundColor: '#FEE2E2', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  fromBadgeText: { fontSize: 12, color: COLORS.error, fontWeight: '600' },
  toBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  toBadgeText: { fontSize: 12, fontWeight: '600' },
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

export default QueryDetailsScreen;
