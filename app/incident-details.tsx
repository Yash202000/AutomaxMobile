import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Linking, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ImageView from 'react-native-image-viewing';
import MapView, { Marker } from 'react-native-maps';
import { getIncidentById, getAvailableTransitions } from '@/src/api/incidents';
import { baseURL } from '@/src/api/client';
import * as SecureStore from 'expo-secure-store';

const DottedSeparator = () => <View style={styles.separator} />;

const priorityMap = {
    1: { text: 'Critical', color: '#E74C3C' },
    2: { text: 'High', color: '#E67E22' },
    3: { text: 'Medium', color: '#F1C40F' },
    4: { text: 'Low', color: '#3498DB' },
    5: { text: 'Very Low', color: '#2ECC71' },
};

const TransitionHistoryCard = ({ item }: { item: { from_state: { name: string }; to_state: { name: string }; performed_by: { username: string }; transitioned_at: string; comment?: string } }) => (
    <View style={styles.historyCard}>
        <View style={styles.historyIcon}>
            <Ionicons name="git-compare-outline" size={24} color="#fff" />
        </View>
        <View style={styles.historyDetails}>
            <Text style={styles.historyText}>
                Status changed from <Text style={styles.historyState}>{item.from_state.name}</Text> to <Text style={styles.historyState}>{item.to_state.name}</Text>
            </Text>
            <Text style={styles.historyMeta}>
                by {item.performed_by.username} on {new Date(item.transitioned_at).toLocaleDateString()}
            </Text>
            {item.comment && <Text style={styles.historyComment}>{`"${item.comment}"`}</Text>}
        </View>
    </View>
);


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
  transition: {
    id: string;
    name: string;
  };
}

