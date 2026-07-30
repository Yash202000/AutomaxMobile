import { baseURL } from '@/src/api/client';
import { getAvailableTransitions, getIncidentById, getIncidentHistory, canConvertToRequest } from '@/src/api/incidents';
import { getLookupCategories } from '@/src/api/lookups';
import { AnimatedListItem } from '@/src/components/AnimatedListItem';
import { AuthenticatedImageViewer } from '@/src/components/AuthenticatedImageViewer';
import { CustomAlert } from '@/src/components/CustomAlert';
import { DetailScreenSkeleton } from '@/src/components/DetailScreenSkeleton';
import { RenderWithIncidentMentions } from '@/src/components/RenderWithIncidentMentions';
import { Skeleton } from '@/src/components/Skeleton';
import { useAuth } from '@/src/context/AuthContext';
import { useHierarchy } from '@/src/hooks/useHierarchy';
import i18n from '@/src/i18n';
import { downloadAndOpenAttachment } from '@/src/utils/attachmentDownload';
import { crashLogger } from '@/src/utils/crashLogger';
import { openMapsDirections } from '@/src/utils/openMapsDirections';
import { Ionicons } from '@expo/vector-icons';
import { AudioSource, useAudioPlayer } from 'expo-audio';
import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { t } from 'i18next';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dimensions, ImageBackground, Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';


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

interface LookupValue {
  id: string;
  name: string;
  name_ar?: string;
  color?: string;
  category?: {
    id: string;
    name: string;
    name_ar?: string;
  };
}

interface IncidentData {
  id: string;
  incident_number: string;
  title: string;
  description?: string;
  classification?: { id: string; name: string };
  classification_id?: string;
  current_state?: { id: string; name: string; name_ar: string };
  department?: { id: string; name: string };
  department_id?: string;
  location?: { id: string; name: string; address?: string; name_ar: string };
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
  source?: string;
  created_at: string;
  lookup_values?: LookupValue[];
  custom_fields?: string;
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
  version?: number;
  converted_request_id?: string;
  converted_request?: { incident_number: string; title: string };
  source_incident_id?: string;
  source_incident?: { incident_number: string; title: string };
}

interface TransitionData {
  can_execute: boolean;
  transition: { id: string; name: string };
}

