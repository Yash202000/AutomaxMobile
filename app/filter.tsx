import { getClassificationsTree } from '@/src/api/classifications';
import { getDepartments } from '@/src/api/departments';
import { getIncidentStats } from '@/src/api/incidents';
import { getLocationsTree } from '@/src/api/locations';
import { getUsers } from '@/src/api/users';
import { CustomAlert } from '@/src/components/CustomAlert';
import TreeSelect, { TreeNode } from '@/src/components/TreeSelect';
import usePermissions from '@/src/hooks/usePermissions';
import i18n from '@/src/i18n';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Dimensions, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';


interface FilterState {
  state_ids: string[];
  state_names: string[];
  priorities: number[];
  severities: number[];
  assignee_ids: string[];
  assignee_names: string[];
  department_ids: string[];
  department_names: string[];
  classification_ids: string[];
  classification_names: string[];
  location_ids: string[];
  location_names: string[];
  sources: string[];
  start_date: string | null;
  end_date: string | null;
}

const sources = [
  { value: 'web' },
  { value: 'mobile' },
  { value: 'email' },
  { value: 'phone' },
  { value: 'walk_in' },
  { value: 'api' },
  { value: 'social_media' },
  { value: '940_system' },
  { value: '940_manual' },
  { value: 'field' },
  { value: 'manual' },
  { value: 'viusional' },
  { value: 'other' },
];

const priorities = [
  { value: 1, key: 'critical', color: '#E74C3C' },
  { value: 2, key: 'high', color: '#E67E22' },
  { value: 3, key: 'medium', color: '#F1C40F' },
  { value: 4, key: 'low', color: '#3498DB' },
  { value: 5, key: 'veryLow', color: '#2ECC71' },
];

const severities = [
  { value: 1, key: 'critical', color: '#E74C3C' },
  { value: 2, key: 'major', color: '#E67E22' },
  { value: 3, key: 'moderate', color: '#F1C40F' },
  { value: 4, key: 'minor', color: '#3498DB' },
  { value: 5, key: 'cosmetic', color: '#2ECC71' },
];



const { height: screenHeight } = Dimensions.get('window');
const isSmallScreen = screenHeight < 700;