const IncidentDetailsScreen = () => {
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

  const imageAttachments = attachments.filter(att => att.mime_type.startsWith('image/'));
  const otherAttachments = attachments.filter(att => !att.mime_type.startsWith('image/'));


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
    const [detailsResponse, transitionsResponse] = await Promise.all([
      getIncidentById(incidentId),
      getAvailableTransitions(incidentId),
    ]);

    if (detailsResponse.success) {
      setIncident(detailsResponse.data);
      setAttachments(detailsResponse.data.attachments || []);
    } else {
      setError(detailsResponse.error);
      Alert.alert('Error', `Failed to fetch incident details: ${detailsResponse.error}`);
    }

    if (transitionsResponse.success) {
      const executableTransitions = transitionsResponse.data.filter((t: TransitionData) => t.can_execute);
      setAvailableTransitions(executableTransitions);
    } else {
      console.log('Could not fetch transitions:', transitionsResponse.error);
      setAvailableTransitions([]);
    }

    setLoading(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      fetchDetails();
    }, [fetchDetails])
  );
  
  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" /></View>;
  }

  if (error || !incident) {
    return <View style={styles.centered}><Text style={styles.errorText}>{error || 'Incident not found.'}</Text></View>;
  }
  
  const priority = (incident.priority && priorityMap[incident.priority as keyof typeof priorityMap]) || { text: 'Unknown', color: '#95A5A6' };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{incident.incident_number}</Text>
        <View style={{ width: 28 }} />
      </View>
      
      <View style={{ flex: 1 }}>
        <ScrollView>
          <View style={styles.content}>
            <Text style={styles.incidentTitle}>{incident.title}</Text>
            <Text style={styles.incidentDate}>{new Date(incident.created_at).toLocaleString()} ({incident.reporter?.username || 'N/A'})</Text>
            <View style={[styles.priorityBadge, { backgroundColor: priority.color }]}>
              <Text style={styles.priorityText}>{priority.text}</Text>
            </View>

            <DottedSeparator />

            {/* Compact detail grid - only show items with values */}
            <View style={styles.detailsGrid}>
              {incident.current_state && (
                <View style={styles.detailGridItem}>
                  <Text style={styles.detailLabel}>Status</Text>
                  <Text style={styles.detailValue}>{incident.current_state.name}</Text>
                </View>
              )}
              {incident.classification && (
                <View style={styles.detailGridItem}>
                  <Text style={styles.detailLabel}>Classification</Text>
                  <Text style={styles.detailValue}>{incident.classification.name}</Text>
                </View>
              )}
              {incident.department && (
                <View style={styles.detailGridItem}>
                  <Text style={styles.detailLabel}>Department</Text>
                  <Text style={styles.detailValue}>{incident.department.name}</Text>
                </View>
              )}
              {(incident.assignees?.length || incident.assignee) && (
                <View style={styles.detailGridItem}>
                  <Text style={styles.detailLabel}>Assignee(s)</Text>
                  {incident.assignees && incident.assignees.length > 0 ? (
                    <Text style={styles.detailValue}>
                      {incident.assignees.map(a => `${a.first_name || ''} ${a.last_name || ''}`.trim()).join(', ')}
                    </Text>
                  ) : incident.assignee ? (
                    <Text style={styles.detailValue}>
                      {incident.assignee.first_name} {incident.assignee.last_name}
                    </Text>
                  ) : null}
                </View>
              )}
            </View>

            {incident.description && (
              <>
                <DottedSeparator />
                <Text style={styles.sectionTitleSmall}>Description</Text>
                <Text style={styles.descriptionText}>{incident.description}</Text>
              </>
            )}

            {/* Reporter Section - compact inline */}
            <DottedSeparator />
            <View style={styles.reporterCompact}>
              <Text style={styles.reporterLabel}>Reporter:</Text>
              <View style={styles.reporterInfo}>
                <Text style={styles.reporterName}>
                  {incident.reporter?.first_name
                    ? `${incident.reporter.first_name} ${incident.reporter.last_name || ''}`
                    : incident.reporter?.username || incident.reporter_name || 'Unknown'}
                </Text>
                <View style={styles.reporterContacts}>
                  {(incident.reporter_email || incident.reporter?.email) && (
                    <TouchableOpacity onPress={() => Linking.openURL(`mailto:${incident.reporter_email || incident.reporter?.email}`)}>
                      <Ionicons name="mail-outline" size={16} color="#2EC4B6" style={{ marginRight: 12 }} />
                    </TouchableOpacity>
                  )}
                  {incident.reporter?.phone && (
                    <TouchableOpacity onPress={() => Linking.openURL(`tel:${incident.reporter?.phone}`)}>
                      <Ionicons name="call-outline" size={16} color="#2EC4B6" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Comments:</Text>
              <TouchableOpacity>
                <Text style={styles.viewAllText}>View all</Text>
              </TouchableOpacity>
            </View>
            {incident.comments && incident.comments.length > 0 ? (
                incident.comments.map(comment => (
                    <View style={styles.commentCard} key={comment.id}>
                        <Text style={styles.commentText}>{comment.content}</Text>
                        <Text style={styles.commentAuthor}>{`By ${comment.author.username} | ${new Date(comment.created_at).toLocaleString()}`}</Text>
                    </View>
                ))
            ) : (
                <Text style={styles.noDataText}>No comments yet.</Text>
            )}


            <Text style={styles.sectionTitle}>Attachments:</Text>
            {imageAttachments.length > 0 && (
                <View style={styles.carouselContainer}>
                    <ScrollView
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        onScroll={event => {
                            const slide = Math.ceil(event.nativeEvent.contentOffset.x / event.nativeEvent.layoutMeasurement.width);
                            if (slide !== currentImageIndex) {
                                setCurrentImageIndex(slide);
                            }
                        }}
                    >
                        {imageAttachments.map((att, index) => (
                            <TouchableOpacity key={att.id} onPress={() => {
                                setCurrentImageIndex(index);
                                setImageViewerVisible(true);
                            }}>
                                <Image source={{ uri: `${baseURL}/attachments/${att.id}`, headers: { Authorization: `Bearer ${token}` } }} style={styles.attachmentImage} />
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                    <View style={styles.pagination}>
                        {imageAttachments.map((_, index) => (
                            <Text key={index} style={index === currentImageIndex ? styles.paginationDotActive : styles.paginationDot}>
                                ●
                            </Text>
                        ))}
                    </View>
                </View>
            )}

            {otherAttachments.map(att => (
                <TouchableOpacity key={att.id} onPress={() => Linking.openURL(`${baseURL}/attachments/${att.id}`)} style={styles.attachmentButton}>
                    <Ionicons name="attach" size={20} color="#2EC4B6" />
                    <Text style={styles.attachmentText}>{att.file_name}</Text>
                </TouchableOpacity>
            ))}

            {attachments.length === 0 && <Text style={styles.noDataText}>No attachments</Text>}

            <ImageView
                images={imageAttachments.map(att => ({ uri: `${baseURL}/attachments/${att.id}`, headers: { Authorization: `Bearer ${token}` } }))}
                imageIndex={currentImageIndex}
                visible={isImageViewerVisible}
                onRequestClose={() => setImageViewerVisible(false)}
            />


            {/* Location - only show if available */}
            {incident.location && (
              <>
                <Text style={styles.sectionTitleSmall}>Location</Text>
                <View style={styles.locationContainerCompact}>
                  <Ionicons name="location-sharp" size={16} color="#E74C3C" />
                  <Text style={styles.locationTextCompact}>
                    {incident.location.name}{incident.location.address ? ` - ${incident.location.address}` : ''}
                  </Text>
                </View>
              </>
            )}

            {/* Geolocation Section - compact with map */}
            {(incident.latitude !== undefined && incident.longitude !== undefined) && (
              <>
                <Text style={styles.sectionTitleSmall}>Geolocation</Text>
                {/* Map first - smaller height */}
                <View style={styles.mapContainerCompact}>
                  <MapView
                    style={styles.map}
                    initialRegion={{
                      latitude: incident.latitude,
                      longitude: incident.longitude,
                      latitudeDelta: 0.01,
                      longitudeDelta: 0.01,
                    }}
                  >
                    <Marker
                      coordinate={{
                        latitude: incident.latitude,
                        longitude: incident.longitude,
                      }}
                      title={incident.title}
                      description={incident.address || 'Incident Location'}
                      pinColor="#2EC4B6"
                    />
                  </MapView>
                </View>
                {/* Compact coordinates and address */}
                <View style={styles.geoInfoCompact}>
                  <View style={styles.coordRow}>
                    <Ionicons name="navigate" size={14} color="#2EC4B6" />
                    <Text style={styles.coordText}>
                      {incident.latitude?.toFixed(6)}, {incident.longitude?.toFixed(6)}
                    </Text>
                  </View>
                  {incident.address && (
                    <Text style={styles.geoAddressText} numberOfLines={2}>{incident.address}</Text>
                  )}
                  {(incident.city || incident.state || incident.country) && (
                    <Text style={styles.geoLocationLine}>
                      {[incident.city, incident.state, incident.country, incident.postal_code].filter(Boolean).join(', ')}
                    </Text>
                  )}
                </View>
              </>
            )}

            <Text style={styles.sectionTitle}>Transition History</Text>
            {incident.transition_history && incident.transition_history.length > 0 ? (
                incident.transition_history.map(item => (
                    <TransitionHistoryCard key={item.id} item={item} />
                ))
            ) : (
                <Text style={styles.noDataText}>No transition history.</Text>
            )}
          </View>
        </ScrollView>
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
          >
            <Text style={styles.updateButtonText}>UPDATE</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: 'white',
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    errorText: {
        color: 'red',
        fontSize: 16
    },
    noDataText: {
        color: '#999',
        fontStyle: 'italic',
        marginTop: 10,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#EEE',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    backButton: {},
    scrollView: {},
    content: {
        padding: 20,
    },
    incidentTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 5,
    },
    incidentDate: {
        fontSize: 14,
        color: '#666',
        marginBottom: 10,
    },
    priorityBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 15,
        marginBottom: 15,
    },
    priorityText: {
        color: 'white',
        fontWeight: 'bold',
    },
    separator: {
        height: 1,
        borderBottomWidth: 1,
        borderBottomColor: '#EEE',
        borderStyle: 'dashed',
        marginVertical: 10,
    },
    detailsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 5,
    },
    detailGridItem: {
        width: '50%',
        marginBottom: 10,
    },
    detailItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    detailLabel: {
        fontSize: 11,
        color: '#999',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    detailValue: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
        marginTop: 2,
    },
    descriptionText: {
        fontSize: 14,
        color: '#333',
        lineHeight: 20,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 10,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginTop: 15,
        marginBottom: 8,
    },
    sectionTitleSmall: {
        fontSize: 14,
        fontWeight: '600',
        color: '#666',
        marginTop: 12,
        marginBottom: 6,
    },
    viewAllText: {
        color: '#2EC4B6',
        fontWeight: 'bold',
    },
    commentCard: {
        backgroundColor: '#F8F9FA',
        padding: 15,
        borderRadius: 10,
        borderLeftWidth: 4,
        borderLeftColor: '#2EC4B6',
        marginBottom: 10,
    },
    commentText: {
        fontSize: 14,
        marginBottom: 10,
    },
    commentAuthor: {
        fontSize: 12,
        color: '#999',
    },
    attachmentButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8F9FA',
        padding: 10,
        borderRadius: 5,
        marginBottom: 10,
    },
    attachmentText: {
        marginLeft: 10,
        fontSize: 14,
        color: '#333',
    },
    attachmentContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    attachmentImage: {
        width: width - 40,
        height: 200,
        borderRadius: 10,
        marginBottom: 10,
    },
    carouselContainer: {
        height: 200,
        marginBottom: 10,
    },
    pagination: {
        flexDirection: 'row',
        position: 'absolute',
        bottom: 0,
        alignSelf: 'center',
    },
    paginationDot: {
        color: 'white',
        margin: 3,
        fontSize: 10,
    },
    paginationDotActive: {
        color: '#2EC4B6',
        margin: 3,
        fontSize: 10,
    },
    locationContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 10,
    },
    locationText: {
        fontSize: 14,
        color: '#333',
    },
    locationContainerCompact: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8F9FA',
        borderRadius: 8,
        padding: 10,
        marginBottom: 10,
    },
    locationTextCompact: {
        fontSize: 13,
        color: '#333',
        marginLeft: 8,
        flex: 1,
    },
    mapContainer: {
        height: 150,
        borderRadius: 10,
        overflow: 'hidden',
        marginBottom: 15,
        borderWidth: 1,
        borderColor: '#E0E0E0',
    },
    map: {
        width: '100%',
        height: '100%',
    },
    updateButton: {
        position: 'absolute',
        bottom: 20,
        left: 20,
        right: 20,
        backgroundColor: '#2EC4B6',
        paddingVertical: 15,
        borderRadius: 10,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    updateButtonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
    historyCard: {
        flexDirection: 'row',
        marginBottom: 15,
    },
    historyIcon: {
        backgroundColor: '#8B5CF6',
        borderRadius: 20,
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    historyDetails: {
        flex: 1,
    },
    historyText: {
        fontSize: 14,
    },
    historyState: {
        fontWeight: 'bold',
    },
    historyMeta: {
        fontSize: 12,
        color: '#999',
        marginTop: 3,
    },
    historyComment: {
        fontSize: 12,
        color: '#666',
        fontStyle: 'italic',
        marginTop: 5,
        backgroundColor: '#F0F0F0',
        padding: 5,
        borderRadius: 5,
    },
    reporterContainer: {
        backgroundColor: '#F8F9FA',
        borderRadius: 10,
        padding: 15,
        marginBottom: 15,
    },
    reporterRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    reporterText: {
        fontSize: 14,
        color: '#333',
        marginLeft: 10,
    },
    reporterLink: {
        fontSize: 14,
        color: '#2EC4B6',
        marginLeft: 10,
    },
    // Compact reporter styles
    reporterCompact: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    reporterLabel: {
        fontSize: 14,
        color: '#666',
    },
    reporterInfo: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
    },
    reporterName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
        marginRight: 10,
    },
    reporterContacts: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    // Compact map and geo styles
    mapContainerCompact: {
        height: 140,
        borderRadius: 8,
        overflow: 'hidden',
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#E0E0E0',
    },
    geoInfoCompact: {
        backgroundColor: '#F8F9FA',
        borderRadius: 8,
        padding: 10,
        marginBottom: 10,
    },
    coordRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    coordText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#333',
        marginLeft: 6,
    },
    geoAddressText: {
        fontSize: 12,
        color: '#666',
        marginTop: 4,
        marginLeft: 20,
    },
    geoLocationLine: {
        fontSize: 11,
        color: '#999',
        marginTop: 2,
        marginLeft: 20,
    },
});

export default IncidentDetailsScreen;
