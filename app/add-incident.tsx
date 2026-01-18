import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import { createIncident } from '@/src/api/incidents';
import { getClassifications } from '@/src/api/classifications';
import { getLocations } from '@/src/api/locations';
import { getWorkflows } from '@/src/api/workflow';
import { getUsers } from '@/src/api/users';
import { getDepartments } from '@/src/api/departments';

interface DropdownOption {
  id: string;
  name: string;
}

interface Workflow {
  id: string;
  name: string;
  is_active: boolean;
  required_fields?: string[];
  classifications?: { id: string; name: string }[];
  locations?: { id: string; name: string }[];
  sources?: string[];
  severity_min?: number;
  severity_max?: number;
  priority_min?: number;
  priority_max?: number;
}

interface DropdownProps {
  label: string;
  value: string;
  options: DropdownOption[];
  onSelect: (option: DropdownOption | null) => void;
  loading?: boolean;
  required?: boolean;
  error?: string;
  allowClear?: boolean;
}

const Dropdown: React.FC<DropdownProps> = ({
  label,
  value,
  options,
  onSelect,
  loading,
  required,
  error,
  allowClear = true
}) => {
  const [modalVisible, setModalVisible] = useState(false);

  return (
    <>
      <TouchableOpacity
        style={[styles.dropdown, error && styles.dropdownError]}
        onPress={() => setModalVisible(true)}
      >
        <Text style={[styles.dropdownText, !value && styles.placeholderText]}>
          {value || label}
        </Text>
        {loading ? (
          <ActivityIndicator size="small" color="#666" />
        ) : (
          <FontAwesome name="chevron-down" size={16} color="#666" />
        )}
      </TouchableOpacity>
      {error && <Text style={styles.errorText}>{error}</Text>}

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{label}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            {allowClear && value && (
              <TouchableOpacity
                style={styles.clearOption}
                onPress={() => {
                  onSelect(null);
                  setModalVisible(false);
                }}
              >
                <Text style={styles.clearOptionText}>Clear selection</Text>
                <Ionicons name="close-circle" size={20} color="#E74C3C" />
              </TouchableOpacity>
            )}

            {options.length === 0 ? (
              <View style={styles.emptyList}>
                <Text style={styles.emptyText}>No options available</Text>
              </View>
            ) : (
              <FlatList
                data={options}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.optionItem}
                    onPress={() => {
                      onSelect(item);
                      setModalVisible(false);
                    }}
                  >
                    <Text style={styles.optionText}>{item.name}</Text>
                    {value === item.name && (
                      <Ionicons name="checkmark" size={20} color="#2EC4B6" />
                    )}
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const priorityOptions: DropdownOption[] = [
  { id: '1', name: 'Critical' },
  { id: '2', name: 'High' },
  { id: '3', name: 'Medium' },
  { id: '4', name: 'Low' },
  { id: '5', name: 'Very Low' },
];

const severityOptions: DropdownOption[] = [
  { id: '1', name: 'Critical' },
  { id: '2', name: 'Major' },
  { id: '3', name: 'Moderate' },
  { id: '4', name: 'Minor' },
  { id: '5', name: 'Cosmetic' },
];

const sourceOptions: DropdownOption[] = [
  { id: 'web', name: 'Web Portal' },
  { id: 'mobile', name: 'Mobile App' },
  { id: 'email', name: 'Email' },
  { id: 'phone', name: 'Phone' },
  { id: 'walk_in', name: 'Walk-in' },
  { id: 'api', name: 'API' },
  { id: 'social_media', name: 'Social Media' },
  { id: 'other', name: 'Other' },
];

// Workflow matching function (same logic as frontend)
const findMatchingWorkflow = (
  workflows: Workflow[],
  criteria: {
    classification_id?: string;
    location_id?: string;
    source?: string;
    severity?: number;
    priority?: number;
  }
): Workflow | null => {
  const activeWorkflows = workflows.filter(w => w.is_active);
  let bestMatch: { workflow: Workflow; score: number } | null = null;

  for (const workflow of activeWorkflows) {
    let score = 0;

    // Check classification match
    if (criteria.classification_id && workflow.classifications?.length) {
      if (workflow.classifications.some(c => c.id === criteria.classification_id)) {
        score += 10;
      }
    }

    // Check location match
    if (criteria.location_id && workflow.locations?.length) {
      if (workflow.locations.some(l => l.id === criteria.location_id)) {
        score += 10;
      }
    }

    // Check source match
    if (criteria.source && workflow.sources?.length) {
      if (workflow.sources.includes(criteria.source)) {
        score += 10;
      }
    }

    // Check severity range
    if (criteria.severity !== undefined) {
      const minSev = workflow.severity_min ?? 1;
      const maxSev = workflow.severity_max ?? 5;
      if (criteria.severity >= minSev && criteria.severity <= maxSev) {
        score += 5;
      }
    }

    // Check priority range
    if (criteria.priority !== undefined) {
      const minPri = workflow.priority_min ?? 1;
      const maxPri = workflow.priority_max ?? 5;
      if (criteria.priority >= minPri && criteria.priority <= maxPri) {
        score += 5;
      }
    }

    // If workflow has no restrictions, give it a base score
    if (!workflow.classifications?.length && !workflow.locations?.length && !workflow.sources?.length) {
      score += 1; // Default/catch-all workflow
    }

    if (score > 0 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { workflow, score };
    }
  }

  return bestMatch?.workflow || null;
};

const AddIncidentScreen = () => {
  const router = useRouter();

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [reporterName, setReporterName] = useState('');
  const [reporterEmail, setReporterEmail] = useState('');
  const [selectedClassification, setSelectedClassification] = useState<DropdownOption | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<DropdownOption | null>(null);
  const [selectedSource, setSelectedSource] = useState<DropdownOption | null>(null);
  const [selectedAssignee, setSelectedAssignee] = useState<DropdownOption | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<DropdownOption | null>(null);
  const [selectedPriority, setSelectedPriority] = useState<DropdownOption>(priorityOptions[2]); // Medium
  const [selectedSeverity, setSelectedSeverity] = useState<DropdownOption>(severityOptions[2]); // Moderate

  // Workflow state
  const [matchedWorkflow, setMatchedWorkflow] = useState<Workflow | null>(null);
  const [allWorkflows, setAllWorkflows] = useState<Workflow[]>([]);

  // Data state
  const [classifications, setClassifications] = useState<DropdownOption[]>([]);
  const [locations, setLocations] = useState<DropdownOption[]>([]);
  const [users, setUsers] = useState<DropdownOption[]>([]);
  const [departments, setDepartments] = useState<DropdownOption[]>([]);

  // Loading state
  const [loadingData, setLoadingData] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch all data on mount
  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoadingData(true);
    try {
      const [classRes, locRes, workflowRes, userRes, deptRes] = await Promise.all([
        getClassifications(),
        getLocations(),
        getWorkflows(true),
        getUsers(),
        getDepartments(),
      ]);

      if (classRes.success && classRes.data) {
        setClassifications(classRes.data.map((c: any) => ({ id: c.id, name: c.name })));
      }
      if (locRes.success && locRes.data) {
        setLocations(locRes.data.map((l: any) => ({ id: l.id, name: l.name })));
      }
      if (workflowRes.success && workflowRes.data) {
        setAllWorkflows(workflowRes.data);
      }
      if (userRes.success && userRes.data) {
        setUsers(userRes.data.map((u: any) => ({
          id: u.id,
          name: `${u.first_name} ${u.last_name}`.trim() || u.email
        })));
      }
      if (deptRes.success && deptRes.data) {
        setDepartments(deptRes.data.map((d: any) => ({ id: d.id, name: d.name })));
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
    setLoadingData(false);
  };

  // Auto-match workflow when criteria change
  const matchWorkflow = useCallback(() => {
    if (allWorkflows.length === 0) return;

    const matched = findMatchingWorkflow(allWorkflows, {
      classification_id: selectedClassification?.id,
      location_id: selectedLocation?.id,
      source: selectedSource?.id,
      severity: parseInt(selectedSeverity.id),
      priority: parseInt(selectedPriority.id),
    });

    setMatchedWorkflow(matched);
  }, [
    allWorkflows,
    selectedClassification,
    selectedLocation,
    selectedSource,
    selectedSeverity,
    selectedPriority,
  ]);

  useEffect(() => {
    matchWorkflow();
  }, [matchWorkflow]);

  // Get required fields from matched workflow
  const requiredFields = matchedWorkflow?.required_fields || [];

  const isFieldRequired = (fieldName: string): boolean => {
    return requiredFields.includes(fieldName);
  };

  const fieldLabels: Record<string, string> = {
    description: 'Description',
    classification_id: 'Classification',
    priority: 'Priority',
    severity: 'Severity',
    source: 'Source',
    assignee_id: 'Assignee',
    department_id: 'Department',
    location_id: 'Location',
    reporter_name: 'Reporter Name',
    reporter_email: 'Reporter Email',
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!matchedWorkflow) {
      newErrors.workflow = 'Please select classification, location, or source to match a workflow';
    }

    // Validate workflow-specific required fields
    for (const field of requiredFields) {
      let value: any;
      switch (field) {
        case 'description':
          value = description;
          break;
        case 'classification_id':
          value = selectedClassification?.id;
          break;
        case 'location_id':
          value = selectedLocation?.id;
          break;
        case 'source':
          value = selectedSource?.id;
          break;
        case 'assignee_id':
          value = selectedAssignee?.id;
          break;
        case 'department_id':
          value = selectedDepartment?.id;
          break;
        case 'reporter_name':
          value = reporterName;
          break;
        case 'reporter_email':
          value = reporterEmail;
          break;
      }

      if (!value || (typeof value === 'string' && !value.trim())) {
        newErrors[field] = `${fieldLabels[field] || field} is required`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) {
      // Show first error
      const firstError = Object.values(errors)[0];
      if (firstError) {
        Alert.alert('Validation Error', firstError);
      }
      return;
    }

    setSubmitting(true);

    const incidentData: any = {
      title: title.trim(),
      workflow_id: matchedWorkflow!.id,
      priority: parseInt(selectedPriority.id),
      severity: parseInt(selectedSeverity.id),
    };

    if (description.trim()) incidentData.description = description.trim();
    if (selectedClassification) incidentData.classification_id = selectedClassification.id;
    if (selectedLocation) incidentData.location_id = selectedLocation.id;
    if (selectedSource) incidentData.source = selectedSource.id;
    if (selectedAssignee) incidentData.assignee_id = selectedAssignee.id;
    if (selectedDepartment) incidentData.department_id = selectedDepartment.id;
    if (reporterName.trim()) incidentData.reporter_name = reporterName.trim();
    if (reporterEmail.trim()) incidentData.reporter_email = reporterEmail.trim();

    const response = await createIncident(incidentData);
    setSubmitting(false);

    if (response.success) {
      Alert.alert('Success', 'Incident created successfully.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } else {
      Alert.alert('Error', `Failed to create incident: ${response.error}`);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Add Incident</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close-circle" size={28} color="#E74C3C" />
        </TouchableOpacity>
      </View>

      {loadingData ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2EC4B6" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : (
        <>
          <ScrollView style={styles.formContainer} showsVerticalScrollIndicator={false}>
            {/* Auto-matched Workflow Display */}
            <View style={styles.workflowCard}>
              <View style={styles.workflowHeader}>
                <Ionicons name="git-branch" size={20} color="#2EC4B6" />
                <Text style={styles.workflowLabel}>Workflow</Text>
              </View>
              {matchedWorkflow ? (
                <View style={styles.workflowMatched}>
                  <Ionicons name="checkmark-circle" size={18} color="#27AE60" />
                  <Text style={styles.workflowName}>{matchedWorkflow.name}</Text>
                </View>
              ) : (
                <Text style={styles.workflowHint}>
                  Select classification, location, or source to auto-match a workflow
                </Text>
              )}
              {errors.workflow && <Text style={styles.errorText}>{errors.workflow}</Text>}
            </View>

            {/* Title */}
            <Text style={styles.sectionTitle}>
              Title <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, errors.title && styles.inputError]}
              placeholder="A brief title for the incident"
              value={title}
              onChangeText={(text) => {
                setTitle(text);
                if (errors.title) setErrors(prev => ({ ...prev, title: '' }));
              }}
              placeholderTextColor="#999"
            />
            {errors.title && <Text style={styles.errorText}>{errors.title}</Text>}

            {/* Classification */}
            <Text style={styles.sectionTitle}>
              Classification {isFieldRequired('classification_id') && <Text style={styles.required}>*</Text>}
            </Text>
            <Dropdown
              label="Select classification"
              value={selectedClassification?.name || ''}
              options={classifications}
              onSelect={setSelectedClassification}
              required={isFieldRequired('classification_id')}
              error={errors.classification_id}
            />

            {/* Location */}
            <Text style={styles.sectionTitle}>
              Location {isFieldRequired('location_id') && <Text style={styles.required}>*</Text>}
            </Text>
            <Dropdown
              label="Select location"
              value={selectedLocation?.name || ''}
              options={locations}
              onSelect={setSelectedLocation}
              required={isFieldRequired('location_id')}
              error={errors.location_id}
            />

            {/* Source */}
            <Text style={styles.sectionTitle}>
              Source {isFieldRequired('source') && <Text style={styles.required}>*</Text>}
            </Text>
            <Dropdown
              label="Select source"
              value={selectedSource?.name || ''}
              options={sourceOptions}
              onSelect={setSelectedSource}
              required={isFieldRequired('source')}
              error={errors.source}
            />

            {/* Priority & Severity */}
            <View style={styles.row}>
              <View style={styles.halfWidth}>
                <Text style={styles.sectionTitle}>Priority</Text>
                <Dropdown
                  label="Select priority"
                  value={selectedPriority.name}
                  options={priorityOptions}
                  onSelect={(opt) => opt && setSelectedPriority(opt)}
                  allowClear={false}
                />
              </View>
              <View style={styles.halfWidth}>
                <Text style={styles.sectionTitle}>Severity</Text>
                <Dropdown
                  label="Select severity"
                  value={selectedSeverity.name}
                  options={severityOptions}
                  onSelect={(opt) => opt && setSelectedSeverity(opt)}
                  allowClear={false}
                />
              </View>
            </View>

            {/* Assignee */}
            <Text style={styles.sectionTitle}>
              Assignee {isFieldRequired('assignee_id') && <Text style={styles.required}>*</Text>}
            </Text>
            <Dropdown
              label="Select assignee"
              value={selectedAssignee?.name || ''}
              options={users}
              onSelect={setSelectedAssignee}
              required={isFieldRequired('assignee_id')}
              error={errors.assignee_id}
            />

            {/* Department */}
            <Text style={styles.sectionTitle}>
              Department {isFieldRequired('department_id') && <Text style={styles.required}>*</Text>}
            </Text>
            <Dropdown
              label="Select department"
              value={selectedDepartment?.name || ''}
              options={departments}
              onSelect={setSelectedDepartment}
              required={isFieldRequired('department_id')}
              error={errors.department_id}
            />

            {/* Description */}
            <Text style={styles.sectionTitle}>
              Description {isFieldRequired('description') && <Text style={styles.required}>*</Text>}
            </Text>
            <TextInput
              style={[styles.descriptionInput, errors.description && styles.inputError]}
              placeholder="Describe the incident in detail..."
              multiline
              value={description}
              onChangeText={(text) => {
                setDescription(text);
                if (errors.description) setErrors(prev => ({ ...prev, description: '' }));
              }}
              placeholderTextColor="#999"
              textAlignVertical="top"
            />
            {errors.description && <Text style={styles.errorText}>{errors.description}</Text>}

            {/* Reporter Info */}
            <Text style={styles.sectionTitle}>
              Reporter Name {isFieldRequired('reporter_name') && <Text style={styles.required}>*</Text>}
            </Text>
            <TextInput
              style={[styles.input, errors.reporter_name && styles.inputError]}
              placeholder="Reporter's name"
              value={reporterName}
              onChangeText={(text) => {
                setReporterName(text);
                if (errors.reporter_name) setErrors(prev => ({ ...prev, reporter_name: '' }));
              }}
              placeholderTextColor="#999"
            />
            {errors.reporter_name && <Text style={styles.errorText}>{errors.reporter_name}</Text>}

            <Text style={styles.sectionTitle}>
              Reporter Email {isFieldRequired('reporter_email') && <Text style={styles.required}>*</Text>}
            </Text>
            <TextInput
              style={[styles.input, errors.reporter_email && styles.inputError]}
              placeholder="Reporter's email"
              value={reporterEmail}
              onChangeText={(text) => {
                setReporterEmail(text);
                if (errors.reporter_email) setErrors(prev => ({ ...prev, reporter_email: '' }));
              }}
              placeholderTextColor="#999"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            {errors.reporter_email && <Text style={styles.errorText}>{errors.reporter_email}</Text>}

            <View style={styles.bottomPadding} />
          </ScrollView>

          <View style={styles.submitContainer}>
            <TouchableOpacity
              style={[styles.submitButton, submitting && styles.disabledButton]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>CREATE INCIDENT</Text>
              )}
            </TouchableOpacity>
          </View>
        </>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 50,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontSize: 16,
  },
  formContainer: {
    flex: 1,
    padding: 20,
  },
  workflowCard: {
    backgroundColor: '#E8F8F7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2EC4B6',
  },
  workflowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  workflowLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2EC4B6',
    marginLeft: 8,
  },
  workflowMatched: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  workflowName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  workflowHint: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  required: {
    color: '#E74C3C',
  },
  input: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    color: '#333',
  },
  inputError: {
    borderColor: '#E74C3C',
  },
  dropdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  dropdownError: {
    borderColor: '#E74C3C',
  },
  dropdownText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  placeholderText: {
    color: '#999',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfWidth: {
    width: '48%',
  },
  descriptionInput: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    height: 120,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    color: '#333',
  },
  bottomPadding: {
    height: 100,
  },
  submitContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#EEE',
  },
  submitButton: {
    backgroundColor: '#2EC4B6',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#A0A0A0',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorText: {
    color: '#E74C3C',
    fontSize: 12,
    marginTop: -16,
    marginBottom: 16,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  clearOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    backgroundColor: '#FFF5F5',
  },
  clearOptionText: {
    fontSize: 16,
    color: '#E74C3C',
  },
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  optionText: {
    fontSize: 16,
    color: '#333',
  },
  emptyList: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#999',
    fontSize: 16,
  },
});

export default AddIncidentScreen;
