import { getMyAssignedIncidents, getMyReportedIncidents } from '@/src/api/incidents';
import { getProfile } from '@/src/api/user';
import { FontAwesome, Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useState, useRef, useEffect } from 'react';
import { ActivityIndicator, Alert, ImageBackground, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const priorityMap: Record<number, { text: string; color: string }> = {
  1: { text: 'Critical', color: '#E74C3C' },
  2: { text: 'High', color: '#E67E22' },
  3: { text: 'Medium', color: '#F1C40F' },
  4: { text: 'Low', color: '#3498DB' },
  5: { text: 'Very Low', color: '#2ECC71' },
};

interface Incident {
  id: string;
  incident_number: string;
  title: string;
  priority: number;
  created_at: string;
  due_date?: string;
  sla_breached?: boolean;
  current_state?: { name: string; color?: string };
  location?: { name: string };
  assignee?: { first_name?: string; username: string };
  department?: { name: string };
}

interface PaginationInfo {
  page: number;
  limit: number;
  total_items: number;
  total_pages: number;
}

const IncidentCard = ({ incident, isAssigned }: { incident: Incident; isAssigned: boolean }) => {
  const router = useRouter();
  const priority = priorityMap[incident.priority] || { text: 'Unknown', color: '#95A5A6' };

  return (
    <TouchableOpacity
      style={styles.incidentCard}
      onPress={() => router.push(`/incident-details?id=${incident.id}`)}
    >
      <View style={[styles.incidentPriorityBar, { backgroundColor: priority.color }]} />
      <View style={styles.incidentCardContent}>
        <View style={styles.incidentCardHeader}>
          <View style={styles.incidentIdContainer}>
            <View style={[styles.incidentDot, { backgroundColor: priority.color }]} />
            <Text style={styles.incidentId}>{incident.incident_number}</Text>
          </View>
          <View style={styles.tagsRow}>
            {incident.sla_breached && (
              <View style={styles.slaBreachedBadge}>
                <Ionicons name="warning" size={10} color="#FFF" />
                <Text style={styles.slaBreachedText}>SLA</Text>
              </View>
            )}
            <Text style={[styles.incidentTag, { backgroundColor: priority.color }]}>
              {priority.text}
            </Text>
          </View>
        </View>
        <Text style={styles.incidentTitle} numberOfLines={2}>{incident.title}</Text>
        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: incident.current_state?.color ? `${incident.current_state.color}20` : '#E3F2FD' }
            ]}
          >
            <Text
              style={[
                styles.statusText,
                { color: incident.current_state?.color || '#1976D2' }
              ]}
            >
              {incident.current_state?.name || 'N/A'}
            </Text>
          </View>
          {incident.due_date && (
            <View style={styles.dueDateContainer}>
              <Ionicons name="calendar-outline" size={12} color="#666" />
              <Text style={styles.dueDateText}>
                {new Date(incident.due_date).toLocaleDateString()}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.metaRow}>
          {isAssigned ? (
            incident.department && (
              <View style={styles.metaItem}>
                <Ionicons name="business-outline" size={14} color="#666" />
                <Text style={styles.metaText}>{incident.department.name}</Text>
              </View>
            )
          ) : (
            incident.assignee && (
              <View style={styles.metaItem}>
                <Ionicons name="person-outline" size={14} color="#666" />
                <Text style={styles.metaText}>
                  {incident.assignee.first_name || incident.assignee.username}
                </Text>
              </View>
            )
          )}
          {incident.location && (
            <View style={styles.metaItem}>
              <Ionicons name="location-outline" size={14} color="#666" />
              <Text style={styles.metaText}>{incident.location.name}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const MyIncidentsScreen = () => {
  const router = useRouter();
  const { type: initialType } = useLocalSearchParams<{ type?: string }>();
  const [activeTab, setActiveTab] = useState<'assigned' | 'created'>(
    initialType === 'created' ? 'created' : 'assigned'
  );

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState<{ email?: string; username?: string; id?: string } | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    total_items: 0,
    total_pages: 0,
  });

  const isLoadingMore = useRef(false);

  // Fetch current user info
  useEffect(() => {
    const fetchUser = async () => {
      const response = await getProfile();
      if (response.success) {
        setCurrentUser(response.data);
      }
    };
    fetchUser();
  }, []);

  const fetchIncidents = async (page = 1, append = false) => {
    if (page === 1) {
      setLoading(true);
      setError('');
    }

    const fetchFn = activeTab === 'assigned' ? getMyAssignedIncidents : getMyReportedIncidents;
    const response = await fetchFn(page, 20);

    if (response.success) {
      if (append) {
        setIncidents(prev => [...prev, ...response.data]);
      } else {
        setIncidents(response.data);
      }
      setPagination(response.pagination);
    } else {
      setError(response.error || 'Failed to fetch incidents');
      if (!append) {
        Alert.alert('Error', response.error || 'Failed to fetch incidents.');
      }
    }

    setLoading(false);
    setLoadingMore(false);
    setRefreshing(false);
    isLoadingMore.current = false;
  };

  const handleLoadMore = () => {
    if (isLoadingMore.current || loadingMore || loading) return;
    if (pagination.page >= pagination.total_pages) return;

    isLoadingMore.current = true;
    setLoadingMore(true);
    fetchIncidents(pagination.page + 1, true);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchIncidents(1, false);
  };

  useEffect(() => {
    fetchIncidents(1, false);
  }, [activeTab]);

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#1A237E" />
        <Text style={styles.footerLoaderText}>Loading more...</Text>
      </View>
    );
  };

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconContainer}>
          <Ionicons
            name={activeTab === 'assigned' ? 'checkbox-outline' : 'create-outline'}
            size={48}
            color="#1A237E"
          />
        </View>
        <Text style={styles.emptyTitle}>
          {activeTab === 'assigned' ? 'No Assigned Incidents' : 'No Reported Incidents'}
        </Text>
        <Text style={styles.emptySubtitle}>
          {activeTab === 'assigned'
            ? 'No incidents are currently assigned to you'
            : 'You have not created any incidents yet'}
        </Text>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => router.push('/add-incident')}
        >
          <FontAwesome name="plus" size={16} color="white" />
          <Text style={styles.createButtonText}>Create Incident</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderHeader = () => (
    <View style={styles.listHeader}>
      <Text style={styles.incidentsFoundText}>
        {pagination.total_items} {activeTab === 'assigned' ? 'assigned' : 'created'} incident{pagination.total_items !== 1 ? 's' : ''}
      </Text>
      {pagination.total_pages > 1 && (
        <Text style={styles.paginationText}>
          Page {pagination.page} of {pagination.total_pages}
        </Text>
      )}
    </View>
  );

  // Stats summary
  const openCount = incidents.filter(i => i.current_state?.name?.toLowerCase() !== 'closed' && i.current_state?.name?.toLowerCase() !== 'resolved').length;
  const breachedCount = incidents.filter(i => i.sla_breached).length;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ImageBackground source={require('@/assets/images/background.png')} style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>My Incidents</Text>
          {currentUser && (
            <Text style={styles.headerSubtitle}>Logged in as: {currentUser.email}</Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.headerIcon}
          onPress={() => router.push('/add-incident')}
        >
          <FontAwesome name="plus" size={20} color="white" />
        </TouchableOpacity>
      </ImageBackground>

      <View style={styles.contentContainer}>
        {/* Tabs */}
        <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'assigned' && styles.activeTab]}
          onPress={() => setActiveTab('assigned')}
        >
          <Ionicons
            name="checkbox-outline"
            size={18}
            color={activeTab === 'assigned' ? '#1A237E' : '#666'}
          />
          <Text style={[styles.tabText, activeTab === 'assigned' && styles.activeTabText]}>
            Assigned to Me
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'created' && styles.activeTab]}
          onPress={() => setActiveTab('created')}
        >
          <Ionicons
            name="create-outline"
            size={18}
            color={activeTab === 'created' ? '#1A237E' : '#666'}
          />
          <Text style={[styles.tabText, activeTab === 'created' && styles.activeTabText]}>
            Created by Me
          </Text>
        </TouchableOpacity>
      </View>

      {/* Quick Stats */}
      {!loading && incidents.length > 0 && (
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{pagination.total_items}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: '#F1C40F' }]}>{openCount}</Text>
            <Text style={styles.statLabel}>Open</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: '#E74C3C' }]}>{breachedCount}</Text>
            <Text style={styles.statLabel}>SLA Breached</Text>
          </View>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <View style={styles.loaderCard}>
            <ActivityIndicator size="large" color="#1A237E" />
            <Text style={styles.loadingText}>Loading incidents...</Text>
          </View>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchIncidents(1, false)}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={incidents}
          renderItem={({ item }) => <IncidentCard incident={item} isAssigned={activeTab === 'assigned'} />}
          keyExtractor={(item) => item.id}
          style={styles.flatList}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={incidents.length > 0 ? renderHeader : null}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmpty}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          showsVerticalScrollIndicator={false}
        />
      )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1A237E',
  },
  contentContainer: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  flatList: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 20,
  },
  loaderCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  loadingText: {
    marginTop: 16,
    color: '#1A237E',
    fontSize: 16,
    fontWeight: '500',
  },
  errorText: {
    color: 'red',
    fontSize: 16,
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#1A237E',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  header: {
    paddingHorizontal: 15,
    paddingTop: 40,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 5,
  },
  headerTitleContainer: {
    flex: 1,
    marginLeft: 10,
  },
  headerTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    marginTop: 2,
  },
  headerIcon: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 15,
    paddingTop: 15,
    paddingBottom: 5,
    gap: 10,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: 'white',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  activeTab: {
    backgroundColor: '#E3F2FD',
    borderWidth: 1,
    borderColor: '#1A237E',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  activeTabText: {
    color: '#1A237E',
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    marginHorizontal: 15,
    marginTop: 10,
    borderRadius: 10,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A237E',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 5,
  },
  listContent: {
    padding: 15,
    paddingBottom: 30,
    backgroundColor: '#F5F5F5',
    flexGrow: 1,
  },
  listHeader: {
    marginBottom: 15,
  },
  incidentsFoundText: {
    fontSize: 14,
    color: '#666',
  },
  paginationText: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  incidentCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  incidentPriorityBar: {
    width: 5,
  },
  incidentCardContent: {
    flex: 1,
    padding: 15,
  },
  incidentCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  incidentIdContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  incidentDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  incidentId: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1A237E',
  },
  tagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  slaBreachedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E74C3C',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    gap: 3,
  },
  slaBreachedText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  incidentTag: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  incidentTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
    lineHeight: 20,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dueDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dueDateText: {
    fontSize: 12,
    color: '#666',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#666',
  },
  footerLoader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  footerLoaderText: {
    marginLeft: 10,
    color: '#666',
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 30,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2EC4B6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  createButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default MyIncidentsScreen;
