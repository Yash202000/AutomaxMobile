import { getClassifications } from '@/src/api/classifications';
import { getDepartments } from '@/src/api/departments';
import { getComplaintStats } from '@/src/api/incidents';
import { getLocations } from '@/src/api/locations';
import { getUsers } from '@/src/api/users';
import { CustomAlert } from '@/src/components/CustomAlert';
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
  channels: string[];
  start_date: string | null;
  end_date: string | null;
}

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


const channels = [
  { value: 'phone' },
  { value: 'email' },
  { value: 'web' },
  { value: 'mobile' },
  { value: 'social_media' },
  { value: 'in_person' },
  { value: 'viusional' },
  { value: 'other' },
];

const { height: screenHeight } = Dimensions.get('window');
const isSmallScreen = screenHeight < 700;

const ComplaintFilterScreen = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{
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
    channel?: string;
    start_date?: string;
    end_date?: string;
  }>();

  const [states, setStates] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [classifications, setClassifications] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [loadingStates, setLoadingStates] = useState(true);
  const [loadingDepartments, setLoadingDepartments] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingClassifications, setLoadingClassifications] = useState(true);
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [filters, setFilters] = useState<FilterState>({
    state_ids: params.state_id ? params.state_id.split(',') : [],
    state_names: params.state_name ? params.state_name.split(',') : [],
    priorities: params.priority ? params.priority.split(',').map(p => parseInt(p)) : [],
    severities: params.severity ? params.severity.split(',').map(s => parseInt(s)) : [],
    assignee_ids: params.assignee_id ? params.assignee_id.split(',') : [],
    assignee_names: params.assignee_name ? params.assignee_name.split(',') : [],
    department_ids: params.department_id ? params.department_id.split(',') : [],
    department_names: params.department_name ? params.department_name.split(',') : [],
    classification_ids: params.classification_id ? params.classification_id.split(',') : [],
    classification_names: params.classification_name ? params.classification_name.split(',') : [],
    location_ids: params.location_id ? params.location_id.split(',') : [],
    location_names: params.location_name ? params.location_name.split(',') : [],
    channels: params.channel ? params.channel.split(',') : [],
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
    const response = await getComplaintStats();
    if (response.success) setStates(response.data.by_state_details || []);
    setLoadingStates(false);
  };

  const fetchDepartments = async () => {
    setLoadingDepartments(true);
    const response = await getDepartments();
    if (response.success) setDepartments(response.data || []);
    setLoadingDepartments(false);
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    const response = await getUsers();
    if (response.success) setUsers(response.data || []);
    setLoadingUsers(false);
  };

  const fetchClassifications = async () => {
    setLoadingClassifications(true);
    const response = await getClassifications();
    if (response.success) setClassifications(response.data || []);
    setLoadingClassifications(false);
  };

  const fetchLocations = async () => {
    setLoadingLocations(true);
    const response = await getLocations();
    if (response.success) setLocations(response.data || []);
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

  const selectClassification = (item: any) => {
    const isSelected = filters.classification_ids.includes(item.id);
    if (isSelected) {
      setFilters({
        ...filters,
        classification_ids: filters.classification_ids.filter(id => id !== item.id),
        classification_names: filters.classification_names.filter(name => name !== item.name),
      });
    } else {
      setFilters({
        ...filters,
        classification_ids: [...filters.classification_ids, item.id],
        classification_names: [...filters.classification_names, item.name],
      });
    }
  };

  const selectLocation = (item: any) => {
    const isSelected = filters.location_ids.includes(item.id);
    if (isSelected) {
      setFilters({
        ...filters,
        location_ids: filters.location_ids.filter(id => id !== item.id),
        location_names: filters.location_names.filter(name => name !== item.name),
      });
    } else {
      setFilters({
        ...filters,
        location_ids: [...filters.location_ids, item.id],
        location_names: [...filters.location_names, item.name],
      });
    }
  };

  const selectChannel = (channel: string) => {
    const isSelected = filters.channels.includes(channel);
    setFilters({
      ...filters,
      channels: isSelected
        ? filters.channels.filter(c => c !== channel)
        : [...filters.channels, channel],
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
    if (filters.state_ids.length > 0) { queryParams.state_id = filters.state_ids.join(','); queryParams.state_name = filters.state_names.join(','); }
    if (filters.priorities.length > 0) queryParams.priority = filters.priorities.join(',');
    if (filters.severities.length > 0) queryParams.severity = filters.severities.join(',');
    if (filters.assignee_ids.length > 0) { queryParams.assignee_id = filters.assignee_ids.join(','); queryParams.assignee_name = filters.assignee_names.join(','); }
    if (filters.department_ids.length > 0) { queryParams.department_id = filters.department_ids.join(','); queryParams.department_name = filters.department_names.join(','); }
    if (filters.classification_ids.length > 0) { queryParams.classification_id = filters.classification_ids.join(','); queryParams.classification_name = filters.classification_names.join(','); }
    if (filters.location_ids.length > 0) { queryParams.location_id = filters.location_ids.join(','); queryParams.location_name = filters.location_names.join(','); }
    if (filters.channels.length > 0) queryParams.channel = filters.channels.join(',');
    if (filters.start_date) queryParams.start_date = filters.start_date;
    if (filters.end_date) queryParams.end_date = filters.end_date;

    router.replace({ pathname: '/(tabs)/complaint', params: queryParams });
  };

  const resetFilters = () => {
    router.replace({ pathname: '/(tabs)/complaint' });
  };

  const hasActiveFilters = filters.state_ids.length > 0 || filters.priorities.length > 0 || filters.severities.length > 0 ||
    filters.assignee_ids.length > 0 || filters.department_ids.length > 0 || filters.classification_ids.length > 0 ||
    filters.location_ids.length > 0 || filters.channels.length > 0 || filters.start_date || filters.end_date;

  const formatDisplayDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const renderFilterSection = (
    key: string, label: string, icon: string, value: string, loading: boolean,
    options: any[], renderOption: (item: any) => React.ReactNode
  ) => (
    <View style={styles.filterSection}>
      <TouchableOpacity style={styles.filterHeader} onPress={() => toggleSection(key)}>
        <View style={styles.filterHeaderLeft}>
          <Ionicons name={icon as any} size={20} color="#E74C3C" />
          <Text style={styles.filterLabel}>{label}</Text>
        </View>
        <View style={styles.filterHeaderRight}>
          <Text style={[styles.filterValue, value !== 'All' && styles.filterValueActive]}>{value}</Text>
          <Ionicons name={expandedSection === key ? 'chevron-up' : 'chevron-down'} size={20} color="#666" />
        </View>
      </TouchableOpacity>
      {expandedSection === key && (
        <View style={styles.filterOptions}>
          {loading ? <ActivityIndicator size="small" color="#E74C3C" /> : options.map(renderOption)}
        </View>
      )}
    </View>
  );

  return (
    <View style={[styles.container, { marginTop: isSmallScreen ? 60 : 100 }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('filter.filterComplaints', 'Filter Complaints')}</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close-circle" size={28} color="#E74C3C" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.optionsContainer}>
        {renderFilterSection('channel', t('complaints.channel', 'Channel'), 'megaphone-outline',
          filters.channels.length === 0 ? t('filter.allLabel', 'All') : (filters.channels.length === 1 ? t(`incidents.channels.${filters.channels[0]}`) : t('filter.nSelected', '{{count}} selected', { count: filters.channels.length })),
          false,
          [{ value: null, label: t('filter.allChannels', 'All Channels') }, ...channels],
          (c) => (
            <TouchableOpacity key={c.value || 'all'} style={[styles.filterOption, (c.value ? filters.channels.includes(c.value) : filters.channels.length === 0) && styles.filterOptionSelected]}
              onPress={() => c.value ? selectChannel(c.value) : setFilters({ ...filters, channels: [] })}>
              <Text style={styles.filterOptionText}>{c.value ? t(`incidents.channels.${c.value}`) : c.label}</Text>
              {(c.value ? filters.channels.includes(c.value) : filters.channels.length === 0) && <Ionicons name="checkmark" size={20} color="#E74C3C" />}
            </TouchableOpacity>
          )
        )}

        {renderFilterSection('status', t('filter.status', 'Status'), 'flag-outline',
          filters.state_ids.length === 0 ? t('filter.allLabel', 'All') : (filters.state_ids.length === 1 ? filters.state_names[0] : t('filter.nSelected', '{{count}} selected', { count: filters.state_ids.length })),
          loadingStates,
          [{ id: null, name: t('filter.allStatuses', 'All Statuses') }, ...states],
          (state) => (
            <TouchableOpacity key={state.id || 'all'} style={[styles.filterOption, (state.id ? filters.state_ids.includes(state.id) : filters.state_ids.length === 0) && styles.filterOptionSelected]}
              onPress={() => state.id ? selectState(state) : setFilters({ ...filters, state_ids: [], state_names: [] })}>
              <Text style={styles.filterOptionText}>{state.name}</Text>
              {(state.id ? filters.state_ids.includes(state.id) : filters.state_ids.length === 0) && <Ionicons name="checkmark" size={20} color="#E74C3C" />}
            </TouchableOpacity>
          )
        )}

        {renderFilterSection('priority', t('filter.priority', 'Priority'), 'flag-outline',
          filters.priorities.length === 0 ? t('filter.allLabel', 'All') : (filters.priorities.length === 1 ? t(`priorities.${priorities.find(p => p.value === filters.priorities[0])?.key}`) : t('filter.nSelected', '{{count}} selected', { count: filters.priorities.length })),
          false,
          [{ value: null, label: t('filter.allPriorities', 'All Priorities') }, ...priorities],
          (p) => (
            <TouchableOpacity key={p.value || 'all'} style={[styles.filterOption, (p.value ? filters.priorities.includes(p.value) : filters.priorities.length === 0) && styles.filterOptionSelected]}
              onPress={() => p.value ? selectPriority(p.value) : setFilters({ ...filters, priorities: [] })}>
              <View style={styles.priorityOption}>
                {p.color && <View style={[styles.priorityDot, { backgroundColor: p.color }]} />}
                <Text style={styles.filterOptionText}>{p.value ? t(`priorities.${p.key}`) : p.label}</Text>
              </View>
              {(p.value ? filters.priorities.includes(p.value) : filters.priorities.length === 0) && <Ionicons name="checkmark" size={20} color="#E74C3C" />}
            </TouchableOpacity>
          )
        )}

        {renderFilterSection('severity', t('filter.severity', 'Severity'), 'warning-outline',
          filters.severities.length === 0 ? t('filter.allLabel', 'All') : (filters.severities.length === 1 ? t(`severities.${severities.find(s => s.value === filters.severities[0])?.key}`) : t('filter.nSelected', '{{count}} selected', { count: filters.severities.length })),
          false,
          [{ value: null, label: t('filter.allSeverities', 'All Severities') }, ...severities],
          (s) => (
            <TouchableOpacity key={s.value || 'all'} style={[styles.filterOption, (s.value ? filters.severities.includes(s.value) : filters.severities.length === 0) && styles.filterOptionSelected]}
              onPress={() => s.value ? selectSeverity(s.value) : setFilters({ ...filters, severities: [] })}>
              <View style={styles.priorityOption}>
                {s.color && <View style={[styles.priorityDot, { backgroundColor: s.color }]} />}
                <Text style={styles.filterOptionText}>{s.value ? t(`severities.${s.key}`) : s.label}</Text>
              </View>
              {(s.value ? filters.severities.includes(s.value) : filters.severities.length === 0) && <Ionicons name="checkmark" size={20} color="#E74C3C" />}
            </TouchableOpacity>
          )
        )}

        {renderFilterSection('assignee', t('filter.assignee', 'Assignee'), 'person-outline',
          filters.assignee_ids.length === 0 ? t('filter.allLabel', 'All') : (filters.assignee_ids.length === 1 ? filters.assignee_names[0] : t('filter.nSelected', '{{count}} selected', { count: filters.assignee_ids.length })),
          loadingUsers,
          [{ id: null, first_name: t('filter.allLabel', 'All'), last_name: t('filter.assignee', 'Assignees') }, ...users],
          (user) => (
            <TouchableOpacity key={user.id || 'all'} style={[styles.filterOption, (user.id ? filters.assignee_ids.includes(user.id) : filters.assignee_ids.length === 0) && styles.filterOptionSelected]}
              onPress={() => user.id ? selectAssignee(user) : setFilters({ ...filters, assignee_ids: [], assignee_names: [] })}>
              <Text style={styles.filterOptionText}>{user.id ? `${user.first_name} ${user.last_name}` : t('filter.allAssignees', 'All Assignees')}</Text>
              {(user.id ? filters.assignee_ids.includes(user.id) : filters.assignee_ids.length === 0) && <Ionicons name="checkmark" size={20} color="#E74C3C" />}
            </TouchableOpacity>
          )
        )}

        {renderFilterSection('department', t('filter.department', 'Department'), 'business-outline',
          filters.department_ids.length === 0 ? t('filter.allLabel', 'All') : (filters.department_ids.length === 1 ? filters.department_names[0] : t('filter.nSelected', '{{count}} selected', { count: filters.department_ids.length })),
          loadingDepartments,
          [{ id: null, name: t('filter.allDepartments', 'All Departments') }, ...departments],
          (dept) => (
            <TouchableOpacity key={dept.id || 'all'} style={[styles.filterOption, (dept.id ? filters.department_ids.includes(dept.id) : filters.department_ids.length === 0) && styles.filterOptionSelected]}
              onPress={() => dept.id ? selectDepartment(dept) : setFilters({ ...filters, department_ids: [], department_names: [] })}>
              <Text style={styles.filterOptionText}>{dept.name}</Text>
              {(dept.id ? filters.department_ids.includes(dept.id) : filters.department_ids.length === 0) && <Ionicons name="checkmark" size={20} color="#E74C3C" />}
            </TouchableOpacity>
          )
        )}

        {renderFilterSection('classification', t('filter.classification', 'Classification'), 'layers-outline',
          filters.classification_ids.length === 0 ? t('filter.allLabel', 'All') : (filters.classification_ids.length === 1 ? filters.classification_names[0] : t('filter.nSelected', '{{count}} selected', { count: filters.classification_ids.length })),
          loadingClassifications,
          [{ id: null, name: t('filter.allClassifications', 'All Classifications') }, ...classifications],
          (item) => (
            <TouchableOpacity key={item.id || 'all'} style={[styles.filterOption, (item.id ? filters.classification_ids.includes(item.id) : filters.classification_ids.length === 0) && styles.filterOptionSelected]}
              onPress={() => item.id ? selectClassification(item) : setFilters({ ...filters, classification_ids: [], classification_names: [] })}>
              <Text style={styles.filterOptionText}>{item.name}</Text>
              {(item.id ? filters.classification_ids.includes(item.id) : filters.classification_ids.length === 0) && <Ionicons name="checkmark" size={20} color="#E74C3C" />}
            </TouchableOpacity>
          )
        )}

        {renderFilterSection('location', t('filter.location', 'Location'), 'location-outline',
          filters.location_ids.length === 0 ? t('filter.allLabel', 'All') : (filters.location_ids.length === 1 ? filters.location_names[0] : t('filter.nSelected', '{{count}} selected', { count: filters.location_ids.length })),
          loadingLocations,
          [{ id: null, name: t('filter.allLocations', 'All Locations') }, ...locations],
          (item) => (
            <TouchableOpacity key={item.id || 'all'} style={[styles.filterOption, (item.id ? filters.location_ids.includes(item.id) : filters.location_ids.length === 0) && styles.filterOptionSelected]}
              onPress={() => item.id ? selectLocation(item) : setFilters({ ...filters, location_ids: [], location_names: [] })}>
              <Text style={styles.filterOptionText}>{item.name}</Text>
              {(item.id ? filters.location_ids.includes(item.id) : filters.location_ids.length === 0) && <Ionicons name="checkmark" size={20} color="#E74C3C" />}
            </TouchableOpacity>
          )
        )}

        {/* Date Range Filter */}
        <View style={styles.filterSection}>
          <TouchableOpacity style={styles.filterHeader} onPress={() => toggleSection('date_range')}>
            <View style={styles.filterHeaderLeft}>
              <Ionicons name="calendar-outline" size={20} color="#E74C3C" />
              <Text style={styles.filterLabel}>{t('filter.dateRange')}</Text>
            </View>
            <View style={styles.filterHeaderRight}>
              <Text style={[styles.filterValue, (filters.start_date || filters.end_date) && styles.filterValueActive]}>
                {filters.start_date || filters.end_date ? 'Set' : 'All'}
              </Text>
              <Ionicons name={expandedSection === 'date_range' ? 'chevron-up' : 'chevron-down'} size={20} color="#666" />
            </View>
          </TouchableOpacity>
          {expandedSection === 'date_range' && (
            <View style={styles.filterOptions}>
              <TouchableOpacity style={styles.dateRow} onPress={() => setShowDatePicker('from')}>
                <Ionicons name="calendar" size={18} color="#E74C3C" />
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
                <Ionicons name="calendar" size={18} color="#E74C3C" />
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

        <View style={{ height: 20 }} />
      </ScrollView>

      {showDatePicker !== null && (
        Platform.OS === 'ios' ? (
          <Modal transparent animationType="slide">
            <View style={styles.dateModalOverlay}>
              <View style={styles.dateModalContent}>
                <View style={styles.dateModalHeader}>
                  <Text style={styles.dateModalTitle}>
                    {showDatePicker === 'from' ? 'Select From Date' : 'Select To Date'}
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
        <TouchableOpacity style={[styles.resetButton, !hasActiveFilters && styles.resetButtonDisabled]} onPress={resetFilters} disabled={!hasActiveFilters}>
          <Text style={[styles.resetButtonText, !hasActiveFilters && styles.resetButtonTextDisabled]}>{t('filter.reset', 'Reset')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.filterButton} onPress={applyFilters}>
          <Text style={styles.filterButtonText}>{t('filter.applyFilters', 'APPLY FILTERS')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white', marginTop: 100, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#E74C3C' },
  optionsContainer: { flex: 1, padding: 15 },
  filterSection: { marginBottom: 10, backgroundColor: '#F8F9FA', borderRadius: 12, overflow: 'hidden' },
  filterHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15 },
  filterHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  filterHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filterLabel: { fontSize: 16, fontWeight: '600', color: '#333' },
  filterValue: { fontSize: 14, color: '#666' },
  filterValueActive: { color: '#E74C3C', fontWeight: '600' },
  filterOptions: { paddingHorizontal: 15, paddingBottom: 15, borderTopWidth: 1, borderTopColor: '#E0E0E0' },
  filterOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 10, borderRadius: 8, marginTop: 8 },
  filterOptionSelected: { backgroundColor: '#FDEAEA' },
  filterOptionText: { fontSize: 15, color: '#333' },
  priorityOption: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  priorityDot: { width: 10, height: 10, borderRadius: 5 },
  footer: { flexDirection: 'row', paddingHorizontal: 15, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#EEE', gap: 10 },
  resetButton: { flex: 1, paddingVertical: isSmallScreen ? 12 : 15, paddingHorizontal: 8, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: '#E74C3C' },
  resetButtonDisabled: { borderColor: '#CCC' },
  resetButtonText: { fontSize: 16, fontWeight: 'bold', color: '#E74C3C' },
  resetButtonTextDisabled: { color: '#CCC' },
  filterButton: { flex: 2, backgroundColor: '#E74C3C', paddingVertical: isSmallScreen ? 12 : 15, paddingHorizontal: 8, borderRadius: 10, alignItems: 'center' },
  filterButtonText: { fontSize: isSmallScreen ? 14 : 16, fontWeight: 'bold', color: 'white' },
  dateRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 10, gap: 10 },
  dateLabel: { fontSize: 15, color: '#333', width: 36 },
  dateValue: { flex: 1, fontSize: 15, color: '#666' },
  dateModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  dateModalContent: { backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 30 },
  dateModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  dateModalTitle: { fontSize: 16, fontWeight: '600', color: '#333' },
  dateModalDone: { fontSize: 16, fontWeight: '600', color: '#2EC4B6' },
});

export default ComplaintFilterScreen;