const FilterScreen = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    state_id?: string;
    state_name?: string;
    state_name_ar?: string;
    priority?: string;
    severity?: string;
    assignee_id?: string;
    assignee_name?: string;
    department_id?: string;
    department_name?: string;
    classification_ids?: string;
    classification_names?: string;
    location_ids?: string;
    location_names?: string;
    source?: string;
    start_date?: string;
    end_date?: string;
  }>();

  const [states, setStates] = useState<any[]>([]);
  const { canViewAllIncidents } = usePermissions()
  const [departments, setDepartments] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [classifications, setClassifications] = useState<TreeNode[]>([]);
  const [locations, setLocations] = useState<TreeNode[]>([]);
  const [loadingStates, setLoadingStates] = useState(true);
  const [loadingDepartments, setLoadingDepartments] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingClassifications, setLoadingClassifications] = useState(true);
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [filters, setFilters] = useState<FilterState>({
    state_ids: params.state_id ? params.state_id.split(',') : states.map(s => s.id),
    state_names: params.state_name ? params.state_name.split(',') : [],
    priorities: params.priority ? params.priority.split(',').map(p => parseInt(p)) : [],
    severities: params.severity ? params.severity.split(',').map(s => parseInt(s)) : [],
    assignee_ids: params.assignee_id ? params.assignee_id.split(',') : [],
    assignee_names: params.assignee_name ? params.assignee_name.split(',') : [],
    department_ids: params.department_id ? params.department_id.split(',') : [],
    department_names: params.department_name ? params.department_name.split(',') : [],
    classification_ids: params.classification_ids ? params.classification_ids.split(',') : [],
    classification_names: params.classification_names ? params.classification_names.split(',') : [],
    location_ids: params.location_ids ? params.location_ids.split(',') : [],
    location_names: params.location_names ? params.location_names.split(',') : [],
    sources: params.source ? params.source.split(',') : [],
    start_date: params.start_date || null,
    end_date: params.end_date || null,
  });

  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState<'from' | 'to' | null>(null);

  useEffect(() => {
    fetchStates();
    fetchDepartments();
    fetchUsers();
    fetchClassifications();
    fetchLocations();
  }, []);

  const fetchStates = async () => {
    setLoadingStates(true);
    const response = await getIncidentStats();
    if (response.success) {
      setStates(response?.data?.workflow_stats?.[0]?.by_state_details || []);
    }
    setLoadingStates(false);
  };

  const fetchDepartments = async () => {
    setLoadingDepartments(true);
    const response = await getDepartments();
    if (response.success) {
      setDepartments(response.data || []);
    }
    setLoadingDepartments(false);
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    const response = await getUsers();
    if (response.success) {
      setUsers(response.data || []);
    }
    setLoadingUsers(false);
  };

  const fetchClassifications = async () => {
    setLoadingClassifications(true);
    const response = await getClassificationsTree();
    if (response.success) {
      setClassifications(response.data || []);
    }
    setLoadingClassifications(false);
  };

  const fetchLocations = async () => {
    setLoadingLocations(true);
    const response = await getLocationsTree();
    if (response.success) {
      setLocations(response.data || []);
    }
    setLoadingLocations(false);
  };

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const selectState = (state: any) => {
    const isSelected = filters.state_ids.includes(state.id);
    if (isSelected) {
      setFilters({
        ...filters,
        state_ids: filters.state_ids.filter(id => id !== state.id),
        state_names: filters.state_names.filter(name => name !== state.name),
      });
    } else {
      setFilters({
        ...filters,
        state_ids: [...filters.state_ids, state.id],
        state_names: [...filters.state_names, state.name],
      });
    }
  };

  const selectPriority = (priority: number) => {
    const isSelected = filters.priorities.includes(priority);
    setFilters({
      ...filters,
      priorities: isSelected
        ? filters.priorities.filter(p => p !== priority)
        : [...filters.priorities, priority],
    });
  };

  const selectSeverity = (severity: number) => {
    const isSelected = filters.severities.includes(severity);
    setFilters({
      ...filters,
      severities: isSelected
        ? filters.severities.filter(s => s !== severity)
        : [...filters.severities, severity],
    });
  };

  const selectAssignee = (user: any) => {
    const userName = `${user.first_name} ${user.last_name}`;
    const isSelected = filters.assignee_ids.includes(user.id);
    if (isSelected) {
      setFilters({
        ...filters,
        assignee_ids: filters.assignee_ids.filter(id => id !== user.id),
        assignee_names: filters.assignee_names.filter(name => name !== userName),
      });
    } else {
      setFilters({
        ...filters,
        assignee_ids: [...filters.assignee_ids, user.id],
        assignee_names: [...filters.assignee_names, userName],
      });
    }
  };

  const selectDepartment = (department: any) => {
    const isSelected = filters.department_ids.includes(department.id);
    if (isSelected) {
      setFilters({
        ...filters,
        department_ids: filters.department_ids.filter(id => id !== department.id),
        department_names: filters.department_names.filter(name => name !== department.name),
      });
    } else {
      setFilters({
        ...filters,
        department_ids: [...filters.department_ids, department.id],
        department_names: [...filters.department_names, department.name],
      });
    }
  };

  const handleClassificationMultiSelect = (nodes: any[]) => {
    setFilters({
      ...filters,
      classification_ids: nodes.map(n => n.id),
      classification_names: nodes.map(n => n.name),
    });
  };

  const handleLocationMultiSelect = (nodes: any[]) => {
    setFilters({
      ...filters,
      location_ids: nodes.map(n => n.id),
      location_names: nodes.map(n => n.name),
    });
  };

  const selectSource = (source: string) => {
    const isSelected = filters.sources.includes(source);
    setFilters({
      ...filters,
      sources: isSelected
        ? filters.sources.filter(s => s !== source)
        : [...filters.sources, source],
    });
  };

  const applyFilters = () => {
    if (filters.start_date && filters.end_date) {
      if (new Date(filters.start_date) > new Date(filters.end_date)) {
        CustomAlert.alert(
          t('filter.invalidDateRangeTitle', 'Invalid Date Range'),
          t('filter.invalidDateRange', 'Start date cannot be after end date')
        );
        return;
      }
    }

    const queryParams: any = {};
    if (filters.state_ids.length > 0) {
      queryParams.state_id = filters.state_ids.join(',');
      queryParams.state_name = filters.state_names.join(',');
      // Carry the Arabic name alongside so the destination screen's filter
      // badge can localize it instead of always showing the English name.
      queryParams.state_name_ar = filters.state_ids
        .map(id => states.find(s => s.id === id)?.name_ar || '')
        .join(',');
    }
    if (filters.priorities.length > 0) {
      queryParams.priority = filters.priorities.join(',');
    }
    if (filters.severities.length > 0) {
      queryParams.severity = filters.severities.join(',');
    }
    if (filters.assignee_ids.length > 0) {
      queryParams.assignee_id = filters.assignee_ids.join(',');
      queryParams.assignee_name = filters.assignee_names.join(',');
    }
    if (filters.department_ids.length > 0) {
      queryParams.department_id = filters.department_ids.join(',');
      queryParams.department_name = filters.department_names.join(',');
    }
    if (filters.classification_ids.length > 0) {
      queryParams.classification_ids = filters.classification_ids.join(',');
      queryParams.classification_names = filters.classification_names.join(',');
    }
    if (filters.location_ids.length > 0) {
      queryParams.location_ids = filters.location_ids.join(',');
      queryParams.location_names = filters.location_names.join(',');
    }
    if (filters.sources.length > 0) queryParams.source = filters.sources.join(',');
    if (filters.start_date) queryParams.start_date = filters.start_date;
    if (filters.end_date) queryParams.end_date = filters.end_date;

    router.replace({
      pathname: '/(tabs)/incident',
      params: queryParams,
    });
  };

  const resetFilters = () => {
    router.replace({ pathname: '/(tabs)/incident' });
  };

  const hasActiveFilters = filters.state_ids.length > 0 || filters.priorities.length > 0 || filters.severities.length > 0 ||
    filters.assignee_ids.length > 0 || filters.department_ids.length > 0 || filters.classification_ids.length > 0 ||
    filters.location_ids.length > 0 || filters.sources.length > 0 || filters.start_date || filters.end_date;

  const formatDisplayDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getSelectedStateName = () => {
    if (filters.state_ids.length === 0) return t('filter.all');
    if (filters.state_ids.length === 1) {
      const match = states.find(s => s.id === filters.state_ids[0]);
      if (match) {
        return (i18n.language === 'en' || !match.name_ar) ? match.name : match.name_ar;
      }
      // states hasn't loaded yet — use the Arabic name carried over via
      // params instead of always falling back to English, so there's no
      // flash of English text while the list is still fetching.
      return (i18n.language !== 'en' && params.state_name_ar) || filters.state_names[0] || t('filter.selected');
    }
    return `${filters.state_ids.length} ${t('filter.selected')}`;
  };

  const getSelectedPriorityLabel = () => {
    if (filters.priorities.length === 0) return t('filter.all');
    if (filters.priorities.length === 1) {
      const priority = priorities.find(p => p.value === filters.priorities[0]);
      return priority ? t(`priorities.${priority.key}`) : t('filter.selected');
    }
    return `${filters.priorities.length} ${t('filter.selected')}`;
  };

  const getSelectedSeverityLabel = () => {
    if (filters.severities.length === 0) return t('filter.all');
    if (filters.severities.length === 1) {
      const severity = severities.find(s => s.value === filters.severities[0]);
      return severity ? t(`severities.${severity.key}`) : t('filter.selected');
    }
    return `${filters.severities.length} ${t('filter.selected')}`;
  };

  const getSelectedAssigneeName = () => {
    if (filters.assignee_ids.length === 0) return t('filter.all');
    if (filters.assignee_ids.length === 1) return filters.assignee_names[0] || t('filter.selected');
    return `${filters.assignee_ids.length} ${t('filter.selected')}`;
  };

  const getSelectedDepartmentName = () => {
    if (filters.department_ids.length === 0) return t('filter.all');
    if (filters.department_ids.length === 1) return filters.department_names[0] || t('filter.selected');
    return `${filters.department_ids.length} ${t('filter.selected')}`;
  };

  const getSelectedClassificationName = () => {
    if (filters.classification_ids.length === 0) return t('filter.all');
    return `${filters.classification_ids.length} ${t('filter.selected')}`;
  };

  const getSelectedLocationName = () => {
    if (filters.location_ids.length === 0) return t('filter.all');
    return `${filters.location_ids.length} ${t('filter.selected')}`;
  };

  return (
    <View style={[styles.container, { marginTop: isSmallScreen ? 60 : 100 }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('filter.title')}</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close-circle" size={28} color="#E74C3C" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.optionsContainer}>
        <View style={{ padding: 20 }}>
          {/* Status Filter */}
          <View style={styles.filterSection}>
            <TouchableOpacity
              style={styles.filterHeader}
              onPress={() => toggleSection('status')}
            >
              <View style={styles.filterHeaderLeft}>
                <Ionicons name="flag-outline" size={20} color="#1A237E" />
                <Text style={styles.filterLabel}>{t('filter.status')}</Text>
              </View>
              <View style={styles.filterHeaderRight}>
                <Text style={[styles.filterValue, filters.state_ids.length > 0 && styles.filterValueActive]}>
                  {getSelectedStateName()}
                </Text>
                <Ionicons
                  name={expandedSection === 'status' ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color="#666"
                />
              </View>
            </TouchableOpacity>

            {expandedSection === 'status' && (
              <View style={styles.filterOptions}>
                {loadingStates ? (
                  <ActivityIndicator size="small" color="#1A237E" />
                ) : (
                  <>
                    <TouchableOpacity
                      style={[styles.filterOption, filters.state_ids.length === 0 && styles.filterOptionSelected]}
                      onPress={() => setFilters({ ...filters, state_ids: [], state_names: [] })}
                    >
                      <Text style={[styles.filterOptionText, filters.state_ids.length === 0 && styles.filterOptionTextSelected]}>
                        {t('filter.allStatuses')}
                      </Text>
                      {filters.state_ids.length === 0 && <Ionicons name="checkmark" size={20} color="#1A237E" />}
                    </TouchableOpacity>
                    {states.map((state) => (
                      <TouchableOpacity
                        key={state.id}
                        style={[styles.filterOption, filters.state_ids.includes(state.id) && styles.filterOptionSelected]}
                        onPress={() => selectState(state)}
                      >
                        <View style={styles.stateOption}>
                          <View style={[styles.stateColor, { backgroundColor: state.color || '#6366f1' }]} />
                          <Text style={[styles.filterOptionText, filters.state_ids.includes(state.id) && styles.filterOptionTextSelected]}>
                            {(i18n.language === 'en' || !state?.name_ar) ? state.name : state?.name_ar}
                          </Text>
                        </View>
                        {filters.state_ids.includes(state.id) && <Ionicons name="checkmark" size={20} color="#1A237E" />}
                      </TouchableOpacity>
                    ))}
                  </>
                )}
              </View>
            )}
          </View>

          {/* Priority Filter */}
          <View style={styles.filterSection}>
            <TouchableOpacity
              style={styles.filterHeader}
              onPress={() => toggleSection('priority')}
            >
              <View style={styles.filterHeaderLeft}>
                <Ionicons name="alert-circle-outline" size={20} color="#1A237E" />
                <Text style={styles.filterLabel}>{t('filter.priority')}</Text>
              </View>
              <View style={styles.filterHeaderRight}>
                <Text style={[styles.filterValue, filters.priorities.length > 0 && styles.filterValueActive]}>
                  {getSelectedPriorityLabel()}
                </Text>
                <Ionicons
                  name={expandedSection === 'priority' ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color="#666"
                />
              </View>
            </TouchableOpacity>

            {expandedSection === 'priority' && (
              <View style={styles.filterOptions}>
                <TouchableOpacity
                  style={[styles.filterOption, filters.priorities.length === 0 && styles.filterOptionSelected]}
                  onPress={() => setFilters({ ...filters, priorities: [] })}
                >
                  <Text style={[styles.filterOptionText, filters.priorities.length === 0 && styles.filterOptionTextSelected]}>
                    {t('filter.allPriorities')}
                  </Text>
                  {filters.priorities.length === 0 && <Ionicons name="checkmark" size={20} color="#1A237E" />}
                </TouchableOpacity>
                {priorities.map((priority) => (
                  <TouchableOpacity
                    key={priority.value}
                    style={[styles.filterOption, filters.priorities.includes(priority.value) && styles.filterOptionSelected]}
                    onPress={() => selectPriority(priority.value)}
                  >
                    <View style={styles.priorityOption}>
                      <View style={[styles.priorityDot, { backgroundColor: priority.color }]} />
                      <Text style={[styles.filterOptionText, filters.priorities.includes(priority.value) && styles.filterOptionTextSelected]}>
                        {t(`priorities.${priority.key}`)}
                      </Text>
                    </View>
                    {filters.priorities.includes(priority.value) && <Ionicons name="checkmark" size={20} color="#1A237E" />}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Classification Filter */}
          <View style={styles.filterSection}>
            <View style={styles.filterHeader}>
              <View style={styles.filterHeaderLeft}>
                <Ionicons name="layers-outline" size={20} color="#1A237E" />
                <Text style={styles.filterLabel}>{t('filter.classification')}</Text>
              </View>
            </View>
            <View style={styles.treeSelectWrapper}>
              <TreeSelect
                label={t('filter.classification')}
                value=""
                data={classifications}
                loading={loadingClassifications}
                onSelect={() => { }}
                leafOnly={true}
                placeholder={filters.classification_ids.length > 0 ? `${filters.classification_ids.length} selected` : t('filter.allClassifications')}
                iconType="classification"
                multiSelect={true}
                selectedIds={filters.classification_ids}
                onMultiSelect={handleClassificationMultiSelect}
              />
            </View>
          </View>

          {/* Location Filter */}
          <View style={styles.filterSection}>
            <View style={styles.filterHeader}>
              <View style={styles.filterHeaderLeft}>
                <Ionicons name="location-outline" size={20} color="#1A237E" />
                <Text style={styles.filterLabel}>{t('filter.location')}</Text>
              </View>
            </View>
            <View style={styles.treeSelectWrapper}>
              <TreeSelect
                label={t('filter.location')}
                value=""
                data={locations}
                loading={loadingLocations}
                onSelect={() => { }}
                leafOnly={true}
                placeholder={filters.location_ids.length > 0 ? `${filters.location_ids.length} selected` : t('filter.allLocations')}
                iconType="location"
                multiSelect={true}
                selectedIds={filters.location_ids}
                onMultiSelect={handleLocationMultiSelect}
              />
            </View>
          </View>

          {/* Assignee Filter */}
          {canViewAllIncidents() && <View style={styles.filterSection}>
            <TouchableOpacity
              style={styles.filterHeader}
              onPress={() => toggleSection('assignee')}
            >
              <View style={styles.filterHeaderLeft}>
                <Ionicons name="person-outline" size={20} color="#1A237E" />
                <Text style={styles.filterLabel}>{t('filter.assignee')}</Text>
              </View>
              <View style={styles.filterHeaderRight}>
                <Text style={[styles.filterValue, filters.assignee_ids.length > 0 && styles.filterValueActive]}>
                  {getSelectedAssigneeName()}
                </Text>
                <Ionicons
                  name={expandedSection === 'assignee' ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color="#666"
                />
              </View>
            </TouchableOpacity>

            {expandedSection === 'assignee' && (
              <View style={styles.filterOptions}>
                {loadingUsers ? (
                  <ActivityIndicator size="small" color="#1A237E" />
                ) : (
                  <>
                    <TouchableOpacity
                      style={[styles.filterOption, filters.assignee_ids.length === 0 && styles.filterOptionSelected]}
                      onPress={() => setFilters({ ...filters, assignee_ids: [], assignee_names: [] })}
                    >
                      <Text style={[styles.filterOptionText, filters.assignee_ids.length === 0 && styles.filterOptionTextSelected]}>
                        {t('filter.allAssignees')}
                      </Text>
                      {filters.assignee_ids.length === 0 && <Ionicons name="checkmark" size={20} color="#1A237E" />}
                    </TouchableOpacity>
                    {users.map((user) => (
                      <TouchableOpacity
                        key={user.id}
                        style={[styles.filterOption, filters.assignee_ids.includes(user.id) && styles.filterOptionSelected]}
                        onPress={() => selectAssignee(user)}
                      >
                        <View style={styles.stateOption}>
                          <View style={styles.userAvatar}>
                            <Text style={styles.userAvatarText}>
                              {user.first_name?.charAt(0)}{user.last_name?.charAt(0)}
                            </Text>
                          </View>
                          <Text style={[styles.filterOptionText, filters.assignee_ids.includes(user.id) && styles.filterOptionTextSelected]}>
                            {user.first_name} {user.last_name}
                          </Text>
                        </View>
                        {filters.assignee_ids.includes(user.id) && <Ionicons name="checkmark" size={20} color="#1A237E" />}
                      </TouchableOpacity>
                    ))}
                  </>
                )}
              </View>
            )}
          </View>}

          {/* Department Filter */}
          <View style={styles.filterSection}>
            <TouchableOpacity
              style={styles.filterHeader}
              onPress={() => toggleSection('department')}
            >
              <View style={styles.filterHeaderLeft}>
                <Ionicons name="business-outline" size={20} color="#1A237E" />
                <Text style={styles.filterLabel}>{t('filter.department')}</Text>
              </View>
              <View style={styles.filterHeaderRight}>
                <Text style={[styles.filterValue, filters.department_ids.length > 0 && styles.filterValueActive]}>
                  {getSelectedDepartmentName()}
                </Text>
                <Ionicons
                  name={expandedSection === 'department' ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color="#666"
                />
              </View>
            </TouchableOpacity>

            {expandedSection === 'department' && (
              <View style={styles.filterOptions}>
                {loadingDepartments ? (
                  <ActivityIndicator size="small" color="#1A237E" />
                ) : (
                  <>
                    <TouchableOpacity
                      style={[styles.filterOption, filters.department_ids.length === 0 && styles.filterOptionSelected]}
                      onPress={() => setFilters({ ...filters, department_ids: [], department_names: [] })}
                    >
                      <Text style={[styles.filterOptionText, filters.department_ids.length === 0 && styles.filterOptionTextSelected]}>
                        {t('filter.allDepartments')}
                      </Text>
                      {filters.department_ids.length === 0 && <Ionicons name="checkmark" size={20} color="#1A237E" />}
                    </TouchableOpacity>
                    {departments.map((department) => (
                      <TouchableOpacity
                        key={department.id}
                        style={[styles.filterOption, filters.department_ids.includes(department.id) && styles.filterOptionSelected]}
                        onPress={() => selectDepartment(department)}
                      >
                        <Text style={[styles.filterOptionText, filters.department_ids.includes(department.id) && styles.filterOptionTextSelected]}>
                          {department.name}
                        </Text>
                        {filters.department_ids.includes(department.id) && <Ionicons name="checkmark" size={20} color="#1A237E" />}
                      </TouchableOpacity>
                    ))}
                  </>
                )}
              </View>
            )}
          </View>

          {/* Source Filter */}
          <View style={styles.filterSection}>
            <TouchableOpacity
              style={styles.filterHeader}
              onPress={() => toggleSection('source')}
            >
              <View style={styles.filterHeaderLeft}>
                <Ionicons name="git-network-outline" size={20} color="#1A237E" />
                <Text style={styles.filterLabel}>{t('filter.source', 'Source')}</Text>
              </View>
              <View style={styles.filterHeaderRight}>
                <Text style={[styles.filterValue, filters.sources.length > 0 && styles.filterValueActive]}>
                  {filters.sources.length === 0 ? t('filter.allLabel') : (filters.sources.length === 1 ? t(`incidents.sources.${filters.sources[0]}`) : t('filter.nSelected', { count: filters.sources.length }))}
                </Text>
                <Ionicons
                  name={expandedSection === 'source' ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color="#666"
                />
              </View>
            </TouchableOpacity>
            {expandedSection === 'source' && (
              <View style={styles.filterOptions}>
                <TouchableOpacity
                  style={[styles.filterOption, filters.sources.length === 0 && styles.filterOptionSelected]}
                  onPress={() => setFilters({ ...filters, sources: [] })}
                >
                  <Text style={[styles.filterOptionText, filters.sources.length === 0 && styles.filterOptionTextSelected]}>
                    {t('filter.allSources')}
                  </Text>
                  {filters.sources.length === 0 && <Ionicons name="checkmark" size={20} color="#1A237E" />}
                </TouchableOpacity>
                {sources.map((s) => (
                  <TouchableOpacity
                    key={s.value}
                    style={[styles.filterOption, filters.sources.includes(s.value) && styles.filterOptionSelected]}
                    onPress={() => selectSource(s.value)}
                  >
                    <Text style={[styles.filterOptionText, filters.sources.includes(s.value) && styles.filterOptionTextSelected]}>
                      {t(`incidents.sources.${s.value}`)}
                    </Text>
                    {filters.sources.includes(s.value) && <Ionicons name="checkmark" size={20} color="#1A237E" />}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Date Range Filter */}
          <View style={styles.filterSection}>
            <TouchableOpacity style={styles.filterHeader} onPress={() => toggleSection('date_range')}>
              <View style={styles.filterHeaderLeft}>
                <Ionicons name="calendar-outline" size={20} color="#1A237E" />
                <Text style={styles.filterLabel}>{t('filter.dateRange')}</Text>
              </View>
              <View style={styles.filterHeaderRight}>
                <Text style={[styles.filterValue, (filters.start_date || filters.end_date) && styles.filterValueActive]}>
                  {filters.start_date || filters.end_date ? t('filter.setLabel') : t('filter.allLabel')}
                </Text>
                <Ionicons name={expandedSection === 'date_range' ? 'chevron-up' : 'chevron-down'} size={20} color="#666" />
              </View>
            </TouchableOpacity>
            {expandedSection === 'date_range' && (
              <View style={styles.filterOptions}>
                <TouchableOpacity style={styles.dateRow} onPress={() => setShowDatePicker('from')}>
                  <Ionicons name="calendar" size={18} color="#1A237E" />
                  <Text style={styles.dateLabel}>{t('filter.from')}</Text>
                  <Text style={[styles.dateValue, filters.start_date && styles.filterValueActive]}>
                    {filters.start_date ? formatDisplayDate(filters.start_date) : t('filter.anyDate')}
                  </Text>
                  {filters.start_date ? (
                    <TouchableOpacity onPress={() => setFilters({ ...filters, start_date: null })}>
                      <Ionicons name="close-circle" size={18} color="#999" />
                    </TouchableOpacity>
                  ) : null}
                </TouchableOpacity>
                <TouchableOpacity style={styles.dateRow} onPress={() => setShowDatePicker('to')}>
                  <Ionicons name="calendar" size={18} color="#1A237E" />
                  <Text style={styles.dateLabel}>{t('filter.to')}</Text>
                  <Text style={[styles.dateValue, filters.end_date && styles.filterValueActive]}>
                    {filters.end_date ? formatDisplayDate(filters.end_date) : t('filter.anyDate')}
                  </Text>
                  {filters.end_date ? (
                    <TouchableOpacity onPress={() => setFilters({ ...filters, end_date: null })}>
                      <Ionicons name="close-circle" size={18} color="#999" />
                    </TouchableOpacity>
                  ) : null}
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Add some bottom padding for scroll */}
          <View style={{ height: 20 }} />
        </View>
      </ScrollView>

      {showDatePicker !== null && (
        Platform.OS === 'ios' ? (
          <Modal transparent animationType="slide">
            <View style={styles.dateModalOverlay}>
              <View style={styles.dateModalContent}>
                <View style={styles.dateModalHeader}>
                  <Text style={styles.dateModalTitle}>
                    {showDatePicker === 'from'
                      ? t('filter.selectFromDate', 'Select From Date')
                      : t('filter.selectToDate', 'Select To Date')}
                  </Text>
                  <TouchableOpacity onPress={() => setShowDatePicker(null)}>
                    <Text style={styles.dateModalDone}>{t('common.done', 'Done')}</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={showDatePicker === 'from'
                    ? (filters.start_date ? new Date(filters.start_date) : new Date())
                    : (filters.end_date ? new Date(filters.end_date) : new Date())
                  }
                  mode="date"
                  display="spinner"
                  maximumDate={new Date()}
                  onChange={(_, selectedDate) => {
                    if (selectedDate) {
                      if (showDatePicker === 'from') {
                        const d = new Date(selectedDate);
                        d.setHours(0, 0, 0, 0);
                        setFilters(prev => ({ ...prev, start_date: d.toISOString() }));
                      } else {
                        const d = new Date(selectedDate);
                        d.setHours(23, 59, 59, 999);
                        setFilters(prev => ({ ...prev, end_date: d.toISOString() }));
                      }
                    }
                  }}
                />
              </View>
            </View>
          </Modal>
        ) : (
          <DateTimePicker
            value={showDatePicker === 'from'
              ? (filters.start_date ? new Date(filters.start_date) : new Date())
              : (filters.end_date ? new Date(filters.end_date) : new Date())
            }
            mode="date"
            display="default"
            maximumDate={new Date()}
            onChange={(event, selectedDate) => {
              setShowDatePicker(null);
              if (event.type === 'dismissed' || !selectedDate) return;
              if (showDatePicker === 'from') {
                const d = new Date(selectedDate);
                d.setHours(0, 0, 0, 0);
                setFilters(prev => ({ ...prev, start_date: d.toISOString() }));
              } else {
                const d = new Date(selectedDate);
                d.setHours(23, 59, 59, 999);
                setFilters(prev => ({ ...prev, end_date: d.toISOString() }));
              }
            }}
          />
        )
      )}

      <View style={[styles.footer, { paddingBottom: Math.max(15, insets.bottom + 10) }]}>
        <TouchableOpacity
          style={[styles.resetButton, !hasActiveFilters && styles.resetButtonDisabled]}
          onPress={resetFilters}
          disabled={!hasActiveFilters}
        >
          <Text style={[styles.resetButtonText, !hasActiveFilters && styles.resetButtonTextDisabled]}>
            {t('filter.reset')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.filterButton} onPress={applyFilters}>
          <Text style={styles.filterButtonText}>{t('filter.applyFilters')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
    marginTop: 100,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A237E',
  },
  optionsContainer: {
    flex: 1,
    // padding: 15,
  },
  filterSection: {
    marginBottom: 10,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    overflow: 'hidden',
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
  },
  filterHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  filterHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  filterValue: {
    fontSize: 14,
    color: '#666',
  },
  filterValueActive: {
    color: '#1A237E',
    fontWeight: '600',
  },
  filterOptions: {
    paddingHorizontal: 15,
    paddingBottom: 15,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  treeSelectWrapper: {
    paddingHorizontal: 15,
    paddingBottom: 15,
  },
  filterOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  filterOptionSelected: {
    backgroundColor: '#E3F2FD',
  },
  filterOptionText: {
    fontSize: 15,
    color: '#333',
  },
  filterOptionTextSelected: {
    color: '#1A237E',
    fontWeight: '600',
  },
  stateOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stateColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  priorityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  priorityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  userAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1A237E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatarText: {
    color: 'white',
    fontSize: 11,
    fontWeight: 'bold',
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#EEE',
    gap: 10,
  },
  resetButton: {
    flex: 1,
    paddingVertical: isSmallScreen ? 12 : 15,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1A237E',
  },
  resetButtonDisabled: {
    borderColor: '#CCC',
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1A237E',
  },
  resetButtonTextDisabled: {
    color: '#CCC',
  },
  filterButton: {
    flex: 2,
    backgroundColor: '#2EC4B6',
    paddingVertical: isSmallScreen ? 12 : 15,
    paddingHorizontal: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  filterButtonText: {
    fontSize: isSmallScreen ? 14 : 16,
    fontWeight: 'bold',
    color: 'white',
  },
  dateRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 10, gap: 10 },
  dateLabel: { fontSize: 15, color: '#333', width: 36 },
  dateValue: { flex: 1, fontSize: 15, color: '#666' },
  dateModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  dateModalContent: { backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 30 },
  dateModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  dateModalTitle: { fontSize: 16, fontWeight: '600', color: '#333' },
  dateModalDone: { fontSize: 16, fontWeight: '600', color: '#2EC4B6' },
});

export default FilterScreen;
