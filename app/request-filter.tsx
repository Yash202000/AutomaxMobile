import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Dimensions, Platform, Modal } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getAllStates } from '@/src/api/workflow';
import { getDepartments } from '@/src/api/departments';
import { getUsers } from '@/src/api/users';
import { getClassificationsTree } from '@/src/api/classifications';
import { getLocationsTree } from '@/src/api/locations';
import TreeSelect, { TreeNode } from '@/src/components/TreeSelect';

interface FilterState {
  state_id: string | null;
  state_name: string | null;
  priority: number | null;
  severity: number | null;
  assignee_id: string | null;
  assignee_name: string | null;
  department_id: string | null;
  department_name: string | null;
  classification_ids: string[];
  classification_names: string[];
  location_ids: string[];
  location_names: string[];
  source: string | null;
  start_date: string | null;
  end_date: string | null;
}

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

const priorities = [
  { value: 1, label: 'Critical', color: '#E74C3C' },
  { value: 2, label: 'High', color: '#E67E22' },
  { value: 3, label: 'Medium', color: '#F1C40F' },
  { value: 4, label: 'Low', color: '#3498DB' },
  { value: 5, label: 'Very Low', color: '#2ECC71' },
];

const severities = [
  { value: 1, label: 'Critical', color: '#E74C3C' },
  { value: 2, label: 'Major', color: '#E67E22' },
  { value: 3, label: 'Moderate', color: '#F1C40F' },
  { value: 4, label: 'Minor', color: '#3498DB' },
  { value: 5, label: 'Cosmetic', color: '#2ECC71' },
];



const { height: screenHeight } = Dimensions.get('window');
const isSmallScreen = screenHeight < 700;