const AudioPlayer = ({ attachment, token }: { attachment: { id: string; file_name: string }; token: string }) => {
  const audioSource: AudioSource = {
    uri: `${baseURL}/attachments/${attachment.id}/preview`,
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
    <Text style={styles.infoValue}>{value || t('common.na')}</Text>
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
  const { classTree, deptTree, locTree, getPath } = useHierarchy();
  const [incident, setIncident] = useState<IncidentData | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [availableTransitions, setAvailableTransitions] = useState<TransitionData[]>([]);
  const [canConvert, setCanConvert] = useState<boolean>(false);
  const [attachments, setAttachments] = useState<Array<{ id: string; file_name: string; mime_type: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [isImageViewerVisible, setImageViewerVisible] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [mapZoom, setMapZoom] = useState<number>(15);
  const [showAllComments, setShowAllComments] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const mapRef = useRef<WebView>(null);
  const insets = useSafeAreaInsets();

  const imageAttachments = attachments.filter(att => att.mime_type?.startsWith('image/'));
  const audioAttachments = attachments.filter(att => att.mime_type?.startsWith('audio/'));
  const otherAttachments = attachments.filter(att => !att.mime_type?.startsWith('image/') && !att.mime_type?.startsWith('audio/'));
  const isDefaultLocation = incident?.location?.name?.trim().toLowerCase() === 'default';

  const { user } = useAuth()

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
      const [detailsResponse, historyResponse, transitionsResponse, canConvertResponse] = await Promise.all([
        getIncidentById(incidentId),
        getIncidentHistory(incidentId),
        getAvailableTransitions(incidentId),
        canConvertToRequest(incidentId),
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

        CustomAlert.alert(t('common.error'), `${t('details.fetchError')}: ${detailsResponse.error}`);
      }

      if (historyResponse.success) {
        setHistory(historyResponse.data);
      } else {
        setHistory([]);
      }

      if (transitionsResponse.success) {
        const executableTransitions = transitionsResponse.data.filter((t: TransitionData) => t.can_execute);
        setAvailableTransitions(executableTransitions);
      } else {
        setAvailableTransitions([]);
      }

      if (canConvertResponse.success) {
        setCanConvert(canConvertResponse.data?.can_convert || false);
      } else {
        setCanConvert(false);
      }
    } catch (err: any) {
      if (err?.isLogoutCancel) return;

      console.error('Error fetching incident details:', err);

      // Log unexpected error
      crashLogger.logError(err as Error, {
        screen: 'IncidentDetailsScreen',
        action: 'fetchDetails',
        incidentId: incidentId,
        context: 'Unexpected error while fetching incident details',
      }).catch(logErr => console.error('Failed to log error:', logErr));

      setError(t('details.fetchError'));
      CustomAlert.alert(
        t('common.error'),
        t('errors.unknownError')
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

  useEffect(() => {
    const fetchCategories = async () => {
      const cat = await getLookupCategories();
      setCategories(cat.data);
    };
    fetchCategories();
  }, [])

  const handleZoomIn = () => {
    const newZoom = Math.min(mapZoom + 1, 19);
    setMapZoom(newZoom);
    mapRef.current?.injectJavaScript(`
      map.setZoom(${newZoom});
      true;
    `);
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(mapZoom - 1, 1);
    setMapZoom(newZoom);
    mapRef.current?.injectJavaScript(`
      map.setZoom(${newZoom});
      true;
    `);
  };

  const handleOpenDirections = () => {
    if (incident?.latitude && incident?.longitude) {
      openMapsDirections(incident.latitude, incident.longitude, (error) => {
        crashLogger.logError(error as Error, {
          screen: 'IncidentDetailsScreen',
          action: 'openDirections',
          incidentId: incident?.id,
          latitude: incident?.latitude,
          longitude: incident?.longitude,
          context: 'Failed to open maps directions',
        }).catch(err => console.error('Failed to log error:', err));
      });
    }
  };

  const handleUpdateStatusPress = () => {
    if (!incident) return;

    if (isDefaultLocation) {
      CustomAlert.alert(
        t('common.notAllowed', 'Not allowed'),
        t('incidents.defaultLocationTransitionBlocked', 'Transition is not allowed while the incident location is Default. Incident location should be updated first.')
      );
      return;
    }

    router.push({
      pathname: '/update-status',
      params: {
        id: incident.id,
        type: 'incident',
        transitions: JSON.stringify(availableTransitions),
        incident: JSON.stringify({
          id: incident.id,
          classification_id: incident.classification_id || incident.classification?.id,
          location_id: incident.location_id || incident.location?.id,
          department_id: incident.department_id || incident.department?.id,
          assignee_id: incident.assignee_id || incident.assignee?.id,
          version: incident?.version,
        }),
      },
    });
  };

  const handleConvertToRequestPress = () => {
    if (!incident) return;

    if (isDefaultLocation) {
      CustomAlert.alert(
        t('common.notAllowed', 'Not allowed'),
        t('incidents.defaultLocationTransitionBlocked', 'Transition is not allowed while the incident location is Default. Incident location should be updated first.')
      );
      return;
    }

    router.push({
      pathname: '/convert-to-request',
      params: {
        id: incident.id,
        transitions: JSON.stringify(availableTransitions),
        incident: JSON.stringify({
          id: incident.id,
          classification_id: incident.classification_id || incident.classification?.id,
          location_id: incident.location_id || incident.location?.id,
          department_id: incident.department_id || incident.department?.id,
          assignee_id: incident.assignee_id || incident.assignee?.id,
          version: incident?.version,
        }),
      },
    });
  };


  const isViewerApp = process.env.EXPO_PUBLIC_VIEWER_APP === 'true';
  const viewerRoles = (process.env.EXPO_PUBLIC_VIEWER_APP_ROLES || 'viewer,viewer2').split(',');
  const isViewerRole = user?.roles?.some(role => viewerRoles.includes(role.code)) ?? false;
  const isViewerMode = isViewerApp && isViewerRole;

  if (loading) {
    return (
      <View style={styles.safeArea}>
        <ImageBackground
          source={
            isViewerMode
              ? require("@/assets/images/viewerBackground.png")
              : require("@/assets/images/background.png")
          }
          style={[styles.header, { paddingTop: insets.top }]}
        >
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name={t('common.icons.chevronBack') as any} size={24} color={COLORS.white} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Skeleton width={120} height={18} style={{ backgroundColor: 'rgba(255,255,255,0.35)' }} />
            <Text style={styles.headerSubtitle}>{t('incidents.incidentDetails')}</Text>
          </View>
          <View style={{ width: 40 }} />
        </ImageBackground>
        <DetailScreenSkeleton sections={[4, 3, 2]} />
      </View>
    );
  }

  if (error || !incident) {
    return (
      <View style={[styles.safeArea]}>
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={64} color={COLORS.text.muted} />
          <Text style={styles.errorTitle}>{t('errors.oops')}</Text>
          <Text style={styles.errorText}>{error || t('details.notFound')}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchDetails}>
            <Ionicons name="refresh" size={20} color={COLORS.white} />
            <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const config = priorityConfig[incident.priority as number] || { key: 'unknown', color: COLORS.text.muted };
  const priorityText = t(`priorities.${config.key}`, config.key);

  let sectionIndex = 0;
  const nextSection = () => sectionIndex++;

  return (
    <View style={styles.safeArea}>
      {/* Header */}
      <ImageBackground
        source={
          isViewerMode
            ? require("@/assets/images/viewerBackground.png")
            : require("@/assets/images/background.png")
        }
        style={[styles.header, { paddingTop: insets.top + 16 }]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name={t('common.icons.chevronBack') as any} size={24} color={COLORS.white} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{incident.incident_number}</Text>
          <Text style={styles.headerSubtitle}>{t('incidents.incidentDetails')}</Text>
        </View>
        <View style={{ width: 40 }} />
      </ImageBackground>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Title Card */}
        <AnimatedListItem index={nextSection()}>
          <View style={styles.titleCard}>
            {/* <View style={[styles.priorityBar, { backgroundColor: config.color }]} /> */}
            <View style={styles.titleCardContent}>
              <View style={styles.titleHeader}>
                {/* <View style={[styles.priorityBadge, { backgroundColor: config.color }]}>
                <Ionicons name="flag" size={12} color={COLORS.white} />
                <Text style={styles.priorityBadgeText}>{priorityText}</Text>
              </View> */}
                <Text style={styles.dateText}>{new Date(incident.created_at).toLocaleDateString('en-GB')}</Text>
              </View>
              <Text style={styles.incidentTitle}>{incident.title}</Text>
              {incident.current_state && (
                <View style={styles.statusContainer}>
                  <View style={styles.statusDot} />
                  <Text style={styles.statusText}>{(i18n.language === 'en' || !incident.current_state?.name_ar) ? incident.current_state?.name : incident.current_state?.name_ar}</Text>
                </View>
              )}
            </View>
          </View>
        </AnimatedListItem>

        {/* Converted to Request Banner */}
        {incident.converted_request_id && (
          <AnimatedListItem index={nextSection()}>
            <TouchableOpacity
              style={[styles.card, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE', borderWidth: 1 }]}
              onPress={() => router.push({ pathname: '/request-details', params: { id: incident.converted_request_id } })}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ backgroundColor: '#DBEAFE', padding: 8, borderRadius: 8 }}>
                  <Ionicons name="git-branch-outline" size={24} color="#2563EB" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, color: '#1E3A8A', fontWeight: '600' }}>
                    {t('incidents.convertedToRequest', 'Converted to Request')}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#3B82F6', marginTop: 2 }}>
                    {incident.converted_request?.incident_number
                      ? t('incidents.tapToViewRequest', { number: incident.converted_request.incident_number, defaultValue: `Tap to view ${incident.converted_request.incident_number}` })
                      : t('incidents.tapToViewConverted', 'Tap to view converted request')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#3B82F6" />
              </View>
            </TouchableOpacity>
          </AnimatedListItem>
        )}

        {/* Source Incident Banner */}
        {incident.source_incident_id && (
          <AnimatedListItem index={nextSection()}>
            <TouchableOpacity
              style={[styles.card, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0', borderWidth: 1 }]}
              onPress={() => router.push({ pathname: '/incident-details', params: { id: incident.source_incident_id } })}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ backgroundColor: '#DCFCE7', padding: 8, borderRadius: 8 }}>
                  <Ionicons name="arrow-undo-outline" size={24} color="#16A34A" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, color: '#14532D', fontWeight: '600' }}>
                    {t('incidents.convertedFromIncident', 'Converted from Incident')}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#22C55E', marginTop: 2 }}>
                    {incident.source_incident?.incident_number
                      ? t('incidents.tapToViewSource', { number: incident.source_incident.incident_number, defaultValue: `Tap to view source ${incident.source_incident.incident_number}` })
                      : t('incidents.tapToViewSourceIncident', 'Tap to view source incident')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#22C55E" />
              </View>
            </TouchableOpacity>
          </AnimatedListItem>
        )}

        {/* Details Card with Lookup Values and Custom Fields Inside */}
        <AnimatedListItem index={nextSection()}>
          <View style={styles.card}>
            <SectionHeader title={t('incidents.incidentDetails')} icon="information-circle" />

            <View style={styles.infoContainer}>
              {/* Basic Info */}
              <InfoRow icon="grid-outline" label={t('details.classification')} value={getPath(classTree, incident.classification?.id) || incident.classification?.name || ''} iconColor={COLORS.accent} />
              <InfoRow icon="business-outline" label={t('details.department')} value={getPath(deptTree, incident.department?.id) || incident.department?.name || ''} iconColor="#8B5CF6" />
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
                <InfoRow icon="location-outline" label={t('details.location')} value={getPath(locTree, incident.location.id) || incident.location.name} iconColor={COLORS.error} />
              )}
              {incident.source && (
                <InfoRow
                  icon="git-network-outline"
                  label={t('incidents.source')}
                  value={t(`incidents.sources.${incident.source?.toLowerCase()}`).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  iconColor="#0EA5E9"
                />
              )}

              {/* Lookup Values as InfoRows */}
              {incident.lookup_values && incident.lookup_values.length > 0 && (() => {
                const grouped: Record<string, LookupValue[]> = {};
                incident.lookup_values.forEach(value => {
                  const categoryName = (i18n.language === 'en' ? value.category?.name : value.category?.name_ar) || 'Other';
                  if (!grouped[categoryName]) {
                    grouped[categoryName] = [];
                  }
                  grouped[categoryName].push(value);
                });

                return Object.entries(grouped).map(([category, values]) => (
                  <View key={category} style={styles.infoRow}>
                    <View style={styles.infoRowLeft}>
                      <Ionicons name="pricetag" size={18} color="#10B981" />
                      <Text style={styles.infoLabel}>{category}</Text>
                    </View>
                    <View style={styles.lookupValuesList}>
                      {values.map(value => (
                        <View
                          key={value.id}
                          style={[
                            styles.lookupValueTag,
                            {
                              backgroundColor: value.color ? `${value.color}20` : '#E2E8F0',
                              borderColor: value.color || '#CBD5E1',
                            },
                          ]}
                        >
                          <RenderWithIncidentMentions text={i18n.language === 'en' ? (value.name || '') : (value?.name_ar || '')} style={styles.descriptionText} />
                        </View>
                      ))}
                    </View>
                  </View>
                ));
              })()}

              {/* Custom Fields as InfoRows */}
              {incident.custom_fields && (() => {
                try {
                  const customFields = JSON.parse(incident.custom_fields);
                  const allFields: any[] = [];

                  // Extract all custom fields
                  Object.entries(customFields).forEach(([key, fieldData]: [string, any]) => {
                    const ld = categories.find((c: any) => c.id === fieldData.category_id);
                    if (key.startsWith('lookup:')) {
                      allFields.push({
                        key,
                        label: i18n.language === 'en' ? ld.name : (ld?.name_ar || ld.name),
                        value: fieldData.value,
                        field_type: fieldData.field_type || 'text',
                      });
                    }
                  });

                  return allFields.map((field) => {
                    let displayValue = field.value || 'N/A';
                    if (field.field_type === 'checkbox') {
                      displayValue = field.value ? t('common.yes') : t('common.no');
                    } else if (field.field_type === 'date' && field.value) {
                      displayValue = new Date(field.value).toLocaleDateString('en-GB');
                    }

                    return (
                      <InfoRow
                        key={field.key}
                        icon="list-outline"
                        label={field.label}
                        value={String(displayValue)}
                        iconColor="#F59E0B"
                      />
                    );
                  });
                } catch (error) {
                  console.error('Error parsing custom_fields:', error);
                  return null;
                }
              })()}
            </View>
          </View>
        </AnimatedListItem>

        {/* Attachments Card */}
        <AnimatedListItem index={nextSection()}>
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
                      source={{ uri: `${baseURL}/attachments/${att.id}/preview`, headers: { Authorization: `Bearer ${token}` } }}
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
                onPress={() => downloadAndOpenAttachment(att.id, att.file_name)}
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
        </AnimatedListItem>

        <AuthenticatedImageViewer
          images={imageAttachments.map(att => ({
            id: att.id,
            uri: `${baseURL}/attachments/${att.id}/preview`,
            file_name: att.file_name,
          }))}
          imageIndex={currentImageIndex}
          visible={isImageViewerVisible}
          onRequestClose={() => setImageViewerVisible(false)}
          token={token || ''}
        />

        {/* Geolocation Card */}
        {(incident.latitude !== undefined && incident.longitude !== undefined) && (
          <AnimatedListItem index={nextSection()}>
            <View style={styles.card}>
              <SectionHeader title={t('details.geolocation')} icon="navigate" />
              <View style={styles.mapContainer}>
                <WebView
                  ref={mapRef}
                  source={{
                    html: `
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
      background-color: ${COLORS.error};
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
    const lat = ${incident.latitude};
    const lng = ${incident.longitude};
    const map = L.map('map').setView([lat, lng], 15);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);

    const markerHtml = '<div class="custom-marker"></div>';
    const customIcon = L.divIcon({
      html: markerHtml,
      className: 'custom-div-icon',
      iconSize: [30, 30],
      iconAnchor: [15, 30],
      popupAnchor: [0, -30]
    });

    const marker = L.marker([lat, lng], { icon: customIcon })
      .addTo(map)
      .bindPopup(\`
        <div style="min-width: 150px;">
          <strong style="font-size: 13px;">${incident.title.replace(/'/g, "\\'")}</strong><br/>
          <span style="font-size: 11px; color: #64748B;">${(incident.address || 'Incident Location').replace(/'/g, "\\'")}</span>
        </div>
      \`);

    map.whenReady(function() {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'mapReady'
      }));
    });
  </script>
</body>
</html>
                `, baseUrl: 'https://localhost/'
                  }}
                  style={styles.map}
                  javaScriptEnabled={true}
                  domStorageEnabled={true}
                  startInLoadingState={false}
                  originWhitelist={['*']}
                  mixedContentMode="compatibility"
                  onMessage={(event) => {
                    try {
                      const data = JSON.parse(event.nativeEvent.data);
                      if (data.type === 'mapReady') {
                        // Map is ready
                      }
                    } catch (error) {
                      console.error('❌ [IncidentDetails OSM] Error handling message:', error);
                    }
                  }}
                />
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
                    <Text style={[styles.addressText, { textAlign: "left" }]}>{incident.address}</Text>
                  </View>
                )}
                <TouchableOpacity style={styles.directionsButton} onPress={handleOpenDirections}>
                  <Ionicons name="navigate" size={18} color={COLORS.white} />
                  <Text style={styles.directionsButtonText}>{t('details.directions') || 'Directions'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </AnimatedListItem>
        )}

        {/* Description Card */}
        {incident.description && (
          <AnimatedListItem index={nextSection()}>
            <View style={styles.card}>
              <SectionHeader title={t('details.description')} icon="document-text" />
              <RenderWithIncidentMentions text={incident.description} style={styles.descriptionText} />
            </View>
          </AnimatedListItem>
        )}

        {/* Reporter Card */}
        <AnimatedListItem index={nextSection()}>
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
                    : incident.reporter?.username || incident.reporter_name || t('common.unknown', 'Unknown')}
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
        </AnimatedListItem>

        {/* Comments Card */}
        <AnimatedListItem index={nextSection()}>
          <View style={styles.card}>
            <SectionHeader title={t('details.comments')} icon="chatbubbles" />
            {incident.comments && incident.comments.length > 0 ? (
              <>
                {(showAllComments ? incident.comments : [incident.comments[0]]).map(comment => (
                  <View style={styles.commentItem} key={comment.id}>
                    <View style={styles.commentHeader}>
                      <View style={styles.commentAvatar}>
                        <Text style={styles.commentAvatarText}>{comment.author.username[0]}</Text>
                      </View>
                      <View style={styles.commentMeta}>
                        <Text style={styles.commentAuthor}>{comment.author.username}</Text>
                        <Text style={styles.commentDate}>{new Date(comment.created_at).toLocaleString('en-GB')}</Text>
                      </View>
                    </View>
                    <RenderWithIncidentMentions text={comment.content} style={styles.commentContent} />
                  </View>
                ))}
                {incident.comments.length > 1 && (
                  <TouchableOpacity
                    style={styles.seeMoreButton}
                    onPress={() => setShowAllComments(!showAllComments)}
                  >
                    <Text style={styles.seeMoreText}>
                      {showAllComments ? t('common.showLess') : `${t('common.viewAll')} (${incident.comments.length})`}
                    </Text>
                    <Ionicons
                      name={showAllComments ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color={COLORS.accent}
                    />
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="chatbubble-outline" size={32} color={COLORS.text.muted} />
                <Text style={styles.emptyStateText}>{t('details.noComments')}</Text>
              </View>
            )}
          </View>
        </AnimatedListItem>

        {/* Transition History Card */}
        <AnimatedListItem index={nextSection()}>
          <View style={[styles.card, { marginBottom: availableTransitions.length > 0 ? 100 : 30 }]}>
            <SectionHeader title={t('details.transitionHistory')} icon="git-compare" />
            {history && history.length > 0 ? (
              <View style={styles.timeline}>
                {(showAllHistory ? history : [history[0]]).map((item, index) => (
                  <View key={item.id} style={styles.timelineItem}>
                    <View style={styles.timelineLeft}>
                      <View style={[styles.timelineDot, { backgroundColor: COLORS.accent }]} />
                      {(showAllHistory ? index < history.length - 1 : false) && <View style={styles.timelineLine} />}
                    </View>
                    <View style={styles.timelineContent}>
                      <View style={{ display: 'flex', flexDirection: 'row', gap: 5 }}>
                        <Text style={{ fontWeight: 'bold', fontSize: 12 }}>{item.transition?.name || t('common.stateChanged', 'State Changed')}</Text>
                        <Text style={styles.transitionMeta}>
                          {t('details.by')} {item?.performed_by?.username || item?.performed_by?.name || t('common.system')} • {new Date(item.transitioned_at).toLocaleDateString('en-GB')}
                        </Text>
                      </View>
                      <View style={styles.transitionBadges}>
                        <View style={styles.fromBadge}>
                          <Text style={styles.fromBadgeText}>{(i18n.language === 'ar' && item.from_state?.name_ar) ? item.from_state?.name_ar : item.from_state.name}</Text>
                        </View>
                        <Ionicons name={t('common.icons.arrowForward') as any} size={14} color={COLORS.text.muted} />
                        <View style={styles.toBadge}>
                          <Text style={styles.toBadgeText}>{(i18n.language === 'ar' && item.to_state?.name_ar) ? item.to_state?.name_ar : item.to_state.name}</Text>
                        </View>
                      </View>
                      {item.comment && (
                        <View style={styles.transitionComment}>
                          <Ionicons name="chatbubble-ellipses-outline" size={14} color={COLORS.text.secondary} />
                          <RenderWithIncidentMentions text={item.comment} style={styles.transitionCommentText} />
                        </View>
                      )}
                      {item?.feedbacks?.comment && (
                        <View style={styles.transitionComment}>
                          <Ionicons name="chatbubble-ellipses-outline" size={14} color={COLORS.text.secondary} />
                          <RenderWithIncidentMentions text={item.feedbacks.comment} style={styles.transitionCommentText} />
                        </View>
                      )}
                      {
                        item?.feedbacks?.rating > 0 && item?.transition?.is_final_close &&
                        (
                          <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 }}>
                            {[
                              ...Array(5).keys(),
                            ].map((i) => (
                              <Ionicons
                                key={i}
                                name={
                                  i <= item.feedbacks?.rating
                                    ? "star"
                                    : "star-outline"
                                }
                                size={14}
                                color={
                                  i <= item.feedbacks?.rating
                                    ? "#FFD700"
                                    : "#CCC"
                                }
                              />
                            ))}
                          </View>
                        )
                      }
                    </View>
                  </View>
                ))}
                {history.length > 1 && (
                  <TouchableOpacity
                    style={styles.seeMoreButton}
                    onPress={() => setShowAllHistory(!showAllHistory)}
                  >
                    <Text style={styles.seeMoreText}>
                      {showAllHistory ? t('common.showLess') || 'Show Less' : `${t('common.viewAll') || 'See More'} (${history.length})`}
                    </Text>
                    <Ionicons
                      name={showAllHistory ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color={COLORS.accent}
                    />
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="time-outline" size={32} color={COLORS.text.muted} />
                <Text style={styles.emptyStateText}>{t('details.noTransitionHistory')}</Text>
              </View>
            )}
          </View>
        </AnimatedListItem>
      </ScrollView>

      {/* Action Buttons */}
      <View style={[styles.actionButtonsContainer, { bottom: insets.bottom + 20 }]}>
        {availableTransitions.length > 0 && (
          <TouchableOpacity
            style={[styles.updateButton, isDefaultLocation && styles.updateButtonDisabled, { flex: 1 }]}
            onPress={handleUpdateStatusPress}
            activeOpacity={isDefaultLocation ? 1 : 0.8}
          >
            <Ionicons name="sync" size={20} color={COLORS.white} />
            <Text style={styles.updateButtonText}>{t('details.update')}</Text>
          </TouchableOpacity>
        )}
        {canConvert && (
          <TouchableOpacity
            style={[styles.updateButton, isDefaultLocation && styles.updateButtonDisabled, { backgroundColor: COLORS.priority.high, flex: 1 }]}
            onPress={handleConvertToRequestPress}
            activeOpacity={isDefaultLocation ? 1 : 0.8}
          >
            <Ionicons name="git-branch" size={20} color={COLORS.white} />
            <Text style={styles.updateButtonText}>{t('incidents.convert', 'Convert')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
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

  container: { flex: 1, backgroundColor: COLORS.background, paddingTop: 10 },

  titleCard: {
    backgroundColor: COLORS.white, marginHorizontal: 16, marginTop: 10,
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
  incidentTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text.primary, marginBottom: 8, textAlign: "left" },
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

  descriptionText: { fontSize: 14, color: COLORS.text.secondary, lineHeight: 22, textAlign: 'left' },

  reporterCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.background, borderRadius: 12, padding: 12 },
  reporterAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  reporterAvatarText: { color: COLORS.white, fontSize: 18, fontWeight: 'bold' },
  reporterInfo: { flex: 1, marginLeft: 12 },
  reporterName: { fontSize: 15, fontWeight: '600', color: COLORS.text.primary, textAlign: "left" },
  reporterEmail: { fontSize: 12, color: COLORS.text.secondary, marginTop: 2, textAlign: "left" },
  reporterActions: { flexDirection: 'row', gap: 8 },
  reporterActionButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.white, justifyContent: 'center', alignItems: 'center' },

  commentItem: { backgroundColor: COLORS.background, borderRadius: 12, padding: 12, marginBottom: 10 },
  commentHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  commentAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.accent, justifyContent: 'center', alignItems: 'center' },
  commentAvatarText: { color: COLORS.white, fontSize: 13, fontWeight: 'bold' },
  commentMeta: { marginLeft: 10 },
  commentAuthor: { fontSize: 13, fontWeight: '600', color: COLORS.text.primary, textAlign: "left" },
  commentDate: { fontSize: 11, color: COLORS.text.muted },
  commentContent: { fontSize: 14, color: COLORS.text.secondary, lineHeight: 20, textAlign: "left", marginLeft: 42 },
  seeMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: 8,
  },
  seeMoreText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.accent,
    marginRight: 4,
  },

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
  transitionBadges: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: "wrap", width: "100%" },
  fromBadge: { backgroundColor: '#FEE2E2', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  fromBadgeText: { fontSize: 12, color: COLORS.error, fontWeight: '600' },
  toBadge: { backgroundColor: '#D1FAE5', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  toBadgeText: { fontSize: 12, color: '#059669', fontWeight: '600' },
  transitionMeta: { fontSize: 12, color: COLORS.text.muted },
  transitionComment: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 8, gap: 6, textAlign: "left" },
  transitionCommentText: { fontSize: 13, color: COLORS.text.secondary, fontStyle: 'italic', flex: 1, textAlign: "left" },

  actionButtonsContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    flexDirection: 'row',
    gap: 12,
  },
  updateButton: {
    backgroundColor: COLORS.accent, flexDirection: 'row', justifyContent: 'center',
    alignItems: 'center', paddingVertical: 16, borderRadius: 14, gap: 8,
    ...Platform.select({
      ios: { shadowColor: COLORS.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12 },
      android: { elevation: 8 },
    }),
  },
  updateButtonDisabled: {
    backgroundColor: COLORS.text.muted,
    opacity: 0.75,
  },
  updateButtonText: { color: COLORS.white, fontSize: 16, fontWeight: 'bold' },

  // Lookup Values Styles (InfoRow compatible)
  lookupValuesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    maxWidth: '50%',
    gap: 4,
    justifyContent: 'flex-end',
  },
  lookupValueTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  lookupValueTagText: {
    fontSize: 12,
    fontWeight: '600',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});

export default IncidentDetailsScreen;
