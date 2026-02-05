import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Platform,
  ActionSheetIOS
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Audio } from 'expo-av';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { createQuery, getIncidents, uploadMultipleComplaintAttachments } from '@/src/api/incidents';
import { getClassificationsTree } from '@/src/api/classifications';
import { getLocations } from '@/src/api/locations';
import { getWorkflows } from '@/src/api/workflow';
import { getUsers } from '@/src/api/users';
import { getDepartments } from '@/src/api/departments';
import { getLookupCategories, LookupCategory, LookupValue } from '@/src/api/lookups';
import TreeSelect, { TreeNode } from '@/src/components/TreeSelect';
import LocationPicker, { LocationData } from '@/src/components/LocationPickerOSM';
import { WatermarkProcessor, WatermarkData } from '@/src/components/WatermarkProcessor';
import { WatermarkPreview } from '@/src/components/WatermarkPreview';
import { generateWatermarkedFilename, createWatermarkText, WatermarkInfo } from '@/src/utils/watermarkUtils';
import * as FileSystem from 'expo-file-system/legacy';
import { useAuth } from '@/src/context/AuthContext';

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
                      <Ionicons name="checkmark" size={20} color="#3498DB" />
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

const AddQueryScreen = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useAuth();

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
  const [selectedSourceIncident, setSelectedSourceIncident] = useState<DropdownOption | null>(null);
  const [incidentSearch, setIncidentSearch] = useState('');
  const [searchedIncidents, setSearchedIncidents] = useState<DropdownOption[]>([]);
  const [loadingIncidents, setLoadingIncidents] = useState(false);

  // Voice recording state
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);

  // Attachments state (combined files and voice recordings)
  const [attachments, setAttachments] = useState<any[]>([]);
  const [attachmentPickerVisible, setAttachmentPickerVisible] = useState(false);

  // Watermark processing state
  interface PendingWatermark {
    id: string;
    imageUri: string;
    data: WatermarkData;
    originalName: string;
  }
  const [pendingWatermarks, setPendingWatermarks] = useState<PendingWatermark[]>([]);

  // Preview state
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewImageUri, setPreviewImageUri] = useState<string>('');
  const [previewWatermarkData, setPreviewWatermarkData] = useState<WatermarkData>({});
  const [previewPendingWatermark, setPreviewPendingWatermark] = useState<PendingWatermark | null>(null);

  // Monitor pending watermarks
  useEffect(() => {
    console.log('🔄 [Watermark Queue] Current pending watermarks:', pendingWatermarks.length);
    if (pendingWatermarks.length > 0) {
      console.log('🔄 [Watermark Queue] IDs:', pendingWatermarks.map(w => w.id).join(', '));
    }
  }, [pendingWatermarks]);

  // Geolocation state
  const [locationData, setLocationData] = useState<LocationData | undefined>(undefined);
  const locationDataRef = useRef<LocationData | undefined>(undefined);

  // Monitor locationData changes and keep ref in sync
  useEffect(() => {
    console.log('🗺️ [Location State] LocationData changed:', JSON.stringify(locationData, null, 2));
    locationDataRef.current = locationData; // Keep ref updated
  }, [locationData]);

  const [matchedWorkflow, setMatchedWorkflow] = useState<Workflow | null>(null);
  const [allWorkflows, setAllWorkflows] = useState<Workflow[]>([]);

  const [classifications, setClassifications] = useState<TreeNode[]>([]);
  const [locations, setLocations] = useState<DropdownOption[]>([]);
  const [users, setUsers] = useState<DropdownOption[]>([]);
  const [departments, setDepartments] = useState<DropdownOption[]>([]);
  const [lookupCategories, setLookupCategories] = useState<LookupCategory[]>([]);
  const [lookupValues, setLookupValues] = useState<Record<string, string>>({});

  const [loadingData, setLoadingData] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoadingData(true);
    try {
      // Fetch classifications with 'query', 'both', and 'all' types
      const [queryClassRes, bothClassRes, allClassRes] = await Promise.all([
        getClassificationsTree('query'),
        getClassificationsTree('both'),
        getClassificationsTree('all'),
      ]);

      // Fetch workflows with 'query', 'both', and 'all' types
      const [queryWorkflowRes, bothWorkflowRes, allWorkflowRes] = await Promise.all([
        getWorkflows(true, 'query'),
        getWorkflows(true, 'both'),
        getWorkflows(true, 'all'),
      ]);

      // Fetch other data
      const [locRes, userRes, deptRes, lookupRes] = await Promise.all([
        getLocations(),
        getUsers(),
        getDepartments(),
        getLookupCategories().catch(err => ({ success: false, error: err.message })),
      ]);

      // Combine and deduplicate classifications
      const allClassifications = [
        ...(queryClassRes.success && queryClassRes.data ? queryClassRes.data : []),
        ...(bothClassRes.success && bothClassRes.data ? bothClassRes.data : []),
        ...(allClassRes.success && allClassRes.data ? allClassRes.data : []),
      ];

      // Deduplicate by ID
      const uniqueClassifications = allClassifications.filter((item, index, self) =>
        index === self.findIndex(t => t.id === item.id)
      );

      if (uniqueClassifications.length > 0) {
        // Normalize classification tree data
        const normalizeClassifications = (nodes: TreeNode[]): TreeNode[] => {
          return nodes.map(node => ({
            id: String(node.id),
            name: node.name,
            parent_id: node.parent_id ? String(node.parent_id) : null,
            children: node.children ? normalizeClassifications(node.children) : undefined,
          }));
        };
        setClassifications(normalizeClassifications(uniqueClassifications));
      } else {
        setClassifications([]);
      }

      // Combine and deduplicate workflows
      const allWorkflowsData = [
        ...(queryWorkflowRes.success && queryWorkflowRes.data ? queryWorkflowRes.data : []),
        ...(bothWorkflowRes.success && bothWorkflowRes.data ? bothWorkflowRes.data : []),
        ...(allWorkflowRes.success && allWorkflowRes.data ? allWorkflowRes.data : []),
      ];

      // Deduplicate by ID
      const uniqueWorkflows = allWorkflowsData.filter((item, index, self) =>
        index === self.findIndex(t => t.id === item.id)
      );

      if (uniqueWorkflows.length > 0) {
        setAllWorkflows(uniqueWorkflows);
      }

      if (locRes.success && locRes.data) {
        setLocations(locRes.data.map((l: any) => ({ id: l.id, name: l.name })));
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
        // Filter to only show categories that should be added to query form
        const queryCategories = lookupRes.data.filter((cat: LookupCategory) => cat.add_to_incident_form && cat.is_active);
        setLookupCategories(queryCategories);
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
    source_incident_id: 'Source Incident Reference',
    geolocation: 'Geolocation',
    attachments: 'Attachments',
    attachment: 'Attachments',
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!selectedClassification) {
      newErrors.classification_id = 'Classification is required';
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

      if (field === 'geolocation') {
        // Check geolocation - locationData must be set
        if (!locationData) {
          newErrors.geolocation = 'Geolocation is required';
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
        case 'source_incident_id':
          value = selectedSourceIncident?.id;
          break;
        case 'attachments':
        case 'attachment':
          value = attachments.length > 0;
          break;
      }

      if (!value || (typeof value === 'string' && !value.trim())) {
        newErrors[field] = `${fieldLabels[field] || field} is required`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
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

  const handleLocationChange = (location: LocationData | undefined) => {
    console.log('🗺️ [Location Change] Received location update:', JSON.stringify(location, null, 2));
    setLocationData(location);
    if (location && errors.geolocation) {
      setErrors(prev => ({ ...prev, geolocation: '' }));
    }
  };

  // Search incidents with debouncing
  const searchIncidents = useCallback(async (searchText: string) => {
    if (searchText.length < 2) {
      setSearchedIncidents([]);
      return;
    }

    setLoadingIncidents(true);
    try {
      const response = await getIncidents({
        search: searchText,
        created_by_me: true, // Only show incidents created by current user
        limit: 20,
      });

      if (response.success && response.data) {
        setSearchedIncidents(response.data.map((i: any) => ({
          id: i.id,
          name: `${i.incident_number} - ${i.title}`
        })));
      }
    } catch (error) {
      console.error('Error searching incidents:', error);
    }
    setLoadingIncidents(false);
  }, []);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (incidentSearch) {
        searchIncidents(incidentSearch);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [incidentSearch, searchIncidents]);

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

      // Show alert that recording has started
      Alert.alert('Recording', 'Voice recording started. Tap "Stop Recording" when done.');
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
        // Add voice recording to attachments array
        const voiceAttachment = {
          uri,
          name: `voice-recording-${Date.now()}.m4a`,
          type: 'audio/m4a',
          size: undefined,
          isVoice: true,
          duration: recordingDuration
        };
        setAttachments(prev => [...prev, voiceAttachment]);
        if (errors.attachments || errors.attachment) {
          setErrors(prev => ({ ...prev, attachments: '', attachment: '' }));
        }
      }

      setRecording(null);
      setRecordingDuration(0);
    } catch (error) {
      console.error('Failed to stop recording:', error);
      Alert.alert('Error', 'Failed to stop recording');
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Attachment options handler
  const showAttachmentOptions = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo', 'Choose from Gallery', 'Choose File', 'Record Voice'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            handleTakePhoto();
          } else if (buttonIndex === 2) {
            handlePickFromGallery();
          } else if (buttonIndex === 3) {
            handlePickDocument();
          } else if (buttonIndex === 4) {
            startRecording();
          }
        }
      );
    } else {
      setAttachmentPickerVisible(true);
    }
  };

  const handleTakePhoto = async () => {
    console.log('📷 [Camera] Take photo button pressed');

    // Check if geolocation is required
    const isGeoRequired = isFieldRequired('geolocation');

    if (isGeoRequired) {
      // If location is required but not available at all
      if (!locationData?.latitude) {
        console.warn('⚠️ [Camera] Location is required but not available yet');
        Alert.alert(
          'Location Required',
          'Please wait for your location to be detected before taking a photo, or click "Get Current Location" button.',
          [{ text: 'OK' }]
        );
        return;
      }

      // If we have coordinates but no address yet (still loading)
      if (locationData?.latitude && !locationData?.address && !locationData?.city) {
        console.log('⏳ [Camera] Location address is still loading, waiting up to 3 seconds...');

        // Show loading alert
        Alert.alert(
          'Getting Location Details',
          'Please wait while we get your address...',
          [{ text: 'OK' }]
        );

        // Wait up to 3 seconds for address
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Check again after waiting
        const finalLocation = locationDataRef.current;
        if (finalLocation?.latitude && !finalLocation?.address && !finalLocation?.city) {
          console.warn('⚠️ [Camera] Address still not available after waiting');
          Alert.alert(
            'Location Address Unavailable',
            'We have your GPS coordinates but couldn\'t get the street address. Continue with coordinates only?',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Continue', onPress: () => proceedWithCamera() }
            ]
          );
          return;
        }
        console.log('✅ [Camera] Address loaded, proceeding');
      }
    }

    await proceedWithCamera();
  };

  const proceedWithCamera = async () => {

    try {
      console.log('📷 [Camera] Requesting camera permissions...');
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      console.log('📷 [Camera] Permission status:', status);

      if (status !== 'granted') {
        console.warn('📷 [Camera] Permission denied');
        Alert.alert('Permission Required', 'Camera permission is required to take photos.');
        return;
      }

      console.log('📷 [Camera] Launching camera...');
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
        exif: true,
      });

      console.log('📷 [Camera] ✅ Camera closed');
      console.log('📷 [Camera] Full result:', JSON.stringify(result, null, 2));
      console.log('📷 [Camera] Result.canceled:', result.canceled);
      console.log('📷 [Camera] Result.assets:', result.assets);
      console.log('📷 [Camera] Assets count:', result.assets?.length || 0);

      if (!result.canceled && result.assets && Array.isArray(result.assets) && result.assets.length > 0) {
        console.log('📷 [Camera] Photo captured successfully!');

        // Take first image (camera usually returns only one)
        const asset = result.assets[0];
        console.log('📷 [Camera] Image details:', {
          uri: asset.uri?.substring(0, 50) + '...',
          width: asset.width,
          height: asset.height,
        });

        // Prepare watermark data - Use ref to get latest value that won't be lost on re-render
        const currentLocation = locationDataRef.current;
        console.log('📍 [Location Data] From STATE:', JSON.stringify(locationData, null, 2));
        console.log('📍 [Location Data] From REF:', JSON.stringify(currentLocation, null, 2));

        const watermarkData: WatermarkData = {
          latitude: currentLocation?.latitude,
          longitude: currentLocation?.longitude,
          address: currentLocation?.address,
          city: currentLocation?.city,
          state: currentLocation?.state,
          country: currentLocation?.country,
          userName: user ? `${user.first_name} ${user.last_name}`.trim() || user.username : undefined,
          timestamp: new Date(),
          appName: 'Automax',
        };

        console.log('🏷️ [Watermark Data] Prepared:', JSON.stringify(watermarkData, null, 2));

        const originalFileName = asset.fileName || `photo_${Date.now()}.jpg`;
        const watermarkedFileName = generateWatermarkedFilename(originalFileName, {
          appName: 'Automax',
          userName: user ? `${user.first_name} ${user.last_name}`.trim() || user.username : undefined,
          userId: user?.id,
          timestamp: new Date(),
          location: locationData ? `${locationData.city || ''} ${locationData.state || ''}`.trim() : undefined,
        });

        // Prepare pending watermark object
        const pendingWatermark: PendingWatermark = {
          id: `watermark_${Date.now()}`,
          imageUri: asset.uri,
          data: watermarkData,
          originalName: watermarkedFileName,
        };

        console.log('🏷️ [Camera] Showing preview with watermark data:', watermarkData);

        // Show preview modal
        setPreviewImageUri(asset.uri);
        setPreviewWatermarkData(watermarkData);
        setPreviewPendingWatermark(pendingWatermark);
        setPreviewVisible(true);
      } else {
        console.log('📷 [Camera] Photo capture was canceled or no assets');
      }
    } catch (error) {
      console.error('❌ [Camera] Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  // Handle preview accept
  const handlePreviewAccept = useCallback(() => {
    console.log('✅ [Preview] User accepted photo');
    if (previewPendingWatermark) {
      console.log('✅ [Preview] Adding to watermark queue');
      setPendingWatermarks(prev => [...prev, previewPendingWatermark]);
    }
    setPreviewVisible(false);
    setPreviewImageUri('');
    setPreviewWatermarkData({});
    setPreviewPendingWatermark(null);
  }, [previewPendingWatermark]);

  // Handle preview retry
  const handlePreviewRetry = useCallback(() => {
    console.log('🔄 [Preview] User wants to retry');
    setPreviewVisible(false);
    setPreviewImageUri('');
    setPreviewWatermarkData({});
    setPreviewPendingWatermark(null);
    // Relaunch camera
    setTimeout(() => {
      handleTakePhoto();
    }, 300);
  }, []);

  // Handle watermark completion
  const handleWatermarkComplete = useCallback((id: string, watermarkedUri: string, originalName: string) => {
    console.log('✅ [Watermark Complete] ID:', id);
    console.log('✅ [Watermark Complete] URI:', watermarkedUri.substring(0, 50) + '...');
    console.log('✅ [Watermark Complete] Name:', originalName);

    // Add watermarked image to attachments
    setAttachments(prev => {
      const newAttachments = [
        ...prev,
        {
          uri: watermarkedUri,
          name: originalName,
          type: 'image/jpeg',
        },
      ];
      console.log('✅ [Watermark Complete] Total attachments now:', newAttachments.length);
      return newAttachments;
    });

    // Remove from pending list
    setPendingWatermarks(prev => {
      const remaining = prev.filter(w => w.id !== id);
      console.log('✅ [Watermark Complete] Remaining in queue:', remaining.length);
      return remaining;
    });

    // Clear error if any
    if (errors.attachments || errors.attachment) {
      setErrors(prev => ({ ...prev, attachments: '', attachment: '' }));
    }
  }, [errors.attachments, errors.attachment]);

  const handlePickFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Gallery permission is required to select photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && Array.isArray(result.assets)) {
        const newAttachments = result.assets.map(asset => ({
          uri: asset.uri,
          name: asset.fileName || `image_${Date.now()}.jpg`,
          type: asset.mimeType || 'image/jpeg',
          size: asset.fileSize,
        }));
        setAttachments(prev => [...prev, ...newAttachments]);
        if (errors.attachments || errors.attachment) {
          setErrors(prev => ({ ...prev, attachments: '', attachment: '' }));
        }
      }
    } catch (error) {
      console.error('Error picking from gallery:', error);
      Alert.alert('Error', 'Failed to pick from gallery');
    }
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        multiple: true,
      });

      if (result.canceled === false && result.assets) {
        const newAttachments = result.assets.map(asset => ({
          uri: asset.uri,
          name: asset.name,
          type: asset.mimeType,
          size: asset.size,
        }));
        setAttachments(prev => [...prev, ...newAttachments]);
        if (errors.attachments || errors.attachment) {
          setErrors(prev => ({ ...prev, attachments: '', attachment: '' }));
        }
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to pick document');
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
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

    const queryData: any = {
      title: title.trim(),
      workflow_id: matchedWorkflow!.id,
    };

    if (description.trim()) queryData.description = description.trim();
    if (selectedClassification) queryData.classification_id = selectedClassification.id;
    if (selectedLocation) queryData.location_id = selectedLocation.id;
    if (selectedSource) queryData.source = selectedSource.id;
    if (selectedChannel) queryData.channel = selectedChannel.id;
    if (selectedAssignee) queryData.assignee_id = selectedAssignee.id;
    if (selectedDepartment) queryData.department_id = selectedDepartment.id;
    if (selectedSourceIncident) queryData.source_incident_id = selectedSourceIncident.id;
    if (reporterName.trim()) queryData.reporter_name = reporterName.trim();
    if (reporterEmail.trim()) queryData.reporter_email = reporterEmail.trim();
    if (locationData) {
      queryData.latitude = locationData.latitude;
      queryData.longitude = locationData.longitude;
      if (locationData.address) queryData.address = locationData.address;
      if (locationData.city) queryData.city = locationData.city;
      if (locationData.state) queryData.state = locationData.state;
      if (locationData.country) queryData.country = locationData.country;
      if (locationData.postal_code) queryData.postal_code = locationData.postal_code;
    }

    // Add lookup values if any selected
    const selectedLookupIds = Object.values(lookupValues).filter(Boolean);
    if (selectedLookupIds.length > 0) {
      queryData.lookup_value_ids = selectedLookupIds;
    }

    const response = await createQuery(queryData);

    if (response.success) {
      // Upload attachments if any
      if (attachments.length > 0) {
        const filesToUpload = attachments.map(file => ({
          uri: file.uri,
          name: file.name,
          type: file.type || 'application/octet-stream',
        }));

        const queryId = response.data.id;
        const uploadResult = await uploadMultipleComplaintAttachments(queryId, filesToUpload);

        if (!uploadResult.success) {
          console.error('Failed to upload some files:', uploadResult.errors);
          // Continue anyway since query was created
        }
      }

      setSubmitting(false);
      Alert.alert('Success', 'Query created successfully.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } else {
      setSubmitting(false);
      Alert.alert('Error', `Failed to create query: ${response.error}`);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('addQuery.title')}</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close-circle" size={28} color="#E74C3C" />
        </TouchableOpacity>
      </View>

      {loadingData ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3498DB" />
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      ) : (
        <>
          <ScrollView style={styles.formContainer} showsVerticalScrollIndicator={false}>
            <View style={styles.workflowCard}>
              <View style={styles.workflowHeader}>
                <Ionicons name="git-branch" size={20} color="#3498DB" />
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
              placeholder={t('addQuery.titlePlaceholder')}
              value={title}
              onChangeText={(text) => {
                setTitle(text);
                if (errors.title) setErrors(prev => ({ ...prev, title: '' }));
              }}
              placeholderTextColor="#999"
            />
            {errors.title && <Text style={styles.errorText}>{errors.title}</Text>}

            <Text style={styles.sectionTitle}>
              Channel {isFieldRequired('channel') && <Text style={styles.required}>*</Text>}
            </Text>
            <Dropdown
              label={t('addQuery.selectChannel')}
              value={selectedChannel?.name || ''}
              options={channelOptions}
              onSelect={setSelectedChannel}
              required={isFieldRequired('channel')}
              error={errors.channel}
            />

            {/* Source Incident - only show if required */}
            {isFieldRequired('source_incident_id') && (
              <>
                <Text style={styles.sectionTitle}>
                  Source Incident Reference <Text style={styles.required}>*</Text>
                </Text>

                {selectedSourceIncident ? (
                  <View style={styles.selectedIncidentCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.selectedIncidentText}>{selectedSourceIncident.name}</Text>
                    </View>
                    <TouchableOpacity onPress={() => setSelectedSourceIncident(null)}>
                      <Ionicons name="close-circle" size={24} color="#666" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    <View style={styles.searchInputContainer}>
                      <Ionicons name="search" size={20} color="#666" style={{ marginRight: 8 }} />
                      <TextInput
                        style={styles.searchInput}
                        placeholder={t('addQuery.searchIncident', 'Search by incident number or title...')}
                        value={incidentSearch}
                        onChangeText={setIncidentSearch}
                        placeholderTextColor="#999"
                      />
                      {loadingIncidents && <ActivityIndicator size="small" color="#666" />}
                    </View>

                    {searchedIncidents.length > 0 && (
                      <View style={styles.searchResults}>
                        <ScrollView
                          style={styles.searchResultsScroll}
                          nestedScrollEnabled={true}
                          showsVerticalScrollIndicator={true}
                        >
                          {searchedIncidents.map((incident) => (
                            <TouchableOpacity
                              key={incident.id}
                              style={styles.searchResultItem}
                              onPress={() => {
                                setSelectedSourceIncident(incident);
                                setIncidentSearch('');
                                setSearchedIncidents([]);
                                if (errors.source_incident_id) {
                                  setErrors(prev => ({ ...prev, source_incident_id: '' }));
                                }
                              }}
                            >
                              <Text style={styles.searchResultText}>{incident.name}</Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    )}

                    {incidentSearch.length >= 2 && !loadingIncidents && searchedIncidents.length === 0 && (
                      <Text style={styles.noResultsText}>
                        {t('addQuery.noIncidentsFound', 'No incidents found')}
                      </Text>
                    )}
                  </>
                )}

                {errors.source_incident_id && <Text style={styles.errorText}>{errors.source_incident_id}</Text>}
              </>
            )}

            <Text style={styles.sectionTitle}>
              Classification <Text style={styles.required}>*</Text>
            </Text>
            <TreeSelect
              label={t('addQuery.selectClassification')}
              value={selectedClassification?.name || ''}
              data={classifications}
              onSelect={(node) => setSelectedClassification(node as DropdownOption | null)}
              required={true}
              error={errors.classification_id}
              leafOnly={true}
              placeholder={t('addQuery.selectClassification')}
            />

            {/* Location - only show if required */}
            {isFieldRequired('location_id') && (
              <>
                <Text style={styles.sectionTitle}>
                  Location <Text style={styles.required}>*</Text>
                </Text>
                <Dropdown
                  label={t('addQuery.selectLocation')}
                  value={selectedLocation?.name || ''}
                  options={locations}
                  onSelect={setSelectedLocation}
                  required={true}
                  error={errors.location_id}
                />
              </>
            )}

            {/* Source - only show if required */}
            {isFieldRequired('source') && (
              <>
                <Text style={styles.sectionTitle}>
                  Source <Text style={styles.required}>*</Text>
                </Text>
                <Dropdown
                  label={t('addQuery.selectSource')}
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

            {/* Priority & Severity - only show if either is required */}
            {(isFieldRequired('priority') || isFieldRequired('severity')) && (
              <View style={styles.row}>
                {isFieldRequired('priority') && (
                  <View style={isFieldRequired('severity') ? styles.halfWidth : styles.fullWidth}>
                    <Text style={styles.sectionTitle}>
                      Priority <Text style={styles.required}>*</Text>
                    </Text>
                    <Dropdown
                      label={t('addQuery.selectPriority')}
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
                      label={t('addQuery.selectSeverity')}
                      value={selectedSeverity.name}
                      options={severityOptions}
                      onSelect={(opt) => opt && setSelectedSeverity(opt)}
                      allowClear={false}
                    />
                  </View>
                )}
              </View>
            )}

            {/* Assignee - only show if required */}
            {isFieldRequired('assignee_id') && (
              <>
                <Text style={styles.sectionTitle}>
                  Assignee <Text style={styles.required}>*</Text>
                </Text>
                <Dropdown
                  label={t('addQuery.selectAssignee')}
                  value={selectedAssignee?.name || ''}
                  options={users}
                  onSelect={setSelectedAssignee}
                  required={true}
                  error={errors.assignee_id}
                />
              </>
            )}

            {/* Department - only show if required */}
            {isFieldRequired('department_id') && (
              <>
                <Text style={styles.sectionTitle}>
                  Department <Text style={styles.required}>*</Text>
                </Text>
                <Dropdown
                  label={t('addQuery.selectDepartment')}
                  value={selectedDepartment?.name || ''}
                  options={departments}
                  onSelect={setSelectedDepartment}
                  required={true}
                  error={errors.department_id}
                />
              </>
            )}

            {/* Description - only show if required */}
            {isFieldRequired('description') && (
              <>
                <Text style={styles.sectionTitle}>
                  Description <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={[styles.descriptionInput, errors.description && styles.inputError]}
                  placeholder={t('addQuery.descriptionPlaceholder')}
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

            {/* Reporter Name - only show if required */}
            {isFieldRequired('reporter_name') && (
              <>
                <Text style={styles.sectionTitle}>
                  Reporter Name <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={[styles.input, errors.reporter_name && styles.inputError]}
                  placeholder={t('addQuery.reporterNamePlaceholder')}
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

            {/* Reporter Email - only show if required */}
            {isFieldRequired('reporter_email') && (
              <>
                <Text style={styles.sectionTitle}>
                  Reporter Email <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={[styles.input, errors.reporter_email && styles.inputError]}
                  placeholder={t('addQuery.reporterEmailPlaceholder')}
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

            {/* Geolocation - only show if required */}
            {isFieldRequired('geolocation') && (
              <>
                <LocationPicker
                  label={t('details.geolocation', 'Geolocation')}
                  value={locationData}
                  onChange={handleLocationChange}
                  required
                  autoFetch={true}
                  error={errors.geolocation}
                />
                {/* Show address loading status */}
                {locationData?.latitude && !locationData?.address && !locationData?.city && (
                  <Text style={{ fontSize: 12, color: '#FF9800', marginTop: 4, marginLeft: 4 }}>
                    ⏳ Getting address details...
                  </Text>
                )}
                {(locationData?.address || locationData?.city) && (
                  <Text style={{ fontSize: 12, color: '#4CAF50', marginTop: 4, marginLeft: 4 }}>
                    ✓ Location: {locationData.city || locationData.address}
                  </Text>
                )}
              </>
            )}

            {/* Attachments Section */}
            {(isFieldRequired('attachments') || isFieldRequired('attachment')) && (
              <>
                <Text style={styles.sectionTitle}>
                  Attachments <Text style={styles.required}>*</Text>
                </Text>
                <View style={[styles.attachmentsContainer, (errors.attachments || errors.attachment) && styles.attachmentsContainerError]}>
                  {attachments.length > 0 && (
                    <View style={styles.attachmentsList}>
                      {attachments.map((file, index) => (
                        <View key={index} style={styles.attachmentItem}>
                          <View style={styles.attachmentInfo}>
                            <Ionicons
                              name={file.isVoice ? "mic" : "document-attach"}
                              size={20}
                              color="#3498DB"
                            />
                            <Text style={styles.attachmentName} numberOfLines={1}>
                              {file.name}
                            </Text>
                            {file.size && (
                              <Text style={styles.attachmentSize}>
                                ({(file.size / 1024).toFixed(1)} KB)
                              </Text>
                            )}
                            {file.isVoice && file.duration && (
                              <Text style={styles.attachmentSize}>
                                ({formatDuration(file.duration)})
                              </Text>
                            )}
                          </View>
                          <TouchableOpacity onPress={() => removeAttachment(index)}>
                            <Ionicons name="close-circle" size={22} color="#E74C3C" />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                  {recording ? (
                    <TouchableOpacity
                      style={[styles.attachmentButton, styles.recordingButton]}
                      onPress={stopRecording}
                    >
                      <Ionicons name="stop" size={24} color="#EF4444" />
                      <Text style={[styles.attachmentButtonText, styles.recordingButtonText]}>
                        Stop Recording ({formatDuration(recordingDuration)})
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={styles.attachmentButton} onPress={showAttachmentOptions}>
                      <Ionicons name="cloud-upload-outline" size={24} color="#3498DB" />
                      <Text style={styles.attachmentButtonText}>
                        {attachments.length > 0 ? 'Add More Files' : 'Tap to Upload'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
                {errors.attachments && <Text style={styles.errorText}>{errors.attachments}</Text>}
                {errors.attachment && <Text style={styles.errorText}>{errors.attachment}</Text>}
              </>
            )}

            <View style={styles.bottomPadding} />
          </ScrollView>

          {/* Attachment Picker Modal (Android) */}
          <Modal
            visible={attachmentPickerVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setAttachmentPickerVisible(false)}
          >
            <TouchableOpacity
              style={styles.pickerModalOverlay}
              activeOpacity={1}
              onPress={() => setAttachmentPickerVisible(false)}
            >
              <View style={styles.pickerModalContent}>
                <Text style={styles.pickerModalTitle}>Add Attachment</Text>

                <TouchableOpacity
                  style={styles.pickerOption}
                  onPress={() => {
                    setAttachmentPickerVisible(false);
                    handleTakePhoto();
                  }}
                >
                  <Ionicons name="camera" size={24} color="#3498DB" />
                  <Text style={styles.pickerOptionText}>Take Photo</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.pickerOption}
                  onPress={() => {
                    setAttachmentPickerVisible(false);
                    handlePickFromGallery();
                  }}
                >
                  <Ionicons name="images" size={24} color="#3498DB" />
                  <Text style={styles.pickerOptionText}>Choose from Gallery</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.pickerOption}
                  onPress={() => {
                    setAttachmentPickerVisible(false);
                    handlePickDocument();
                  }}
                >
                  <Ionicons name="document" size={24} color="#3498DB" />
                  <Text style={styles.pickerOptionText}>Choose File</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.pickerOption}
                  onPress={() => {
                    setAttachmentPickerVisible(false);
                    startRecording();
                  }}
                >
                  <Ionicons name="mic" size={24} color="#3498DB" />
                  <Text style={styles.pickerOptionText}>Record Voice</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.pickerCancelButton}
                  onPress={() => setAttachmentPickerVisible(false)}
                >
                  <Text style={styles.pickerCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>

          <View style={styles.submitContainer}>
            <TouchableOpacity
              style={[styles.submitButton, submitting && styles.disabledButton]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>{t('addQuery.createButton')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Hidden watermark processors */}
      {pendingWatermarks.length > 0 && console.log('🎨 [Render] Rendering', pendingWatermarks.length, 'WatermarkProcessor component(s)')}
      {pendingWatermarks.map((pending) => {
        console.log('🎨 [Render] Creating WatermarkProcessor for:', pending.id);
        return (
          <WatermarkProcessor
            key={pending.id}
            imageUri={pending.imageUri}
            data={pending.data}
            onComplete={(watermarkedUri) =>
              handleWatermarkComplete(pending.id, watermarkedUri, pending.originalName)
            }
          />
        );
      })}

      {/* Watermark Preview Modal */}
      <WatermarkPreview
        visible={previewVisible}
        imageUri={previewImageUri}
        watermarkData={previewWatermarkData}
        onAccept={handlePreviewAccept}
        onRetry={handlePreviewRetry}
      />
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
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#3498DB',
  },
  workflowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  workflowLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3498DB',
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
    backgroundColor: '#3498DB',
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
  selectedIncidentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  selectedIncidentText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    padding: 0,
  },
  searchResults: {
    backgroundColor: 'white',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 12,
    overflow: 'hidden',
    maxHeight: 250,
  },
  searchResultsScroll: {
    maxHeight: 250,
  },
  searchResultItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  searchResultText: {
    fontSize: 14,
    color: '#333',
  },
  noResultsText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 12,
  },
  attachmentsContainer: {
    backgroundColor: 'white',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 20,
    overflow: 'hidden',
  },
  attachmentsContainerError: {
    borderColor: '#E74C3C',
  },
  attachmentsList: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  attachmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  attachmentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  attachmentName: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  attachmentSize: {
    fontSize: 12,
    color: '#666',
  },
  attachmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
  },
  attachmentButtonText: {
    fontSize: 14,
    color: '#3498DB',
    fontWeight: '600',
  },
  recordingButton: {
    backgroundColor: '#FEE2E2',
  },
  recordingButtonText: {
    color: '#EF4444',
  },
  pickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  pickerModalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    padding: 20,
  },
  pickerModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    borderRadius: 10,
    backgroundColor: '#F8F9FA',
    marginBottom: 12,
  },
  pickerOptionText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  pickerCancelButton: {
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  pickerCancelText: {
    fontSize: 16,
    color: '#E74C3C',
    fontWeight: '600',
  },
});

export default AddQueryScreen;
