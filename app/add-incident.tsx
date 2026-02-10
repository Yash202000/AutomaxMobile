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
  ActionSheetIOS,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { createIncident, uploadMultipleAttachments } from '@/src/api/incidents';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { getClassificationsTree } from '@/src/api/classifications';
import { getLocationsTree } from '@/src/api/locations';
import { getWorkflows } from '@/src/api/workflow';
import { getUsers } from '@/src/api/users';
import { getDepartments } from '@/src/api/departments';
import { getLookupCategories, LookupCategory, LookupValue } from '@/src/api/lookups';
import TreeSelect, { TreeNode } from '@/src/components/TreeSelect';
import LocationPicker, { LocationData } from '@/src/components/LocationPickerOSM';
import { WatermarkProcessor, WatermarkData } from '@/src/components/WatermarkProcessor';
import { WatermarkPreview } from '@/src/components/WatermarkPreview';
import { DynamicLookupField } from '@/src/components/DynamicLookupField';
import { crashLogger } from '@/src/utils/crashLogger';
import { generateWatermarkedFilename, createWatermarkText, WatermarkInfo } from '@/src/utils/watermarkUtils';
import * as FileSystem from 'expo-file-system/legacy';
import { useAuth } from '@/src/context/AuthContext';
import { compressImage } from '@/src/utils/imageCompression';

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

