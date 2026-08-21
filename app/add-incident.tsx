import { getClassificationsTree } from '@/src/api/classifications';
import { getDepartments } from '@/src/api/departments';
import { createIncident, uploadMultipleAttachments } from '@/src/api/incidents';
import { getLocationsTree, createLocation } from '@/src/api/locations';
import { getLookupCategories, LookupCategory } from '@/src/api/lookups';
import { getUsers } from '@/src/api/users';
import { getWorkflows, matchWorkflow as matchWorkflowAPI } from '@/src/api/workflow';
import { CustomAlert } from '@/src/components/CustomAlert';
import { DynamicLookupField } from '@/src/components/DynamicLookupField';
import LocationPicker, { LocationData } from '@/src/components/LocationPickerOSM';
import TreeSelect, { TreeNode } from '@/src/components/TreeSelect';
import { WatermarkPreview } from '@/src/components/WatermarkPreview';
import { WatermarkProcessor } from '@/src/components/WatermarkProcessor';
import { useAuth } from '@/src/context/AuthContext';
import i18n from '@/src/i18n';
import { crashLogger } from '@/src/utils/crashLogger';
import { compressImage } from '@/src/utils/imageCompression';
import { generateWatermarkedFilename, WatermarkData } from '@/src/utils/watermarkUtils';
import { FontAwesome, Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { t } from 'i18next';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Animated,
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
import { AuthenticatedImageViewer } from '@/src/components/AuthenticatedImageViewer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// When true, skip reverse geocoding + location-dropdown auto-matching after map taps/GPS.
// Mirrors VITE_DISABLE_AUTO_LOCATION_RETRIEVAL from the web client.
const DISABLE_AUTO_LOCATION_RETRIEVAL =
  process.env.EXPO_PUBLIC_DISABLE_AUTO_LOCATION_RETRIEVAL === 'true';

// Shape for a pending (not-yet-persisted) location created from a map selection
interface PendingNewLocation {
  levels: { name: string; type: string; name_ar: string }[];
  /** Index in levels[] where we start creating (levels before this index already exist). */
  startLevelIndex: number;
  virtualId: string;
  name: string;
  name_ar: string;
  parent_id?: string;
}

interface DropdownOption {
  id: string;
  name: string;
}

interface Workflow {
  id: string;
  name: string;
  name_ar: string;
  is_active: boolean;
  is_default?: boolean;
  required_fields?: string[];
  classifications?: { id: string; name: string }[];
  locations?: { id: string; name: string }[];
  sources?: string[];
  priorities?: number[];
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
        <Text style={[styles.dropdownText, !value && styles.placeholderText, { textAlign: "left" }]}>
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
          style={[styles.modalOverlay, { paddingBottom: insets.bottom }]}
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

const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const MAX_ATTACHMENTS_COUNT = Number(process.env.EXPO_PUBLIC_MAX_INCIDENT_ATTACHMENTS) || 10;

const AddIncidentScreen = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { user } = useAuth();

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

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [comment, setComment] = useState('');
  const [reporterName, setReporterName] = useState('');
  const [reporterEmail, setReporterEmail] = useState('');
  const [selectedClassification, setSelectedClassification] = useState<DropdownOption | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<DropdownOption | null>(null);
  const [selectedSource] = useState<DropdownOption>(sourceOptions[0]); // Fixed to mobile, non-editable
  const [selectedAssignee, setSelectedAssignee] = useState<DropdownOption | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<DropdownOption | null>(null);
  const [selectedPriority, setSelectedPriority] = useState<DropdownOption>(priorityOptions[2]); // Medium
  const [selectedSeverity, setSelectedSeverity] = useState<DropdownOption>(severityOptions[2]); // Moderate

  // Attachments state
  const [attachments, setAttachments] = useState<any[]>([]);
  // Kept in sync so callbacks with stale closures (e.g. handleWatermarkComplete,
  // memoized on unrelated deps) can still read the current count reliably.
  const attachmentsCountRef = useRef(0);
  useEffect(() => {
    attachmentsCountRef.current = attachments.length;
  }, [attachments.length]);
  const [attachmentPickerVisible, setAttachmentPickerVisible] = useState(false);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [imageViewerIndex, setImageViewerIndex] = useState(0);

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
  // GPS-only location ref — updated solely from real device GPS, never from map taps or search
  const gpsLocationRef = useRef<LocationData | undefined>(undefined);
  // Tracks the last geo coord pair we processed to avoid duplicate matching calls
  const lastProcessedGeoRef = useRef<string | null>(null);
  // Pending location to create on submit when no match found in master tree
  const [pendingNewLocation, setPendingNewLocation] = useState<PendingNewLocation | null>(null);
  // True while we are resolving a geo-coord against the location master
  const [isMatchingLocation, setIsMatchingLocation] = useState(false);

  // ── Inline toast ─────────────────────────────────────────────────────────────
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'info' | 'error'>('info');
  const toastAnim = useRef(new Animated.Value(0)).current;
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, type: 'info' | 'error' = 'info') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage(message);
    setToastType(type);
    Animated.spring(toastAnim, { toValue: 1, useNativeDriver: true }).start();
    toastTimerRef.current = setTimeout(() => {
      Animated.timing(toastAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() =>
        setToastMessage(null)
      );
    }, 4000);
  }, [toastAnim]);
  // ─────────────────────────────────────────────────────────────────────────────
  const hasFetchedDataRef = useRef(false);

  // Monitor locationData changes and keep ref in sync
  useEffect(() => {
    locationDataRef.current = locationData; // Keep ref updated
  }, [locationData]);

  // Workflow state
  const [matchedWorkflow, setMatchedWorkflow] = useState<Workflow | null>(null);
  const [allWorkflows, setAllWorkflows] = useState<Workflow[]>([]);
  const [isMatchingWorkflow, setIsMatchingWorkflow] = useState(false);

  // Data state
  const [classifications, setClassifications] = useState<TreeNode[]>([]);
  const [locations, setLocations] = useState<TreeNode[]>([]);
  const [masterLocations, setMasterLocations] = useState<TreeNode[]>([]);
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
      // Get classifications filtered by mobile type
      const results = await Promise.all([
        getClassificationsTree('mobile').catch(err => ({ success: false, error: err.message })),
        getLocationsTree().catch(err => ({ success: false, error: err.message })),
        getWorkflows(true, 'incident').catch(err => ({ success: false, error: err.message })),
        getUsers().catch(err => ({ success: false, error: err.message })),
        getDepartments().catch(err => ({ success: false, error: err.message })),
        getLookupCategories().catch(err => ({ success: false, error: err.message })),
      ]);

      const [classRes, locRes, workflowRes, userRes, deptRes, lookupRes] = results;

      if (classRes.success && classRes?.data && Array.isArray(classRes.data)) {
        // Filter to only show classifications that can be used for incidents
        // Types: 'incident', 'all', or no type (legacy)
        const filterForIncidents = (nodes: TreeNode[]): TreeNode[] => {
          return nodes.map(node => {
            const nodeWithType = node as any;
            const validType = !nodeWithType.type ||
              nodeWithType.type === 'incident' ||
              nodeWithType.type === 'both' ||
              nodeWithType.type === 'all';

            if (!validType) return null;

            // Ensure id is a string
            const filteredNode: TreeNode = {
              id: String(node.id),
              name: node.name,
              parent_id: node.parent_id ? String(node.parent_id) : null,
              name_ar: node?.name_ar
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
                name_ar: node?.name_ar
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
            name_ar: node?.name_ar,
          }));
        };
        let normalizedLocations = normalizeLocations(locRes.data);
        setMasterLocations(normalizedLocations);

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
                name_ar: node?.name_ar
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
        setMasterLocations([]);
        setLocations([]);
      }
      if (workflowRes.success && workflowRes?.data) {
        setAllWorkflows(workflowRes?.data);
      }
      if (userRes.success && userRes.data) {
        setUsers(userRes.data.map((u: any) => ({
          id: u.id,
          name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email || t('common.unknownUser')
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
        CustomAlert.alert(
          t('common.required'),
          t('common.workflowLoadWarning'),
          [
            { text: t('common.retry'), onPress: () => fetchAllData() },
            { text: t('common.back'), onPress: () => router.back() }
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

      CustomAlert.alert(
        t('common.error'),
        t('common.dataLoadError'),
        [
          { text: 'Retry', onPress: () => fetchAllData() },
          { text: 'Go Back', onPress: () => router.back() }
        ]
      );
    }
    setLoadingData(false);
  };

  // Helper: flatten a location tree into a flat array of all nodes
  const flattenLocations = useCallback((nodes: TreeNode[]): TreeNode[] => {
    const result: TreeNode[] = [];
    const traverse = (list: TreeNode[]) => {
      for (const node of list) {
        result.push(node);
        if (node.children && node.children.length > 0) {
          traverse(node.children);
        }
      }
    };
    traverse(nodes);
    return result;
  }, []);

  // Inject pending virtual location node(s) into the tree so TreeSelect can display the full hierarchy.
  // For GIS mode all unmatched levels (from startLevelIndex) are inserted as a chain of nested
  // virtual nodes so getHierarchyPath returns e.g. "Municipality › District › Street".
  const locationsWithVirtual = React.useMemo<TreeNode[]>(() => {
    if (!pendingNewLocation) return locations;

    const insertNode = (
      nodes: TreeNode[],
      parentId: string | undefined,
      nodeToInsert: TreeNode,
    ): TreeNode[] => {
      if (!parentId) return [...nodes, nodeToInsert];
      return nodes.map((node) => {
        if (node.id === parentId) {
          return { ...node, children: [...(node.children || []), nodeToInsert] };
        }
        if (node.children && node.children.length > 0) {
          return { ...node, children: insertNode(node.children, parentId, nodeToInsert) };
        }
        return node;
      });
    };

    const { levels, startLevelIndex, parent_id, virtualId } = pendingNewLocation;
    const unmatchedLevels = levels.slice(startLevelIndex ?? 0);

    if (unmatchedLevels.length === 0) return locations;

    // Build a nested chain bottom-up: deepest level becomes leaf, shallower levels wrap it.
    // The final leaf gets virtualId; intermediate nodes get temporary stable IDs.
    let chain: TreeNode | undefined;
    for (let i = unmatchedLevels.length - 1; i >= 0; i--) {
      const level = unmatchedLevels[i];
      const nodeId = i === unmatchedLevels.length - 1
        ? virtualId
        : `virtual_level_${i}_${level.name.replace(/\s+/g, '_')}`;
      chain = {
        id: nodeId,
        name: level.name,
        name_ar: level?.name_ar,
        type: level.type,
        children: chain ? [chain] : undefined,
      };
    }

    return insertNode(locations, parent_id, chain!);
  }, [locations, pendingNewLocation]);

  // Auto-match workflow via backend API when criteria change
  const matchWorkflow = useCallback(async () => {
    const criteria = {
      classification_id: selectedClassification?.id || undefined,
      location_id: selectedLocation?.id || undefined,
      source: selectedSource?.id || undefined,
      priority: parseInt(selectedPriority.id),
    };

    setIsMatchingWorkflow(true);
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
    } finally {
      setIsMatchingWorkflow(false);
    }
  }, [allWorkflows, selectedClassification, selectedLocation, selectedSource, selectedPriority]);

  useEffect(() => {
    if (allWorkflows.length > 0) {
      matchWorkflow();
    }
  }, [selectedClassification?.id, selectedLocation?.id, selectedSource?.id, selectedPriority.id, allWorkflows.length]);

  // Auto-generate title from classification, location, and geolocation
  useEffect(() => {
    const parts: string[] = [];

    // Add classification name
    if (selectedClassification?.name) {
      parts.push(selectedClassification.name);
    }

    // Add location name
    if (selectedLocation?.name) {
      parts.push(selectedLocation.name);
    }

    // Add geolocation area/address if available
    if (locationData) {
      if (locationData.area) {
        parts.push(locationData.area);
      } else if (locationData.address) {
        parts.push(locationData.address);
      } else if (locationData.city) {
        parts.push(locationData.city);
      }
    }

    // Generate title from parts
    if (parts.length > 0) {
      const generatedTitle = parts.join(' - ');
      setTitle(generatedTitle);
    }
  }, [selectedClassification, selectedLocation, locationData]);

  // Get required fields from matched workflow
  const requiredFields = matchedWorkflow?.required_fields || [];

  const isFieldRequired = (fieldName: string): boolean => {
    return requiredFields.includes(fieldName);
  };

  const fieldLabels: Record<string, string> = {
    description: t('incidents.description'),
    comment: t('incidents.comment'),
    classification_id: t('incidents.classification'),
    priority: t('incidents.priority'),
    severity: t('incidents.severity'),
    source: t('incidents.source'),
    assignee_id: t('incidents.assignee'),
    department_id: t('incidents.department'),
    location_id: t('incidents.location'),
    geolocation: t('details.geolocation'),
    reporter_name: t('addIncident.reporterName'),
    reporter_email: t('addIncident.reporterEmail'),
    attachments: t('incidents.attachments'),
  };

  const validate = (): Record<string, string> => {
    const newErrors: Record<string, string> = {};
    if (process.env.EXPO_PUBLIC_ENABLE_GIS === "true" && (!locationData?.gis || !locationData?.gis?.isInsideBoundary)) {
      newErrors.geolocation = t("addIncident.gisError");
    }

    if (attachments.length > MAX_ATTACHMENTS_COUNT) {
      newErrors.attachments = t('addIncident.maxAttachmentsExceeded', {
        max: MAX_ATTACHMENTS_COUNT,
        defaultValue: `You can attach a maximum of ${MAX_ATTACHMENTS_COUNT} files`,
      });
    }

    if (!title.trim()) {
      newErrors.title = t('addIncident.titlePlaceholder');
    }

    if (!matchedWorkflow) {
      newErrors.workflow = 'Please select classification, location, or source to match a workflow';
    }

    // Always require classification, location, source, and priority on mobile
    if (!selectedClassification) {
      newErrors.classification_id = `${t('incidents.classification')} ${t('common.isRequired')}`;
    }

    if (!selectedLocation) {
      newErrors.location_id = `${t('incidents.location')} ${t('common.isRequired')}`;
    }

    if (!selectedSource) {
      newErrors.source = `${t('incidents.source')} ${t('common.isRequired')}`;
    }

    if (!selectedPriority) {
      newErrors.priority = t(`addIncident.selectPriority`);
    }

    // Validate workflow-specific required fields
    for (const field of requiredFields) {
      // Skip classification, location, source, and priority since we already validated them above
      if (field === 'classification_id' || field === 'location_id' || field === 'source' || field === 'priority') {
        continue;
      }

      // Check for lookup field requirements (format: lookup:CATEGORY_CODE)
      if (field.startsWith('lookup:')) {
        const categoryCode = field.replace('lookup:', '');
        const category = lookupCategories.find(c => c.code === categoryCode);
        if (category) {
          const value = lookupValues[category.id];
          // For multiselect, check if array is empty
          if (category.field_type === 'multiselect') {
            if (!value || (Array.isArray(value) && value.length === 0)) {
              newErrors[field] = `${i18n.language === 'en' ? category.name : category?.name_ar} ${t('common.isRequired')}`;
            }
          } else if (!value) {
            newErrors[field] = `${i18n.language === 'en' ? category.name : category?.name_ar} ${t('common.isRequired')}`;
          }
        }
        continue;
      }

      if (field === 'attachments') {
        // Check attachments separately
        if (attachments.length === 0) {
          newErrors.attachments = t('addIncident.requiredFields');
        }
        continue;
      }

      if (field === 'geolocation') {
        // Check geolocation - locationData must be set
        if (!locationData) {
          newErrors.geolocation = `${fieldLabels.geolocation} ${t('common.isRequired')}`;
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
        newErrors[field] = `${fieldLabels[field] || field} ${t('common.isRequired')}`;
      }
    }

    setErrors(newErrors);
    return newErrors;
  };

  const showAttachmentOptions = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo'/*, 'Choose from Gallery', 'Choose File'*/],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            handleTakePhoto();
          }
          // } else if (buttonIndex === 2) {
          //   handlePickFromGallery();
          // } else if (buttonIndex === 3) {
          //   handlePickDocument();
          // }
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
            t('common.locationAddressUnavailableTitle'),
            t('common.locationAddressUnavailableDesc'),
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

        // Take first image
        const asset = result.assets[0];

        // Use GPS-only location for watermark — never the map-selected location
        const gpsLocation = gpsLocationRef.current;

        const watermarkData: WatermarkData = {
          latitude: gpsLocation?.latitude,
          longitude: gpsLocation?.longitude,
          address: gpsLocation?.address,
          city: gpsLocation?.city,
          state: gpsLocation?.state,
          country: gpsLocation?.country,
          street: gpsLocation?.street,
          district: gpsLocation?.district,
          subregion: gpsLocation?.subregion,
          street_number: gpsLocation?.street_number,
          ...(process.env.EXPO_PUBLIC_ENABLE_GIS === 'true' && gpsLocation?.gis
            ? { gis: gpsLocation.gis }
            : {}),
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
          location: gpsLocation ? `${gpsLocation.city || ''} ${gpsLocation.state || ''}`.trim() : undefined,
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

    // Add watermarked image to attachments, unless the cap's already been hit
    if (attachmentsCountRef.current >= MAX_ATTACHMENTS_COUNT) {
      CustomAlert.alert(
        t('common.error'),
        t('addIncident.maxAttachmentsExceeded', {
          max: MAX_ATTACHMENTS_COUNT,
          defaultValue: `You can attach a maximum of ${MAX_ATTACHMENTS_COUNT} files`,
        })
      );
    } else {
      setAttachments(prev => {
        if (prev.length >= MAX_ATTACHMENTS_COUNT) return prev;
        return [
          ...prev,
          {
            uri: finalUri,
            name: originalName,
            type: 'image/jpeg',
          },
        ];
      });
    }

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

        // Add valid files, capped to however many slots remain
        if (validFiles.length > 0) {
          const remainingSlots = Math.max(0, MAX_ATTACHMENTS_COUNT - attachments.length);
          const filesToAdd = validFiles.slice(0, remainingSlots);
          const excessCount = validFiles.length - filesToAdd.length;

          if (filesToAdd.length > 0) {
            setAttachments(prev => [...prev, ...filesToAdd]);
            if (errors.attachments) {
              setErrors(prev => ({ ...prev, attachments: '' }));
            }
          }

          if (excessCount > 0) {
            CustomAlert.alert(
              t('common.error'),
              t('addIncident.maxAttachmentsExceeded', {
                max: MAX_ATTACHMENTS_COUNT,
                defaultValue: `You can attach a maximum of ${MAX_ATTACHMENTS_COUNT} files`,
              })
            );
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
      crashLogger.logError(error as Error, {
        screen: 'AddIncidentScreen',
        action: 'pickFromGallery',
        context: 'Failed to pick image from gallery',
      }).catch(err => console.error('Failed to log error:', err));
      CustomAlert.alert(t('common.error'), t('common.failedToPickFromGallery', 'Failed to pick from gallery'));
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

        // Add valid files, capped to however many slots remain
        if (validFiles.length > 0) {
          const remainingSlots = Math.max(0, MAX_ATTACHMENTS_COUNT - attachments.length);
          const filesToAdd = validFiles.slice(0, remainingSlots);
          const excessCount = validFiles.length - filesToAdd.length;

          if (filesToAdd.length > 0) {
            setAttachments(prev => [...prev, ...filesToAdd]);
            if (errors.attachments) {
              setErrors(prev => ({ ...prev, attachments: '' }));
            }
          }

          if (excessCount > 0) {
            CustomAlert.alert(
              t('common.error'),
              t('addIncident.maxAttachmentsExceeded', {
                max: MAX_ATTACHMENTS_COUNT,
                defaultValue: `You can attach a maximum of ${MAX_ATTACHMENTS_COUNT} files`,
              })
            );
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
      crashLogger.logError(error as Error, {
        screen: 'AddIncidentScreen',
        action: 'pickDocument',
        context: 'Failed to pick document',
      }).catch(err => console.error('Failed to log error:', err));
      CustomAlert.alert(t('common.error'), t('common.failedToPickDocument', 'Failed to pick document'));
    }
  };

  const removeAttachment = (index: number) => {
    const file = attachments[index];
    // Delete the temp file from device cache when the user removes it
    if (file?.uri) {
      FileSystem.deleteAsync(file.uri, { idempotent: true }).catch(() => { });
    }
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const openImagePreview = (index: number) => {
    const imageAttachments = attachments.filter(f => f.type?.startsWith('image/'));
    const imageIndex = attachments
      .slice(0, index + 1)
      .filter(f => f.type?.startsWith('image/')).length - 1;
    if (imageAttachments.length > 0 && imageIndex >= 0) {
      setImageViewerIndex(imageIndex);
      setImageViewerVisible(true);
    }
  };

  const handleLocationChange = useCallback(async (location: LocationData | undefined) => {
    if (!location) {
      setLocationData(undefined);
      lastProcessedGeoRef.current = null;
      setPendingNewLocation(null);
      return;
    }

    if (process.env.EXPO_PUBLIC_ENABLE_GIS === 'true' && !location.gis?.isInsideBoundary && location?.gis !== undefined) {
      CustomAlert.alert('Error', 'You are not inside the permissible boundary');
      return;
    }

    setLocationData(location);
    if (errors.geolocation) {
      setErrors(prev => ({ ...prev, geolocation: '' }));
    }

    // When auto location retrieval is disabled, stop here — do not attempt to
    // match or create anything in the location dropdown.
    if (DISABLE_AUTO_LOCATION_RETRIEVAL) {
      return;
    }

    // LocationPickerOSM fires onChange TWICE for the same coordinate pair:
    //   1st call: raw coords only  ({latitude, longitude})
    //   2nd call: enriched with address ({latitude, longitude, city/gis, state, ...})
    // We must wait for the enriched call before running the matching logic.
    const isGisMode = process.env.EXPO_PUBLIC_ENABLE_GIS === 'true';
    const hasAddressData = isGisMode
      ? !!location.gis  // GIS mode: wait for gis object
      : !!(location.city || location.address || location.country); // OSM mode
    if (!hasAddressData) {
      // Raw coords only — skip matching, the enriched call will follow shortly
      return;
    }

    // Deduplicate: only process each coordinate pair once (after address is resolved)
    const geoKey = `${location.latitude},${location.longitude}`;
    if (lastProcessedGeoRef.current === geoKey) {
      return;
    }
    lastProcessedGeoRef.current = geoKey;

    // Try to match the geo-location against the Location master tree
    setIsMatchingLocation(true);
    try {
      const allLocations = flattenLocations(masterLocations.length > 0 ? masterLocations : locations);

      if (isGisMode && location.gis) {
        // ── GIS mode: match using district_name → municipality_name → street_fullname ──
        const gis = location.gis;

        // Try to find a leaf node matching district or municipality name
        const candidates = [
          gis.district_name,
          gis.municipality_name,
          gis.street_fullname,
        ].filter(Boolean).map(s => s.toLowerCase().trim());

        const matched = allLocations.find(
          loc =>
            (!loc.children || loc.children.length === 0) &&
            candidates.some(name => loc.name.toLowerCase().trim() === name),
        );

        if (matched) {
          setSelectedLocation({ id: matched.id, name: matched.name });
          if (errors.location_id) {
            setErrors(prev => ({ ...prev, location_id: '' }));
          }
          setPendingNewLocation(null);
          showToast(
            t('incidents.locationAutoMatched', {
              name: matched.name,
              defaultValue: `Location "${matched.name}" auto-selected from master`,
            }),
            'info'
          );
        } else {
          // No match found — map to the root-level "Default" location.
          // If it doesn't exist yet, create it first.
          const DEFAULT_LOCATION_NAME = 'Default';
          const existingDefault = allLocations.find(
            loc =>
              loc.name.toLowerCase().trim() === DEFAULT_LOCATION_NAME.toLowerCase() &&
              !(loc as any).parent_id,
          );

          if (existingDefault) {
            setPendingNewLocation(null);
            setSelectedLocation({ id: existingDefault.id, name: existingDefault.name });
            if (errors.location_id) {
              setErrors(prev => ({ ...prev, location_id: '' }));
            }
            showToast(
              t('incidents.locationDefaultMapped', {
                defaultValue: 'No matching location found. Mapped to "Default" location.',
              }),
              'info'
            );
          } else {
            // "Default" doesn't exist yet — create it at the root on the fly
            try {
              const res = await createLocation({ name: DEFAULT_LOCATION_NAME, type: 'default', link_default_department: true });
              if (res.success && res.data) {
                setPendingNewLocation(null);
                setSelectedLocation({ id: res.data.id, name: DEFAULT_LOCATION_NAME });
                if (errors.location_id) {
                  setErrors(prev => ({ ...prev, location_id: '' }));
                }
                showToast(
                  t('incidents.locationDefaultCreated', {
                    defaultValue: 'No matching location found. Created and mapped to "Default" location.',
                  }),
                  'info'
                );
              } else {
                showToast(
                  t('incidents.locationMatchError', 'Failed to create Default location. Please select manually.'),
                  'error'
                );
              }
            } catch (createErr) {
              console.error('[handleLocationChange] Failed to create Default location:', createErr);
              showToast(
                t('incidents.locationMatchError', 'Failed to create Default location. Please select manually.'),
                'error'
              );
            }
          }
        }
      } else {
        // ── OSM mode: original logic using city / address / country ──
        const searchName = (location.city || location.address || '')
          .toLowerCase()
          .trim();

        const matched = searchName
          ? allLocations.find(
            (loc) =>
              (!loc.children || loc.children.length === 0) &&
              (loc.name.toLowerCase().trim() === searchName ||
                (location.city &&
                  loc.name.toLowerCase().trim() ===
                  location.city.toLowerCase().trim())),
          )
          : undefined;

        if (matched) {
          setSelectedLocation({ id: matched.id, name: matched.name });
          if (errors.location_id) {
            setErrors(prev => ({ ...prev, location_id: '' }));
          }
          setPendingNewLocation(null);
          showToast(
            t('incidents.locationAutoMatched', {
              name: matched.name,
              defaultValue: `Location "${matched.name}" auto-selected from master`,
            }),
            'info'
          );
        } else {
          // No match found — map to the root-level "Default" location.
          // If it doesn't exist yet, create it first.
          const DEFAULT_LOCATION_NAME = 'Default';
          const existingDefault = allLocations.find(
            (loc) =>
              loc.name.toLowerCase().trim() === DEFAULT_LOCATION_NAME.toLowerCase() &&
              !(loc as any).parent_id,
          );

          if (existingDefault) {
            setPendingNewLocation(null);
            setSelectedLocation({ id: existingDefault.id, name: existingDefault.name });
            if (errors.location_id) {
              setErrors(prev => ({ ...prev, location_id: '' }));
            }
            showToast(
              t('incidents.locationDefaultMapped', {
                defaultValue: 'No matching location found. Mapped to "Default" location.',
              }),
              'info'
            );
          } else {
            // "Default" doesn't exist yet — create it at the root on the fly
            try {
              const res = await createLocation({ name: DEFAULT_LOCATION_NAME, type: 'default', link_default_department: true });
              if (res.success && res.data) {
                setPendingNewLocation(null);
                setSelectedLocation({ id: res.data.id, name: DEFAULT_LOCATION_NAME });
                if (errors.location_id) {
                  setErrors(prev => ({ ...prev, location_id: '' }));
                }
                showToast(
                  t('incidents.locationDefaultCreated', {
                    defaultValue: 'No matching location found. Created and mapped to "Default" location.',
                  }),
                  'info'
                );
              } else {
                showToast(
                  t('incidents.locationMatchError', 'Failed to create Default location. Please select manually.'),
                  'error'
                );
              }
            } catch (createErr) {
              console.error('[handleLocationChange] Failed to create Default location:', createErr);
              showToast(
                t('incidents.locationMatchError', 'Failed to create Default location. Please select manually.'),
                'error'
              );
            }
          }
        }
      }
    } catch (err) {
      console.error('[handleLocationChange] Location match error:', err);
      showToast(
        t('incidents.locationMatchError', 'Failed to match location. Please select manually.'),
        'error'
      );
    } finally {
      setIsMatchingLocation(false);
    }
  }, [locations, masterLocations, flattenLocations, errors]);

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
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      const firstError = Object.values(validationErrors)[0];
      CustomAlert.alert(t('common.validationError'), firstError);
      return;
    }

    setSubmitting(true);

    try {
      // Double-check matchedWorkflow exists with valid id
      if (!matchedWorkflow || !matchedWorkflow.id) {
        setSubmitting(false);
        CustomAlert.alert(t('common.error'), t('common.workflowMatchedError'));
        return;
      }

      // Validate priority and severity are valid numbers
      const priorityNum = parseInt(selectedPriority.id);
      const severityNum = parseInt(selectedSeverity.id);
      if (isNaN(priorityNum) || isNaN(severityNum)) {
        setSubmitting(false);
        CustomAlert.alert(t('common.error'), t('common.invalidPrioritySeverity'));
        return;
      }

      const incidentData: any = {
        title: title.trim(),
        workflow_id: matchedWorkflow.id,
        priority: priorityNum,
        severity: severityNum,
      };

      if (description.trim()) incidentData.description = description.trim();
      if (comment.trim()) incidentData.comment = comment.trim();
      if (selectedClassification) incidentData.classification_id = selectedClassification.id;

      // Use the already-resolved location id (Default location is now resolved in handleLocationChange).
      let finalLocationId = selectedLocation?.id;
      if (finalLocationId && finalLocationId !== 'virtual_new_location') {
        incidentData.location_id = finalLocationId;
      }

      incidentData.source = "mobile";
      incidentData.channel = "mobile";
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
              const serverError = uploadResult.errors?.[0]?.error
              CustomAlert.alert(
                t('common.partialSuccess'),
                `${t('addIncident.createdAttErr')}. ${serverError}`,
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

            CustomAlert.alert(
              t('common.partialSuccess'),
              t('addIncident.createdAttErr'),
              [{ text: 'OK', onPress: () => router.back() }]
            );
            setSubmitting(false);
            return;
          }
        }

        // Clean up all temp files that were uploaded — prevents cache bloat
        attachments.forEach(file => {
          if (file?.uri) {
            FileSystem.deleteAsync(file.uri, { idempotent: true }).catch(() => { });
          }
        });

        setSubmitting(false);
        CustomAlert.alert(t('common.success'), t('addIncident.created'), [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else {
        setSubmitting(false);
        const errorMsg = response.error || 'Unknown error occurred';
        CustomAlert.alert(t('common.error'), `${t('common.failed')}: ${errorMsg}`);
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
      CustomAlert.alert(
        t('common.error'),
        t('common.unexpectedError', { error: error instanceof Error ? error.message : 'Unknown error' })
      );
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('addIncident.title')}</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close-circle" size={28} color="#E74C3C" />
        </TouchableOpacity>
      </View>

      {/* Inline toast banner */}
      {toastMessage && (
        <Animated.View
          style={[
            styles.toastBanner,
            toastType === 'error' && styles.toastBannerError,
            {
              opacity: toastAnim,
              transform: [{
                translateY: toastAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-20, 0],
                }),
              }],
            },
          ]}
          pointerEvents="none"
        >
          <Ionicons
            name={toastType === 'error' ? 'alert-circle' : 'information-circle'}
            size={18}
            color="white"
            style={{ marginRight: 8 }}
          />
          <Text style={styles.toastText} numberOfLines={3}>{toastMessage}</Text>
        </Animated.View>
      )}

      {loadingData ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2EC4B6" />
          <Text style={styles.loadingText}>{t('common.loading', 'Loading...')}</Text>
        </View>
      ) : (
        <>
          <ScrollView style={[styles.formContainer]} showsVerticalScrollIndicator={false}>
            {/* Auto-matched Workflow Display */}
            <View style={{ padding: 20 }}>
              <View style={[styles.workflowCard]}>
                <View style={styles.workflowHeader}>
                  <Ionicons name="git-branch" size={20} color="#2EC4B6" />
                  <Text style={styles.workflowLabel}>{t('common.workflow', 'Workflow')}</Text>
                </View>
                {matchedWorkflow ? (
                  <View style={styles.workflowMatched}>
                    <Ionicons name="checkmark-circle" size={18} color="#27AE60" />
                    <Text style={styles.workflowName}>{
                      i18n.language === 'ar' && matchedWorkflow.name_ar ? matchedWorkflow.name_ar :
                        matchedWorkflow.name
                    }</Text>
                  </View>
                ) : isMatchingWorkflow ? (
                  <View style={styles.workflowMatched}>
                    <ActivityIndicator size="small" color="#2EC4B6" />
                    <Text style={styles.workflowHint}>
                      {t('addIncident.matchingWorkflow', 'Matching workflow...')}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.workflowHint}>
                    {t('addIncident.workflowHint', 'Select classification, location, or source to auto-match a workflow')}
                  </Text>
                )}
                {errors.workflow && <Text style={styles.errorText}>{errors.workflow}</Text>}
              </View>

              {/* Title - Auto-generated */}
              <Text style={styles.sectionTitle}>
                {t('addIncident.incidentTitle')} <Text style={styles.required}>*</Text>
              </Text>
              <View style={[styles.input, styles.autoGeneratedField, errors.title && styles.inputError]}>
                <Text style={[styles.autoGeneratedText, !title && styles.placeholderText, { textAlign: 'left' }]}>
                  {title || t('incidents.titlePlaceholder')}
                </Text>
                <Ionicons name="lock-closed" size={16} color="#999" style={styles.lockIcon} />
              </View>
              <Text style={styles.helperText}>
                {t('incidents.autoTitle')}
              </Text>
              {errors.title && <Text style={styles.errorText}>{errors.title}</Text>}

              {/* Classification - Always required on mobile */}
              <Text style={styles.sectionTitle}>
                {t('incidents.classification')} <Text style={styles.required}>*</Text>
              </Text>
              <TreeSelect
                label={t('addIncident.selectClassification')}
                value={selectedClassification?.name || ''}
                valueId={selectedClassification?.id}
                data={classifications}
                onSelect={(node) => setSelectedClassification(node as DropdownOption | null)}
                required={true}
                error={errors.classification_id}
                leafOnly={true}
                placeholder={t('addIncident.selectClassification')}
                iconType="classification"
              />

              {/* Location - Always required on mobile */}
              <Text style={styles.sectionTitle}>
                {t('incidents.location')} <Text style={styles.required}>*</Text>
              </Text>
              <TreeSelect
                label={t('addIncident.selectLocation')}
                value={selectedLocation?.name || ''}
                valueId={selectedLocation?.id !== 'virtual_new_location' ? selectedLocation?.id : undefined}
                data={locationsWithVirtual}
                onSelect={(node) => {
                  setSelectedLocation(node as DropdownOption | null);
                  // User manually selected from the dropdown — clear any pending auto-matched location
                  setPendingNewLocation(null);
                  lastProcessedGeoRef.current = null;
                }}
                required={true}
                error={errors.location_id}
                leafOnly={true}
                placeholder={t('addIncident.selectLocation')}
                iconType="location"
                disabled={!DISABLE_AUTO_LOCATION_RETRIEVAL}
              />

              {/* Source - Always mobile for mobile app, non-editable, Always required */}
              <Text style={styles.sectionTitle}>
                {t('addIncident.source')} <Text style={styles.required}>*</Text>
              </Text>
              <Dropdown
                label={t('addIncident.selectSource')}
                value={selectedSource?.name || ''}
                options={sourceOptions}
                onSelect={() => { }} // No-op, field is not editable on mobile
                required={true}
                error={errors.source}
                allowClear={false}
              />

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

              {/* Severity - Only show if required by workflow */}
              {isFieldRequired('severity') && (
                <>
                  <Text style={styles.sectionTitle}>
                    {t('incidents.severity')} <Text style={styles.required}>*</Text>
                  </Text>
                  <Dropdown
                    label={t('addIncident.selectSeverity')}
                    value={selectedSeverity.name}
                    options={severityOptions}
                    onSelect={(opt) => opt && setSelectedSeverity(opt)}
                    allowClear={false}
                    error={errors.severity}
                  />
                </>
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
                    style={[styles.descriptionInput, errors.description && styles.inputError, { textAlign: i18n.language === 'ar' ? 'right' : 'left' }]}
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
                    {t('addIncident.reporterName')} <Text style={styles.required}>*</Text>
                  </Text>
                  <TextInput
                    style={[styles.input, errors.reporter_name && styles.inputError, { textAlign: i18n.language === 'ar' ? 'right' : 'left' }]}
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
                    style={[styles.input, errors.reporter_email && styles.inputError, { textAlign: i18n.language === 'ar' ? 'right' : 'left' }]}
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
                    onGpsLocation={(loc) => { gpsLocationRef.current = loc; }}
                    required
                    autoFetch={true}
                    error={errors.geolocation}
                  />
                  {/* Show address loading status */}
                  {locationData?.latitude && !locationData?.address && !locationData?.city && (
                    <Text style={{ fontSize: 12, color: '#FF9800', textAlign: "left", marginBottom: 10 }}>
                      {t('common.gettingAddress')}
                    </Text>
                  )}
                  {(locationData?.address || locationData?.city) && (
                    <Text style={{ fontSize: 12, color: '#4CAF50', textAlign: "left", marginBottom: 10 }}>
                      {t('common.locationLabel', { address: locationData.city || locationData.address })}
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
                  <View style={[styles.attachmentsContainer, errors.attachments && styles.attachmentsContainerError, { marginBottom: insets.bottom }]}>
                    {attachments.length > 0 && (
                      <View style={styles.attachmentsList}>
                        {attachments.map((file, index) => (
                          <View key={index} style={styles.attachmentItem}>
                            <TouchableOpacity
                              style={styles.attachmentInfo}
                              onPress={() => openImagePreview(index)}
                              activeOpacity={file.type?.startsWith('image/') ? 0.6 : 1}
                            >
                              <Ionicons
                                name={file.type?.startsWith('image/') ? 'image-outline' : 'document-attach'}
                                size={20}
                                color="#2EC4B6"
                              />
                              <Text style={styles.attachmentName} numberOfLines={1}>
                                {file.name}
                              </Text>
                              <Text style={styles.attachmentSize}>
                                ({file.size ? (file.size / 1024).toFixed(1) + ' KB' : 'N/A'})
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => removeAttachment(index)}>
                              <Ionicons name="close-circle" size={22} color="#E74C3C" />
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    )}
                    <TouchableOpacity
                      style={[styles.attachmentButton, attachments.length >= MAX_ATTACHMENTS_COUNT && styles.attachmentButtonDisabled]}
                      onPress={handleTakePhoto}
                      disabled={attachments.length >= MAX_ATTACHMENTS_COUNT}
                    >
                      <Ionicons
                        name="cloud-upload-outline"
                        size={24}
                        color={attachments.length >= MAX_ATTACHMENTS_COUNT ? '#999999' : '#2EC4B6'}
                      />
                      <Text style={[styles.attachmentButtonText, attachments.length >= MAX_ATTACHMENTS_COUNT && styles.attachmentButtonTextDisabled]}>
                        {attachments.length >= MAX_ATTACHMENTS_COUNT
                          ? t('addIncident.maxAttachmentsReached', {
                              max: MAX_ATTACHMENTS_COUNT,
                              defaultValue: `Maximum of ${MAX_ATTACHMENTS_COUNT} files reached`,
                            })
                          : attachments.length > 0 ? t('addIncident.addMoreFiles') : t('addIncident.tapToUpload')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {errors.attachments && <Text style={styles.errorText}>{errors.attachments}</Text>}
                </>
              )}

              <View style={styles.bottomPadding} />
            </View>
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
                  <Ionicons name="camera" size={24} color="#2EC4B6" />
                  <Text style={styles.pickerOptionText}>{t('incidents.takePhoto', 'Take Photo')}</Text>
                </TouchableOpacity>

                {/* <TouchableOpacity
                  style={styles.pickerOption}
                  onPress={() => {
                    setAttachmentPickerVisible(false);
                    handlePickFromGallery();
                  }}
                >
                  <Ionicons name="images" size={24} color="#2EC4B6" />
                  <Text style={styles.pickerOptionText}>{t('common.chooseFromGallery', 'Choose from Gallery')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.pickerOption}
                  onPress={() => {
                    setAttachmentPickerVisible(false);
                    handlePickDocument();
                  }}
                >
                  <Ionicons name="document" size={24} color="#2EC4B6" />
                  <Text style={styles.pickerOptionText}>{t('common.chooseFile', 'Choose File')}</Text>
                </TouchableOpacity> */}

                <TouchableOpacity
                  style={styles.pickerCancelButton}
                  onPress={() => setAttachmentPickerVisible(false)}
                >
                  <Text style={styles.pickerCancelText}>{t('common.cancel', 'Cancel')}</Text>
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

          <AuthenticatedImageViewer
            images={attachments
              .filter(f => f.type?.startsWith('image/'))
              .map((f, i) => ({
                id: String(i),
                uri: f.uri,
                file_name: f.name || `Image_${i}.jpg`,
              }))}
            imageIndex={imageViewerIndex}
            visible={imageViewerVisible}
            onRequestClose={() => setImageViewerVisible(false)}
          />
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
  toastBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2EC4B6',
    marginHorizontal: 16,
    marginBottom: 4,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    zIndex: 100,
  },
  toastBannerError: {
    backgroundColor: '#E74C3C',
  },
  toastText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
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
    // padding: 20,
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
    textAlign: 'left'
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
  autoGeneratedField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8F9FA',
    borderColor: '#D0D0D0',
    paddingRight: 10,
  },
  autoGeneratedText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  lockIcon: {
    marginLeft: 8,
  },
  helperText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: -15,
    marginBottom: 15,
    textAlign: 'left'
  },
  placeholderText: {
    color: '#999',
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
    textAlign: "left"
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
  attachmentButtonDisabled: {
    borderColor: '#B0B0B0',
  },
  attachmentButtonText: {
    marginLeft: 8,
    color: '#2EC4B6',
    fontSize: 14,
    fontWeight: '500',
  },
  attachmentButtonTextDisabled: {
    color: '#999999',
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
