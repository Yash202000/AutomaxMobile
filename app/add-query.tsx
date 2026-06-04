import { getClassificationsTree } from '@/src/api/classifications';
import { getDepartments } from '@/src/api/departments';
import { createQuery, getIncidents, uploadMultipleComplaintAttachments } from '@/src/api/incidents';
import { getLocationsTree } from '@/src/api/locations';
import { getLookupCategories, LookupCategory } from '@/src/api/lookups';
import { getUsers } from '@/src/api/users';
import { getWorkflows, matchWorkflow as matchWorkflowAPI } from '@/src/api/workflow';
import LocationPicker, { LocationData } from '@/src/components/LocationPickerOSM';
import TreeSelect, { TreeNode } from '@/src/components/TreeSelect';
import { WatermarkPreview } from '@/src/components/WatermarkPreview';
import { WatermarkData, WatermarkProcessor } from '@/src/components/WatermarkProcessor';
import { useAuth } from '@/src/context/AuthContext';
import i18n from '@/src/i18n';
import { compressImage } from '@/src/utils/imageCompression';
import { generateWatermarkedFilename } from '@/src/utils/watermarkUtils';
import { FontAwesome, Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { t } from 'i18next';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { CustomAlert } from '@/src/components/CustomAlert';
import { useTranslation } from 'react-i18next';
import {
  ActionSheetIOS,
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import IncidentPicker from '@/src/components/IncidentPicker';


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
  const insets = useSafeAreaInsets();

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
          style={[styles.modalOverlay, { marginBottom: insets.bottom }]}
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
                <Text style={styles.clearOptionText}>{t('common.clearSelection')}</Text>
                <Ionicons name="close-circle" size={20} color="#E74C3C" />
              </TouchableOpacity>
            )}

            {options.length === 0 ? (
              <View style={styles.emptyList}>
                <Text style={styles.emptyText}>{t('common.noOptions')}</Text>
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




// File size limit: 10MB (adjust based on your server configuration)
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const AddQueryScreen = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const priorityOptions: DropdownOption[] = [
    { id: '1', name: t('priorities.critical') },
    { id: '2', name: t('priorities.high') },
    { id: '3', name: t('priorities.medium') },
    { id: '4', name: t('priorities.low') },
    { id: '5', name: t('priorities.veryLow') },
  ];

  const severityOptions: DropdownOption[] = [
    { id: '1', name: t('severities.critical') },
    { id: '2', name: t('severities.major') },
    { id: '3', name: t('severities.moderate') },
    { id: '4', name: t('severities.minor') },
    { id: '5', name: t('severities.cosmetic') },
  ];

  const sourceOptions: DropdownOption[] = [
    { id: 'mobile', name: t('incidents.sources.mobile') },
  ];

  const channelOptions: DropdownOption[] = [
    { id: 'phone', name: t('incidents.channels.phone') },
    { id: 'email', name: t('incidents.channels.email') },
    { id: 'web', name: t('incidents.channels.web') },
    { id: 'mobile', name: t('incidents.channels.mobile') },
    { id: 'social_media', name: t('incidents.channels.socialMedia') },
    { id: 'in_person', name: t('incidents.channels.inPerson') },
    { id: 'viusional', name: t('incidents.channels.visual') },
    { id: 'other', name: t('incidents.channels.other') },
  ];

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [comment, setComment] = useState('');
  const [reporterName, setReporterName] = useState('');
  const [reporterEmail, setReporterEmail] = useState('');
  const [selectedClassification, setSelectedClassification] = useState<DropdownOption | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<DropdownOption | null>(null);
  const [selectedSource] = useState<DropdownOption>(sourceOptions[0]); // Fixed to mobile, non-editable
  const [selectedChannel, setSelectedChannel] = useState<DropdownOption | null>(null);
  const [selectedAssignee, setSelectedAssignee] = useState<DropdownOption | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<DropdownOption | null>(null);
  const [selectedPriority, setSelectedPriority] = useState<DropdownOption>(priorityOptions[2]);
  const [selectedSeverity, setSelectedSeverity] = useState<DropdownOption>(severityOptions[2]);
  const [selectedSourceIncident, setSelectedSourceIncident] = useState<DropdownOption | null>(null);
  const [userIncidents, setUserIncidents] = useState<DropdownOption[]>([]);
  const [incidentSearch, setIncidentSearch] = useState('');
  const [incidentDropdownOpen, setIncidentDropdownOpen] = useState(false);
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
    if (pendingWatermarks.length > 0) {
    }
  }, [pendingWatermarks]);

  // Geolocation state
  const [locationData, setLocationData] = useState<LocationData | undefined>(undefined);
  const locationDataRef = useRef<LocationData | undefined>(undefined);

  // Monitor locationData changes and keep ref in sync
  useEffect(() => {
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

  const hasFetchedDataRef = useRef(false);

  // Fetch all data once when user is loaded
  useEffect(() => {
    if (user && !hasFetchedDataRef.current) {
      hasFetchedDataRef.current = true;
      fetchAllData();
    }
  }, [user]);

  const fetchAllData = async () => {
    setLoadingData(true);
    try {
      // Fetch classifications with 'query', 'both', and 'all' types
      const [queryClassRes] = await Promise.all([
        getClassificationsTree('query')
      ]);

      // Fetch workflows with 'query', 'both', and 'all' types
      const [queryWorkflowRes] = await Promise.all([
        getWorkflows(true, 'query')
      ]);

      // Fetch other data
      const [locRes, userRes, deptRes, lookupRes] = await Promise.all([
        getLocationsTree(),
        getUsers(),
        getDepartments(),
        getLookupCategories().catch(err => ({ success: false, error: err.message }))
      ]);

      // Combine and deduplicate classifications
      if (queryClassRes.success && queryClassRes.data && queryClassRes.data.length > 0) {
        setSelectedClassification(queryClassRes.data[0])
      }
      const allClassifications = [
        ...(queryClassRes.success && queryClassRes.data ? queryClassRes.data : [])];
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
        let normalizedClassifications = normalizeClassifications(uniqueClassifications);

        // Filter by user's assigned classifications (unless super admin)
        if (user && !user.is_super_admin && user.classifications && user.classifications.length > 0) {
          const userClassificationIds = new Set(user.classifications.map(c => c.id));

          // Helper to check if node or any descendant is assigned to user
          const hasUserAccess = (node: TreeNode): boolean => {
            if (userClassificationIds.has(node.id)) return true;
            if (node.children && node.children.length > 0) {
              return node.children.some(child => hasUserAccess(child));
            }
            return false;
          };

          // Filter tree to only include nodes with user access
          const filterByUserAccess = (nodes: TreeNode[]): TreeNode[] => {
            return nodes.map(node => {
              if (!hasUserAccess(node)) return null;

              const filteredNode: TreeNode = {
                id: node.id,
                name: node.name,
                parent_id: node.parent_id,
              };

              if (node.children && node.children.length > 0) {
                const filteredChildren = filterByUserAccess(node.children).filter(Boolean) as TreeNode[];
                if (filteredChildren.length > 0) {
                  filteredNode.children = filteredChildren;
                }
              }

              return filteredNode;
            }).filter(Boolean) as TreeNode[];
          };

          normalizedClassifications = filterByUserAccess(normalizedClassifications);
        }

        setClassifications(normalizedClassifications);
      } else {
        setClassifications([]);
      }

      // Combine and deduplicate workflows
      const allWorkflowsData = [
        ...(queryWorkflowRes.success && queryWorkflowRes.data ? queryWorkflowRes.data : [])
      ];

      // Deduplicate by ID
      const uniqueWorkflows = allWorkflowsData.filter((item, index, self) =>
        index === self.findIndex(t => t.id === item.id)
      );

      if (uniqueWorkflows.length > 0) {
        setAllWorkflows(uniqueWorkflows);
      }

      if (locRes.success && locRes.data && Array.isArray(locRes.data)) {
        // Ensure all IDs are strings
        const normalizeLocations = (nodes: TreeNode[]): TreeNode[] => {
          return nodes.map(node => ({
            id: String(node.id),
            name: node.name,
            parent_id: node.parent_id ? String(node.parent_id) : null,
            children: node.children ? normalizeLocations(node.children) : undefined,
          }));
        };
        let normalizedLocations = normalizeLocations(locRes.data);

        // Filter by user's assigned locations (unless super admin)
        if (user && !user.is_super_admin && user.locations && user.locations.length > 0) {
          const userLocationIds = new Set(user.locations.map(l => l.id));

          // Helper to check if node or any descendant is assigned to user
          const hasUserAccess = (node: TreeNode): boolean => {
            if (userLocationIds.has(node.id)) return true;
            if (node.children && node.children.length > 0) {
              return node.children.some(child => hasUserAccess(child));
            }
            return false;
          };

          // Filter tree to only include nodes with user access
          const filterByUserAccess = (nodes: TreeNode[]): TreeNode[] => {
            return nodes.map(node => {
              if (!hasUserAccess(node)) return null;

              const filteredNode: TreeNode = {
                id: node.id,
                name: node.name,
                parent_id: node.parent_id,
              };

              if (node.children && node.children.length > 0) {
                const filteredChildren = filterByUserAccess(node.children).filter(Boolean) as TreeNode[];
                if (filteredChildren.length > 0) {
                  filteredNode.children = filteredChildren;
                }
              }

              return filteredNode;
            }).filter(Boolean) as TreeNode[];
          };

          normalizedLocations = filterByUserAccess(normalizedLocations);
        }

        setLocations(normalizedLocations);
      } else {
        setLocations([]);
      }
      if (userRes.success && userRes.data) {
        setUsers(userRes.data.map((u: any) => ({
          id: u.id,
          name: `${u.first_name} ${u.last_name}`.trim() || u.email || t('common.unknownUser')
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

  // Auto-match workflow via backend API when criteria change
  const matchWorkflow = useCallback(async () => {
    const criteria = {
      classification_id: selectedClassification?.id || undefined,
      location_id: selectedLocation?.id || undefined,
      source: selectedSource?.id || undefined,
      priority: parseInt(selectedPriority.id),
    };

    try {
      const result = await matchWorkflowAPI(criteria);
      if (result.success && result.data?.workflow_id) {
        const matched = allWorkflows.find(w => w.id === result.data.workflow_id) || null;
        setMatchedWorkflow(matched ?? allWorkflows.find(w => w.is_default) ?? allWorkflows[0] ?? null);
      } else if (allWorkflows.length > 0) {
        setMatchedWorkflow(allWorkflows.find(w => w.is_default) ?? allWorkflows[0] ?? null);
      }
    } catch {
      if (allWorkflows.length > 0) {
        setMatchedWorkflow(allWorkflows.find(w => w.is_default) ?? allWorkflows[0] ?? null);
      }
    }
  }, [allWorkflows, selectedClassification, selectedLocation, selectedSource, selectedPriority]);

  useEffect(() => {
    if (allWorkflows.length > 0) {
      matchWorkflow();
    }
  }, [selectedClassification?.id, selectedLocation?.id, selectedSource?.id, selectedPriority.id, allWorkflows.length]);

  const requiredFields = matchedWorkflow?.required_fields || [];

  const isFieldRequired = (fieldName: string): boolean => {
    return requiredFields.includes(fieldName);
  };

  const fieldLabels: Record<string, string> = {
    description: t('addQuery.description'),
    comment: t('incidents.comment'),
    classification_id: t('incidents.classification'),
    priority: t('incidents.priority'),
    severity: t('incidents.severity'),
    source: t('incidents.source'),
    channel: t('addQuery.selectChannel'),
    assignee_id: t('incidents.assignee'),
    department_id: t('incidents.department'),
    location_id: t('incidents.location'),
    reporter_name: t('addQuery.reporterName'),
    reporter_email: t('addQuery.reporterEmail'),
    source_incident_id: t('addComplaint.selectSourceIncident'),
    geolocation: t('details.geolocation'),
    attachments: t('incidents.attachments'),
    attachment: t('incidents.attachments'),
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!title.trim()) {
      newErrors.title = t('addQuery.titlePlaceholder');
    } else if (title.trim().length < 5) {
      newErrors.title = t('errors.minCharacters', { field: 'Title', min: 5 });
    }

    if (!selectedClassification) {
      newErrors.classification_id = t('addQuery.selectClassification');
    }

    if (!matchedWorkflow) {
      newErrors.workflow = t('addQuery.workflowHint');
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
        case 'comment':
          value = comment;
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
    setLocationData(location);
    if (location && errors.geolocation) {
      setErrors(prev => ({ ...prev, geolocation: '' }));
    }
  };

  // Filter user's pre-loaded incidents by search query (client-side, instant)
  const filteredIncidents = incidentSearch.trim().length === 0
    ? userIncidents
    : userIncidents.filter(i =>
      i.name.toLowerCase().includes(incidentSearch.toLowerCase())
    );

  // Voice recording functions
  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        CustomAlert.alert(t('common.permissionRequired'), t('addComplaint.micPermissionRequired'));
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
      CustomAlert.alert(t('addComplaint.voiceRecording'), t('addComplaint.recordAudio'));
    } catch (error) {
      console.error('Failed to start recording:', error);
      CustomAlert.alert(t('common.error'), t('common.recordingStartError'));
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
      CustomAlert.alert(t('common.error'), t('common.failedToStopRecording'));
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

    // Check if geolocation is required
    const isGeoRequired = isFieldRequired('geolocation');

    if (isGeoRequired) {
      // If location is required but not available at all
      if (!locationData?.latitude) {
        CustomAlert.alert(
          t('addIncident.addressUnavailable'),
          t('addIncident.waitingForLocation'),
          [{ text: t('common.ok') }]
        );
        return;
      }

      // If we have coordinates but no address yet (still loading)
      if (locationData?.latitude && !locationData?.address && !locationData?.city) {

        // Show loading alert
        CustomAlert.alert(
          t('addIncident.gettingLocationDetails'),
          t('addIncident.waitingForAddress'),
          [{ text: t('common.ok') }]
        );

        // Wait up to 3 seconds for address
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Check again after waiting
        const finalLocation = locationDataRef.current;
        if (finalLocation?.latitude && !finalLocation?.address && !finalLocation?.city) {
          CustomAlert.alert(
            t('addIncident.addressUnavailable'),
            t('addIncident.addressUnavailableDesc'),
            [
              { text: t('common.cancel'), style: 'cancel' },
              { text: t('common.next'), onPress: () => proceedWithCamera() }
            ]
          );
          return;
        }
      }
    }

    await proceedWithCamera();
  };

  const proceedWithCamera = async () => {

    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();

      if (status !== 'granted') {
        CustomAlert.alert(
          t('common.permissionRequired', 'Permission Required'),
          t('common.cameraPermissionNeeded', 'Camera permission is required to take photos. Please enable it in your device settings.'),
          [
            {
              text: t('common.cancel', 'Cancel'),
              style: 'cancel'
            },
            {
              text: t('common.openSettings', 'Open Settings'),
              onPress: () => {
                if (Platform.OS === 'ios') {
                  Linking.openURL('app-settings:');
                } else {
                  Linking.openSettings();
                }
              }
            }
          ]
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
        exif: true,
      });


      if (!result.canceled && result.assets && Array.isArray(result.assets) && result.assets.length > 0) {

        // Take first image (camera usually returns only one)
        const asset = result.assets[0];

        // Prepare watermark data - Use ref to get latest value that won't be lost on re-render
        const currentLocation = locationDataRef.current;

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


        // Show preview modal
        setPreviewImageUri(asset.uri);
        setPreviewWatermarkData(watermarkData);
        setPreviewPendingWatermark(pendingWatermark);
        setPreviewVisible(true);
      } else {
      }
    } catch (error) {
      console.error('❌ [Camera] Error taking photo:', error);
      CustomAlert.alert(t('common.error'), t('common.takePhotoFailed'));
    }
  };

  // Handle preview accept
  const handlePreviewAccept = useCallback(() => {
    if (previewPendingWatermark) {
      setPendingWatermarks(prev => [...prev, previewPendingWatermark]);
    }
    setPreviewVisible(false);
    setPreviewImageUri('');
    setPreviewWatermarkData({});
    setPreviewPendingWatermark(null);
  }, [previewPendingWatermark]);

  // Handle preview retry
  const handlePreviewRetry = useCallback(() => {
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
  const handleWatermarkComplete = useCallback(async (id: string, watermarkedUri: string, originalName: string) => {
    // Compress watermarked image before adding to attachments
    const compressionResult = await compressImage(watermarkedUri, {
      quality: 0.75,        // ~50% reduction
      format: 'jpeg',
      skipSmallFiles: true,
    });

    // Use compressed URI or fallback to original on error
    const finalUri = compressionResult.success && compressionResult.compressedUri
      ? compressionResult.compressedUri
      : watermarkedUri;

    // Add watermarked image to attachments
    setAttachments(prev => {
      const newAttachments = [
        ...prev,
        {
          uri: finalUri,
          name: originalName,
          type: 'image/jpeg',
        },
      ];
      return newAttachments;
    });

    // Remove from pending list
    setPendingWatermarks(prev => {
      const remaining = prev.filter(w => w.id !== id);
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
        CustomAlert.alert(
          t('common.permissionRequired', 'Permission Required'),
          t('common.galleryPermissionNeeded', 'Gallery permission is required to select photos. Please enable it in your device settings.'),
          [
            {
              text: t('common.cancel', 'Cancel'),
              style: 'cancel'
            },
            {
              text: t('common.openSettings', 'Open Settings'),
              onPress: () => {
                if (Platform.OS === 'ios') {
                  Linking.openURL('app-settings:');
                } else {
                  Linking.openSettings();
                }
              }
            }
          ]
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && Array.isArray(result.assets)) {
        // Filter out oversized files
        const validFiles: any[] = [];
        const oversizedFiles: string[] = [];

        result.assets.forEach(asset => {
          const fileSize = asset.fileSize || 0;
          const fileName = asset.fileName || `image_${Date.now()}.jpg`;

          if (fileSize > MAX_FILE_SIZE_BYTES) {
            oversizedFiles.push(`${fileName} (${(fileSize / (1024 * 1024)).toFixed(1)}MB)`);
          } else {
            validFiles.push({
              uri: asset.uri,
              name: fileName,
              type: asset.mimeType || 'image/jpeg',
              size: fileSize,
            });
          }
        });

        // Add valid files
        if (validFiles.length > 0) {
          setAttachments(prev => [...prev, ...validFiles]);
          if (errors.attachments || errors.attachment) {
            setErrors(prev => ({ ...prev, attachments: '', attachment: '' }));
          }
        }

        // Show warning for oversized files
        if (oversizedFiles.length > 0) {
          CustomAlert.alert(
            t('common.filesTooLargeTitle'),
            t('common.filesTooLargeDesc', { size: MAX_FILE_SIZE_MB, files: oversizedFiles.join('\n') }),
            [{ text: t('common.ok') }]
          );
        }
      }
    } catch (error) {
      console.error('Error picking from gallery:', error);
      CustomAlert.alert(t('common.error'), t('common.failedToPickFromGallery', 'Failed to pick from gallery'));
    }
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        multiple: true,
      });

      if (result.canceled === false && result.assets) {
        // Filter out oversized files
        const validFiles: any[] = [];
        const oversizedFiles: string[] = [];

        result.assets.forEach(asset => {
          const fileSize = asset.size || 0;

          if (fileSize > MAX_FILE_SIZE_BYTES) {
            oversizedFiles.push(`${asset.name} (${(fileSize / (1024 * 1024)).toFixed(1)}MB)`);
          } else {
            validFiles.push({
              uri: asset.uri,
              name: asset.name,
              type: asset.mimeType,
              size: fileSize,
            });
          }
        });

        // Add valid files
        if (validFiles.length > 0) {
          setAttachments(prev => [...prev, ...validFiles]);
          if (errors.attachments || errors.attachment) {
            setErrors(prev => ({ ...prev, attachments: '', attachment: '' }));
          }
        }

        // Show warning for oversized files
        if (oversizedFiles.length > 0) {
          CustomAlert.alert(
            t('common.filesTooLargeTitle'),
            t('common.filesTooLargeDesc', { size: MAX_FILE_SIZE_MB, files: oversizedFiles.join('\n') }),
            [{ text: t('common.ok') }]
          );
        }
      }
    } catch (error) {
      console.error('Error picking document:', error);
      CustomAlert.alert(t('common.error'), t('common.failedToPickDocument', 'Failed to pick document'));
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => {
      const file = prev[index];
      if (file?.uri) {
        FileSystem.deleteAsync(file.uri, { idempotent: true }).catch(() => { });
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSubmit = async () => {
    if (!validate()) {
      const firstError = Object.values(errors)[0];
      if (firstError) {
        CustomAlert.alert(t('common.validationError'), firstError);
      }
      return;
    }

    setSubmitting(true);

    const queryData: any = {
      title: title.trim(),
      workflow_id: matchedWorkflow!.id,
    };

    if (description.trim()) queryData.description = description.trim();
    if (comment.trim()) queryData.comment = comment.trim();
    if (selectedClassification) queryData.classification_id = selectedClassification.id;
    if (selectedLocation) queryData.location_id = selectedLocation.id;
    if (selectedSource) queryData.source = selectedSource.id;
    queryData.channel = "mobile";
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

        // Clean up temp files after upload
        attachments.forEach(file => {
          if (file?.uri) {
            FileSystem.deleteAsync(file.uri, { idempotent: true }).catch(() => { });
          }
        });
      }

      setSubmitting(false);
      CustomAlert.alert(t('common.success'), t('addQuery.createdSuccess', 'Query created successfully.'), [
        { text: t('common.ok'), onPress: () => router.back() },
      ]);
    } else {
      setSubmitting(false);
      CustomAlert.alert(t('common.error'), `${t('common.failed')}: ${response.error}`);
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
          <ScrollView style={[styles.formContainer, { marginBottom: insets.bottom }]} showsVerticalScrollIndicator={false}>
            <View style={styles.workflowCard}>
              <View style={styles.workflowHeader}>
                <Ionicons name="git-branch" size={20} color="#3498DB" />
                <Text style={styles.workflowLabel}>{t('common.workflow', 'Workflow')}</Text>
              </View>
              {matchedWorkflow ? (
                <View style={styles.workflowMatched}>
                  <Ionicons name="checkmark-circle" size={18} color="#27AE60" />
                  <Text style={styles.workflowName}>{matchedWorkflow.name}</Text>
                </View>
              ) : (
                <Text style={styles.workflowHint}>
                  {t('addQuery.autoWorkflow')}
                </Text>
              )}
              {errors.workflow && <Text style={styles.errorText}>{errors.workflow}</Text>}
            </View>

            <Text style={styles.sectionTitle}>
              {t('incidents.title')} <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, errors.title && styles.inputError, { textAlign: i18n.language === 'ar' ? 'right' : 'left' }]}
              placeholder={t('addQuery.titlePlaceholder')}
              value={title}
              onChangeText={(text) => {
                setTitle(text);
                if (errors.title) setErrors(prev => ({ ...prev, title: '' }));
              }}
              placeholderTextColor="#999"
            />
            {errors.title && <Text style={styles.errorText}>{errors.title}</Text>}

            {/* <Text style={styles.sectionTitle}>
              {t('addQuery.channel')} {isFieldRequired('channel') && <Text style={styles.required}>*</Text>}
            </Text>
            <Dropdown
              label={t('addQuery.selectChannel')}
              value={selectedChannel?.name || ''}
              options={channelOptions}
              onSelect={setSelectedChannel}
              required={isFieldRequired('channel')}
              error={errors.channel}
            /> */}

            {isFieldRequired('source_incident_id') && (
              <>
                <Text style={styles.sectionTitle}>
                  {t('addQuery.sourceIncident')} <Text style={styles.required}>*</Text>
                </Text>

                {/* Dropdown trigger */}
                <TouchableOpacity
                  style={[styles.dropdown, errors.source_incident_id ? styles.dropdownError : null]}
                  onPress={() => {
                    setIncidentSearch('');
                    setIncidentDropdownOpen(true);
                  }}
                >
                  <Text style={[styles.dropdownText, !selectedSourceIncident && styles.placeholderText]}>
                    {selectedSourceIncident ? selectedSourceIncident.name : t('common.selectIncident')}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {selectedSourceIncident && (
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation();
                          setSelectedSourceIncident(null);
                          if (errors.source_incident_id) {
                            setErrors(prev => ({ ...prev, source_incident_id: '' }));
                          }
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="close-circle" size={18} color="#999" />
                      </TouchableOpacity>
                    )}
                    {loadingData ? (
                      <ActivityIndicator size="small" color="#666" />
                    ) : (
                      <FontAwesome name="chevron-down" size={16} color="#666" />
                    )}
                  </View>
                </TouchableOpacity>

                {errors.source_incident_id && (
                  <Text style={styles.errorText}>{errors.source_incident_id}</Text>
                )}

                <IncidentPicker
                  incidentDropdownOpen={incidentDropdownOpen}
                  onClose={setIncidentDropdownOpen}
                  selectedSourceIncident={selectedSourceIncident}
                  onSelect={setSelectedSourceIncident}
                />

                {/* Incident picker modal */}

              </>
            )}

            {/* <Text style={styles.sectionTitle}>
              {t('incidents.classification')} <Text style={styles.required}>*</Text>
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
              iconType="classification"
            /> */}

            {/* Location - only show if required */}
            {isFieldRequired('location_id') && (
              <>
                <Text style={styles.sectionTitle}>
                  {t('incidents.location')} <Text style={styles.required}>*</Text>
                </Text>
                <TreeSelect
                  label={t('addIncident.selectLocation')}
                  value={selectedLocation?.name || ''}
                  data={locations}
                  onSelect={(node) => setSelectedLocation(node as DropdownOption | null)}
                  required={true}
                  error={errors.location_id}
                  leafOnly={true}
                  placeholder={t('addIncident.selectLocation')}
                  iconType="location"
                />
              </>
            )}

            {/* Source field - always mobile for mobile app, non-editable */}
            <Text style={styles.sectionTitle}>
              {t('incidents.source')} {isFieldRequired('source') && <Text style={styles.required}>*</Text>}
            </Text>
            <Dropdown
              label={t('addQuery.selectSource')}
              value={selectedSource?.name || ''}
              options={sourceOptions}
              onSelect={() => { }} // No-op, field is not editable
              required={isFieldRequired('source')}
              error={errors.source}
              disabled={true}
            />

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
                    {i18n.language === 'en' ? category.name : category.name_ar} <Text style={styles.required}>*</Text>
                  </Text>
                  <Dropdown
                    label={`${t('common.select')} ${i18n.language === 'en' ? category.name : category.name_ar}`}
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
                      {t('incidents.priority')} <Text style={styles.required}>*</Text>
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
                      {t('incidents.severity')} <Text style={styles.required}>*</Text>
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
                  {t('incidents.assignee')} <Text style={styles.required}>*</Text>
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
                  {t('incidents.department')} <Text style={styles.required}>*</Text>
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
                  {t('incidents.description')} <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={[styles.descriptionInput, errors.description && styles.inputError, { textAlign: i18n.language === 'ar' ? 'right' : 'left' }]}
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

            {/* Comment - only show if required */}
            {isFieldRequired('comment') && (
              <>
                <Text style={styles.sectionTitle}>
                  {t('incidents.comment')} <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={[styles.descriptionInput, errors.comment && styles.inputError, { textAlign: i18n.language === 'ar' ? 'right' : 'left' }]}
                  placeholder={t('incidents.addCommentPlaceholder', 'Add a comment...')}
                  multiline
                  value={comment}
                  onChangeText={(text) => {
                    setComment(text);
                    if (errors.comment) setErrors(prev => ({ ...prev, comment: '' }));
                  }}
                  placeholderTextColor="#999"
                  textAlignVertical="top"
                />
                {errors.comment && <Text style={styles.errorText}>{errors.comment}</Text>}
              </>
            )}

            {/* Reporter Name - only show if required */}
            {isFieldRequired('reporter_name') && (
              <>
                <Text style={styles.sectionTitle}>
                  {t('addQuery.reporterName')} <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={[styles.input, errors.reporter_name && styles.inputError, { textAlign: i18n.language === 'ar' ? 'right' : 'left' }]}
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
                  {t('addQuery.reporterEmail')} <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={[styles.input, errors.reporter_email && styles.inputError, { textAlign: i18n.language === 'ar' ? 'right' : 'left' }]}
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
                    {t('common.gettingAddress')}
                  </Text>
                )}
                {(locationData?.address || locationData?.city) && (
                  <Text style={{ fontSize: 12, color: '#4CAF50', marginTop: 4, marginLeft: 4 }}>
                    {t('common.locationLabel', { address: locationData.city || locationData.address })}
                  </Text>
                )}
              </>
            )}

            {/* Attachments Section */}
            {(isFieldRequired('attachments') || isFieldRequired('attachment')) && (
              <>
                <Text style={styles.sectionTitle}>
                  {t('incidents.attachments')} <Text style={styles.required}>*</Text>
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
                        {t('addComplaint.stopRecording')} ({formatDuration(recordingDuration)})
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={styles.attachmentButton} onPress={showAttachmentOptions}>
                      <Ionicons name="cloud-upload-outline" size={24} color="#3498DB" />
                      <Text style={styles.attachmentButtonText}>
                        {attachments.length > 0 ? t('addIncident.addMoreFiles') : t('addIncident.tapToUpload')}
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
                <Text style={styles.pickerModalTitle}>{t('incidents.addAttachment', 'Add Attachment')}</Text>

                <TouchableOpacity
                  style={styles.pickerOption}
                  onPress={() => {
                    setAttachmentPickerVisible(false);
                    handleTakePhoto();
                  }}
                >
                  <Ionicons name="camera" size={24} color="#3498DB" />
                  <Text style={styles.pickerOptionText}>{t('incidents.takePhoto', 'Take Photo')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.pickerOption}
                  onPress={() => {
                    setAttachmentPickerVisible(false);
                    handlePickFromGallery();
                  }}
                >
                  <Ionicons name="images" size={24} color="#3498DB" />
                  <Text style={styles.pickerOptionText}>{t('common.chooseFromGallery', 'Choose from Gallery')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.pickerOption}
                  onPress={() => {
                    setAttachmentPickerVisible(false);
                    handlePickDocument();
                  }}
                >
                  <Ionicons name="document" size={24} color="#3498DB" />
                  <Text style={styles.pickerOptionText}>{t('common.chooseFile', 'Choose File')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.pickerOption}
                  onPress={() => {
                    setAttachmentPickerVisible(false);
                    startRecording();
                  }}
                >
                  <Ionicons name="mic" size={24} color="#3498DB" />
                  <Text style={styles.pickerOptionText}>{t('common.recordVoice', 'Record Voice')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.pickerCancelButton}
                  onPress={() => setAttachmentPickerVisible(false)}
                >
                  <Text style={styles.pickerCancelText}>{t('common.cancel', 'Cancel')}</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>

          <View style={[styles.submitContainer, { paddingBottom: insets.bottom }]}>
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
      {pendingWatermarks.map((pending) => (
        <WatermarkProcessor
          key={pending.id}
          imageUri={pending.imageUri}
          data={pending.data}
          onComplete={(watermarkedUri) =>
            handleWatermarkComplete(pending.id, watermarkedUri, pending.originalName)
          }
        />
      ))}

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
