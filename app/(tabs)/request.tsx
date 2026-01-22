import { getRequests, getRequestStats } from '@/src/api/incidents';
import { FontAwesome, Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useState, useRef, useEffect } from 'react';
import { ActivityIndicator, Alert, ImageBackground, SafeAreaView, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const priorityMap: Record<number, { text: string; color: string }> = {
    1: { text: 'Critical', color: '#E74C3C' },
    2: { text: 'High', color: '#E67E22' },
    3: { text: 'Medium', color: '#F1C40F' },
    4: { text: 'Low', color: '#3498DB' },
    5: { text: 'Very Low', color: '#2ECC71' },
};

const severityMap: Record<number, { text: string; color: string }> = {
    1: { text: 'Critical', color: '#E74C3C' },
    2: { text: 'Major', color: '#E67E22' },
    3: { text: 'Moderate', color: '#F1C40F' },
    4: { text: 'Minor', color: '#3498DB' },
    5: { text: 'Cosmetic', color: '#2ECC71' },
};

const slaStatusMap: Record<string, { text: string; color: string }> = {
    'on_track': { text: 'On Track', color: '#2ECC71' },
    'at_risk': { text: 'At Risk', color: '#F1C40F' },
    'breached': { text: 'Breached', color: '#E74C3C' },
};

interface Request {
  id: string;
  incident_number: string;
  title: string;
  priority: number;
  created_at: string;
  current_state?: { name: string };
  location?: { name: string };
}

interface PaginationInfo {
  page: number;
  limit: number;
  total_items: number;
  total_pages: number;
}

const RequestCard = ({ request }: { request: Request }) => {
  const router = useRouter();
  const priority = priorityMap[request.priority] || { text: 'Unknown', color: '#95A5A6' };

  return (
    <TouchableOpacity
      style={styles.requestCard}
      onPress={() => router.push(`/request-details?id=${request.id}`)}
    >
      <View style={[styles.requestPriorityBar, { backgroundColor: priority.color }]} />
      <View style={styles.requestCardContent}>
        <View style={styles.requestCardHeader}>
          <View style={styles.requestIdContainer}>
            <View style={[styles.requestDot, { backgroundColor: priority.color }]} />
            <Text style={styles.requestId}>{request.incident_number}</Text>
          </View>
          <Text style={[styles.requestTag, { backgroundColor: priority.color }]}>
            {priority.text}
          </Text>
        </View>
        <Text style={styles.requestDateTime}>{new Date(request.created_at).toLocaleString()}</Text>
        <Text style={styles.requestStatus}>Status: {request.current_state?.name || 'N/A'}</Text>
        <View style={styles.requestDetailRow}>
          <Ionicons name="document-text" size={16} color="#9B59B6" style={{ marginRight: 5 }} />
          <Text style={styles.requestDetailText}>{request.title}</Text>
        </View>
        <View style={styles.requestDetailRow}>
          <Ionicons name="location-sharp" size={16} color="#3498DB" style={{ marginRight: 5 }} />
          <Text style={styles.requestDetailText}>{request.location?.name || 'No location'}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const RequestsScreen = () => {
  const router = useRouter();
  const {
    state_id,
    state_name,
    priority,
    severity,
    assignee_id,
    assignee_name,
    department_id,
    department_name,
    classification_id,
    classification_name,
    location_id,
    location_name,
    sla_status
  } = useLocalSearchParams<{
    state_id?: string;
    state_name?: string;
    priority?: string;
    severity?: string;
    assignee_id?: string;
    assignee_name?: string;
    department_id?: string;
    department_name?: string;
    classification_id?: string;
    classification_name?: string;
    location_id?: string;
    location_name?: string;
    sla_status?: string;
  }>();

  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    total_items: 0,
    total_pages: 0,
  });

  const [defaultStatus, setDefaultStatus] = useState<{ id: string; name: string } | null>(null);
  const [statsLoaded, setStatsLoaded] = useState(false);

  const isLoadingMore = useRef(false);

  useEffect(() => {
    const fetchDefaultStatus = async () => {
      const response = await getRequestStats();
      if (response.success && response.data?.by_state_details?.length > 0) {
        const firstState = response.data.by_state_details[0];
        setDefaultStatus({ id: firstState.id, name: firstState.name });
      }
      setStatsLoaded(true);
    };
    fetchDefaultStatus();
  }, []);

  const activeStateId = state_id || (statsLoaded && !state_id && defaultStatus ? defaultStatus.id : undefined);
  const activeStateName = state_name || (statsLoaded && !state_id && defaultStatus ? defaultStatus.name : undefined);

  const buildParams = (page: number) => {
    const params: Record<string, any> = { page, limit: 20 };
    if (activeStateId) params.current_state_id = activeStateId;
    if (priority) params.priority = parseInt(priority);
    if (severity) params.severity = parseInt(severity);
    if (assignee_id) params.assignee_id = assignee_id;
    if (department_id) params.department_id = department_id;
    if (classification_id) params.classification_id = classification_id;
    if (location_id) params.location_id = location_id;
    if (sla_status) params.sla_status = sla_status;
    return params;
  };

  const fetchRequests = async (page = 1, append = false) => {
    if (page === 1) {
      setLoading(true);
    }

    const params = buildParams(page);
    const response = await getRequests(params);

    if (response.success) {
      if (append) {
        setRequests(prev => [...prev, ...response.data]);
      } else {
        setRequests(response.data);
      }
      setPagination(response.pagination);
    } else {
      setError(response.error || 'Failed to fetch requests');
      if (!append) {
        Alert.alert('Error', 'Failed to fetch requests.');
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
    fetchRequests(pagination.page + 1, true);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchRequests(1, false);
  };

  useFocusEffect(
    useCallback(() => {
      if (statsLoaded) {
        fetchRequests(1, false);
      }
    }, [statsLoaded, activeStateId, priority, severity, assignee_id, department_id, classification_id, location_id, sla_status])
  );

  const clearFilter = () => {
    router.replace('/(tabs)/request');
  };

  const hasManualFilters = state_id || priority || severity || assignee_id || department_id || classification_id || location_id || sla_status;
  const headerTitle = activeStateName || 'Requests';

  const activeFilterCount = [state_id, priority, severity, assignee_id, department_id, classification_id, location_id, sla_status].filter(Boolean).length;

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
        <Ionicons name="document-text-outline" size={64} color="#CCC" />
        <Text style={styles.emptyTitle}>No Requests Found</Text>
        <Text style={styles.emptySubtitle}>
          {hasManualFilters ? 'Try adjusting your filters' : 'Create your first request'}
        </Text>
      </View>
    );
  };

  const renderHeader = () => (
    <View style={styles.listHeader}>
      <Text style={styles.requestsFoundText}>
        {hasManualFilters
          ? `${pagination.total_items} requests found (${activeFilterCount} filter${activeFilterCount > 1 ? 's' : ''} applied)`
          : `${pagination.total_items} ${activeStateName || ''} request${pagination.total_items !== 1 ? 's' : ''}`
        }
      </Text>
      {pagination.total_pages > 1 && (
        <Text style={styles.paginationText}>
          Page {pagination.page} of {pagination.total_pages}
        </Text>
      )}
    </View>
  );

  const FilterBadges = () => {
    if (!hasManualFilters) return null;

    return (
      <View style={styles.filterBadgeContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterBadgeScroll}
          data={[
            state_id && state_name && { key: 'status', label: 'Status:', value: state_name },
            priority && { key: 'priority', label: 'Priority:', value: priorityMap[parseInt(priority)]?.text || priority },
            severity && { key: 'severity', label: 'Severity:', value: severityMap[parseInt(severity)]?.text || severity },
            assignee_id && assignee_name && { key: 'assignee', label: 'Assignee:', value: assignee_name },
            department_id && department_name && { key: 'dept', label: 'Dept:', value: department_name },
            classification_id && classification_name && { key: 'class', label: 'Class:', value: classification_name },
            location_id && location_name && { key: 'loc', label: 'Loc:', value: location_name },
            sla_status && { key: 'sla', label: 'SLA:', value: slaStatusMap[sla_status]?.text || sla_status },
          ].filter(Boolean) as { key: string; label: string; value: string }[]}
          renderItem={({ item }) => (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeLabel}>{item.label}</Text>
              <Text style={styles.filterBadgeValue}>{item.value}</Text>
            </View>
          )}
          keyExtractor={(item) => item.key}
        />
        <TouchableOpacity onPress={clearFilter} style={styles.clearAllButton}>
          <Ionicons name="close-circle" size={18} color="#E74C3C" />
          <Text style={styles.clearAllText}>Clear ({activeFilterCount})</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ImageBackground source={require('@/assets/images/background.png')} style={styles.header}>
        <View style={styles.backButton} />
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>{headerTitle}</Text>
        </View>
        <View style={styles.headerIcons}>
          <TouchableOpacity style={styles.headerIcon}>
            <Ionicons name="search-outline" size={24} color="white" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerIcon, hasManualFilters && styles.filterIconActive]}
            onPress={() => router.push({
              pathname: '/request-filter',
              params: { state_id, state_name, priority, severity, assignee_id, assignee_name, department_id, department_name, classification_id, classification_name, location_id, location_name, sla_status }
            })}
          >
            <FontAwesome name="filter" size={20} color="white" />
            {hasManualFilters && <View style={styles.filterDot} />}
          </TouchableOpacity>
        </View>
      </ImageBackground>

      <FilterBadges />

      {(loading || !statsLoaded) ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1A237E" />
          <Text style={styles.loadingText}>Loading requests...</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchRequests(1, false)}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={requests}
          renderItem={({ item }) => <RequestCard request={item} />}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={renderHeader}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmpty}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          showsVerticalScrollIndicator={false}
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={() => router.push('/add-request')}>
        <FontAwesome name="plus" size={24} color="white" />
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1A237E',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontSize: 14,
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
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginLeft: 10,
  },
  headerTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginRight: 5,
  },
  headerIcons: {
    flexDirection: 'row',
  },
  headerIcon: {
    marginLeft: 15,
    padding: 5,
  },
  filterBadgeContainer: {
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 15,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterBadgeScroll: {
    flex: 1,
  },
  filterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8D5F2',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  filterBadgeLabel: {
    fontSize: 12,
    color: '#666',
    marginRight: 4,
  },
  filterBadgeValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#9B59B6',
  },
  clearAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
  },
  clearAllText: {
    fontSize: 12,
    color: '#E74C3C',
    fontWeight: '600',
  },
  filterIconActive: {
    position: 'relative',
  },
  filterDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#9B59B6',
  },
  listContent: {
    padding: 15,
    paddingBottom: 100,
    backgroundColor: '#F5F5F5',
    flexGrow: 1,
  },
  listHeader: {
    marginBottom: 15,
  },
  requestsFoundText: {
    fontSize: 16,
    color: '#666',
  },
  paginationText: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  requestCard: {
    backgroundColor: 'white',
    borderRadius: 10,
    marginBottom: 10,
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  requestPriorityBar: {
    width: 5,
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
  },
  requestCardContent: {
    flex: 1,
    padding: 15,
  },
  requestCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  requestIdContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  requestDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  requestId: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  requestTag: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
  },
  requestDateTime: {
    fontSize: 12,
    color: '#999',
    marginBottom: 10,
  },
  requestStatus: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  requestDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  requestDetailText: {
    fontSize: 14,
    color: '#555',
    flexShrink: 1,
  },
  fab: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#9B59B6',
    justifyContent: 'center',
    alignItems: 'center',
    bottom: 90,
    right: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
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
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
});

export default RequestsScreen;
