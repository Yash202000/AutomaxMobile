import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getAllStates } from '@/src/api/workflow';
import { getDepartments } from '@/src/api/departments';
import { getUsers } from '@/src/api/users';
import { getClassifications } from '@/src/api/classifications';
import { getLocations } from '@/src/api/locations';

interface FilterState {
  state_id: string | null;
  state_name: string | null;
  priority: number | null;
  severity: number | null;
  assignee_id: string | null;
  assignee_name: string | null;
  department_id: string | null;
  department_name: string | null;
  classification_id: string | null;
  classification_name: string | null;
  location_id: string | null;
  location_name: string | null;
  sla_status: string | null;
}

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

const slaStatuses = [
  { value: 'on_track', label: 'On Track', color: '#2ECC71' },
  { value: 'at_risk', label: 'At Risk', color: '#F1C40F' },
  { value: 'breached', label: 'Breached', color: '#E74C3C' },
];

const RequestFilterScreen = () => {
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
    classification_id?: string;
    classification_name?: string;
    location_id?: string;
    location_name?: string;
    sla_status?: string;
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
    state_id: params.state_id || null,
    state_name: params.state_name || null,
    priority: params.priority ? parseInt(params.priority) : null,
    severity: params.severity ? parseInt(params.severity) : null,
    assignee_id: params.assignee_id || null,
    assignee_name: params.assignee_name || null,
    department_id: params.department_id || null,
    department_name: params.department_name || null,
    classification_id: params.classification_id || null,
    classification_name: params.classification_name || null,
    location_id: params.location_id || null,
    location_name: params.location_name || null,
    sla_status: params.sla_status || null,
  });

  const [expandedSection, setExpandedSection] = useState<string | null>(null);

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
    const response = await getClassifications();
    if (response.success) {
      setClassifications(response.data || []);
    }
    setLoadingClassifications(false);
  };

  const fetchLocations = async () => {
    setLoadingLocations(true);
    const response = await getLocations();
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

  const selectClassification = (classification: any) => {
    if (filters.classification_id === classification.id) {
      setFilters({ ...filters, classification_id: null, classification_name: null });
    } else {
      setFilters({ ...filters, classification_id: classification.id, classification_name: classification.name });
    }
    setExpandedSection(null);
  };

  const selectLocation = (location: any) => {
    if (filters.location_id === location.id) {
      setFilters({ ...filters, location_id: null, location_name: null });
    } else {
      setFilters({ ...filters, location_id: location.id, location_name: location.name });
    }
    setExpandedSection(null);
  };

  const selectSlaStatus = (status: string) => {
    setFilters({ ...filters, sla_status: filters.sla_status === status ? null : status });
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
    if (filters.classification_id) {
      queryParams.classification_id = filters.classification_id;
      queryParams.classification_name = filters.classification_name;
    }
    if (filters.location_id) {
      queryParams.location_id = filters.location_id;
      queryParams.location_name = filters.location_name;
    }
    if (filters.sla_status) queryParams.sla_status = filters.sla_status;

    router.replace({
      pathname: '/(tabs)/request',
      params: queryParams,
    });
  };

  const resetFilters = () => {
    setFilters({
      state_id: null, state_name: null, priority: null, severity: null,
      assignee_id: null, assignee_name: null, department_id: null, department_name: null,
      classification_id: null, classification_name: null, location_id: null, location_name: null,
      sla_status: null,
    });
  };

  const hasActiveFilters = filters.state_id || filters.priority || filters.severity ||
    filters.assignee_id || filters.department_id || filters.classification_id ||
    filters.location_id || filters.sla_status;

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
    <View style={styles.container}>
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

        {renderFilterSection('classification', 'Classification', 'folder-outline', filters.classification_name || 'All', loadingClassifications,
          [{ id: null, name: 'All Classifications' }, ...classifications],
          (c) => (
            <TouchableOpacity key={c.id || 'all'} style={[styles.filterOption, (c.id ? filters.classification_id === c.id : !filters.classification_id) && styles.filterOptionSelected]}
              onPress={() => c.id ? selectClassification(c) : setFilters({ ...filters, classification_id: null, classification_name: null })}>
              <Text style={styles.filterOptionText}>{c.name}</Text>
              {(c.id ? filters.classification_id === c.id : !filters.classification_id) && <Ionicons name="checkmark" size={20} color="#9B59B6" />}
            </TouchableOpacity>
          )
        )}

        {renderFilterSection('location', 'Location', 'location-outline', filters.location_name || 'All', loadingLocations,
          [{ id: null, name: 'All Locations' }, ...locations],
          (l) => (
            <TouchableOpacity key={l.id || 'all'} style={[styles.filterOption, (l.id ? filters.location_id === l.id : !filters.location_id) && styles.filterOptionSelected]}
              onPress={() => l.id ? selectLocation(l) : setFilters({ ...filters, location_id: null, location_name: null })}>
              <Text style={styles.filterOptionText}>{l.name}</Text>
              {(l.id ? filters.location_id === l.id : !filters.location_id) && <Ionicons name="checkmark" size={20} color="#9B59B6" />}
            </TouchableOpacity>
          )
        )}

        {renderFilterSection('sla', 'SLA Status', 'time-outline', slaStatuses.find(s => s.value === filters.sla_status)?.label || 'All', false,
          [{ value: null, label: 'All SLA Statuses' }, ...slaStatuses],
          (s) => (
            <TouchableOpacity key={s.value || 'all'} style={[styles.filterOption, (s.value ? filters.sla_status === s.value : !filters.sla_status) && styles.filterOptionSelected]}
              onPress={() => s.value ? selectSlaStatus(s.value) : setFilters({ ...filters, sla_status: null })}>
              <View style={styles.priorityOption}>
                {s.color && <View style={[styles.priorityDot, { backgroundColor: s.color }]} />}
                <Text style={styles.filterOptionText}>{s.label}</Text>
              </View>
              {(s.value ? filters.sla_status === s.value : !filters.sla_status) && <Ionicons name="checkmark" size={20} color="#9B59B6" />}
            </TouchableOpacity>
          )
        )}
        <View style={{ height: 20 }} />
      </ScrollView>

      <View style={styles.footer}>
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
  filterOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 10, borderRadius: 8, marginTop: 8 },
  filterOptionSelected: { backgroundColor: '#F3E8FF' },
  filterOptionText: { fontSize: 15, color: '#333' },
  priorityOption: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  priorityDot: { width: 10, height: 10, borderRadius: 5 },
  footer: { flexDirection: 'row', padding: 15, borderTopWidth: 1, borderTopColor: '#EEE', gap: 10 },
  resetButton: { flex: 1, padding: 15, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: '#9B59B6' },
  resetButtonDisabled: { borderColor: '#CCC' },
  resetButtonText: { fontSize: 16, fontWeight: 'bold', color: '#9B59B6' },
  resetButtonTextDisabled: { color: '#CCC' },
  filterButton: { flex: 2, backgroundColor: '#9B59B6', padding: 15, borderRadius: 10, alignItems: 'center' },
  filterButtonText: { fontSize: 16, fontWeight: 'bold', color: 'white' },
});

export default RequestFilterScreen;
