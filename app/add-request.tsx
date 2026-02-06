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
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { createRequest, uploadMultipleAttachments } from '@/src/api/incidents';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { getClassificationsTree } from '@/src/api/classifications';
import { getLocations } from '@/src/api/locations';
import { getWorkflows } from '@/src/api/workflow';
import { getUsers } from '@/src/api/users';
import { getDepartments } from '@/src/api/departments';
import { getLookupCategories, LookupCategory, LookupValue } from '@/src/api/lookups';
import LocationPicker, { LocationData } from '@/src/components/LocationPickerOSM';
import TreeSelect, { TreeNode } from '@/src/components/TreeSelect';
import { WatermarkProcessor, WatermarkData } from '@/src/components/WatermarkProcessor';
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
                      <Ionicons name="checkmark" size={20} color="#9B59B6" />
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

const AddRequestScreen = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [reporterName, setReporterName] = useState('');
  const [reporterEmail, setReporterEmail] = useState('');
  const [selectedClassification, setSelectedClassification] = useState<DropdownOption | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<DropdownOption | null>(null);
  const [selectedSource, setSelectedSource] = useState<DropdownOption | null>(null);
  const [selectedAssignee, setSelectedAssignee] = useState<DropdownOption | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<DropdownOption | null>(null);
  const [selectedPriority, setSelectedPriority] = useState<DropdownOption>(priorityOptions[2]);
  const [selectedSeverity, setSelectedSeverity] = useState<DropdownOption>(severityOptions[2]);

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

  // Monitor pending watermarks
  useEffect(() => {
    // Track watermark queue changes
  }, [pendingWatermarks]);

  // Geolocation state
  const [locationData, setLocationData] = useState<LocationData | undefined>(undefined);
  const locationDataRef = useRef<LocationData | undefined>(undefined);

  // Keep ref synced with state to avoid stale data during re-renders
  useEffect(() => {
    locationDataRef.current = locationData;
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
      const [classRes, locRes, workflowRes, userRes, deptRes, lookupRes] = await Promise.all([
        getClassificationsTree('request'),
        getLocations(),
        getWorkflows(true, 'request'),
        getUsers(),
        getDepartments(),
        getLookupCategories().catch(err => ({ success: false, error: err.message })),
      ]);

      if (classRes.success && classRes.data && Array.isArray(classRes.data)) {
        // Normalize classification tree data
        const normalizeClassifications = (nodes: TreeNode[]): TreeNode[] => {
          return nodes.map(node => ({
            id: String(node.id),
            name: node.name,
            parent_id: node.parent_id ? String(node.parent_id) : null,
            children: node.children ? normalizeClassifications(node.children) : undefined,
          }));
        };
        setClassifications(normalizeClassifications(classRes.data));
      } else {
        setClassifications([]);
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
        // Filter to only show categories that should be added to request form
        const requestCategories = lookupRes.data.filter((cat: LookupCategory) => cat.add_to_incident_form && cat.is_active);
        setLookupCategories(requestCategories);
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

      // Check attachments separately
      if (field === 'attachments') {
        if (attachments.length === 0) {
          newErrors.attachments = 'At least one attachment is required';
        }
        continue;
      }

      // Check geolocation separately
      if (field === 'geolocation') {
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

  // Attachment handling functions
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

        // Check again after waiting (need to add ref to add-request.tsx)
        if (locationData?.latitude && !locationData?.address && !locationData?.city) {
          Alert.alert(
            'Location Address Unavailable',
            'We have your GPS coordinates but couldn\'t get the street address. Continue with coordinates only?',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Continue', onPress: () => handleTakePhoto() } // Retry
            ]
          );
          return;
        }
      }
    }

    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Camera permission is required to take photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
        exif: true,
      });

      if (!result.canceled && result.assets) {
        // Process each captured image with visual watermark
        const newPendingWatermarks: PendingWatermark[] = result.assets.map((asset, index) => {

          const originalFileName = asset.fileName || `photo_${Date.now()}_${index}.jpg`;
          // Use ref instead of state to avoid stale data
          const currentLocation = locationDataRef.current;

          const watermarkedFileName = generateWatermarkedFilename(originalFileName, {
            appName: 'Automax',
            userName: user ? `${user.first_name} ${user.last_name}`.trim() || user.username : undefined,
            userId: user?.id,
            timestamp: new Date(),
            location: currentLocation ? `${currentLocation.city || ''} ${currentLocation.state || ''}`.trim() : undefined,
          });

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

          return {
            id: `watermark_${Date.now()}_${index}`,
            imageUri: asset.uri,
            data: watermarkData,
            originalName: watermarkedFileName,
          };
        });

        setPendingWatermarks(prev => [...prev, ...newPendingWatermarks]);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  // Handle watermark completion
  const handleWatermarkComplete = useCallback((id: string, watermarkedUri: string, originalName: string) => {
    // Add watermarked image to attachments
    setAttachments(prev => [
      ...prev,
      {
        uri: watermarkedUri,
        name: originalName,
        type: 'image/jpeg',
      },
    ]);

    // Remove from pending list
    setPendingWatermarks(prev => prev.filter(w => w.id !== id));

    // Clear error if any
    if (errors.attachments) {
      setErrors(prev => ({ ...prev, attachments: '' }));
    }
  }, [errors.attachments]);

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

      if (!result.canceled && result.assets) {
        const newAttachments = result.assets.map(asset => ({
          uri: asset.uri,
          name: asset.fileName || `image_${Date.now()}.jpg`,
          type: asset.mimeType || 'image/jpeg',
          size: asset.fileSize,
        }));
        setAttachments(prev => [...prev, ...newAttachments]);
        if (errors.attachments) {
          setErrors(prev => ({ ...prev, attachments: '' }));
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
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets) {
        const newAttachments = result.assets.map(asset => ({
          uri: asset.uri,
          name: asset.name,
          type: asset.mimeType || 'application/octet-stream',
          size: asset.size,
        }));
        setAttachments(prev => [...prev, ...newAttachments]);
        if (errors.attachments) {
          setErrors(prev => ({ ...prev, attachments: '' }));
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

  const handleLocationChange = (location: LocationData | undefined) => {
    setLocationData(location);
    if (location && errors.geolocation) {
      setErrors(prev => ({ ...prev, geolocation: '' }));
    }
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

    const requestData: any = {
      title: title.trim(),
      workflow_id: matchedWorkflow!.id,
      priority: parseInt(selectedPriority.id),
      severity: parseInt(selectedSeverity.id),
    };

    if (description.trim()) requestData.description = description.trim();
    if (selectedClassification) requestData.classification_id = selectedClassification.id;
    if (selectedLocation) requestData.location_id = selectedLocation.id;
    if (selectedSource) requestData.source = selectedSource.id;
    if (selectedAssignee) requestData.assignee_id = selectedAssignee.id;
    if (selectedDepartment) requestData.department_id = selectedDepartment.id;
    if (locationData) {
      requestData.latitude = locationData.latitude;
      requestData.longitude = locationData.longitude;
      if (locationData.address) requestData.address = locationData.address;
      if (locationData.city) requestData.city = locationData.city;
      if (locationData.state) requestData.state = locationData.state;
      if (locationData.country) requestData.country = locationData.country;
      if (locationData.postal_code) requestData.postal_code = locationData.postal_code;
    }
    if (reporterName.trim()) requestData.reporter_name = reporterName.trim();
    if (reporterEmail.trim()) requestData.reporter_email = reporterEmail.trim();

    // Add lookup values if any selected
    const selectedLookupIds = Object.values(lookupValues).filter(Boolean);
    if (selectedLookupIds.length > 0) {
      requestData.lookup_value_ids = selectedLookupIds;
    }

    const response = await createRequest(requestData);

    if (response.success && response.data) {
      // Upload attachments if any
      if (attachments.length > 0) {
        await uploadMultipleAttachments(response.data.id, attachments);
      }

      setSubmitting(false);
      Alert.alert('Success', 'Request created successfully.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } else {
      setSubmitting(false);
      Alert.alert('Error', `Failed to create request: ${response.error}`);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Add Request</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close-circle" size={28} color="#E74C3C" />
        </TouchableOpacity>
      </View>

      {loadingData ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#9B59B6" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : (
        <>
          <ScrollView style={styles.formContainer} showsVerticalScrollIndicator={false}>
            <View style={styles.workflowCard}>
              <View style={styles.workflowHeader}>
                <Ionicons name="git-branch" size={20} color="#9B59B6" />
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
              placeholder={t('addRequest.titlePlaceholder')}
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
                  Classification <Text style={styles.required}>*</Text>
                </Text>
                <TreeSelect
                  label={t('addRequest.selectClassification')}
                  value={selectedClassification?.name || ''}
                  data={classifications}
                  onSelect={(node) => setSelectedClassification(node as DropdownOption | null)}
                  required={true}
                  error={errors.classification_id}
                  leafOnly={true}
                  placeholder={t('addRequest.selectClassification')}
                />
              </>
            )}

            {/* Location - only show if required */}
            {isFieldRequired('location_id') && (
              <>
                <Text style={styles.sectionTitle}>
                  Location <Text style={styles.required}>*</Text>
                </Text>
                <Dropdown
                  label={t('addRequest.selectLocation')}
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
                  label={t('addRequest.selectSource')}
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
                      label={t('addRequest.selectPriority')}
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
                      label={t('addRequest.selectSeverity')}
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
                  label={t('addRequest.selectAssignee')}
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
                  label={t('addRequest.selectDepartment')}
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
                  placeholder={t('addRequest.descriptionPlaceholder')}
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
                  placeholder={t('addRequest.reporterNamePlaceholder')}
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
                  placeholder={t('addRequest.reporterEmailPlaceholder')}
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

            {/* Attachments - only show if required */}
            {isFieldRequired('attachments') && (
              <>
                <Text style={styles.sectionTitle}>
                  Attachments <Text style={styles.required}>*</Text>
                </Text>
                <View style={[styles.attachmentsContainer, errors.attachments && styles.attachmentsContainerError]}>
                  {attachments.length > 0 && (
                    <View style={styles.attachmentsList}>
                      {attachments.map((file, index) => (
                        <View key={index} style={styles.attachmentItem}>
                          <View style={styles.attachmentInfo}>
                            <Ionicons name="document-attach" size={20} color="#9B59B6" />
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
                    <Ionicons name="cloud-upload-outline" size={24} color="#9B59B6" />
                    <Text style={styles.attachmentButtonText}>
                      {attachments.length > 0 ? 'Add more files' : 'Tap to upload files'}
                    </Text>
                  </TouchableOpacity>
                </View>
                {errors.attachments && <Text style={styles.errorText}>{errors.attachments}</Text>}
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
                  <Ionicons name="camera" size={24} color="#9B59B6" />
                  <Text style={styles.pickerOptionText}>Take Photo</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.pickerOption}
                  onPress={() => {
                    setAttachmentPickerVisible(false);
                    handlePickFromGallery();
                  }}
                >
                  <Ionicons name="images" size={24} color="#9B59B6" />
                  <Text style={styles.pickerOptionText}>Choose from Gallery</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.pickerOption}
                  onPress={() => {
                    setAttachmentPickerVisible(false);
                    handlePickDocument();
                  }}
                >
                  <Ionicons name="document" size={24} color="#9B59B6" />
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
                <Text style={styles.submitButtonText}>{t('addRequest.createButton')}</Text>
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
    backgroundColor: '#F3E8FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#9B59B6',
  },
  workflowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  workflowLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9B59B6',
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
    backgroundColor: '#9B59B6',
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
    alignItems: 'center',
    justifyContent: 'space-between',
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
    padding: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#9B59B6',
    borderRadius: 8,
  },
  attachmentButtonText: {
    color: '#9B59B6',
    fontSize: 14,
    marginLeft: 8,
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
    width: '80%',
    maxWidth: 300,
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
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  pickerOptionText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
  pickerCancelButton: {
    marginTop: 8,
    padding: 14,
    alignItems: 'center',
  },
  pickerCancelText: {
    fontSize: 16,
    color: '#E74C3C',
    fontWeight: '600',
  },
});

export default AddRequestScreen;
