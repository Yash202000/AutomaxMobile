import { getIncidents, getIncidentStats } from '@/src/api/incidents';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ImageBackground, FlatList, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePermissions } from '@/src/hooks/usePermissions';

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
  incident: '#10B981',
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

const slaStatusConfig: Record<string, { key: string; color: string }> = {
  'on_track': { key: 'onTrack', color: '#22C55E' },
  'at_risk': { key: 'atRisk', color: '#F59E0B' },
  'breached': { key: 'breached', color: '#DC2626' },
};

interface Incident {
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

const IncidentCard = ({ incident, t }: { incident: Incident; t: any }) => {
  const router = useRouter();
  const config = priorityConfig[incident.priority] || { key: 'unknown', color: '#94A3B8' };
  const priorityText = t(`priorities.${config.key}`, config.key);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/incident-details?id=${incident.id}`)}
      activeOpacity={0.7}
    >
      <View style={[styles.cardBar, { backgroundColor: config.color }]} />
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <View style={styles.idContainer}>
            <View style={[styles.dot, { backgroundColor: config.color }]} />
            <Text style={styles.idText}>{incident.incident_number}</Text>
          </View>
          <View style={[styles.priorityBadge, { backgroundColor: config.color }]}>
            <Text style={styles.priorityText}>{priorityText}</Text>
          </View>
        </View>
        <Text style={styles.dateTime}>{new Date(incident.created_at).toLocaleString()}</Text>
        <Text style={styles.statusText}>{t('incidents.status')}: {incident.current_state?.name || 'N/A'}</Text>
        <View style={styles.detailRow}>
          <Ionicons name="alert-circle" size={16} color={COLORS.incident} style={styles.detailIcon} />
          <Text style={styles.detailText} numberOfLines={1}>{incident.title}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="location" size={16} color={COLORS.priority.low} style={styles.detailIcon} />
          <Text style={styles.detailText}>{incident.location?.name || t('common.noData')}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const IncidentsScreen = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const { canCreateIncidents } = usePermissions();
  const {
    state_id, state_name, priority, severity, assignee_id, assignee_name,
    department_id, department_name, classification_id, classification_name,
    location_id, location_name, sla_status
  } = useLocalSearchParams<{
    state_id?: string; state_name?: string; priority?: string; severity?: string;
    assignee_id?: string; assignee_name?: string; department_id?: string;
    department_name?: string; classification_id?: string; classification_name?: string;
    location_id?: string; location_name?: string; sla_status?: string;
  }>();

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1, limit: 20, total_items: 0, total_pages: 0,
  });
  const [defaultStatus, setDefaultStatus] = useState<{ id: string; name: string } | null>(null);
  const [statsLoaded, setStatsLoaded] = useState(false);
  const isLoadingMore = useRef(false);

  useEffect(() => {
    const fetchDefaultStatus = async () => {
      const response = await getIncidentStats();
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

  const fetchIncidents = async (page = 1, append = false) => {
    if (page === 1) setLoading(true);
    setError('');

    const params = buildParams(page);
    const response = await getIncidents(params);

    if (response.success) {
      setIncidents(append ? prev => [...prev, ...response.data] : response.data);
      setPagination(response.pagination);
    } else {
      setError(response.error || t('errors.fetchFailed'));
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

  useFocusEffect(
    useCallback(() => {
      if (statsLoaded) fetchIncidents(1, false);
    }, [statsLoaded, activeStateId, priority, severity, assignee_id, department_id, classification_id, location_id, sla_status])
  );

  const clearFilter = () => router.replace('/(tabs)/incident');

  const hasManualFilters = state_id || priority || severity || assignee_id || department_id || classification_id || location_id || sla_status;
  const headerTitle = activeStateName || t('incidents.title');
  const activeFilterCount = [state_id, priority, severity, assignee_id, department_id, classification_id, location_id, sla_status].filter(Boolean).length;

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={COLORS.primary} />
        <Text style={styles.footerLoaderText}>{t('incidents.loadingMore')}</Text>
      </View>
    );
  };

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="document-text-outline" size={64} color={COLORS.text.muted} />
        <Text style={styles.emptyTitle}>{t('incidents.noIncidents')}</Text>
        <Text style={styles.emptySubtitle}>
          {hasManualFilters ? t('incidents.adjustFilters') : t('incidents.noIncidentsDesc')}
        </Text>
      </View>
    );
  };

  const renderHeader = () => (
    <View style={styles.listHeader}>
      <Text style={styles.foundText}>
        {hasManualFilters
          ? t('incidents.incidentsFound', { count: pagination.total_items }) + ` (${activeFilterCount} ${t('filter.title').toLowerCase()})`
          : `${pagination.total_items} ${activeStateName || ''} ${pagination.total_items !== 1 ? t('tabs.incident').toLowerCase() : t('tabs.incident').toLowerCase().slice(0, -1)}`
        }
      </Text>
      {pagination.total_pages > 1 && (
        <Text style={styles.paginationText}>{t('incidents.page', { current: pagination.page, total: pagination.total_pages })}</Text>
      )}
    </View>
  );

  const FilterBadges = () => {
    if (!hasManualFilters) return null;
    const badges = [
      state_id && state_name && { key: 'status', label: t('filter.status'), value: state_name },
      priority && { key: 'priority', label: t('filter.priority'), value: t(`priorities.${priorityConfig[parseInt(priority)]?.key}`) },
      assignee_id && assignee_name && { key: 'assignee', label: t('filter.assignee'), value: assignee_name },
      department_id && department_name && { key: 'dept', label: t('filter.department'), value: department_name },
      classification_id && classification_name && { key: 'class', label: t('filter.classification'), value: classification_name },
      location_id && location_name && { key: 'loc', label: t('filter.location'), value: location_name },
      sla_status && { key: 'sla', label: t('filter.slaStatus'), value: t(`sla.${slaStatusConfig[sla_status]?.key}`) },
    ].filter(Boolean) as { key: string; label: string; value: string }[];

    return (
      <View style={styles.filterBadgeContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterBadgeScroll}
          data={badges}
          renderItem={({ item }) => (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeLabel}>{item.label}:</Text>
              <Text style={styles.filterBadgeValue}>{item.value}</Text>
            </View>
          )}
          keyExtractor={(item) => item.key}
        />
        <TouchableOpacity onPress={clearFilter} style={styles.clearAllButton}>
          <Ionicons name="close-circle" size={18} color={COLORS.priority.critical} />
          <Text style={styles.clearAllText}>{t('filter.clearAll')} ({activeFilterCount})</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ImageBackground source={require('@/assets/images/background.png')} style={styles.header}>
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
              pathname: '/filter',
              params: { state_id, state_name, priority, severity, assignee_id, assignee_name, department_id, department_name, classification_id, classification_name, location_id, location_name, sla_status }
            })}
          >
            <Ionicons name="filter" size={22} color="white" />
            {hasManualFilters && <View style={styles.filterDot} />}
          </TouchableOpacity>
        </View>
      </ImageBackground>

      <FilterBadges />

      {(loading || !statsLoaded) ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>{t('incidents.loadingIncidents')}</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={64} color={COLORS.text.muted} />
          <Text style={styles.errorTitle}>{t('errors.oops')}</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchIncidents(1, false)}>
            <Ionicons name="refresh" size={20} color={COLORS.white} />
            <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={incidents}
          renderItem={({ item }) => <IncidentCard incident={item} t={t} />}
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

      {canCreateIncidents() && (
        <TouchableOpacity style={styles.fab} onPress={() => router.push('/add-incident')} activeOpacity={0.8}>
          <Ionicons name="add" size={28} color="white" />
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
};

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
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary,
    paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginTop: 24, gap: 8,
  },
  retryButtonText: { color: COLORS.white, fontSize: 16, fontWeight: '600' },
  header: {
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  headerTitleContainer: { flex: 1 },
  headerTitle: { color: 'white', fontSize: 22, fontWeight: 'bold' },
  headerIcons: { flexDirection: 'row', gap: 12 },
  headerIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center',
  },
  filterBadgeContainer: {
    backgroundColor: COLORS.background, paddingHorizontal: 16, paddingVertical: 12,
    flexDirection: 'row', alignItems: 'center',
  },
  filterBadgeScroll: { flex: 1 },
  filterBadge: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#DBEAFE',
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, marginRight: 8,
  },
  filterBadgeLabel: { fontSize: 12, color: COLORS.text.secondary, marginRight: 4 },
  filterBadgeValue: { fontSize: 12, fontWeight: 'bold', color: COLORS.primary },
  clearAllButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, gap: 4 },
  clearAllText: { fontSize: 12, color: COLORS.priority.critical, fontWeight: '600' },
  filterIconActive: { position: 'relative' },
  filterDot: {
    position: 'absolute', top: 6, right: 6, width: 8, height: 8,
    borderRadius: 4, backgroundColor: COLORS.accent,
  },
  listContent: { padding: 16, paddingBottom: 100, backgroundColor: COLORS.background, flexGrow: 1 },
  listHeader: { marginBottom: 16 },
  foundText: { fontSize: 15, color: COLORS.text.secondary, fontWeight: '500' },
  paginationText: { fontSize: 12, color: COLORS.text.muted, marginTop: 4 },
  card: {
    backgroundColor: COLORS.white, borderRadius: 14, marginBottom: 12, flexDirection: 'row',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
      android: { elevation: 2 },
    }),
  },
  cardBar: { width: 4, borderTopLeftRadius: 14, borderBottomLeftRadius: 14 },
  cardContent: { flex: 1, padding: 16 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  idContainer: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  idText: { fontSize: 16, fontWeight: 'bold', color: COLORS.text.primary },
  priorityBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  priorityText: { color: 'white', fontSize: 11, fontWeight: 'bold' },
  dateTime: { fontSize: 12, color: COLORS.text.muted, marginBottom: 8 },
  statusText: { fontSize: 14, fontWeight: '600', color: COLORS.text.primary, marginBottom: 10 },
  detailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  detailIcon: { marginRight: 8 },
  detailText: { fontSize: 14, color: COLORS.text.secondary, flex: 1 },
  fab: {
    position: 'absolute', width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.accent,
    justifyContent: 'center', alignItems: 'center', bottom: 90, right: 20,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
      android: { elevation: 8 },
    }),
  },
  footerLoader: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 20 },
  footerLoaderText: { marginLeft: 10, color: COLORS.text.secondary, fontSize: 14 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text.primary, marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: COLORS.text.secondary, marginTop: 8, textAlign: 'center' },
});

export default IncidentsScreen;
