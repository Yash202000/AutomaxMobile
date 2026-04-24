import { getClassificationsTree } from '@/src/api/classifications';
import { getIncidents } from '@/src/api/incidents';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, FlatList, ImageBackground, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const COLORS = {
  primary: '#1A237E',
  accent: '#1D8FA0C2',
  background: '#F5F7FA',
  white: '#FFFFFF',
  secondary: '#EDF1FF',
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

const severityConfig: Record<number, { key: string; color: string }> = {
  1: { key: 'critical', color: '#E74C3C' },
  2: { key: 'major', color: '#E67E22' },
  3: { key: 'moderate', color: '#F1C40F' },
  4: { key: 'minor', color: '#3498DB' },
  5: { key: 'cosmetic', color: '#2ECC71' },
};

const sources = [
  { value: 'web', label: 'Web Portal' },
  { value: 'mobile', label: 'Mobile App' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'api', label: 'API Integration' },
  { value: 'social_media', label: 'Social Media' },
  { value: '940_system', label: '940 System' },
  { value: '940_manual', label: '940 Manual' },
  { value: 'field', label: 'Field' },
  { value: 'manual', label: 'Manual Entry' },
  { value: 'viusional', label: 'Viusional' },
  { value: 'other', label: 'Other' },
];

interface Incident {
  id: string;
  incident_number: string;
  title: string;
  priority: number;
  created_at: string;
  current_state?: { name: string };
  location?: { name: string };
  lookup_values?: Array<{
    category: { code: string; name: string };
    code: string;
    name: string;
    color: string;
  }>;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total_items: number;
  total_pages: number;
}

const IncidentCard = ({ incident, t }: { incident: Incident; t: any }) => {
  const router = useRouter();

  // Extract priority from lookup_values if available
  const priorityLookup = incident.lookup_values?.find(
    lv => lv.category.code === 'PRIORITY'
  );

  // Use lookup value color and name if available, otherwise fallback to old config
  let config = priorityConfig[incident.priority] || { key: 'unknown', color: '#94A3B8' };
  let priorityText = t(`priorities.${config.key}`, config.key);

  if (priorityLookup) {
    config = { key: priorityLookup.code.toLowerCase(), color: priorityLookup.color };
    priorityText = priorityLookup.name;
  }

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
  // const {
  //   state_id, state_name, priority, severity, assignee_id, assignee_name,
  //   department_id, department_name, classification_ids, classification_names,
  //   location_ids, location_names, source, start_date, end_date
  // } = useLocalSearchParams<{
  //   state_id?: string; state_name?: string; priority?: string; severity?: string;
  //   assignee_id?: string; assignee_name?: string; department_id?: string;
  //   department_name?: string; classification_ids?: string; classification_names?: string;
  //   location_ids?: string; location_names?: string; source?: string;
  //   start_date?: string; end_date?: string;
  // }>();
  let classification_ids: string = ""

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1, limit: 20, total_items: 0, total_pages: 0,
  });
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<TextInput>(null);
  const isLoadingMore = useRef(false);
  const [selectedClassification, setSelectedClassification] = useState<string[]>([]);
  const [shadowClassification, setShadowClassification] = useState<any[]>([]);
  const [showIncidents, setShowIncidents] = useState(false);
  const [classifications, setClassifications] = useState<any[]>([]);

  const buildParams = (page: number) => {
    const params: Record<string, any> = { page, limit: 20 };
    if (classification_ids) params.classification_id = classification_ids.split(',');
    if (searchQuery.trim().length >= 3) params.search = searchQuery.trim();
    return params;
  };

  const fetchIncidents = async (page = 1, append = false) => {
    // If search has 1-2 chars, show empty state immediately — don't fetch
    const trimmedSearch = searchQuery.trim();
    if (trimmedSearch.length > 0 && trimmedSearch.length < 3) {
      setIncidents([]);
      setPagination({ page: 1, limit: 20, total_items: 0, total_pages: 0 });
      setLoading(false);
      setRefreshing(false);
      isLoadingMore.current = false;
      return;
    }

    if (page === 1) setLoading(true);
    setError('');

    let params = buildParams(page);
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

  const handleSearchToggle = () => {
    setShowSearch(!showSearch);
    if (!showSearch) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    } else {
      setSearchQuery('');
    }
  };

  const handleSearchSubmit = () => {
    fetchIncidents(1, false);
  };

  const clearFilter = () => router.replace('/(tabs)/incident');

  const hasManualFilters = classification_ids;
  const headerTitle = t('incidents.title');
  const activeFilterCount = [classification_ids].filter(Boolean).length;

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
    const trimmedSearch = searchQuery.trim();
    const isShortSearch = trimmedSearch.length > 0 && trimmedSearch.length < 3;
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name={isShortSearch ? 'search-outline' : 'document-text-outline'} size={64} color={COLORS.text.muted} />
        <Text style={styles.emptyTitle}>
          {isShortSearch ? t('search.minCharsTitle', 'Keep Typing...') : t('incidents.noIncidents')}
        </Text>
        <Text style={styles.emptySubtitle}>
          {isShortSearch
            ? t('search.minCharsDesc', 'Enter at least 3 characters to search')
            : hasManualFilters ? t('incidents.adjustFilters') : t('incidents.noIncidentsDesc')}
        </Text>
      </View>
    );
  };

  const renderHeader = () => (
    <View style={styles.listHeader}>
      <Text style={styles.foundText}>
        {hasManualFilters
          ? t('incidents.incidentsFound', { count: pagination.total_items }) + ` (${activeFilterCount} ${t('filter.title').toLowerCase()})`
          : `${pagination.total_items} ${pagination.total_items !== 1 ? t('tabs.incident').toLowerCase() : t('tabs.incident').toLowerCase().slice(0, -1)}`
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
      classification_ids && { key: 'class', label: t('filter.classification'), value: classification_ids.split(',').length > 1 ? `${classification_ids.split(',').length} selected` : classification_ids },
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


  const viewIncidentClicked = () => {
    if (!selectedClassification.length) {
      Alert.alert(t('common.error'), t('incidents.selectClassification'))
      return
    }
    setShowIncidents(true);
    classification_ids = selectedClassification.join(',')
    fetchIncidents(1, false);
  }

  const fetchClassifications = () => {
    getClassificationsTree("all").then(x => {
      setClassifications(x.data)
    })
  }

  const goBack = () => {
    setShowIncidents(false)
    setSelectedClassification([])
  }

  const classificationClicked = (classification: any) => {
    if (selectedClassification.includes(classification.id)) {
      setSelectedClassification(selectedClassification.filter((id) => id !== classification.id))
    } else {
      setSelectedClassification([...selectedClassification, classification.id])
    }
  }

  useEffect(() => {
    fetchClassifications()
  }, [])

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={{ flex: 1, backgroundColor: COLORS.white }}>

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
                <TouchableOpacity onPress={() => { goBack() }}>
                  <Ionicons name="arrow-back" size={22} color="white" />
                </TouchableOpacity>
                <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">{headerTitle}</Text>
              </View>
              <View style={styles.headerIcons}>
                <TouchableOpacity style={styles.headerIcon} onPress={() => router.push({
                  pathname: '/map-view',
                  params: { type: 'incident', classification_ids }
                })}>
                  <Ionicons name="map-outline" size={22} color="white" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.headerIcon} onPress={handleSearchToggle}>
                  <Ionicons name="search-outline" size={24} color="white" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.headerIcon, hasManualFilters && styles.filterIconActive]}
                  onPress={() => router.push({
                    pathname: '/filter',
                    params: { classification_ids }
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
        {
          showIncidents &&
          <View style={{ flex: 1 }}>
            {loading ? (
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
          </View>
        }
        {
          !showIncidents &&
          (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              {/*create tree structure of classification*/}
              <View style={{ marginVertical: 10, width: '100%', paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: COLORS.primary, textAlign: 'center', fontWeight: 'bold' }}>{t('incidents.selectClassification')}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ color: COLORS.primary, textAlign: 'center', fontWeight: 'bold' }}>{t('incidents.selectAll')}</Text>
                  {/* <TouchableOpacity onPress={() => {
                    if (selectedClassification.length === classifications.length) {
                      setSelectedClassification([])
                    } else {
                      setSelectedClassification(classifications.map((classification) => classification.id))
                    }
                  }}>
                    <Ionicons name="checkmark" size={20} color={selectedClassification.length === classifications.length ? COLORS.white : COLORS.primary} />
                  </TouchableOpacity> */}
                </View>
              </View>
              <ScrollView style={{ flex: 1, width: '100%', paddingHorizontal: 16 }}>
                <View style={{ gap: 16, paddingVertical: 16, paddingBottom: 120 }}>
                  {
                    classifications.map((classification) => (
                      <View key={classification.id}>
                        <View key={classification.id}>
                          <Text>{classification.name}</Text>
                        </View>
                        {classification?.children?.map((child: any) => (
                          <TouchableOpacity onPress={() => { classificationClicked(child) }} key={child.id} style={{ marginLeft: 16, marginVertical: 6, backgroundColor: selectedClassification.includes(child.id) ? COLORS.accent : COLORS.secondary, padding: 8, paddingVertical: 12, borderRadius: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={{ color: selectedClassification.includes(child.id) ? COLORS.white : COLORS.primary }}>{child.name}</Text>
                            <Ionicons name="checkmark" size={20} color={selectedClassification.includes(child.id) ? COLORS.white : COLORS.primary} />
                          </TouchableOpacity>
                        ))}
                        {
                          (!classification?.children?.length || !classification?.children) && (
                            <Text style={{ color: COLORS.primary, marginLeft: 18, marginTop: 5 }}>No children classification found</Text>
                          )
                        }
                      </View>
                    ))
                  }
                </View>
              </ScrollView>
              <View style={styles.btnContainer}>
                <TouchableOpacity style={styles.clearBtn} onPress={() => setSelectedClassification([])}>
                  <Text style={{ color: COLORS.primary, textAlign: 'center', fontWeight: 'bold' }}>Clear</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.viewIncidentButton} onPress={() => viewIncidentClicked()}>
                  <Text style={{ color: COLORS.white, textAlign: 'center', fontWeight: 'bold' }}>View Incident</Text>
                </TouchableOpacity>
              </View>
            </View>
          )
        }
      </View>

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
  headerTitle: { color: 'white', fontSize: 22, fontWeight: 'bold', maxWidth: 200 },
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
    justifyContent: 'center', alignItems: 'center', bottom: 120, right: 20,
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
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  searchCancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  searchCancelText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  clearBtn: {
    borderWidth: 2,
    borderColor: COLORS.primary,
    padding: 16,
    borderRadius: 8,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  viewIncidentButton: {
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 8,
    color: COLORS.white,
    textAlign: 'center',
    fontWeight: 'bold',
    flex: 1
  },
  btnContainer: {
    flexDirection: 'row',
    gap: 5,
    // marginHorizontal: 16,
    position: "absolute",
    bottom: 70,
    right: 16,
    left: 16,
  }
});

export default IncidentsScreen;
