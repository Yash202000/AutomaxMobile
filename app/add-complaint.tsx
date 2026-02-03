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
import { Audio } from 'expo-av';
import { createComplaint, uploadMultipleComplaintAttachments } from '@/src/api/incidents';
import { getClassifications } from '@/src/api/classifications';
import { getLocations } from '@/src/api/locations';
import { getWorkflows } from '@/src/api/workflow';
import { getUsers } from '@/src/api/users';
import { getDepartments } from '@/src/api/departments';
import { getLookupCategories, LookupCategory, LookupValue } from '@/src/api/lookups';

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
                      <Ionicons name="checkmark" size={20} color="#E74C3C" />
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

const channelOptions: DropdownOption[] = [
  { id: 'phone', name: 'Phone' },
  { id: 'email', name: 'Email' },
  { id: 'web', name: 'Web Portal' },
  { id: 'mobile', name: 'Mobile App' },
  { id: 'social_media', name: 'Social Media' },
  { id: 'in_person', name: 'In Person' },
  { id: 'other', name: 'Other' },
];

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

    if (criteria.classification_id && workflow.classifications?.length) {
      if (workflow.classifications.some(c => c.id === criteria.classification_id)) {
        score += 10;
      }
    }

    if (criteria.location_id && workflow.locations?.length) {
      if (workflow.locations.some(l => l.id === criteria.location_id)) {
        score += 10;
      }
    }

    if (criteria.source && workflow.sources?.length) {
      if (workflow.sources.includes(criteria.source)) {
        score += 10;
      }
    }

    if (criteria.severity !== undefined) {
      const minSev = workflow.severity_min ?? 1;
      const maxSev = workflow.severity_max ?? 5;
      if (criteria.severity >= minSev && criteria.severity <= maxSev) {
        score += 5;
      }
    }

    if (criteria.priority !== undefined) {
      const minPri = workflow.priority_min ?? 1;
      const maxPri = workflow.priority_max ?? 5;
      if (criteria.priority >= minPri && criteria.priority <= maxPri) {
        score += 5;
      }
    }

    if (!workflow.classifications?.length && !workflow.locations?.length && !workflow.sources?.length) {
      score += 1;
    }

    if (score > 0 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { workflow, score };
    }
  }

  return bestMatch?.workflow || null;
};

