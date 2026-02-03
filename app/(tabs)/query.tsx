import { getQueries, getQueryStats } from '@/src/api/incidents';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ImageBackground, FlatList, Platform, StyleSheet, Text, TouchableOpacity, View, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePermissions } from '@/src/hooks/usePermissions';

const COLORS = {
  primary: '#1A237E',
  accent: '#2563EB',
  background: '#F5F7FA',
  white: '#FFFFFF',
  text: { primary: '#1A1A2E', secondary: '#64748B', muted: '#94A3B8' },
  query: '#2563EB',
  priority: { critical: '#DC2626', high: '#EA580C', medium: '#F59E0B', low: '#3B82F6', veryLow: '#22C55E' },
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

interface Query {
  id: string;
  incident_number: string;
  title: string;
  priority: number;
  created_at: string;
  current_state?: { name: string };
  location?: { name: string };
  channel?: string;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total_items: number;
  total_pages: number;
}

const QueryCard = ({ query, t }: { query: Query; t: any }) => {
  const router = useRouter();
  const config = priorityConfig[query.priority] || { key: 'unknown', color: '#94A3B8' };
  const priorityText = t(`priorities.${config.key}`, config.key);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/query-details?id=${query.id}`)}
      activeOpacity={0.7}
    >
      <View style={[styles.cardBar, { backgroundColor: config.color }]} />
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <View style={styles.idContainer}>
            <View style={[styles.dot, { backgroundColor: config.color }]} />
            <Text style={styles.idText}>{query.incident_number}</Text>
          </View>
          <View style={[styles.priorityBadge, { backgroundColor: config.color }]}>
            <Text style={styles.priorityText}>{priorityText}</Text>
          </View>
        </View>
        <Text style={styles.dateTime}>{new Date(query.created_at).toLocaleString()}</Text>
        <Text style={styles.statusText}>{t('incidents.status')}: {query.current_state?.name || 'N/A'}</Text>
        <View style={styles.detailRow}>
          <Ionicons name="help-circle" size={16} color={COLORS.query} style={styles.detailIcon} />
          <Text style={styles.detailText} numberOfLines={1}>{query.title}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="location" size={16} color={COLORS.priority.low} style={styles.detailIcon} />
          <Text style={styles.detailText}>{query.location?.name || t('common.noData')}</Text>
        </View>
        {query.channel && (
          <View style={styles.detailRow}>
            <Ionicons name="megaphone" size={16} color="#F59E0B" style={styles.detailIcon} />
            <Text style={styles.detailText}>{t('queries.channel')}: {query.channel}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const QueriesScreen = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const { canCreateQueries } = usePermissions();
  const {
    state_id, state_name, priority, severity, assignee_id, assignee_name,
    department_id, department_name, classification_id, classification_name,
    location_id, location_name, sla_status, channel
  } = useLocalSearchParams<{
    state_id?: string; state_name?: string; priority?: string; severity?: string;
    assignee_id?: string; assignee_name?: string; department_id?: string;
    department_name?: string; classification_id?: string; classification_name?: string;
    location_id?: string; location_name?: string; sla_status?: string; channel?: string;
  }>();

  const [queries, setQueries] = useState<Query[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState<PaginationInfo>({ page: 1, limit: 20, total_items: 0, total_pages: 0 });
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<TextInput>(null);
  const isLoadingMore = useRef(false);

  // Don't apply default status filter - show ALL queries unless explicitly filtered
  const activeStateId = state_id;
  const activeStateName = state_name;

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
    if (channel) params.channel = channel;
    if (searchQuery.trim()) params.search = searchQuery.trim();
    return params;
  };

  const fetchQueries = async (page = 1, append = false) => {
    if (page === 1) setLoading(true);
    setError('');

    const params = buildParams(page);
    const response = await getQueries(params);

    if (response.success) {
      setQueries(append ? prev => [...prev, ...response.data] : response.data);
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
    fetchQueries(pagination.page + 1, true);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchQueries(1, false);
  };

  useFocusEffect(
    useCallback(() => {
      fetchQueries(1, false);
    }, [activeStateId, priority, severity, assignee_id, department_id, classification_id, location_id, sla_status, channel, searchQuery])
  );

  const handleSearchToggle = () => {
    setShowSearch(!showSearch);
    if (!showSearch) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    } else {
      setSearchQuery('');
    }
  };

  const handleSearchSubmit = () => {
    fetchQueries(1, false);
  };

  const clearFilter = () => router.replace('/(tabs)/query');

  const hasManualFilters = state_id || priority || severity || assignee_id || department_id || classification_id || location_id || sla_status || channel;
  const headerTitle = activeStateName || t('queries.title');
  const activeFilterCount = [state_id, priority, severity, assignee_id, department_id, classification_id, location_id, sla_status, channel].filter(Boolean).length;

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={COLORS.primary} />
        <Text style={styles.footerLoaderText}>{t('common.loading')}</Text>
      </View>
    );
  };

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="help-circle-outline" size={64} color={COLORS.text.muted} />
        <Text style={styles.emptyTitle}>{t('queries.noQueries')}</Text>
        <Text style={styles.emptySubtitle}>
          {hasManualFilters ? t('incidents.adjustFilters') : t('queries.noQueriesDesc')}
        </Text>
      </View>
    );
  };

  const renderHeader = () => (
    <View style={styles.listHeader}>
      <Text style={styles.foundText}>
        {`${pagination.total_items} ${activeStateName || ''} ${t('tabs.query').toLowerCase()}`}
        {hasManualFilters && ` (${activeFilterCount} ${t('filter.title').toLowerCase()})`}
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
      channel && { key: 'channel', label: t('queries.channel'), value: channel },
    ].filter(Boolean) as { key: string; label: string; value: string }[];

    return (
      <View style={styles.filterBadgeContainer}>
        <FlatList
          horizontal showsHorizontalScrollIndicator={false} style={styles.filterBadgeScroll}
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
        {showSearch ? (
          <View style={styles.searchContainer}>
            <View style={styles.searchInputContainer}>
              <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
              <TextInput
                ref={searchInputRef}
                style={styles.searchInput}
                placeholder={t('common.search', 'Search...')}
                placeholderTextColor="#999"
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={handleSearchSubmit}
                returnKeyType="search"
                autoCapitalize="none"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={20} color="#999" />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity style={styles.searchCancelButton} onPress={handleSearchToggle}>
              <Text style={styles.searchCancelText}>{t('common.cancel', 'Cancel')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle}>{headerTitle}</Text>
            </View>
            <View style={styles.headerIcons}>
              <TouchableOpacity style={styles.headerIcon} onPress={handleSearchToggle}>
                <Ionicons name="search-outline" size={24} color="white" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.headerIcon, hasManualFilters && styles.filterIconActive]}
                onPress={() => router.push({
                  pathname: '/query-filter',
                  params: { state_id, state_name, priority, severity, assignee_id, assignee_name, department_id, department_name, classification_id, classification_name, location_id, location_name, sla_status, channel }
                })}
              >
                <Ionicons name="filter" size={22} color="white" />
                {hasManualFilters && <View style={styles.filterDot} />}
              </TouchableOpacity>
            </View>
          </>
        )}
      </ImageBackground>

      <FilterBadges />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={64} color={COLORS.text.muted} />
          <Text style={styles.errorTitle}>{t('errors.oops')}</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchQueries(1, false)}>
            <Ionicons name="refresh" size={20} color={COLORS.white} />
            <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={queries}
          renderItem={({ item }) => <QueryCard query={item} t={t} />}
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

      {canCreateQueries() && (
        <TouchableOpacity style={styles.fab} onPress={() => router.push('/add-query')} activeOpacity={0.8}>
          <Ionicons name="add" size={28} color="white" />
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.primary },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background, paddingHorizontal: 40 },
  loadingText: { marginTop: 12, color: COLORS.text.secondary, fontSize: 14 },
  errorTitle: { fontSize: 20, fontWeight: '600', color: COLORS.text.primary, marginTop: 16 },
  errorText: { fontSize: 14, color: COLORS.text.secondary, textAlign: 'center', marginTop: 8 },
  retryButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginTop: 24, gap: 8 },
  retryButtonText: { color: COLORS.white, fontSize: 16, fontWeight: '600' },
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitleContainer: { flex: 1 },
  headerTitle: { color: 'white', fontSize: 22, fontWeight: 'bold' },
  headerIcons: { flexDirection: 'row', gap: 12 },
  headerIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  filterBadgeContainer: { backgroundColor: COLORS.background, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center' },
  filterBadgeScroll: { flex: 1 },
  filterBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#DBEAFE', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, marginRight: 8 },
  filterBadgeLabel: { fontSize: 12, color: COLORS.text.secondary, marginRight: 4 },
  filterBadgeValue: { fontSize: 12, fontWeight: 'bold', color: COLORS.accent },
  clearAllButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, gap: 4 },
  clearAllText: { fontSize: 12, color: COLORS.priority.critical, fontWeight: '600' },
  filterIconActive: { position: 'relative' },
  filterDot: { position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.accent },
  listContent: { padding: 16, paddingBottom: 100, backgroundColor: COLORS.background, flexGrow: 1 },
  listHeader: { marginBottom: 16 },
  foundText: { fontSize: 15, color: COLORS.text.secondary, fontWeight: '500' },
  paginationText: { fontSize: 12, color: COLORS.text.muted, marginTop: 4 },
  card: { backgroundColor: COLORS.white, borderRadius: 14, marginBottom: 12, flexDirection: 'row', ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 }, android: { elevation: 2 } }) },
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
  fab: { position: 'absolute', width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.accent, justifyContent: 'center', alignItems: 'center', bottom: 90, right: 20, ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }, android: { elevation: 8 } }) },
  footerLoader: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 20 },
  footerLoaderText: { marginLeft: 10, color: COLORS.text.secondary, fontSize: 14 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text.primary, marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: COLORS.text.secondary, marginTop: 8, textAlign: 'center' },
  searchContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  searchInputContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderRadius: 10, paddingHorizontal: 12, height: 44 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 16, color: '#333' },
  searchCancelButton: { paddingVertical: 8, paddingHorizontal: 4 },
  searchCancelText: { color: 'white', fontSize: 16, fontWeight: '500' },
});

export default QueriesScreen;
