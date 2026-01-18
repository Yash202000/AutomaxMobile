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

const FilterScreen = () => {
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
    if (filters.priority === priority) {
      setFilters({ ...filters, priority: null });
    } else {
      setFilters({ ...filters, priority });
    }
    setExpandedSection(null);
  };

  const selectSeverity = (severity: number) => {
    if (filters.severity === severity) {
      setFilters({ ...filters, severity: null });
    } else {
      setFilters({ ...filters, severity });
    }
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
    if (filters.sla_status === status) {
      setFilters({ ...filters, sla_status: null });
    } else {
      setFilters({ ...filters, sla_status: status });
    }
    setExpandedSection(null);
  };

  const applyFilters = () => {
    const queryParams: any = {};
    if (filters.state_id) {
      queryParams.state_id = filters.state_id;
      queryParams.state_name = filters.state_name;
    }
    if (filters.priority) {
      queryParams.priority = filters.priority.toString();
    }
    if (filters.severity) {
      queryParams.severity = filters.severity.toString();
    }
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
    if (filters.sla_status) {
      queryParams.sla_status = filters.sla_status;
    }

    router.replace({
      pathname: '/(tabs)/incident',
      params: queryParams,
    });
  };

  const resetFilters = () => {
    setFilters({
      state_id: null,
      state_name: null,
      priority: null,
      severity: null,
      assignee_id: null,
      assignee_name: null,
      department_id: null,
      department_name: null,
      classification_id: null,
      classification_name: null,
      location_id: null,
      location_name: null,
      sla_status: null,
    });
  };

  const hasActiveFilters = filters.state_id || filters.priority || filters.severity ||
    filters.assignee_id || filters.department_id || filters.classification_id ||
    filters.location_id || filters.sla_status;

  const getSelectedStateName = () => {
    if (!filters.state_id) return 'All';
    return filters.state_name || 'Selected';
  };

  const getSelectedPriorityLabel = () => {
    if (!filters.priority) return 'All';
    return priorities.find(p => p.value === filters.priority)?.label || 'Selected';
  };

  const getSelectedSeverityLabel = () => {
    if (!filters.severity) return 'All';
    return severities.find(s => s.value === filters.severity)?.label || 'Selected';
  };

  const getSelectedAssigneeName = () => {
    if (!filters.assignee_id) return 'All';
    return filters.assignee_name || 'Selected';
  };

  const getSelectedDepartmentName = () => {
    if (!filters.department_id) return 'All';
    return filters.department_name || 'Selected';
  };

  const getSelectedClassificationName = () => {
    if (!filters.classification_id) return 'All';
    return filters.classification_name || 'Selected';
  };

  const getSelectedLocationName = () => {
    if (!filters.location_id) return 'All';
    return filters.location_name || 'Selected';
  };

  const getSelectedSlaStatusLabel = () => {
    if (!filters.sla_status) return 'All';
    return slaStatuses.find(s => s.value === filters.sla_status)?.label || 'Selected';
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Filter Incidents</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close-circle" size={28} color="#E74C3C" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.optionsContainer}>
        {/* Status Filter */}
        <View style={styles.filterSection}>
          <TouchableOpacity
            style={styles.filterHeader}
            onPress={() => toggleSection('status')}
          >
            <View style={styles.filterHeaderLeft}>
              <Ionicons name="flag-outline" size={20} color="#1A237E" />
              <Text style={styles.filterLabel}>Status</Text>
            </View>
            <View style={styles.filterHeaderRight}>
              <Text style={[styles.filterValue, filters.state_id && styles.filterValueActive]}>
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
                    style={[styles.filterOption, !filters.state_id && styles.filterOptionSelected]}
                    onPress={() => setFilters({ ...filters, state_id: null, state_name: null })}
                  >
                    <Text style={[styles.filterOptionText, !filters.state_id && styles.filterOptionTextSelected]}>
                      All Statuses
                    </Text>
                    {!filters.state_id && <Ionicons name="checkmark" size={20} color="#1A237E" />}
                  </TouchableOpacity>
                  {states.map((state) => (
                    <TouchableOpacity
                      key={state.id}
                      style={[styles.filterOption, filters.state_id === state.id && styles.filterOptionSelected]}
                      onPress={() => selectState(state)}
                    >
                      <View style={styles.stateOption}>
                        <View style={[styles.stateColor, { backgroundColor: state.color || '#6366f1' }]} />
                        <Text style={[styles.filterOptionText, filters.state_id === state.id && styles.filterOptionTextSelected]}>
                          {state.name}
                        </Text>
                      </View>
                      {filters.state_id === state.id && <Ionicons name="checkmark" size={20} color="#1A237E" />}
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
              <Text style={styles.filterLabel}>Priority</Text>
            </View>
            <View style={styles.filterHeaderRight}>
              <Text style={[styles.filterValue, filters.priority && styles.filterValueActive]}>
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
                style={[styles.filterOption, !filters.priority && styles.filterOptionSelected]}
                onPress={() => setFilters({ ...filters, priority: null })}
              >
                <Text style={[styles.filterOptionText, !filters.priority && styles.filterOptionTextSelected]}>
                  All Priorities
                </Text>
                {!filters.priority && <Ionicons name="checkmark" size={20} color="#1A237E" />}
              </TouchableOpacity>
              {priorities.map((priority) => (
                <TouchableOpacity
                  key={priority.value}
                  style={[styles.filterOption, filters.priority === priority.value && styles.filterOptionSelected]}
                  onPress={() => selectPriority(priority.value)}
                >
                  <View style={styles.priorityOption}>
                    <View style={[styles.priorityDot, { backgroundColor: priority.color }]} />
                    <Text style={[styles.filterOptionText, filters.priority === priority.value && styles.filterOptionTextSelected]}>
                      {priority.label}
                    </Text>
                  </View>
                  {filters.priority === priority.value && <Ionicons name="checkmark" size={20} color="#1A237E" />}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Severity Filter */}
        <View style={styles.filterSection}>
          <TouchableOpacity
            style={styles.filterHeader}
            onPress={() => toggleSection('severity')}
          >
            <View style={styles.filterHeaderLeft}>
              <Ionicons name="warning-outline" size={20} color="#1A237E" />
              <Text style={styles.filterLabel}>Severity</Text>
            </View>
            <View style={styles.filterHeaderRight}>
              <Text style={[styles.filterValue, filters.severity && styles.filterValueActive]}>
                {getSelectedSeverityLabel()}
              </Text>
              <Ionicons
                name={expandedSection === 'severity' ? 'chevron-up' : 'chevron-down'}
                size={20}
                color="#666"
              />
            </View>
          </TouchableOpacity>

          {expandedSection === 'severity' && (
            <View style={styles.filterOptions}>
              <TouchableOpacity
                style={[styles.filterOption, !filters.severity && styles.filterOptionSelected]}
                onPress={() => setFilters({ ...filters, severity: null })}
              >
                <Text style={[styles.filterOptionText, !filters.severity && styles.filterOptionTextSelected]}>
                  All Severities
                </Text>
                {!filters.severity && <Ionicons name="checkmark" size={20} color="#1A237E" />}
              </TouchableOpacity>
              {severities.map((severity) => (
                <TouchableOpacity
                  key={severity.value}
                  style={[styles.filterOption, filters.severity === severity.value && styles.filterOptionSelected]}
                  onPress={() => selectSeverity(severity.value)}
                >
                  <View style={styles.priorityOption}>
                    <View style={[styles.priorityDot, { backgroundColor: severity.color }]} />
                    <Text style={[styles.filterOptionText, filters.severity === severity.value && styles.filterOptionTextSelected]}>
                      {severity.label}
                    </Text>
                  </View>
                  {filters.severity === severity.value && <Ionicons name="checkmark" size={20} color="#1A237E" />}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Classification Filter */}
        <View style={styles.filterSection}>
          <TouchableOpacity
            style={styles.filterHeader}
            onPress={() => toggleSection('classification')}
          >
            <View style={styles.filterHeaderLeft}>
              <Ionicons name="folder-outline" size={20} color="#1A237E" />
              <Text style={styles.filterLabel}>Classification</Text>
            </View>
            <View style={styles.filterHeaderRight}>
              <Text style={[styles.filterValue, filters.classification_id && styles.filterValueActive]}>
                {getSelectedClassificationName()}
              </Text>
              <Ionicons
                name={expandedSection === 'classification' ? 'chevron-up' : 'chevron-down'}
                size={20}
                color="#666"
              />
            </View>
          </TouchableOpacity>

          {expandedSection === 'classification' && (
            <View style={styles.filterOptions}>
              {loadingClassifications ? (
                <ActivityIndicator size="small" color="#1A237E" />
              ) : (
                <>
                  <TouchableOpacity
                    style={[styles.filterOption, !filters.classification_id && styles.filterOptionSelected]}
                    onPress={() => setFilters({ ...filters, classification_id: null, classification_name: null })}
                  >
                    <Text style={[styles.filterOptionText, !filters.classification_id && styles.filterOptionTextSelected]}>
                      All Classifications
                    </Text>
                    {!filters.classification_id && <Ionicons name="checkmark" size={20} color="#1A237E" />}
                  </TouchableOpacity>
                  {classifications.map((classification) => (
                    <TouchableOpacity
                      key={classification.id}
                      style={[styles.filterOption, filters.classification_id === classification.id && styles.filterOptionSelected]}
                      onPress={() => selectClassification(classification)}
                    >
                      <Text style={[styles.filterOptionText, filters.classification_id === classification.id && styles.filterOptionTextSelected]}>
                        {classification.name}
                      </Text>
                      {filters.classification_id === classification.id && <Ionicons name="checkmark" size={20} color="#1A237E" />}
                    </TouchableOpacity>
                  ))}
                </>
              )}
            </View>
          )}
        </View>

        {/* Location Filter */}
        <View style={styles.filterSection}>
          <TouchableOpacity
            style={styles.filterHeader}
            onPress={() => toggleSection('location')}
          >
            <View style={styles.filterHeaderLeft}>
              <Ionicons name="location-outline" size={20} color="#1A237E" />
              <Text style={styles.filterLabel}>Location</Text>
            </View>
            <View style={styles.filterHeaderRight}>
              <Text style={[styles.filterValue, filters.location_id && styles.filterValueActive]}>
                {getSelectedLocationName()}
              </Text>
              <Ionicons
                name={expandedSection === 'location' ? 'chevron-up' : 'chevron-down'}
                size={20}
                color="#666"
              />
            </View>
          </TouchableOpacity>

          {expandedSection === 'location' && (
            <View style={styles.filterOptions}>
              {loadingLocations ? (
                <ActivityIndicator size="small" color="#1A237E" />
              ) : (
                <>
                  <TouchableOpacity
                    style={[styles.filterOption, !filters.location_id && styles.filterOptionSelected]}
                    onPress={() => setFilters({ ...filters, location_id: null, location_name: null })}
                  >
                    <Text style={[styles.filterOptionText, !filters.location_id && styles.filterOptionTextSelected]}>
                      All Locations
                    </Text>
                    {!filters.location_id && <Ionicons name="checkmark" size={20} color="#1A237E" />}
                  </TouchableOpacity>
                  {locations.map((location) => (
                    <TouchableOpacity
                      key={location.id}
                      style={[styles.filterOption, filters.location_id === location.id && styles.filterOptionSelected]}
                      onPress={() => selectLocation(location)}
                    >
                      <Text style={[styles.filterOptionText, filters.location_id === location.id && styles.filterOptionTextSelected]}>
                        {location.name}
                      </Text>
                      {filters.location_id === location.id && <Ionicons name="checkmark" size={20} color="#1A237E" />}
                    </TouchableOpacity>
                  ))}
                </>
              )}
            </View>
          )}
        </View>

        {/* Assignee Filter */}
        <View style={styles.filterSection}>
          <TouchableOpacity
            style={styles.filterHeader}
            onPress={() => toggleSection('assignee')}
          >
            <View style={styles.filterHeaderLeft}>
              <Ionicons name="person-outline" size={20} color="#1A237E" />
              <Text style={styles.filterLabel}>Assignee</Text>
            </View>
            <View style={styles.filterHeaderRight}>
              <Text style={[styles.filterValue, filters.assignee_id && styles.filterValueActive]}>
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
                    style={[styles.filterOption, !filters.assignee_id && styles.filterOptionSelected]}
                    onPress={() => setFilters({ ...filters, assignee_id: null, assignee_name: null })}
                  >
                    <Text style={[styles.filterOptionText, !filters.assignee_id && styles.filterOptionTextSelected]}>
                      All Assignees
                    </Text>
                    {!filters.assignee_id && <Ionicons name="checkmark" size={20} color="#1A237E" />}
                  </TouchableOpacity>
                  {users.map((user) => (
                    <TouchableOpacity
                      key={user.id}
                      style={[styles.filterOption, filters.assignee_id === user.id && styles.filterOptionSelected]}
                      onPress={() => selectAssignee(user)}
                    >
                      <View style={styles.stateOption}>
                        <View style={styles.userAvatar}>
                          <Text style={styles.userAvatarText}>
                            {user.first_name?.charAt(0)}{user.last_name?.charAt(0)}
                          </Text>
                        </View>
                        <Text style={[styles.filterOptionText, filters.assignee_id === user.id && styles.filterOptionTextSelected]}>
                          {user.first_name} {user.last_name}
                        </Text>
                      </View>
                      {filters.assignee_id === user.id && <Ionicons name="checkmark" size={20} color="#1A237E" />}
                    </TouchableOpacity>
                  ))}
                </>
              )}
            </View>
          )}
        </View>

        {/* Department Filter */}
        <View style={styles.filterSection}>
          <TouchableOpacity
            style={styles.filterHeader}
            onPress={() => toggleSection('department')}
          >
            <View style={styles.filterHeaderLeft}>
              <Ionicons name="business-outline" size={20} color="#1A237E" />
              <Text style={styles.filterLabel}>Department</Text>
            </View>
            <View style={styles.filterHeaderRight}>
              <Text style={[styles.filterValue, filters.department_id && styles.filterValueActive]}>
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
                    style={[styles.filterOption, !filters.department_id && styles.filterOptionSelected]}
                    onPress={() => setFilters({ ...filters, department_id: null, department_name: null })}
                  >
                    <Text style={[styles.filterOptionText, !filters.department_id && styles.filterOptionTextSelected]}>
                      All Departments
                    </Text>
                    {!filters.department_id && <Ionicons name="checkmark" size={20} color="#1A237E" />}
                  </TouchableOpacity>
                  {departments.map((department) => (
                    <TouchableOpacity
                      key={department.id}
                      style={[styles.filterOption, filters.department_id === department.id && styles.filterOptionSelected]}
                      onPress={() => selectDepartment(department)}
                    >
                      <Text style={[styles.filterOptionText, filters.department_id === department.id && styles.filterOptionTextSelected]}>
                        {department.name}
                      </Text>
                      {filters.department_id === department.id && <Ionicons name="checkmark" size={20} color="#1A237E" />}
                    </TouchableOpacity>
                  ))}
                </>
              )}
            </View>
          )}
        </View>

        {/* SLA Status Filter */}
        <View style={styles.filterSection}>
          <TouchableOpacity
            style={styles.filterHeader}
            onPress={() => toggleSection('sla_status')}
          >
            <View style={styles.filterHeaderLeft}>
              <Ionicons name="time-outline" size={20} color="#1A237E" />
              <Text style={styles.filterLabel}>SLA Status</Text>
            </View>
            <View style={styles.filterHeaderRight}>
              <Text style={[styles.filterValue, filters.sla_status && styles.filterValueActive]}>
                {getSelectedSlaStatusLabel()}
              </Text>
              <Ionicons
                name={expandedSection === 'sla_status' ? 'chevron-up' : 'chevron-down'}
                size={20}
                color="#666"
              />
            </View>
          </TouchableOpacity>

          {expandedSection === 'sla_status' && (
            <View style={styles.filterOptions}>
              <TouchableOpacity
                style={[styles.filterOption, !filters.sla_status && styles.filterOptionSelected]}
                onPress={() => setFilters({ ...filters, sla_status: null })}
              >
                <Text style={[styles.filterOptionText, !filters.sla_status && styles.filterOptionTextSelected]}>
                  All SLA Statuses
                </Text>
                {!filters.sla_status && <Ionicons name="checkmark" size={20} color="#1A237E" />}
              </TouchableOpacity>
              {slaStatuses.map((status) => (
                <TouchableOpacity
                  key={status.value}
                  style={[styles.filterOption, filters.sla_status === status.value && styles.filterOptionSelected]}
                  onPress={() => selectSlaStatus(status.value)}
                >
                  <View style={styles.priorityOption}>
                    <View style={[styles.priorityDot, { backgroundColor: status.color }]} />
                    <Text style={[styles.filterOptionText, filters.sla_status === status.value && styles.filterOptionTextSelected]}>
                      {status.label}
                    </Text>
                  </View>
                  {filters.sla_status === status.value && <Ionicons name="checkmark" size={20} color="#1A237E" />}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Add some bottom padding for scroll */}
        <View style={{ height: 20 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.resetButton, !hasActiveFilters && styles.resetButtonDisabled]}
          onPress={resetFilters}
          disabled={!hasActiveFilters}
        >
          <Text style={[styles.resetButtonText, !hasActiveFilters && styles.resetButtonTextDisabled]}>
            Reset
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.filterButton} onPress={applyFilters}>
          <Text style={styles.filterButtonText}>APPLY FILTERS</Text>
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
    padding: 15,
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
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: '#EEE',
    gap: 10,
  },
  resetButton: {
    flex: 1,
    padding: 15,
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
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  filterButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
});

export default FilterScreen;