const AddComplaintScreen = () => {
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [reporterName, setReporterName] = useState('');
  const [reporterEmail, setReporterEmail] = useState('');
  const [selectedClassification, setSelectedClassification] = useState<DropdownOption | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<DropdownOption | null>(null);
  const [selectedSource, setSelectedSource] = useState<DropdownOption | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<DropdownOption | null>(null);
  const [selectedAssignee, setSelectedAssignee] = useState<DropdownOption | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<DropdownOption | null>(null);
  const [selectedPriority, setSelectedPriority] = useState<DropdownOption>(priorityOptions[2]);
  const [selectedSeverity, setSelectedSeverity] = useState<DropdownOption>(severityOptions[2]);

  const [matchedWorkflow, setMatchedWorkflow] = useState<Workflow | null>(null);
  const [allWorkflows, setAllWorkflows] = useState<Workflow[]>([]);

  const [classifications, setClassifications] = useState<DropdownOption[]>([]);
  const [locations, setLocations] = useState<DropdownOption[]>([]);
  const [users, setUsers] = useState<DropdownOption[]>([]);
  const [departments, setDepartments] = useState<DropdownOption[]>([]);
  const [lookupCategories, setLookupCategories] = useState<LookupCategory[]>([]);
  const [lookupValues, setLookupValues] = useState<Record<string, string>>({});

  const [loadingData, setLoadingData] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Voice recording state
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioFiles, setAudioFiles] = useState<{ uri: string; duration: number }[]>([]);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoadingData(true);
    try {
      const [classRes, locRes, workflowRes, userRes, deptRes, lookupRes] = await Promise.all([
        getClassifications(),
        getLocations(),
        getWorkflows(true, 'complaint'),
        getUsers(),
        getDepartments(),
        getLookupCategories().catch(err => ({ success: false, error: err.message })),
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
      if (lookupRes.success && lookupRes.data) {
        // Filter to only show categories that should be added to complaint form
        const complaintCategories = lookupRes.data.filter((cat: LookupCategory) => cat.add_to_incident_form && cat.is_active);
        setLookupCategories(complaintCategories);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
    setLoadingData(false);
  };

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
    channel: 'Channel',
    assignee_id: 'Assignee',
    department_id: 'Department',
    location_id: 'Location',
    reporter_name: 'Reporter Name',
    reporter_email: 'Reporter Email',
    attachments: 'Voice Recording',
    attachment: 'Voice Recording',
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!matchedWorkflow) {
      newErrors.workflow = 'Please select classification, location, or source to match a workflow';
    }

    for (const field of requiredFields) {
      // Check for lookup field requirements (format: lookup:CATEGORY_CODE)
      if (field.startsWith('lookup:')) {
        const categoryCode = field.replace('lookup:', '');
        const category = lookupCategories.find(c => c.code === categoryCode);
        if (category && !lookupValues[category.id]) {
          newErrors[field] = `${category.name} is required`;
        }
        continue;
      }

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
        case 'channel':
          value = selectedChannel?.id;
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
        case 'attachments':
        case 'attachment':
          value = audioFiles.length > 0;
          break;
      }

      if (!value || (typeof value === 'string' && !value.trim())) {
        newErrors[field] = `${fieldLabels[field] || field} is required`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Voice recording functions
  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Required', 'Please allow microphone access to record audio');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(newRecording);
      setRecordingDuration(0);

      // Update duration every second
      const interval = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

      // Store interval ID in recording object for cleanup
      (newRecording as any)._interval = interval;
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Error', 'Failed to start recording');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    try {
      // Clear interval
      if ((recording as any)._interval) {
        clearInterval((recording as any)._interval);
      }

      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();

      if (uri) {
        setAudioFiles(prev => [...prev, { uri, duration: recordingDuration }]);
      }

      setRecording(null);
      setRecordingDuration(0);
    } catch (error) {
      console.error('Failed to stop recording:', error);
      Alert.alert('Error', 'Failed to stop recording');
    }
  };

  const removeAudio = (index: number) => {
    setAudioFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleLookupChange = (categoryId: string, valueId: string) => {
    setLookupValues(prev => {
      if (!valueId) {
        const newValues = { ...prev };
        delete newValues[categoryId];
        return newValues;
      }
      return { ...prev, [categoryId]: valueId };
    });

    // Clear error for this lookup field if it exists
    const category = lookupCategories.find(c => c.id === categoryId);
    if (category) {
      const errorKey = `lookup:${category.code}`;
      if (errors[errorKey]) {
        setErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[errorKey];
          return newErrors;
        });
      }
    }
  };

  const handleSubmit = async () => {
    if (!validate()) {
      const firstError = Object.values(errors)[0];
      if (firstError) {
        Alert.alert('Validation Error', firstError);
      }
      return;
    }

    setSubmitting(true);

    const complaintData: any = {
      title: title.trim(),
      workflow_id: matchedWorkflow!.id,
    };

    // Only include priority and severity if they're required
    if (isFieldRequired('priority')) {
      complaintData.priority = parseInt(selectedPriority.id);
    }
    if (isFieldRequired('severity')) {
      complaintData.severity = parseInt(selectedSeverity.id);
    }

    if (description.trim()) complaintData.description = description.trim();
    if (selectedClassification) complaintData.classification_id = selectedClassification.id;
    if (selectedLocation) complaintData.location_id = selectedLocation.id;
    if (selectedSource) complaintData.source = selectedSource.id;
    if (selectedChannel) complaintData.channel = selectedChannel.id;
    if (selectedAssignee) complaintData.assignee_id = selectedAssignee.id;
    if (selectedDepartment) complaintData.department_id = selectedDepartment.id;
    if (reporterName.trim()) complaintData.reporter_name = reporterName.trim();
    if (reporterEmail.trim()) complaintData.reporter_email = reporterEmail.trim();

    // Add lookup values if any selected
    const selectedLookupIds = Object.values(lookupValues).filter(Boolean);
    if (selectedLookupIds.length > 0) {
      complaintData.lookup_value_ids = selectedLookupIds;
    }

    const response = await createComplaint(complaintData);

    if (response.success) {
      // Upload audio files if any
      if (audioFiles.length > 0) {
        const complaintId = response.data.id;
        const filesToUpload = audioFiles.map((audio, index) => ({
          uri: audio.uri,
          name: `voice-recording-${Date.now()}-${index}.m4a`,
          type: 'audio/m4a',
        }));

        const uploadResult = await uploadMultipleComplaintAttachments(complaintId, filesToUpload);

        if (!uploadResult.success) {
          console.error('Failed to upload some audio files:', uploadResult.errors);
          // Continue anyway since complaint was created
        }
      }

      setSubmitting(false);
      Alert.alert('Success', 'Complaint created successfully.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } else {
      setSubmitting(false);
      Alert.alert('Error', `Failed to create complaint: ${response.error}`);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Add Complaint</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close-circle" size={28} color="#E74C3C" />
        </TouchableOpacity>
      </View>

      {loadingData ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#E74C3C" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : (
        <>
          <ScrollView style={styles.formContainer} showsVerticalScrollIndicator={false}>
            <View style={styles.workflowCard}>
              <View style={styles.workflowHeader}>
                <Ionicons name="git-branch" size={20} color="#E74C3C" />
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

            <Text style={styles.sectionTitle}>
              Title <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, errors.title && styles.inputError]}
              placeholder="A brief title for the complaint"
              value={title}
              onChangeText={(text) => {
                setTitle(text);
                if (errors.title) setErrors(prev => ({ ...prev, title: '' }));
              }}
              placeholderTextColor="#999"
            />
            {errors.title && <Text style={styles.errorText}>{errors.title}</Text>}

            {isFieldRequired('channel') && (
            <>
            <Text style={styles.sectionTitle}>
              Channel <Text style={styles.required}>*</Text>
            </Text>
            <Dropdown
              label="Select channel"
              value={selectedChannel?.name || ''}
              options={channelOptions}
              onSelect={setSelectedChannel}
              required={true}
              error={errors.channel}
            />
            </>
            )}

            {isFieldRequired('classification_id') && (
            <>
            <Text style={styles.sectionTitle}>
              Classification <Text style={styles.required}>*</Text>
            </Text>
            <Dropdown
              label="Select classification"
              value={selectedClassification?.name || ''}
              options={classifications}
              onSelect={setSelectedClassification}
              required={true}
              error={errors.classification_id}
            />
            </>
            )}

            {isFieldRequired('location_id') && (
            <>
            <Text style={styles.sectionTitle}>
              Location <Text style={styles.required}>*</Text>
            </Text>
            <Dropdown
              label="Select location"
              value={selectedLocation?.name || ''}
              options={locations}
              onSelect={setSelectedLocation}
              required={true}
              error={errors.location_id}
            />
            </>
            )}

            {isFieldRequired('source') && (
            <>
            <Text style={styles.sectionTitle}>
              Source <Text style={styles.required}>*</Text>
            </Text>
            <Dropdown
              label="Select source"
              value={selectedSource?.name || ''}
              options={sourceOptions}
              onSelect={setSelectedSource}
              required={true}
              error={errors.source}
            />
            </>
            )}

            {/* Lookup Fields - Dynamic master data fields */}
            {lookupCategories.map(category => {
              const lookupFieldKey = `lookup:${category.code}`;
              const isRequired = requiredFields.includes(lookupFieldKey);

              // Only show if required by workflow
              if (!isRequired) return null;

              const options = (category.values || [])
                .filter(v => v.is_active)
                .map(v => ({
                  id: v.id,
                  name: v.name
                }));

              return (
                <View key={category.id}>
                  <Text style={styles.sectionTitle}>
                    {category.name} <Text style={styles.required}>*</Text>
                  </Text>
                  <Dropdown
                    label={`Select ${category.name.toLowerCase()}`}
                    value={options.find(opt => opt.id === lookupValues[category.id])?.name || ''}
                    options={options}
                    onSelect={(opt) => handleLookupChange(category.id, opt?.id || '')}
                    required={isRequired}
                    error={errors[lookupFieldKey]}
                  />
                </View>
              );
            })}

            {(isFieldRequired('priority') || isFieldRequired('severity')) && (
            <View style={styles.row}>
              {isFieldRequired('priority') && (
              <View style={isFieldRequired('severity') ? styles.halfWidth : styles.fullWidth}>
                <Text style={styles.sectionTitle}>
                  Priority <Text style={styles.required}>*</Text>
                </Text>
                <Dropdown
                  label="Select priority"
                  value={selectedPriority.name}
                  options={priorityOptions}
                  onSelect={(opt) => opt && setSelectedPriority(opt)}
                  allowClear={false}
                />
              </View>
              )}
              {isFieldRequired('severity') && (
              <View style={isFieldRequired('priority') ? styles.halfWidth : styles.fullWidth}>
                <Text style={styles.sectionTitle}>
                  Severity <Text style={styles.required}>*</Text>
                </Text>
                <Dropdown
                  label="Select severity"
                  value={selectedSeverity.name}
                  options={severityOptions}
                  onSelect={(opt) => opt && setSelectedSeverity(opt)}
                  allowClear={false}
                />
              </View>
              )}
            </View>
            )}

            {isFieldRequired('assignee_id') && (
            <>
            <Text style={styles.sectionTitle}>
              Assignee <Text style={styles.required}>*</Text>
            </Text>
            <Dropdown
              label="Select assignee"
              value={selectedAssignee?.name || ''}
              options={users}
              onSelect={setSelectedAssignee}
              required={true}
              error={errors.assignee_id}
            />
            </>
            )}

            {isFieldRequired('department_id') && (
            <>
            <Text style={styles.sectionTitle}>
              Department <Text style={styles.required}>*</Text>
            </Text>
            <Dropdown
              label="Select department"
              value={selectedDepartment?.name || ''}
              options={departments}
              onSelect={setSelectedDepartment}
              required={true}
              error={errors.department_id}
            />
            </>
            )}

            {isFieldRequired('description') && (
            <>
            <Text style={styles.sectionTitle}>
              Description <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.descriptionInput, errors.description && styles.inputError]}
              placeholder="Describe the complaint in detail..."
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
            </>
            )}

            {isFieldRequired('reporter_name') && (
            <>
            <Text style={styles.sectionTitle}>
              Reporter Name <Text style={styles.required}>*</Text>
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
            </>
            )}

            {isFieldRequired('reporter_email') && (
            <>
            <Text style={styles.sectionTitle}>
              Reporter Email <Text style={styles.required}>*</Text>
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
            </>
            )}

            {/* Voice Recording Section */}
            {(isFieldRequired('attachments') || isFieldRequired('attachment')) && (
            <>
            <Text style={styles.sectionTitle}>
              Voice Recording <Text style={styles.required}>*</Text>
            </Text>

            {/* Recorded Audio Files */}
            {audioFiles.length > 0 && (
              <View style={styles.audioList}>
                {audioFiles.map((audio, index) => (
                  <View key={index} style={styles.audioItem}>
                    <View style={styles.audioInfo}>
                      <Ionicons name="mic" size={20} color="#3B82F6" />
                      <Text style={styles.audioText}>
                        Recording {index + 1} ({formatDuration(audio.duration)})
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => removeAudio(index)}>
                      <Ionicons name="trash-outline" size={20} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* Recording Button */}
            <TouchableOpacity
              style={[
                styles.recordButton,
                recording && styles.recordingButton
              ]}
              onPress={recording ? stopRecording : startRecording}
            >
              {recording ? (
                <>
                  <Ionicons name="stop" size={24} color="#fff" />
                  <Text style={styles.recordButtonText}>
                    Stop Recording ({formatDuration(recordingDuration)})
                  </Text>
                </>
              ) : (
                <>
                  <Ionicons name="mic" size={24} color="#fff" />
                  <Text style={styles.recordButtonText}>Start Recording</Text>
                </>
              )}
            </TouchableOpacity>
            </>
            )}

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
                <Text style={styles.submitButtonText}>CREATE COMPLAINT</Text>
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
    backgroundColor: '#FDEAEA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E74C3C',
  },
  workflowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  workflowLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E74C3C',
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
  fullWidth: {
    width: '100%',
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
    backgroundColor: '#E74C3C',
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
  audioList: {
    marginBottom: 16,
  },
  audioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    marginBottom: 8,
  },
  audioInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  audioText: {
    fontSize: 14,
    color: '#333',
  },
  recordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3B82F6',
    padding: 16,
    borderRadius: 10,
    marginBottom: 16,
  },
  recordingButton: {
    backgroundColor: '#EF4444',
  },
  recordButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AddComplaintScreen;
