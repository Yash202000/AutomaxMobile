import { getClassificationsTree } from '@/src/api/classifications';
import { getDepartmentsTree, matchDepartments } from '@/src/api/departments';
import { executeTransition, getMatchingUsers, uploadMultipleAttachments } from '@/src/api/incidents';
import { getLocationsTree } from '@/src/api/locations';
import { getLookupCategories, LookupCategory } from '@/src/api/lookups';
import { CustomAlert } from '@/src/components/CustomAlert';
import { DynamicLookupField } from '@/src/components/DynamicLookupField';
import { IncidentMentionTextarea } from '@/src/components/IncidentMentionTextarea';
import { LocationData } from '@/src/components/LocationPickerOSM';
import TreeSelect, { TreeNode } from '@/src/components/TreeSelect';
import { WatermarkPreview } from '@/src/components/WatermarkPreview';
import { WatermarkData, WatermarkProcessor } from '@/src/components/WatermarkProcessor';
import { useAuth } from '@/src/context/AuthContext';
import i18n from '@/src/i18n';
import { compressImage } from '@/src/utils/imageCompression';
import { generateWatermarkedFilename } from '@/src/utils/watermarkUtils';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';


const UpdateStatusModal = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { id, type, transitions, incident: incidentParam } = useLocalSearchParams();
  const incidentId = Array.isArray(id) ? id[0] : id;
  const ticketType = Array.isArray(type) ? type[0] : (type || t('details.incident', 'incident'));

  // Safely parse JSON — wrapped in useMemo so the object reference is stable across renders
  const availableTransitions = useMemo(() => {
    try {
      return transitions ? JSON.parse(transitions as string) : [];
    } catch (error) {
      console.error('[UpdateStatus] Failed to parse transitions:', error);
      return [];
    }
  }, [transitions]);

  const incident = useMemo(() => {
    try {
      return incidentParam ? JSON.parse(incidentParam as string) : null;
    } catch (error) {
      console.error('[UpdateStatus] Failed to parse incident:', error);
      return null;
    }
  }, [incidentParam]);

  const [selectedTransition, setSelectedTransition] = useState(null);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  // User selection state
  const [matchingUsers, setMatchingUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserPicker, setShowUserPicker] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [singleUserMatch, setSingleUserMatch] = useState(false);
  const [autoSelectUser, setAutoSelectUser] = useState(false);

  // Department selection state (auto_detect_department)
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
  const [departmentMatchResult, setDepartmentMatchResult] = useState<any>(null);
  const [loadingDeptMatch, setLoadingDeptMatch] = useState(false);

  // Ready-to-close duration state
  const [readyToCloseDuration, setReadyToCloseDuration] = useState('');
  const [showDurationPicker, setShowDurationPicker] = useState(false);

  // Feedback comment state
  const [feedbackComment, setFeedbackComment] = useState('');

  // Attachment state
  const [attachments, setAttachments] = useState([]);
  const [showAttachmentOptions, setShowAttachmentOptions] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // Field change state
  const [fieldChangeValues, setFieldChangeValues] = useState<Record<string, string>>({});
  const [fieldChangeDisplayValues, setFieldChangeDisplayValues] = useState<Record<string, string>>({});
  const [departmentsTree, setDepartmentsTree] = useState<TreeNode[]>([]);
  const [locationsTree, setLocationsTree] = useState<TreeNode[]>([]);
  const [classificationsTree, setClassificationsTree] = useState<TreeNode[]>([]);
  const [lookupCategories, setLookupCategories] = useState<LookupCategory[]>([]);

  // Recursively filter department tree by type ('internal' | 'external')
  const filterDeptTree = (nodes: TreeNode[], type: string): TreeNode[] =>
    nodes
      .map(node => ({ ...node, children: node.children ? filterDeptTree(node.children, type) : [] }))
      .filter(node => node.type === type || (node.children && node.children.length > 0));

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

  // Geolocation state
  const [locationData, setLocationData] = useState<LocationData | undefined>(undefined);
  const locationDataRef = useRef<LocationData | undefined>(undefined);

  // Monitor locationData changes and keep ref in sync
  useEffect(() => {
    locationDataRef.current = locationData; // Keep ref updated
  }, [locationData]);

  // Fetch lookup categories on mount for field changes
  useEffect(() => {
    getLookupCategories()
      .then((r) => {
        if (r.success && Array.isArray(r.data)) {
          setLookupCategories(r.data);
        }
      })
      .catch((err) => console.error('Failed to fetch lookup categories:', err));
  }, []);

  // Helper function to check if a string is a Plus Code
  const isPlusCode = (str: string | null | undefined): boolean => {
    if (!str) return false;
    // Plus Codes format: XXXX+XX or longer variations
    const plusCodeRegex = /^[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,3}$/i;
    return plusCodeRegex.test(str.replace(/\s/g, ''));
  };

  // Auto-fetch location on mount (request permission)
  useEffect(() => {
    const fetchLocation = async () => {
      try {
        // Check current permission status first
        const { status: existingStatus } = await Location.getForegroundPermissionsAsync();

        let finalStatus = existingStatus;

        // If not granted, request permission
        if (existingStatus !== 'granted') {
          const { status } = await Location.requestForegroundPermissionsAsync();
          finalStatus = status;
        }

        if (finalStatus !== 'granted') {
          CustomAlert.alert(
            t('common.locationPermissionRequired', 'Location Permission Required'),
            t('common.locationNeededForWatermark', 'Location access is needed to watermark photos with GPS coordinates. Please enable location services in your device settings.'),
            [
              {
                text: t('common.cancel', 'Cancel'),
                style: 'cancel',
                onPress: () => {
                  // User can still use the app, but photos won't have location watermark
                }
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

        // Permission granted, get location
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        // Reverse geocode to get address
        const [geocode] = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });

        // Filter out Plus Codes from address fields
        let streetAddress: string | null | undefined = geocode?.street;
        if (isPlusCode(streetAddress)) {
          streetAddress = null;
        }

        let nameAddress: string | null | undefined = geocode?.name;
        if (isPlusCode(nameAddress)) {
          nameAddress = null;
        }

        // Build a readable address string
        let addressParts: string[] = [];
        if (streetAddress) addressParts.push(streetAddress);
        if (geocode?.district && geocode.district !== streetAddress) addressParts.push(geocode.district);
        if (geocode?.subregion && geocode.subregion !== geocode?.city) addressParts.push(geocode.subregion);

        const locationData: LocationData = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          address: addressParts.length > 0 ? addressParts.join(', ') : (nameAddress || undefined),
          city: geocode?.city || undefined,
          state: geocode?.region || undefined,
          country: geocode?.country || undefined,
        };

        setLocationData(locationData);
      } catch (error: any) {
        // Handle location services disabled or other errors
        if (error?.message?.includes('Location services are disabled') ||
          error?.message?.includes('unavailable')) {
          CustomAlert.alert(
            t('common.locationServicesDisabled', 'Location Services Disabled'),
            t('common.enableLocationServices', 'Please enable location services in your device settings to add GPS coordinates to photos.'),
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
        }
        // For other errors, silently fail - watermark will work without location
      }
    };

    fetchLocation();
  }, [t]);

  // Feedback rating state
  const [feedbackRating, setFeedbackRating] = useState(0);

  const transitionRequiresComment = selectedTransition?.requirements?.some(req => req.requirement_type === 'comment' && req.is_mandatory);
  const transitionRequiresFeedback = selectedTransition?.requirements?.some(req => req.requirement_type === 'feedback' && req.is_mandatory);
  const transitionRequiresAttachment = selectedTransition?.requirements?.some(req => req.requirement_type === 'attachment' && req.is_mandatory);

  // Check if comment or feedback field should be shown (even if optional)
  const showCommentField = selectedTransition?.requirements?.some(req => req.requirement_type === 'comment');
  const showFeedbackField = selectedTransition?.requirements?.some(req => req.requirement_type === 'feedback');

  // Check if user selection is needed (manual_select_user or auto_match_user with roles)
  const needsUserSelection =
    (selectedTransition?.transition?.manual_select_user) &&
    selectedTransition?.transition?.assignment_roles?.length > 0;

  // Check if department selection is needed
  const needsDeptSelection =
    selectedTransition?.transition?.auto_detect_department && !selectedTransition?.transition?.assign_department_id;

  // is_ready_to_close duration needed
  const isReadyToClose = selectedTransition?.transition?.to_state?.is_ready_to_close === true;

  const readyToCloseDurationOptions = [
    { label: t('incidents.duration_1h', '1 hour'), value: '1h' },
    { label: t('incidents.duration_2h', '2 hours'), value: '2h' },
    { label: t('incidents.duration_4h', '4 hours'), value: '4h' },
    { label: t('incidents.duration_8h', '8 hours'), value: '8h' },
    { label: t('incidents.duration_24h', '24 hours'), value: '24h' },
    { label: t('incidents.duration_48h', '48 hours'), value: '48h' },
    { label: t('incidents.duration_72h', '72 hours'), value: '72h' },
  ];

  // Step wizard state
  const [transitionStep, setTransitionStep] = useState(0);

  // Compute wizard steps based on selected transition
  const transitionSteps = useMemo<string[]>(() => {
    if (!selectedTransition) return [];
    const trans = selectedTransition.transition;
    const steps: string[] = [];
    if (trans.assign_department_id || trans.auto_detect_department) steps.push('department');
    if (trans.assign_user_id || ((trans.auto_match_user || trans.manual_select_user) && trans.assignment_roles?.length > 0)) steps.push('user');
    if (trans.field_changes?.length > 0) steps.push('field_changes');
    if (trans.to_state?.is_ready_to_close) steps.push('duration');
    if (selectedTransition.requirements?.some((r: any) => r.requirement_type === 'attachment' && r.is_mandatory)) steps.push('attachment');
    if (selectedTransition.requirements?.some((r: any) => r.requirement_type === 'feedback')) steps.push('feedback');
    steps.push('comment');
    return steps;
  }, [selectedTransition]);

  const stepTitles: Record<string, string> = {
    department: t('incidents.departmentAssignment', 'Department Assignment'),
    user: t('incidents.userAssignment', 'User Assignment'),
    field_changes: t('incidents.fieldChanges', 'Field Changes'),
    duration: t('incidents.autoRevertDuration', 'Auto-Revert Duration'),
    attachment: t('incidents.attachment', 'Attachment'),
    feedback: t('incidents.feedback', 'Feedback'),
    comment: t('incidents.comment', 'Comment'),
  };

  const currentStepKey = transitionSteps[transitionStep];
  const isLastStep = transitionStep === transitionSteps.length - 1;

  const validateStep = (): boolean => {
    if (!selectedTransition || !currentStepKey) return true;
    const trans = selectedTransition.transition;

    if (currentStepKey === 'department') {
      // Block while still loading
      if (loadingDeptMatch) {
        CustomAlert.alert(t('common.pleaseWait', 'Please Wait'), t('incidents.loadingDepartments', 'Loading departments...'));
        return false;
      }
      // Block if department selection is needed and nothing selected
      if (needsDeptSelection && !selectedDepartmentId) {
        CustomAlert.alert(t('common.required', 'Required'), t('incidents.selectDepartmentRequired', 'Please select a department to continue.'));
        return false;
      }
    }

    if (currentStepKey === 'user') {
      // Block while still loading
      if (loadingUsers) {
        CustomAlert.alert(t('common.pleaseWait', 'Please Wait'), t('incidents.loadingMatchingUsers', 'Loading matching users...'));
        return false;
      }
      // Block if user selection is needed and nothing selected (auto-single-match sets selectedUser automatically)
      if (needsUserSelection && !selectedUser && !trans.assign_user_id) {
        CustomAlert.alert(t('common.required', 'Required'), t('incidents.selectUserRequired', 'Please select a user to continue.'));
        return false;
      }
    }

    if (currentStepKey === 'attachment' && transitionRequiresAttachment && attachments.length === 0) {
      CustomAlert.alert(t('common.required', 'Required'), t('incidents.attachmentRequired', 'At least one attachment is required.'));
      return false;
    }

    if (currentStepKey === 'feedback' && transitionRequiresFeedback && feedbackRating === 0) {
      CustomAlert.alert(t('common.required', 'Required'), t('incidents.feedbackRatingRequired2', 'Please provide a feedback rating.'));
      return false;
    }

    if (currentStepKey === 'comment' && transitionRequiresComment && !comment.trim()) {
      CustomAlert.alert(t('common.required', 'Required'), t('incidents.commentRequiredForTransition', 'A comment is required for this transition.'));
      return false;
    }

    if (currentStepKey === 'field_changes') {
      const fcs = trans.field_changes || [];
      for (const fc of fcs) {
        if (fc.is_required && !fieldChangeValues[fc.field_name]) {
          CustomAlert.alert(t('common.required', 'Required'), `${fc.label || fc.field_name} ${t('common.isRequired', 'is required')}`);
          return false;
        }
      }
    }

    return true;
  };

  const handleNext = () => {
    if (!validateStep()) return;
    if (isLastStep) {
      handleUpdate();
    } else {
      setTransitionStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (transitionStep === 0) {
      // Back to transition selection
      setSelectedTransition(null);
      setTransitionStep(0);
    } else {
      setTransitionStep(prev => prev - 1);
    }
  };

  const isStepMandatory = (): boolean => {
    if (!currentStepKey || !selectedTransition) return false;
    const trans = selectedTransition.transition;
    if (currentStepKey === 'department') return needsDeptSelection;
    if (currentStepKey === 'user') return trans.manual_select_user && !trans.assign_user_id;
    if (currentStepKey === 'attachment') return transitionRequiresAttachment;
    if (currentStepKey === 'feedback') return transitionRequiresFeedback;
    if (currentStepKey === 'comment') return transitionRequiresComment;
    if (currentStepKey === 'duration') return true;
    return false;
  };

  // Fetch matching users when a transition with user selection is needed
  useEffect(() => {
    const fetchMatchingUsers = async () => {
      if (!selectedTransition || !incident) return;

      setLoadingUsers(true);
      const roleIds = selectedTransition.transition.assignment_roles?.map((r: any) => r.id) || [];
      const matchCriteria = {
        role_ids: roleIds,
        classification_id: incident.classification_id || incident.classification?.id || null,
        location_id: incident.location_id || incident.location?.id || null,
        department_id: incident.department_id || incident.department?.id || null,
        exclude_user_id: incident.assignee_id || incident.assignee?.id || null,
      };

      const response = await getMatchingUsers(matchCriteria);
      setLoadingUsers(false);

      if (response.success) {
        const users = response.data.users || [];
        setMatchingUsers(users);
        const isSingle = response.data.single_match === true;
        setSingleUserMatch(isSingle);
        if (isSingle && users.length === 1) {
          setSelectedUser(users[0]);
        } else {
          setSelectedUser(null)
        }
      } else {
        setMatchingUsers([]);
        setSingleUserMatch(false);
      }
    };

    if (selectedTransition) {
      fetchMatchingUsers();
    }
  }, [selectedTransition, needsUserSelection, incident]);

  // Request camera permissions
  const requestCameraPermission = async () => {
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
      return false;
    }
    return true;
  };

  // Request media library permissions
  const requestMediaLibraryPermission = async () => {
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
      return false;
    }
    return true;
  };

  // Pick image from gallery
  const pickImageFromGallery = async () => {
    setShowAttachmentOptions(false);
    const hasPermission = await requestMediaLibraryPermission();
    if (!hasPermission) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
      base64: false,
    });

    if (!result.canceled && result.assets) {
      const newAttachments = result.assets.map(asset => ({
        uri: asset.uri,
        name: asset.fileName || `image_${Date.now()}.jpg`,
        type: asset.mimeType || 'image/jpeg',
        size: asset.fileSize,
      }));
      setAttachments(prev => [...prev, ...newAttachments]);
    }
  };

  // Take photo with camera
  const takePhotoWithCamera = async () => {
    setShowAttachmentOptions(false);
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        base64: false,
        exif: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
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
      }
    } catch (error) {
      CustomAlert.alert(t('common.error', 'Error'), t('common.takePhotoFailed', 'Failed to take photo'));
    }
  };

  // Remove attachment
  const removeAttachment = (index) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

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
  }, []);

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
      takePhotoWithCamera();
    }, 300);
  }, []);

  const handleUpdate = async () => {
    if (!selectedTransition) {
      CustomAlert.alert(t('common.error', 'Error'), t('incidents.selectStatusError', 'Please select a status to update.'));
      return;
    }
    if (transitionRequiresComment && !comment.trim()) {
      CustomAlert.alert(t('common.error', 'Error'), t('incidents.commentRequiredForTransition', 'A comment is required for this transition.'));
      return;
    }
    if (transitionRequiresFeedback && feedbackRating === 0) {
      CustomAlert.alert(t('common.error', 'Error'), t('incidents.feedbackRatingRequiredError', 'Please provide a feedback rating for this transition.'));
      return;
    }
    if (needsUserSelection && !selectedUser) {
      CustomAlert.alert(t('common.error', 'Error'), t('incidents.selectUserError', 'Please select a user to assign this incident to.'));
      return;
    }
    if (needsDeptSelection && !selectedDepartmentId) {
      CustomAlert.alert(t('common.error', 'Error'), t('incidents.selectDepartmentError', 'Please select a department for this transition.'));
      return;
    }
    if (transitionRequiresAttachment && attachments.length === 0) {
      CustomAlert.alert(t('common.error', 'Error'), t('incidents.attachmentRequiredError', 'At least one attachment is required for this transition.'));
      return;
    }

    // Validate required field changes
    const fieldChanges = selectedTransition?.transition?.field_changes || [];
    for (const fc of fieldChanges) {
      if (fc.is_required && !fieldChangeValues[fc.field_name]) {
        CustomAlert.alert(t('common.error', 'Error'), `${fc.label || fc.field_name} ${t('common.isRequired', 'is required')}`);
        return;
      }
    }

    setLoading(true);
    let uploadedAttachmentIds = [];

    // Upload attachments first if there are any
    if (attachments.length > 0) {
      setIsUploading(true);
      setUploadProgress(t('common.uploadingFiles', 'Uploading {{count}} file(s)...', { count: attachments.length }));

      const uploadResult = await uploadMultipleAttachments(incidentId, attachments);

      if (uploadResult.success) {
        uploadedAttachmentIds = uploadResult.data.map(att => att.id);
        setUploadProgress(t('common.uploadComplete', 'Upload complete!'));
      } else if (uploadResult.partialSuccess) {
        // Some files uploaded successfully
        uploadedAttachmentIds = uploadResult.data.map(att => att.id);
        const failedCount = uploadResult.errors?.length || 0;
        CustomAlert.alert(
          t('common.partialUpload', 'Partial Upload'),
          t('common.partialUploadMessage', '{{uploaded}} file(s) uploaded successfully. {{failed}} file(s) failed.', {
            uploaded: uploadResult.data.length,
            failed: failedCount,
          })
        );
      } else {
        // All uploads failed
        setLoading(false);
        setIsUploading(false);
        setUploadProgress('');
        CustomAlert.alert(t('common.error', 'Error'), t('common.uploadFailed', 'Failed to upload attachments. Please try again.'));
        return;
      }

      setIsUploading(false);
    }

    // Execute the transition
    setUploadProgress(t('common.updatingStatus', 'Updating status...'));

    // Determine department_id: static assign or auto-detected selection
    let departmentId: string | undefined;
    if (selectedTransition.transition?.assign_department_id) {
      departmentId = selectedTransition.transition.assign_department_id;
    } else if (needsDeptSelection && selectedDepartmentId) {
      departmentId = selectedDepartmentId;
    }

    const transitionData: any = {
      transition_id: selectedTransition.transition.id,
      comment: comment.trim() || undefined,
      user_ids: selectedUser ? [selectedUser.id] : undefined,
      department_id: departmentId,
      attachments: uploadedAttachmentIds.length > 0 ? uploadedAttachmentIds : undefined,
      feedback: feedbackRating > 0 ? { rating: feedbackRating, comment: feedbackComment.trim() || undefined } : undefined,
      ready_to_close_duration: readyToCloseDuration || undefined,
      version: incident?.version || 1,
      field_changes: Object.keys(fieldChangeValues).length > 0 ? fieldChangeValues : undefined,
    };

    const response = await executeTransition(incidentId, transitionData);

    setLoading(false);
    setUploadProgress('');

    if (response.success) {
      // Get appropriate success message based on ticket type
      let successMessage = t('common.statusUpdated');
      if (ticketType === 'incident') {
        successMessage = t('common.incidentStatusUpdated');
      } else if (ticketType === 'request') {
        successMessage = t('common.requestStatusUpdated');
      } else if (ticketType === 'complaint') {
        successMessage = t('common.complaintStatusUpdated');
      } else if (ticketType === 'query') {
        successMessage = t('common.queryStatusUpdated');
      }

      CustomAlert.alert(t('common.success'), successMessage, [
        {
          text: t('common.ok'), onPress: () => {
            router.back();
          }
        },
      ]);
    } else {
      // Check for version conflict
      const errorMessage = response.error || '';
      if (errorMessage.includes('conflict') || errorMessage.includes('modified by another user')) {
        CustomAlert.alert(
          t('common.conflictDetected') || 'Conflict Detected',
          t('common.incidentModifiedByAnother') || 'This incident was modified by another user. Please review and try again.',
          [
            {
              text: t('common.refresh') || 'Refresh',
              onPress: () => router.back(),
            },
          ]
        );
      } else {
        CustomAlert.alert(t('common.error'), `${t('common.failed')}: ${response.error}`);
      }
    }
  };

  const handleTransitionSelect = (trans) => {
    setSelectedTransition(trans);
    setSelectedUser(null);
    setMatchingUsers([]);
    setSingleUserMatch(false);
    setFeedbackRating(0);
    setFeedbackComment('');
    setComment('');
    setFieldChangeValues({});
    setFieldChangeDisplayValues({});
    setSelectedDepartmentId('');
    setDepartmentMatchResult(null);
    setReadyToCloseDuration('');
    setTransitionStep(0);
    setShowPicker(false);
    setAutoSelectUser(trans.auto_match_user)

    // Pre-fetch tree data for field changes that need hierarchical pickers
    const fcs = trans.transition?.field_changes || [];
    if (fcs.some(fc => fc.field_name === 'department_id')) {
      getDepartmentsTree().then(r => { if (r.success) setDepartmentsTree(r.data); });
    }
    if (fcs.some(fc => fc.field_name === 'location_id')) {
      getLocationsTree().then(r => { if (r.success) setLocationsTree(r.data); });
    }
    if (fcs.some(fc => fc.field_name === 'classification_id')) {
      getClassificationsTree().then(r => { if (r.success) setClassificationsTree(r.data); });
    }

    // Auto-detect department: fetch match result
    if (trans.transition?.auto_detect_department && !trans.transition?.assign_department_id && incident) {
      setLoadingDeptMatch(true);
      const criteria: any = {
        classification_id: incident.classification_id || incident.classification?.id || undefined,
        location_id: incident.location_id || incident.location?.id || undefined,
      };
      if (trans.transition?.department_type_filter) {
        criteria.department_type = trans.transition.department_type_filter;
      }
      matchDepartments(criteria).then(r => {
        setLoadingDeptMatch(false);
        if (r.success && r.data) {
          setDepartmentMatchResult(r.data);
          if (r.data.single_match && r.data.matched_department_id) {
            setSelectedDepartmentId(r.data.matched_department_id);
          }
        } else {
          // API failed — show empty result so UI doesn't stay blank
          setDepartmentMatchResult({ departments: [], single_match: false });
        }
      });
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.overlay}
    >
      <View style={styles.modalContainer}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>{t('incidents.updateTheStatus')}</Text>
            {selectedTransition && transitionSteps.length > 0 && (
              <Text style={styles.stepCounter}>
                {t('incidents.stepOf', 'Step {{current}} of {{total}}', { current: transitionStep + 1, total: transitionSteps.length })}
              </Text>
            )}
          </View>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="close-circle" size={28} color="#E74C3C" />
          </TouchableOpacity>
        </View>

        {/* State indicator + progress dots (shown after transition is selected) */}
        {selectedTransition && (
          <View style={styles.wizardInfoBar}>
            <View style={styles.stateRow}>
              <View style={[styles.stateBadge, { backgroundColor: (selectedTransition.transition.from_state?.color || '#888') + '22' }]}>
                <Text style={[styles.stateBadgeText, { color: selectedTransition.transition.from_state?.color || '#888' }]}>
                  {selectedTransition.transition.from_state?.name || t('incidents.currentStateFallback', 'Current')}
                </Text>
              </View>
              <Ionicons name={t('common.icons.arrowForward') as any} size={14} color="#888" style={{ marginHorizontal: 6 }} />
              <View style={[styles.stateBadge, { backgroundColor: (selectedTransition.transition.to_state?.color || '#2EC4B6') + '22' }]}>
                <Text style={[styles.stateBadgeText, { color: selectedTransition.transition.to_state?.color || '#2EC4B6' }]}>
                  {selectedTransition.transition.to_state?.name || t('incidents.nextStateFallback', 'Next')}
                </Text>
              </View>
            </View>
            <View style={styles.dotsRow}>
              {transitionSteps.map((_, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.dot,
                    idx === transitionStep ? styles.dotActive : idx < transitionStep ? styles.dotDone : styles.dotPending,
                  ]}
                />
              ))}
            </View>
          </View>
        )}

        <ScrollView style={styles.formContainer} showsVerticalScrollIndicator={false}>

          {/* ── TRANSITION SELECTION SCREEN (no transition picked yet) ── */}
          {!selectedTransition && (
            <>
              <Text style={styles.stepLabel}>{t('incidents.selectStatus')}</Text>
              <Text style={styles.stepHint}>{t('common.chooseTransition')}</Text>
              {availableTransitions.map((trans) => (
                <TouchableOpacity
                  key={trans.transition.id}
                  style={styles.transitionCard}
                  onPress={() => handleTransitionSelect(trans)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.transitionCardTitle}>{trans.transition.name}</Text>
                    {trans.transition.to_state && (
                      <View style={styles.transitionCardStateRow}>
                        <Text style={styles.transitionCardStateLabel}>→ </Text>
                        <View style={[styles.stateBadge, { backgroundColor: (trans.transition.to_state.color || '#2EC4B6') + '22' }]}>
                          <Text style={[styles.stateBadgeText, { color: trans.transition.to_state.color || '#2EC4B6' }]}>
                            {trans.transition.to_state.name}
                          </Text>
                        </View>
                      </View>
                    )}
                  </View>
                  <Ionicons name={t('common.icons.chevronForward') as any} size={20} color="#CCC" />
                </TouchableOpacity>
              ))}
            </>
          )}

          {/* ── WIZARD STEPS (transition selected) ── */}
          {selectedTransition && currentStepKey && (
            <View style={{ paddingBottom: 8 }}>
              {/* Step title */}
              <View style={styles.stepTitleRow}>
                <View style={{ marginVertical: 5 }}>
                  <Text style={styles.stepLabel}>{stepTitles[currentStepKey]}</Text>
                  {
                    currentStepKey === 'user' && selectedTransition.transition.auto_match_user &&
                    <Text>{t('incidents.usersAssignedToAll', 'User will be assigned to all users')}</Text>
                  }
                </View>
                {isStepMandatory()
                  ? <Text style={styles.stepRequired}>{t('incidents.stepRequired', 'Required')}</Text>
                  : <Text style={styles.stepOptional}>{t('incidents.stepOptional', 'Optional')}</Text>
                }
              </View>

              {/* ── DEPARTMENT STEP ── */}
              {currentStepKey === 'department' && (
                <>
                  {selectedTransition.transition.assign_department_id ? (
                    <View style={styles.autoAssignedCard}>
                      <Ionicons name="business-outline" size={20} color="#2EC4B6" />
                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={styles.autoAssignedName}>{t('incidents.departmentPreConfigured', 'Department pre-configured')}</Text>
                      </View>
                      <Text style={styles.autoAssignedBadge}>{t('incidents.auto', 'Auto')}</Text>
                    </View>
                  ) : loadingDeptMatch ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="small" color="#2EC4B6" />
                      <Text style={styles.loadingText}>{t('incidents.findingMatchingDepartments', 'Finding matching departments...')}</Text>
                    </View>
                  ) : departmentMatchResult?.single_match ? (
                    <View style={styles.autoAssignedCard}>
                      <Ionicons name="business-outline" size={20} color="#2EC4B6" />
                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={styles.autoAssignedName}>
                          {departmentMatchResult.departments?.[0]?.name || t('incidents.autoSelected', 'Auto-selected')}
                        </Text>
                      </View>
                      <Text style={styles.autoAssignedBadge}>{t('incidents.autoSelected', 'Auto-selected')}</Text>
                    </View>
                  ) : departmentMatchResult?.departments?.length === 0 ? (
                    <View style={styles.noUsersContainer}>
                      <Ionicons name="business-outline" size={32} color="#CCC" />
                      <Text style={styles.noUsersText}>{t('incidents.noMatchingDepartments', 'No matching departments found')}</Text>
                    </View>
                  ) : departmentMatchResult ? (
                    departmentMatchResult.departments.map((dept: any) => (
                      <TouchableOpacity
                        key={dept.id}
                        style={[styles.selectionRow, selectedDepartmentId === dept.id && styles.selectionRowSelected]}
                        onPress={() => setSelectedDepartmentId(dept.id)}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.selectionRowTitle, selectedDepartmentId === dept.id && styles.selectionRowTitleSelected]}>
                            {dept.name}
                          </Text>
                          {dept.type && <Text style={styles.selectionRowSub}>{dept.type}</Text>}
                        </View>
                        {selectedDepartmentId === dept.id && (
                          <Ionicons name="checkmark-circle" size={22} color="#2EC4B6" />
                        )}
                      </TouchableOpacity>
                    ))
                  ) : null}
                </>
              )}

              {/* ── USER STEP ── */}
              {currentStepKey === 'user' && (
                <>
                  {loadingUsers ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="small" color="#2EC4B6" />
                      <Text style={styles.loadingText}>{t('incidents.findingMatchingUsers', 'Finding matching users...')}</Text>
                    </View>
                  ) : singleUserMatch && matchingUsers.length === 1 ? (
                    <View style={styles.autoAssignedCard}>
                      <Ionicons name="person-circle-outline" size={20} color="#2EC4B6" />
                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={styles.autoAssignedName}>
                          {matchingUsers[0].first_name} {matchingUsers[0].last_name}
                        </Text>
                        <Text style={styles.autoAssignedSub}>{matchingUsers[0].email}</Text>
                      </View>
                      <Text style={styles.autoAssignedBadge}>{t('incidents.autoSelected', 'Auto-selected')}</Text>
                    </View>
                  ) : matchingUsers.length > 0 ? (
                    matchingUsers.map((u: any) => (
                      <TouchableOpacity
                        key={u.id}
                        style={[styles.selectionRow, selectedUser?.id === u.id && styles.selectionRowSelected]}
                        onPress={() => setSelectedUser(u)}
                        disabled={selectedTransition.transition.auto_match_user}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.selectionRowTitle, selectedUser?.id === u.id && styles.selectionRowTitleSelected]}>
                            {u.first_name} {u.last_name}
                          </Text>
                          <Text style={styles.selectionRowSub}>{u.email}</Text>
                        </View>
                        {selectedUser?.id === u.id && (
                          <Ionicons name="checkmark-circle" size={22} color="#2EC4B6" />
                        )}
                      </TouchableOpacity>
                    ))
                  ) : (
                    <View style={styles.noUsersContainer}>
                      <Ionicons name="person-outline" size={32} color="#CCC" />
                      <Text style={styles.noUsersText}>{t('incidents.noMatchingUsers', 'No matching users found')}</Text>
                    </View>
                  )}
                </>
              )}

              {/* ── FIELD CHANGES STEP ── */}
              {currentStepKey === 'field_changes' && (
                <>
                  {(selectedTransition.transition.field_changes || [])
                    .slice()
                    .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                    .map((fc: any) => (
                      <View key={fc.field_name} style={{ marginBottom: 16 }}>
                        <Text style={styles.label}>{fc.label || fc.field_name}{fc.is_required ? ' *' : ''}</Text>
                        {fc.field_name === 'priority' && (
                          <View style={styles.priorityRow}>
                            {[1, 2, 3, 4, 5].map((p) => (
                              <TouchableOpacity
                                key={p}
                                style={[styles.priorityBtn, fieldChangeValues['priority'] === String(p) && styles.priorityBtnSelected]}
                                onPress={() => setFieldChangeValues(prev => ({ ...prev, priority: String(p) }))}
                              >
                                <Text style={[styles.priorityBtnText, fieldChangeValues['priority'] === String(p) && styles.priorityBtnTextSelected]}>{p}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                        {fc.field_name === 'department_id' && (
                          <TreeSelect
                            label={fc.label || t('incidents.departmentAssignment', 'Department')}
                            value={fieldChangeDisplayValues['department_id'] || ''}
                            data={fc.department_type_filter ? filterDeptTree(departmentsTree, fc.department_type_filter) : departmentsTree}
                            onSelect={(node) => {
                              if (node) { setFieldChangeValues(p => ({ ...p, department_id: node.id })); setFieldChangeDisplayValues(p => ({ ...p, department_id: node.name })); }
                              else { setFieldChangeValues(p => { const n = { ...p }; delete n.department_id; return n; }); setFieldChangeDisplayValues(p => { const n = { ...p }; delete n.department_id; return n; }); }
                            }}
                            leafOnly={false}
                            placeholder={t('incidents.selectDepartmentPlaceholder', 'Select department...')}
                          />
                        )}
                        {fc.field_name === 'location_id' && (
                          <TreeSelect label={fc.label || t('incidents.location', 'Location')} value={fieldChangeDisplayValues['location_id'] || ''} data={locationsTree}
                            onSelect={(node) => {
                              if (node) { setFieldChangeValues(p => ({ ...p, location_id: node.id })); setFieldChangeDisplayValues(p => ({ ...p, location_id: node.name })); }
                              else { setFieldChangeValues(p => { const n = { ...p }; delete n.location_id; return n; }); setFieldChangeDisplayValues(p => { const n = { ...p }; delete n.location_id; return n; }); }
                            }} leafOnly={false} placeholder={t('incidents.selectLocationPlaceholder', 'Select location...')} iconType="location" />
                        )}
                        {fc.field_name === 'classification_id' && (
                          <TreeSelect label={fc.label || t('incidents.classification', 'Classification')} value={fieldChangeDisplayValues['classification_id'] || ''} data={classificationsTree}
                            onSelect={(node) => {
                              if (node) { setFieldChangeValues(p => ({ ...p, classification_id: node.id })); setFieldChangeDisplayValues(p => ({ ...p, classification_id: node.name })); }
                              else { setFieldChangeValues(p => { const n = { ...p }; delete n.classification_id; return n; }); setFieldChangeDisplayValues(p => { const n = { ...p }; delete n.classification_id; return n; }); }
                            }} leafOnly={false} placeholder={t('incidents.selectClassificationPlaceholder', 'Select classification...')} iconType="classification" />
                        )}
                        {fc.field_name === 'title' && (
                          <TextInput style={[styles.fieldInput, { textAlign: i18n.language === 'ar' ? 'right' : 'left' }]} placeholder={t('incidents.enterTitlePlaceholder', 'Enter title...')} placeholderTextColor="#999"
                            value={fieldChangeValues['title'] || ''} onChangeText={(t) => setFieldChangeValues(p => ({ ...p, title: t }))} />
                        )}
                        {fc.field_name === 'description' && (
                          <TextInput style={[styles.fieldInput, styles.fieldInputMultiline, { textAlign: i18n.language === 'ar' ? 'right' : 'left' }]}
                            placeholder={t('incidents.enterDescriptionPlaceholder', 'Enter description...')}
                            placeholderTextColor="#999" multiline value={fieldChangeValues['description'] || ''}
                            onChangeText={(t) => setFieldChangeValues(p => ({ ...p, description: t }))} />
                        )}
                        {fc.field_name.startsWith('lookup:') && (() => {
                          const code = fc.field_name.replace('lookup:', '');
                          const category = lookupCategories.find(c => c.code === code);
                          if (!category) return null;
                          return (
                            <DynamicLookupField
                              category={category}
                              value={fieldChangeValues[fc.field_name] || null}
                              onChange={(catId, val) => {
                                setFieldChangeValues(prev => ({
                                  ...prev,
                                  [fc.field_name]: val,
                                }));
                              }}
                              required={fc.is_required}
                              mentionFilters={{
                                classification_ids: incident?.classification_id ? [incident.classification_id] : [],
                                location_ids: incident?.location_id ? [incident.location_id] : [],
                                currentIncident_ids: incidentId ? [incidentId] : [],
                              }}
                            />
                          );
                        })()}
                      </View>
                    ))}
                </>
              )}

              {/* ── DURATION STEP ── */}
              {currentStepKey === 'duration' && (
                <>
                  <Text style={styles.stepHint}>
                    {t('incidents.autoRevertHint', 'If not closed within this duration, the incident will automatically revert.')}
                  </Text>
                  {readyToCloseDurationOptions.map(opt => (
                    <TouchableOpacity
                      key={opt.value}
                      style={[styles.selectionRow, readyToCloseDuration === opt.value && styles.selectionRowSelected]}
                      onPress={() => setReadyToCloseDuration(opt.value)}
                    >
                      <Text style={[styles.selectionRowTitle, readyToCloseDuration === opt.value && styles.selectionRowTitleSelected]}>
                        {opt.label}
                      </Text>
                      {readyToCloseDuration === opt.value && (
                        <Ionicons name="checkmark-circle" size={22} color="#2EC4B6" />
                      )}
                    </TouchableOpacity>
                  ))}
                </>
              )}

              {/* ── ATTACHMENT STEP ── */}
              {currentStepKey === 'attachment' && (
                <>
                  {attachments.length > 0 && (
                    <View style={styles.attachmentPreviewContainer}>
                      {attachments.map((attachment: any, index: number) => (
                        <View key={index} style={styles.attachmentPreview}>
                          <Image source={{ uri: attachment.uri }} style={styles.attachmentThumbnail} contentFit="cover" />
                          <TouchableOpacity style={styles.removeAttachmentBtn} onPress={() => removeAttachment(index)}>
                            <Ionicons name="close-circle" size={24} color="#E74C3C" />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                  <TouchableOpacity style={styles.attachmentBox} onPress={takePhotoWithCamera}>
                    <Ionicons name="cloud-upload-outline" size={32} color="#2EC4B6" />
                    <Text style={styles.attachmentText}>{attachments.length > 0 ? t('incidents.addMoreFiles', 'Add more files') : t('incidents.attachFiles', 'Attach files')}</Text>
                    <Text style={styles.attachmentSubText}>{t('incidents.maxFileSize', 'Max file size: 5 MB')}</Text>
                  </TouchableOpacity>
                </>
              )}

              {/* ── FEEDBACK STEP ── */}
              {currentStepKey === 'feedback' && (
                <>
                  <Text style={styles.stepHint}>{t('incidents.rateYourExperience', 'Rate your experience with this resolution')}</Text>
                  <View style={styles.starRatingContainer}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <TouchableOpacity key={star} onPress={() => setFeedbackRating(star)} style={styles.starButton}>
                        <Ionicons name={star <= feedbackRating ? 'star' : 'star-outline'} size={40} color={star <= feedbackRating ? '#FFD700' : '#CCC'} />
                      </TouchableOpacity>
                    ))}
                  </View>
                  {feedbackRating > 0 && (
                    <Text style={[styles.ratingText, { textAlign: 'center', marginBottom: 12 }]}>
                      {feedbackRating === 1 && t('incidents.ratingPoor')}
                      {feedbackRating === 2 && t('incidents.ratingFair')}
                      {feedbackRating === 3 && t('incidents.ratingGood')}
                      {feedbackRating === 4 && t('incidents.ratingVeryGood')}
                      {feedbackRating === 5 && t('incidents.ratingExcellent')}
                    </Text>
                  )}
                  <IncidentMentionTextarea
                    style={[styles.commentInput, { textAlign: i18n.language === 'ar' ? 'right' : 'left' }]}
                    placeholder={t('incidents.feedbackCommentPlaceholder', 'Add feedback comment (optional)...')}
                    value={feedbackComment}
                    onChangeText={setFeedbackComment}
                    filters={{
                      classification_ids: incident?.classification_id ? [incident.classification_id] : [],
                      location_ids: incident?.location_id ? [incident.location_id] : [],
                      currentIncident_ids: incidentId ? [incidentId] : [],
                    }}
                  />
                </>
              )}

              {/* ── COMMENT STEP ── */}
              {currentStepKey === 'comment' && (
                <IncidentMentionTextarea
                  style={[styles.commentInput, { minHeight: 120, textAlign: i18n.language === 'ar' ? 'right' : 'left' }]}
                  placeholder={transitionRequiresComment ? t('incidents.addCommentPlaceholder') + ' *' : t('incidents.addCommentPlaceholder')}
                  value={comment}
                  onChangeText={setComment}
                  filters={{
                    classification_ids: incident?.classification_id ? [incident.classification_id] : [],
                    location_ids: incident?.location_id ? [incident.location_id] : [],
                    currentIncident_ids: incidentId ? [incidentId] : [],
                  }}
                  autoFocus
                />
              )}
            </View>
          )}
        </ScrollView>

        {/* Upload Progress */}
        {uploadProgress ? (
          <View style={styles.progressContainer}>
            <ActivityIndicator size="small" color="#2EC4B6" />
            <Text style={styles.progressText}>{uploadProgress}</Text>
          </View>
        ) : null}

        {/* Wizard Navigation Footer */}
        {selectedTransition ? (
          <View style={[styles.wizardFooter]}>
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <Ionicons name={t('common.icons.arrowBack') as any} size={18} color="#666" />
              <Text style={styles.backButtonText}>{transitionStep === 0 ? t('common.change', 'Change') : t('common.back', 'Back')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.nextButton, loading && styles.disabledButton]}
              onPress={handleNext}
              disabled={loading}
            >
              {loading ? (
                <View style={styles.buttonLoadingContainer}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={styles.nextButtonText}>{isUploading ? ` ${t('common.uploading', 'Uploading...')}` : ` ${t('common.updating', 'Updating...')}`}</Text>
                </View>
              ) : (
                <>
                  <Text style={styles.nextButtonText}>{isLastStep ? t('common.execute', 'Execute') : t('common.next', 'Next')}</Text>
                  <Ionicons name={isLastStep ? 'checkmark' : (t('common.icons.arrowForward') as any)} size={18} color="#fff" />
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      {/* Attachment Options Modal */}
      <Modal
        transparent={true}
        visible={showAttachmentOptions}
        animationType="slide"
        onRequestClose={() => setShowAttachmentOptions(false)}
      >
        <Pressable style={styles.bottomSheetOverlay} onPress={() => setShowAttachmentOptions(false)}>
          <View style={styles.bottomSheet}>
            <View style={styles.bottomSheetHandle} />
            <Text style={styles.bottomSheetTitle}>{t('incidents.addAttachment', 'Add Attachment')}</Text>

            <TouchableOpacity style={styles.bottomSheetOption} onPress={takePhotoWithCamera}>
              <View style={[styles.optionIconContainer, { backgroundColor: '#E8F5E9' }]}>
                <Ionicons name="camera" size={28} color="#4CAF50" />
              </View>
              <View style={styles.optionTextContainer}>
                <Text style={styles.optionTitle}>{t('incidents.takePhoto', 'Take Photo')}</Text>
                <Text style={styles.optionSubtitle}>{t('incidents.takePhotoSubtitle', 'Use your camera to capture an image')}</Text>
              </View>
            </TouchableOpacity>

            {/* <TouchableOpacity style={styles.bottomSheetOption} onPress={pickImageFromGallery}>
              <View style={[styles.optionIconContainer, { backgroundColor: '#E3F2FD' }]}>
                <Ionicons name="images" size={28} color="#2196F3" />
              </View>
              <View style={styles.optionTextContainer}>
                <Text style={styles.optionTitle}>{t('common.chooseFromGallery', 'Choose from Gallery')}</Text>
                <Text style={styles.optionSubtitle}>{t('common.selectImagesFromLibrary', 'Select images from your photo library')}</Text>
              </View>
            </TouchableOpacity> */}

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowAttachmentOptions(false)}
            >
              <Text style={styles.cancelButtonText}>{t('common.cancel', 'Cancel')}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

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
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  formContainer: {
    maxHeight: 400,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 12,
  },
  dropdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  dropdownText: {
    fontSize: 16,
    color: '#333',
  },
  placeholder: {
    color: '#999',
  },
  pickerOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  pickerContainer: {
    width: '85%',
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 15,
    maxHeight: '70%',
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
    color: '#333',
  },
  pickerItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    borderRadius: 8,
    marginBottom: 5,
  },
  pickerItemSelected: {
    backgroundColor: '#E8F8F7',
    borderColor: '#2EC4B6',
    borderWidth: 1,
  },
  pickerItemText: {
    fontSize: 16,
    color: '#333',
  },
  pickerItemTextSelected: {
    color: '#2EC4B6',
    fontWeight: '600',
  },
  pickerItemSubtext: {
    fontSize: 12,
    color: '#999',
    marginTop: 3,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
  },
  loadingText: {
    marginLeft: 10,
    color: '#666',
  },
  autoAssignedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F0FDFB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2EC4B640',
  },
  autoAssignedName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  autoAssignedSub: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  autoAssignedBadge: {
    fontSize: 11,
    color: '#2EC4B6',
    fontWeight: '600',
  },
  noUsersContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#FFF5F5',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FFE0E0',
  },
  noUsersText: {
    marginLeft: 10,
    color: '#999',
    fontSize: 14,
  },
  commentInput: {
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    padding: 15,
    minHeight: 100,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    fontSize: 16,
  },
  starRatingContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    padding: 15,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  starButton: {
    padding: 5,
    marginHorizontal: 5,
  },
  ratingText: {
    textAlign: 'center',
    marginTop: 8,
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  attachmentPreviewContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  attachmentPreview: {
    position: 'relative',
    marginRight: 10,
    marginBottom: 10,
  },
  attachmentThumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  removeAttachmentBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: 'white',
    borderRadius: 12,
  },
  attachmentBox: {
    borderWidth: 2,
    borderColor: '#2EC4B6',
    borderStyle: 'dashed',
    borderRadius: 10,
    padding: 25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FFFE',
  },
  attachmentText: {
    color: '#2EC4B6',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 8,
  },
  attachmentSubText: {
    color: '#666',
    fontSize: 12,
    marginTop: 4,
  },
  updateButton: {
    backgroundColor: '#2EC4B6',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  updateButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  disabledButton: {
    backgroundColor: '#B0B0B0',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  progressText: {
    marginLeft: 10,
    color: '#2EC4B6',
    fontSize: 14,
    fontWeight: '500',
  },
  buttonLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Field Change Styles
  priorityRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  priorityBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
  },
  priorityBtnSelected: {
    borderColor: '#2EC4B6',
    backgroundColor: '#E8F8F7',
  },
  priorityBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  priorityBtnTextSelected: {
    color: '#2EC4B6',
  },
  fieldInput: {
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    padding: 15,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    fontSize: 16,
    marginBottom: 12,
  },
  fieldInputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  // Bottom Sheet Styles
  bottomSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  bottomSheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  bottomSheetTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  bottomSheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  optionIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  optionSubtitle: {
    fontSize: 13,
    color: '#999',
    marginTop: 2,
  },
  cancelButton: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  // Wizard styles
  stepCounter: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  wizardInfoBar: {
    backgroundColor: '#F8F9FA',
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  stateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  stateBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  stateBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    width: 20,
    backgroundColor: '#2EC4B6',
  },
  dotDone: {
    width: 8,
    backgroundColor: '#2EC4B640',
  },
  dotPending: {
    width: 8,
    backgroundColor: '#E0E0E0',
  },
  stepTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  stepLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#222',
  },
  stepHint: {
    fontSize: 13,
    color: '#888',
    marginBottom: 14,
  },
  stepRequired: {
    fontSize: 12,
    color: '#E74C3C',
    fontWeight: '600',
  },
  stepOptional: {
    fontSize: 12,
    color: '#999',
  },
  transitionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#EFEFEF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
  },
  transitionCardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#222',
    marginBottom: 4,
  },
  transitionCardStateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  transitionCardStateLabel: {
    fontSize: 12,
    color: '#888',
  },
  selectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#EFEFEF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
  },
  selectionRowSelected: {
    borderColor: '#2EC4B6',
    backgroundColor: '#F0FAFA',
  },
  selectionRowTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  selectionRowTitleSelected: {
    color: '#2EC4B6',
    fontWeight: '600',
  },
  selectionRowSub: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  wizardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#EFEFEF',
    gap: 12,
  },
  backButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    gap: 6,
  },
  backButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  nextButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2EC4B6',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 6,
  },
  nextButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
});

export default UpdateStatusModal;