// File size limit: 10MB (adjust based on your server configuration)
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const AddIncidentScreen = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { user } = useAuth();

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

  // Attachments state
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
  const hasFetchedDataRef = useRef(false);

  // Monitor locationData changes and keep ref in sync
  useEffect(() => {
    locationDataRef.current = locationData; // Keep ref updated
  }, [locationData]);

  // Workflow state
  const [matchedWorkflow, setMatchedWorkflow] = useState<Workflow | null>(null);
  const [allWorkflows, setAllWorkflows] = useState<Workflow[]>([]);

  // Data state
  const [classifications, setClassifications] = useState<TreeNode[]>([]);
  const [locations, setLocations] = useState<TreeNode[]>([]);
  const [users, setUsers] = useState<DropdownOption[]>([]);
  const [departments, setDepartments] = useState<DropdownOption[]>([]);
  const [lookupCategories, setLookupCategories] = useState<LookupCategory[]>([]);
  const [lookupValues, setLookupValues] = useState<Record<string, any>>({});

  // Loading state
  const [loadingData, setLoadingData] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Errors
  const [errors, setErrors] = useState<Record<string, string>>({});

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
      // Get classifications filtered by incident type
      const results = await Promise.all([
        getClassificationsTree('incident').catch(err => ({ success: false, error: err.message })),
        getLocationsTree().catch(err => ({ success: false, error: err.message })),
        getWorkflows(true, 'incident').catch(err => ({ success: false, error: err.message })),
        getUsers().catch(err => ({ success: false, error: err.message })),
        getDepartments().catch(err => ({ success: false, error: err.message })),
        getLookupCategories().catch(err => ({ success: false, error: err.message })),
      ]);

      const [classRes, locRes, workflowRes, userRes, deptRes, lookupRes] = results;

      if (classRes.success && classRes.data && Array.isArray(classRes.data)) {
        // Filter to only show classifications that can be used for incidents
        // Types: 'incident', 'all', or no type (legacy)
        const filterForIncidents = (nodes: TreeNode[]): TreeNode[] => {
          return nodes.map(node => {
            const nodeWithType = node as any;
            const validType = !nodeWithType.type ||
                             nodeWithType.type === 'incident' ||
                             nodeWithType.type === 'all';

            if (!validType) return null;

            // Ensure id is a string
            const filteredNode: TreeNode = {
              id: String(node.id),
              name: node.name,
              parent_id: node.parent_id ? String(node.parent_id) : null,
            };

            if (node.children && node.children.length > 0) {
              const filteredChildren = filterForIncidents(node.children).filter(Boolean) as TreeNode[];
              if (filteredChildren.length > 0) {
                filteredNode.children = filteredChildren;
              }
            }

            return filteredNode;
          }).filter(Boolean) as TreeNode[];
        };

        let filteredClassifications = filterForIncidents(classRes.data);

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

          filteredClassifications = filterByUserAccess(filteredClassifications);
        }

        setClassifications(filteredClassifications);
      } else {
        setClassifications([]);
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
      if (workflowRes.success && workflowRes.data) {
        setAllWorkflows(workflowRes.data);
      }
      if (userRes.success && userRes.data) {
        setUsers(userRes.data.map((u: any) => ({
          id: u.id,
          name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email || 'Unknown User'
        })));
      }
      if (deptRes.success && deptRes.data) {
        setDepartments(deptRes.data.map((d: any) => ({ id: d.id, name: d.name })));
      }
      if (lookupRes.success && lookupRes.data) {
        // Filter to only show categories that should be added to incident form
        const incidentCategories = lookupRes.data.filter((cat: LookupCategory) => cat.add_to_incident_form && cat.is_active);
        setLookupCategories(incidentCategories);
      }

      // Check if critical workflow data failed to load
      if (!workflowRes.success || !workflowRes.data || workflowRes.data.length === 0) {
        Alert.alert(
          'Warning',
          'Failed to load workflows. You may not be able to create incidents until workflows are available.',
          [
            { text: 'Retry', onPress: () => fetchAllData() },
            { text: 'Go Back', onPress: () => router.back() }
          ]
        );
      }
    } catch (error) {
      console.error('Error fetching data:', error);

      // Log to crash logger with context
      crashLogger.logError(error as Error, {
        screen: 'AddIncidentScreen',
        action: 'fetchAllData',
        context: 'Failed to load classifications, locations, workflows, users, or departments',
      }).catch(err => console.error('Failed to log error:', err));

      Alert.alert(
        'Error',
        'Failed to load required data. Please check your connection and try again.',
        [
          { text: 'Retry', onPress: () => fetchAllData() },
          { text: 'Go Back', onPress: () => router.back() }
        ]
      );
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
    geolocation: 'Geolocation',
    reporter_name: 'Reporter Name',
    reporter_email: 'Reporter Email',
    attachments: 'Attachments',
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
      // Check for lookup field requirements (format: lookup:CATEGORY_CODE)
      if (field.startsWith('lookup:')) {
        const categoryCode = field.replace('lookup:', '');
        const category = lookupCategories.find(c => c.code === categoryCode);
        if (category) {
          const value = lookupValues[category.id];
          // For multiselect, check if array is empty
          if (category.field_type === 'multiselect') {
            if (!value || (Array.isArray(value) && value.length === 0)) {
              newErrors[field] = `${category.name} is required`;
            }
          } else if (!value) {
            newErrors[field] = `${category.name} is required`;
          }
        }
        continue;
      }

      if (field === 'attachments') {
        // Check attachments separately
        if (attachments.length === 0) {
          newErrors.attachments = 'At least one attachment is required';
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
        case 'priority':
          value = selectedPriority?.id;
          break;
        case 'severity':
          value = selectedSeverity?.id;
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

  const showAttachmentOptions = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo', 'Choose from Gallery', 'Choose File'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            handleTakePhoto();
          } else if (buttonIndex === 2) {
            handlePickFromGallery();
          } else if (buttonIndex === 3) {
            handlePickDocument();
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
        Alert.alert(
          'Location Required',
          'Please wait for your location to be detected before taking a photo, or click "Get Current Location" button.',
          [{ text: 'OK' }]
        );
        return;
      }

      // If we have coordinates but no address yet (still loading)
      if (locationData?.latitude && !locationData?.address && !locationData?.city) {

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
      }
    }

    await proceedWithCamera();
  };

  const proceedWithCamera = async () => {

    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert(
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

        // Take first image
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
      crashLogger.logError(error as Error, {
        screen: 'AddIncidentScreen',
        action: 'takePhoto',
        context: 'Failed to take photo with camera',
      }).catch(err => console.error('Failed to log error:', err));
      Alert.alert('Error', 'Failed to take photo');
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
    if (errors.attachments) {
      setErrors(prev => ({ ...prev, attachments: '' }));
    }
  }, [errors.attachments]);

  const handlePickFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
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
          if (errors.attachments) {
            setErrors(prev => ({ ...prev, attachments: '' }));
          }
        }

        // Show warning for oversized files
        if (oversizedFiles.length > 0) {
          Alert.alert(
            'Files Too Large',
            `The following files exceed ${MAX_FILE_SIZE_MB}MB limit and were skipped:\n\n${oversizedFiles.join('\n')}`,
            [{ text: 'OK' }]
          );
        }
      }
    } catch (error) {
      console.error('Error picking from gallery:', error);
      crashLogger.logError(error as Error, {
        screen: 'AddIncidentScreen',
        action: 'pickFromGallery',
        context: 'Failed to pick image from gallery',
      }).catch(err => console.error('Failed to log error:', err));
      Alert.alert('Error', 'Failed to pick from gallery');
    }
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets) {
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
              type: asset.mimeType || 'application/octet-stream',
              size: fileSize,
            });
          }
        });

        // Add valid files
        if (validFiles.length > 0) {
          setAttachments(prev => [...prev, ...validFiles]);
          if (errors.attachments) {
            setErrors(prev => ({ ...prev, attachments: '' }));
          }
        }

        // Show warning for oversized files
        if (oversizedFiles.length > 0) {
          Alert.alert(
            'Files Too Large',
            `The following files exceed ${MAX_FILE_SIZE_MB}MB limit and were skipped:\n\n${oversizedFiles.join('\n')}`,
            [{ text: 'OK' }]
          );
        }
      }
    } catch (error) {
      console.error('Error picking document:', error);
      crashLogger.logError(error as Error, {
        screen: 'AddIncidentScreen',
        action: 'pickDocument',
        context: 'Failed to pick document',
      }).catch(err => console.error('Failed to log error:', err));
      Alert.alert('Error', 'Failed to pick document');
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleLocationChange = (location: LocationData | undefined) => {
    setLocationData(location);
    if (location && errors.geolocation) {
      setErrors(prev => ({ ...prev, geolocation: '' }));
    }
  };

  const handleLookupChange = (categoryId: string, value: any) => {
    setLookupValues(prev => {
      if (!value || (Array.isArray(value) && value.length === 0)) {
        const newValues = { ...prev };
        delete newValues[categoryId];
        return newValues;
      }
      return { ...prev, [categoryId]: value };
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
      // Show first error
      const firstError = Object.values(errors)[0];
      if (firstError) {
        Alert.alert('Validation Error', firstError);
      }
      return;
    }

    setSubmitting(true);

    try {
      // Double-check matchedWorkflow exists with valid id
      if (!matchedWorkflow || !matchedWorkflow.id) {
        setSubmitting(false);
        Alert.alert('Error', 'No workflow matched. Please select classification, location, or source.');
        return;
      }

      // Validate priority and severity are valid numbers
      const priorityNum = parseInt(selectedPriority.id);
      const severityNum = parseInt(selectedSeverity.id);
      if (isNaN(priorityNum) || isNaN(severityNum)) {
        setSubmitting(false);
        Alert.alert('Error', 'Invalid priority or severity selected.');
        return;
      }

      const incidentData: any = {
        title: title.trim(),
        workflow_id: matchedWorkflow.id,
        priority: priorityNum,
        severity: severityNum,
      };

    if (description.trim()) incidentData.description = description.trim();
    if (selectedClassification) incidentData.classification_id = selectedClassification.id;
    if (selectedLocation) incidentData.location_id = selectedLocation.id;
    if (selectedSource) incidentData.source = selectedSource.id;
    if (selectedAssignee) incidentData.assignee_id = selectedAssignee.id;
    if (selectedDepartment) incidentData.department_id = selectedDepartment.id;
    if (locationData) {
      incidentData.latitude = locationData.latitude;
      incidentData.longitude = locationData.longitude;
      if (locationData.address) incidentData.address = locationData.address;
      if (locationData.city) incidentData.city = locationData.city;
      if (locationData.state) incidentData.state = locationData.state;
      if (locationData.country) incidentData.country = locationData.country;
      if (locationData.postal_code) incidentData.postal_code = locationData.postal_code;
    }
    if (reporterName.trim()) incidentData.reporter_name = reporterName.trim();
    if (reporterEmail.trim()) incidentData.reporter_email = reporterEmail.trim();

    // Separate lookup values by field type
    const selectLookupIds: string[] = [];
    const customLookupFields: Record<string, any> = {};

    for (const [categoryId, value] of Object.entries(lookupValues)) {
      const category = lookupCategories.find(c => c.id === categoryId);
      if (!category) continue;

      const fieldType = category.field_type || 'select';

      if (fieldType === 'select' || fieldType === 'multiselect') {
        // Add to lookup_value_ids array
        if (Array.isArray(value)) {
          selectLookupIds.push(...value.filter(Boolean));
        } else if (value) {
          selectLookupIds.push(value);
        }
      } else {
        // Add to custom_lookup_fields with metadata
        customLookupFields[`lookup:${category.code}`] = {
          value: value,
          field_type: fieldType,
          category_id: categoryId,
        };
      }
    }

    if (selectLookupIds.length > 0) {
      incidentData.lookup_value_ids = selectLookupIds;
    }

    if (Object.keys(customLookupFields).length > 0) {
      incidentData.custom_lookup_fields = customLookupFields;
    }

    const response = await createIncident(incidentData);

      if (response.success && response.data && response.data.id) {
        // Upload attachments if any
        if (attachments.length > 0) {
          try {
            const uploadResult = await uploadMultipleAttachments(response.data.id, attachments);
            if (!uploadResult.success && uploadResult.errors) {
              Alert.alert(
                'Partial Success',
                'Incident created but some attachments failed to upload.',
                [{ text: 'OK', onPress: () => router.back() }]
              );
              setSubmitting(false);
              return;
            }
          } catch (uploadError) {
            console.error('Attachment upload error:', uploadError);

            // Log attachment upload error with context
            crashLogger.logError(uploadError as Error, {
              screen: 'AddIncidentScreen',
              action: 'uploadAttachments',
              incidentId: response.data.id,
              attachmentCount: attachments.length,
              context: 'Incident created but attachment upload failed',
            }).catch(err => console.error('Failed to log error:', err));

            Alert.alert(
              'Partial Success',
              'Incident created but attachment upload failed.',
              [{ text: 'OK', onPress: () => router.back() }]
            );
            setSubmitting(false);
            return;
          }
        }

        setSubmitting(false);
        Alert.alert('Success', 'Incident created successfully.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else {
        setSubmitting(false);
        const errorMsg = response.error || 'Unknown error occurred';
        Alert.alert('Error', `Failed to create incident: ${errorMsg}`);
      }
    } catch (error) {
      console.error('Unexpected error during incident creation:', error);

      // Log incident creation error with full context
      crashLogger.logError(error as Error, {
        screen: 'AddIncidentScreen',
        action: 'createIncident',
        title: title,
        workflowId: matchedWorkflow?.id,
        priority: selectedPriority?.id,
        severity: selectedSeverity?.id,
        classificationId: selectedClassification?.id,
        locationId: selectedLocation?.id,
        sourceId: selectedSource?.id,
        hasAttachments: attachments.length > 0,
        context: 'Failed to create incident',
      }).catch(err => console.error('Failed to log error:', err));

      setSubmitting(false);
      Alert.alert(
        'Error',
        `An unexpected error occurred: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`
      );
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
              {t('addIncident.incidentTitle')} <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, errors.title && styles.inputError]}
              placeholder={t('addIncident.titlePlaceholder')}
              value={title}
              onChangeText={(text) => {
                setTitle(text);
                if (errors.title) setErrors(prev => ({ ...prev, title: '' }));
              }}
              placeholderTextColor="#999"
            />
            {errors.title && <Text style={styles.errorText}>{errors.title}</Text>}

            {/* Classification - only show if required */}
            {isFieldRequired('classification_id') && (
              <>
                <Text style={styles.sectionTitle}>
                  {t('incidents.classification')} <Text style={styles.required}>*</Text>
                </Text>
                <TreeSelect
                  label={t('addIncident.selectClassification')}
                  value={selectedClassification?.name || ''}
                  data={classifications}
                  onSelect={(node) => setSelectedClassification(node as DropdownOption | null)}
                  required={true}
                  error={errors.classification_id}
                  leafOnly={true}
                  placeholder={t('addIncident.selectClassification')}
                />
              </>
            )}

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
                />
              </>
            )}

            {/* Source - only show if required */}
            {isFieldRequired('source') && (
              <>
                <Text style={styles.sectionTitle}>
                  {t('addIncident.source')} <Text style={styles.required}>*</Text>
                </Text>
                <Dropdown
                  label={t('addIncident.selectSource')}
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

              return (
                <DynamicLookupField
                  key={category.id}
                  category={category}
                  value={lookupValues[category.id]}
                  onChange={handleLookupChange}
                  required={isRequired}
                  error={errors[lookupFieldKey]}
                />
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
                      label={t('addIncident.selectPriority')}
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
                      label={t('addIncident.selectSeverity')}
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
                  label={t('addIncident.selectAssignee')}
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
                  label={t('addIncident.selectDepartment')}
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
                  style={[styles.descriptionInput, errors.description && styles.inputError]}
                  placeholder={t('addIncident.descriptionPlaceholder')}
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
                  {t('addIncident.reporterName')} <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={[styles.input, errors.reporter_name && styles.inputError]}
                  placeholder={t('addIncident.reporterNamePlaceholder')}
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
                  {t('addIncident.reporterEmail')} <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={[styles.input, errors.reporter_email && styles.inputError]}
                  placeholder={t('addIncident.reporterEmailPlaceholder')}
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
                  label={t('details.geolocation')}
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

            {/* Attachments - only show if required */}
            {isFieldRequired('attachments') && (
              <>
                <Text style={styles.sectionTitle}>
                  {t('incidents.attachments')} <Text style={styles.required}>*</Text>
                </Text>
                <View style={[styles.attachmentsContainer, errors.attachments && styles.attachmentsContainerError]}>
                  {attachments.length > 0 && (
                    <View style={styles.attachmentsList}>
                      {attachments.map((file, index) => (
                        <View key={index} style={styles.attachmentItem}>
                          <View style={styles.attachmentInfo}>
                            <Ionicons name="document-attach" size={20} color="#2EC4B6" />
                            <Text style={styles.attachmentName} numberOfLines={1}>
                              {file.name}
                            </Text>
                            <Text style={styles.attachmentSize}>
                              ({file.size ? (file.size / 1024).toFixed(1) + ' KB' : 'N/A'})
                            </Text>
                          </View>
                          <TouchableOpacity onPress={() => removeAttachment(index)}>
                            <Ionicons name="close-circle" size={22} color="#E74C3C" />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                  <TouchableOpacity style={styles.attachmentButton} onPress={showAttachmentOptions}>
                    <Ionicons name="cloud-upload-outline" size={24} color="#2EC4B6" />
                    <Text style={styles.attachmentButtonText}>
                      {attachments.length > 0 ? t('addIncident.addMoreFiles') : t('addIncident.tapToUpload')}
                    </Text>
                  </TouchableOpacity>
                </View>
                {errors.attachments && <Text style={styles.errorText}>{errors.attachments}</Text>}
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
                  <Ionicons name="camera" size={24} color="#2EC4B6" />
                  <Text style={styles.pickerOptionText}>Take Photo</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.pickerOption}
                  onPress={() => {
                    setAttachmentPickerVisible(false);
                    handlePickFromGallery();
                  }}
                >
                  <Ionicons name="images" size={24} color="#2EC4B6" />
                  <Text style={styles.pickerOptionText}>Choose from Gallery</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.pickerOption}
                  onPress={() => {
                    setAttachmentPickerVisible(false);
                    handlePickDocument();
                  }}
                >
                  <Ionicons name="document" size={24} color="#2EC4B6" />
                  <Text style={styles.pickerOptionText}>Choose File</Text>
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

          <View style={[styles.submitContainer, { paddingBottom: 20 + insets.bottom }]}>
            <TouchableOpacity
              style={[styles.submitButton, submitting && styles.disabledButton]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>{t('addIncident.createButton')}</Text>
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
    height: 120,
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
  // Attachment styles
  attachmentsContainer: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  attachmentsContainerError: {
    borderColor: '#E74C3C',
  },
  attachmentsList: {
    marginBottom: 12,
  },
  attachmentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  attachmentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  attachmentName: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
    flex: 1,
  },
  attachmentSize: {
    fontSize: 12,
    color: '#999',
    marginLeft: 4,
  },
  attachmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderWidth: 2,
    borderColor: '#2EC4B6',
    borderStyle: 'dashed',
    borderRadius: 10,
  },
  attachmentButtonText: {
    marginLeft: 8,
    color: '#2EC4B6',
    fontSize: 14,
    fontWeight: '500',
  },
  // Attachment picker modal styles
  pickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerModalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    width: '85%',
    maxWidth: 340,
  },
  pickerModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 10,
    backgroundColor: '#F8F9FA',
    marginBottom: 10,
  },
  pickerOptionText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
  pickerCancelButton: {
    padding: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  pickerCancelText: {
    fontSize: 16,
    color: '#E74C3C',
    fontWeight: '500',
  },
});

export default AddIncidentScreen;