const RequestFilterScreen = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{
    state_id?: string;
    state_name?: string;
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
    state_id: params.state_id || null,
    state_name: params.state_name || null,
    priority: params.priority ? parseInt(params.priority) : null,
    severity: params.severity ? parseInt(params.severity) : null,
    assignee_id: params.assignee_id || null,
    assignee_name: params.assignee_name || null,
    department_id: params.department_id || null,
    department_name: params.department_name || null,
    classification_ids: params.classification_ids ? params.classification_ids.split(',') : [],
    classification_names: params.classification_names ? params.classification_names.split(',') : [],
    location_ids: params.location_ids ? params.location_ids.split(',') : [],
    location_names: params.location_names ? params.location_names.split(',') : [],
    source: params.source || null,
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
    const response = await getAllStates();
    if (response.success) {
      setStates(response.data || []);
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
    if (filters.state_id === state.id) {
      setFilters({ ...filters, state_id: null, state_name: null });
    } else {
      setFilters({ ...filters, state_id: state.id, state_name: state.name });
    }
    setExpandedSection(null);
  };

  const selectPriority = (priority: number) => {
    setFilters({ ...filters, priority: filters.priority === priority ? null : priority });
    setExpandedSection(null);
  };

  const selectSeverity = (severity: number) => {
    setFilters({ ...filters, severity: filters.severity === severity ? null : severity });
    setExpandedSection(null);
  };

  const selectAssignee = (user: any) => {
    if (filters.assignee_id === user.id) {
      setFilters({ ...filters, assignee_id: null, assignee_name: null });
    } else {
      setFilters({ ...filters, assignee_id: user.id, assignee_name: `${user.first_name} ${user.last_name}` });
    }
    setExpandedSection(null);
  };

  const selectDepartment = (department: any) => {
    if (filters.department_id === department.id) {
      setFilters({ ...filters, department_id: null, department_name: null });
    } else {
      setFilters({ ...filters, department_id: department.id, department_name: department.name });
    }
    setExpandedSection(null);
  };

  const selectSource = (source: string | null) => {
    setFilters({ ...filters, source });
    setExpandedSection(null);
  };

  const applyFilters = () => {
    const queryParams: any = {};
    if (filters.state_id) {
      queryParams.state_id = filters.state_id;
      queryParams.state_name = filters.state_name;
    }
    if (filters.priority) queryParams.priority = filters.priority.toString();
    if (filters.severity) queryParams.severity = filters.severity.toString();
    if (filters.assignee_id) {
      queryParams.assignee_id = filters.assignee_id;
      queryParams.assignee_name = filters.assignee_name;
    }
    if (filters.department_id) {
      queryParams.department_id = filters.department_id;
      queryParams.department_name = filters.department_name;
    }
    if (filters.classification_ids.length > 0) {
      queryParams.classification_ids = filters.classification_ids.join(',');
      queryParams.classification_names = filters.classification_names.join(',');
    }
    if (filters.location_ids.length > 0) {
      queryParams.location_ids = filters.location_ids.join(',');
      queryParams.location_names = filters.location_names.join(',');
    }
    if (filters.source) queryParams.source = filters.source;
    if (filters.start_date) queryParams.start_date = filters.start_date;
    if (filters.end_date) queryParams.end_date = filters.end_date;

    router.replace({
      pathname: '/(tabs)/request',
      params: queryParams,
    });
  };

  const resetFilters = () => {
    router.replace({ pathname: '/(tabs)/request' });
  };

  const hasActiveFilters = filters.state_id || filters.priority || filters.severity ||
    filters.assignee_id || filters.department_id || filters.classification_ids.length > 0 ||
    filters.location_ids.length > 0 || filters.source || filters.start_date || filters.end_date;

  const formatDisplayDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const renderFilterSection = (
    key: string,
    label: string,
    icon: string,
    value: string,
    loading: boolean,
    options: any[],
    renderOption: (item: any) => React.ReactNode
  ) => (
    <View style={styles.filterSection}>
      <TouchableOpacity style={styles.filterHeader} onPress={() => toggleSection(key)}>
        <View style={styles.filterHeaderLeft}>
          <Ionicons name={icon as any} size={20} color="#9B59B6" />
          <Text style={styles.filterLabel}>{label}</Text>
        </View>
        <View style={styles.filterHeaderRight}>
          <Text style={[styles.filterValue, value !== 'All' && styles.filterValueActive]}>{value}</Text>
          <Ionicons name={expandedSection === key ? 'chevron-up' : 'chevron-down'} size={20} color="#666" />
        </View>
      </TouchableOpacity>
      {expandedSection === key && (
        <View style={styles.filterOptions}>
          {loading ? <ActivityIndicator size="small" color="#9B59B6" /> : options.map(renderOption)}
        </View>
      )}
    </View>
  );

  return (
    <View style={[styles.container, { marginTop: isSmallScreen ? 60 : 100 }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Filter Requests</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close-circle" size={28} color="#E74C3C" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.optionsContainer}>
        {renderFilterSection('status', 'Status', 'flag-outline', filters.state_name || 'All', loadingStates,
          [{ id: null, name: 'All Statuses' }, ...states],
          (state) => (
            <TouchableOpacity key={state.id || 'all'} style={[styles.filterOption, (state.id ? filters.state_id === state.id : !filters.state_id) && styles.filterOptionSelected]}
              onPress={() => state.id ? selectState(state) : setFilters({ ...filters, state_id: null, state_name: null })}>
              <Text style={styles.filterOptionText}>{state.name}</Text>
              {(state.id ? filters.state_id === state.id : !filters.state_id) && <Ionicons name="checkmark" size={20} color="#9B59B6" />}
            </TouchableOpacity>
          )
        )}

        {renderFilterSection('priority', 'Priority', 'alert-circle-outline', priorities.find(p => p.value === filters.priority)?.label || 'All', false,
          [{ value: null, label: 'All Priorities' }, ...priorities],
          (p) => (
            <TouchableOpacity key={p.value || 'all'} style={[styles.filterOption, (p.value ? filters.priority === p.value : !filters.priority) && styles.filterOptionSelected]}
              onPress={() => p.value ? selectPriority(p.value) : setFilters({ ...filters, priority: null })}>
              <View style={styles.priorityOption}>
                {p.color && <View style={[styles.priorityDot, { backgroundColor: p.color }]} />}
                <Text style={styles.filterOptionText}>{p.label}</Text>
              </View>
              {(p.value ? filters.priority === p.value : !filters.priority) && <Ionicons name="checkmark" size={20} color="#9B59B6" />}
            </TouchableOpacity>
          )
        )}

        {renderFilterSection('severity', 'Severity', 'warning-outline', severities.find(s => s.value === filters.severity)?.label || 'All', false,
          [{ value: null, label: 'All Severities' }, ...severities],
          (s) => (
            <TouchableOpacity key={s.value || 'all'} style={[styles.filterOption, (s.value ? filters.severity === s.value : !filters.severity) && styles.filterOptionSelected]}
              onPress={() => s.value ? selectSeverity(s.value) : setFilters({ ...filters, severity: null })}>
              <View style={styles.priorityOption}>
                {s.color && <View style={[styles.priorityDot, { backgroundColor: s.color }]} />}
                <Text style={styles.filterOptionText}>{s.label}</Text>
              </View>
              {(s.value ? filters.severity === s.value : !filters.severity) && <Ionicons name="checkmark" size={20} color="#9B59B6" />}
            </TouchableOpacity>
          )
        )}

        <View style={styles.filterSection}>
          <View style={styles.filterHeader}>
            <View style={styles.filterHeaderLeft}>
              <Ionicons name="layers-outline" size={20} color="#9B59B6" />
              <Text style={styles.filterLabel}>Classification</Text>
            </View>
          </View>
          <View style={styles.treeSelectWrapper}>
            <TreeSelect
              label="Classification"
              value=""
              data={classifications}
              loading={loadingClassifications}
              onSelect={() => {}}
              leafOnly={true}
              placeholder={filters.classification_ids.length > 0 ? `${filters.classification_ids.length} selected` : 'All Classifications'}
              iconType="classification"
              multiSelect={true}
              selectedIds={filters.classification_ids}
              onMultiSelect={(nodes) => setFilters({ ...filters, classification_ids: nodes.map(n => n.id), classification_names: nodes.map(n => n.name) })}
            />
          </View>
        </View>

        <View style={styles.filterSection}>
          <View style={styles.filterHeader}>
            <View style={styles.filterHeaderLeft}>
              <Ionicons name="location-outline" size={20} color="#9B59B6" />
              <Text style={styles.filterLabel}>Location</Text>
            </View>
          </View>
          <View style={styles.treeSelectWrapper}>
            <TreeSelect
              label="Location"
              value=""
              data={locations}
              loading={loadingLocations}
              onSelect={() => {}}
              leafOnly={true}
              placeholder={filters.location_ids.length > 0 ? `${filters.location_ids.length} selected` : 'All Locations'}
              iconType="location"
              multiSelect={true}
              selectedIds={filters.location_ids}
              onMultiSelect={(nodes) => setFilters({ ...filters, location_ids: nodes.map(n => n.id), location_names: nodes.map(n => n.name) })}
            />
          </View>
        </View>

        {renderFilterSection('source', 'Source', 'git-network-outline', sources.find(s => s.value === filters.source)?.label || 'All', false,
          [{ value: null, label: 'All Sources' }, ...sources],
          (s) => (
            <TouchableOpacity key={s.value || 'all'} style={[styles.filterOption, (s.value ? filters.source === s.value : !filters.source) && styles.filterOptionSelected]}
              onPress={() => s.value ? selectSource(s.value) : selectSource(null)}>
              <Text style={styles.filterOptionText}>{s.label}</Text>
              {(s.value ? filters.source === s.value : !filters.source) && <Ionicons name="checkmark" size={20} color="#9B59B6" />}
            </TouchableOpacity>
          )
        )}

        {/* Date Range Filter */}
        <View style={styles.filterSection}>
          <TouchableOpacity style={styles.filterHeader} onPress={() => toggleSection('date_range')}>
            <View style={styles.filterHeaderLeft}>
              <Ionicons name="calendar-outline" size={20} color="#9B59B6" />
              <Text style={styles.filterLabel}>Date Range</Text>
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
                <Ionicons name="calendar" size={18} color="#9B59B6" />
                <Text style={styles.dateLabel}>From</Text>
                <Text style={[styles.dateValue, filters.start_date && styles.filterValueActive]}>
                  {filters.start_date ? formatDisplayDate(filters.start_date) : 'Any date'}
                </Text>
                {filters.start_date ? (
                  <TouchableOpacity onPress={() => setFilters({ ...filters, start_date: null })}>
                    <Ionicons name="close-circle" size={18} color="#999" />
                  </TouchableOpacity>
                ) : null}
              </TouchableOpacity>
              <TouchableOpacity style={styles.dateRow} onPress={() => setShowDatePicker('to')}>
                <Ionicons name="calendar" size={18} color="#9B59B6" />
                <Text style={styles.dateLabel}>To</Text>
                <Text style={[styles.dateValue, filters.end_date && styles.filterValueActive]}>
                  {filters.end_date ? formatDisplayDate(filters.end_date) : 'Any date'}
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
                    <Text style={styles.dateModalDone}>Done</Text>
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
          <Text style={[styles.resetButtonText, !hasActiveFilters && styles.resetButtonTextDisabled]}>Reset</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.filterButton} onPress={applyFilters}>
          <Text style={styles.filterButtonText}>APPLY FILTERS</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white', marginTop: 100, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#9B59B6' },
  optionsContainer: { flex: 1, padding: 15 },
  filterSection: { marginBottom: 10, backgroundColor: '#F8F9FA', borderRadius: 12, overflow: 'hidden' },
  filterHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15 },
  filterHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  filterHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filterLabel: { fontSize: 16, fontWeight: '600', color: '#333' },
  filterValue: { fontSize: 14, color: '#666' },
  filterValueActive: { color: '#9B59B6', fontWeight: '600' },
  filterOptions: { paddingHorizontal: 15, paddingBottom: 15, borderTopWidth: 1, borderTopColor: '#E0E0E0' },
  treeSelectWrapper: { paddingHorizontal: 15, paddingBottom: 15 },
  filterOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 10, borderRadius: 8, marginTop: 8 },
  filterOptionSelected: { backgroundColor: '#F3E8FF' },
  filterOptionText: { fontSize: 15, color: '#333' },
  priorityOption: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  priorityDot: { width: 10, height: 10, borderRadius: 5 },
  footer: { flexDirection: 'row', paddingHorizontal: 15, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#EEE', gap: 10 },
  resetButton: { flex: 1, paddingVertical: isSmallScreen ? 12 : 15, paddingHorizontal: 8, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: '#9B59B6' },
  resetButtonDisabled: { borderColor: '#CCC' },
  resetButtonText: { fontSize: 16, fontWeight: 'bold', color: '#9B59B6' },
  resetButtonTextDisabled: { color: '#CCC' },
  filterButton: { flex: 2, backgroundColor: '#9B59B6', paddingVertical: isSmallScreen ? 12 : 15, paddingHorizontal: 8, borderRadius: 10, alignItems: 'center' },
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

export default RequestFilterScreen;
