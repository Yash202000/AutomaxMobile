import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Linking, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ImageView from 'react-native-image-viewing';
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

const TransitionHistoryCard = ({ item }) => (
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


const IncidentDetailsScreen = () => {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [incident, setIncident] = useState(null);
  const [availableTransitions, setAvailableTransitions] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [token, setToken] = useState(null);
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
      const executableTransitions = transitionsResponse.data.filter(t => t.can_execute);
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
  
  const priority = priorityMap[incident.priority] || { text: 'Unknown', color: '#95A5A6' };

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

            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Classification:</Text>
              <Text style={styles.detailValue}>{incident.classification?.name || 'N/A'}</Text>
            </View>
            <DottedSeparator />
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Status:</Text>
              <Text style={styles.detailValue}>{incident.current_state?.name || 'N/A'}</Text>
            </View>
            <DottedSeparator />
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Department:</Text>
              <Text style={styles.detailValue}>{incident.department?.name || 'N/A'}</Text>
            </View>
            <DottedSeparator />
             <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Assignee Phone:</Text>
              <Text style={styles.detailValue}>{incident.assignee?.phone || 'N/A'}</Text>
            </View>
            <DottedSeparator />
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Description:</Text>
              <Text style={[styles.detailValue, { flex: 1, textAlign: 'left' }]}>{incident.description}</Text>
            </View>
            <DottedSeparator />

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


            <Text style={styles.sectionTitle}>Location:</Text>
            <View style={styles.locationContainer}>
              <Ionicons name="location-sharp" size={20} color="#E74C3C" />
              <View style={{ marginLeft: 10 }}>
                <Text style={styles.locationText}>{incident.location?.name || 'No Location'}</Text>
                <Text style={styles.locationText}>{incident.location?.address || ''}</Text>
              </View>
            </View>
            <View style={styles.mapPlaceholder}>
              <Text>Map Placeholder</Text>
            </View>

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
                transitions: JSON.stringify(availableTransitions) 
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
        marginVertical: 15,
    },
    detailItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    detailLabel: {
        fontSize: 16,
        color: '#666',
    },
    detailValue: {
        fontSize: 16,
        fontWeight: 'bold',
        textAlign: 'right',
        flexShrink: 1,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 10,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginTop: 20,
        marginBottom: 10,
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
    mapPlaceholder: {
        height: 200,
        backgroundColor: '#E0E0E0',
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 80, // Space for the button
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
});

export default IncidentDetailsScreen;
