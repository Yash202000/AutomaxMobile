import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Modal, Pressable, Alert, ActivityIndicator, ScrollView, Linking } from 'react-native';
import { Image } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { executeTransition, getMatchingUsers, uploadMultipleAttachments } from '@/src/api/incidents';
import { getDepartmentsTree } from '@/src/api/departments';
import { getLocationsTree } from '@/src/api/locations';
import { getClassificationsTree } from '@/src/api/classifications';
import TreeSelect, { TreeNode } from '@/src/components/TreeSelect';
import { WatermarkProcessor, WatermarkData } from '@/src/components/WatermarkProcessor';
import { WatermarkPreview } from '@/src/components/WatermarkPreview';
import { LocationData } from '@/src/components/LocationPickerOSM';
import { generateWatermarkedFilename } from '@/src/utils/watermarkUtils';
import { useAuth } from '@/src/context/AuthContext';
import * as Location from 'expo-location';
import { compressImage } from '@/src/utils/imageCompression';

const UpdateStatusModal = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { id, type, transitions, incident: incidentParam } = useLocalSearchParams();
  const incidentId = Array.isArray(id) ? id[0] : id;
  const ticketType = Array.isArray(type) ? type[0] : (type || 'incident');

  // Safely parse JSON with error handling to prevent crashes
  let availableTransitions = [];
  let incident = null;

  try {
    availableTransitions = transitions ? JSON.parse(transitions as string) : [];
  } catch (error) {
    console.error('[UpdateStatus] Failed to parse transitions:', error);
    availableTransitions = [];
  }

  try {
    incident = incidentParam ? JSON.parse(incidentParam as string) : null;
  } catch (error) {
    console.error('[UpdateStatus] Failed to parse incident:', error);
    incident = null;
  }

  const [selectedTransition, setSelectedTransition] = useState(null);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  // User selection state
  const [matchingUsers, setMatchingUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserPicker, setShowUserPicker] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);

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
          Alert.alert(
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
          Alert.alert(
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

  // Check if manual user selection is needed
  const needsManualUserSelection = selectedTransition?.transition?.manual_select_user && selectedTransition?.transition?.assignment_role_id;

  // Fetch matching users when a transition with manual_select_user is selected
  useEffect(() => {
    const fetchMatchingUsers = async () => {
      if (!needsManualUserSelection || !incident) return;

      setLoadingUsers(true);
      const matchCriteria = {
        role_id: selectedTransition.transition.assignment_role_id,
        classification_id: incident.classification_id || null,
        location_id: incident.location_id || null,
        department_id: incident.department_id || null,
        exclude_user_id: incident.assignee_id || null,
      };

      const response = await getMatchingUsers(matchCriteria);
      setLoadingUsers(false);

      if (response.success) {
        setMatchingUsers(response.data.users || []);
      } else {
        setMatchingUsers([]);
      }
    };

    if (selectedTransition) {
      fetchMatchingUsers();
    }
  }, [selectedTransition, needsManualUserSelection, incident]);

  // Request camera permissions
  const requestCameraPermission = async () => {
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
      return false;
    }
    return true;
  };

  // Request media library permissions
  const requestMediaLibraryPermission = async () => {
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
      Alert.alert('Error', 'Failed to take photo');
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
      Alert.alert('Error', 'Please select a status to update.');
      return;
    }
    if (transitionRequiresComment && !comment.trim()) {
      Alert.alert('Error', 'A comment is required for this transition.');
      return;
    }
    if (transitionRequiresFeedback && feedbackRating === 0) {
      Alert.alert('Error', 'Please provide a feedback rating for this transition.');
      return;
    }
    if (needsManualUserSelection && !selectedUser) {
      Alert.alert('Error', 'Please select a user to assign this incident to.');
      return;
    }
    if (transitionRequiresAttachment && attachments.length === 0) {
      Alert.alert('Error', 'At least one attachment is required for this transition.');
      return;
    }

    // Validate required field changes
    const fieldChanges = selectedTransition?.transition?.field_changes || [];
    for (const fc of fieldChanges) {
      if (fc.is_required && !fieldChangeValues[fc.field_name]) {
        Alert.alert('Error', `${fc.label || fc.field_name} is required for this transition.`);
        return;
      }
    }

    setLoading(true);
    let uploadedAttachmentIds = [];

    // Upload attachments first if there are any
    if (attachments.length > 0) {
      setIsUploading(true);
      setUploadProgress(`Uploading ${attachments.length} file(s)...`);

      const uploadResult = await uploadMultipleAttachments(incidentId, attachments);

      if (uploadResult.success) {
        uploadedAttachmentIds = uploadResult.data.map(att => att.id);
        setUploadProgress('Upload complete!');
      } else if (uploadResult.partialSuccess) {
        // Some files uploaded successfully
        uploadedAttachmentIds = uploadResult.data.map(att => att.id);
        const failedCount = uploadResult.errors?.length || 0;
        Alert.alert(
          'Partial Upload',
          `${uploadResult.data.length} file(s) uploaded successfully. ${failedCount} file(s) failed.`
        );
      } else {
        // All uploads failed
        setLoading(false);
        setIsUploading(false);
        setUploadProgress('');
        Alert.alert('Error', 'Failed to upload attachments. Please try again.');
        return;
      }

      setIsUploading(false);
    }

    // Execute the transition
    setUploadProgress('Updating status...');
    const transitionData = {
      transition_id: selectedTransition.transition.id,
      comment: comment.trim() || undefined,
      user_id: selectedUser?.id || undefined,
      attachments: uploadedAttachmentIds.length > 0 ? uploadedAttachmentIds : undefined,
      feedback: feedbackRating > 0 ? { rating: feedbackRating } : undefined,
      version: incident?.version || 1, // Include version for optimistic locking
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

      Alert.alert(t('common.success'), successMessage, [
        { text: t('common.ok'), onPress: () => {
          router.back();
        }},
      ]);
    } else {
      // Check for version conflict
      const errorMessage = response.error || '';
      if (errorMessage.includes('conflict') || errorMessage.includes('modified by another user')) {
        Alert.alert(
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
        Alert.alert('Error', `Failed to update status: ${response.error}`);
      }
    }
  };

  const handleTransitionSelect = (trans) => {
    setSelectedTransition(trans);
    setSelectedUser(null);
    setMatchingUsers([]);
    setFeedbackRating(0);
    setComment('');
    setFieldChangeValues({});
    setFieldChangeDisplayValues({});
    setShowPicker(false);

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
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.overlay}
    >
      <View style={styles.modalContainer}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('incidents.updateTheStatus')}</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="close-circle" size={28} color="#E74C3C" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.formContainer} showsVerticalScrollIndicator={false}>
          {/* Status/Transition Picker */}
          <Text style={styles.label}>{t('incidents.selectStatus')}</Text>
          <TouchableOpacity style={styles.dropdown} onPress={() => setShowPicker(true)}>
            <Text style={[styles.dropdownText, !selectedTransition && styles.placeholder]}>
              {selectedTransition ? selectedTransition.transition.name : t('incidents.selectTheStatus')}
            </Text>
            <FontAwesome name="chevron-down" size={16} color="#666" />
          </TouchableOpacity>

          <Modal
            transparent={true}
            visible={showPicker}
            onRequestClose={() => setShowPicker(false)}
          >
            <Pressable style={styles.pickerOverlay} onPress={() => setShowPicker(false)}>
              <View style={styles.pickerContainer}>
                <Text style={styles.pickerTitle}>{t('incidents.selectStatus')}</Text>
                {availableTransitions.map((trans, index) => (
                  <TouchableOpacity
                    key={trans.transition.id}
                    style={[
                      styles.pickerItem,
                      selectedTransition?.transition.id === trans.transition.id && styles.pickerItemSelected
                    ]}
                    onPress={() => handleTransitionSelect(trans)}
                  >
                    <Text style={[
                      styles.pickerItemText,
                      selectedTransition?.transition.id === trans.transition.id && styles.pickerItemTextSelected
                    ]}>
                      {trans.transition.name}
                    </Text>
                    {trans.transition.to_state && (
                      <Text style={styles.pickerItemSubtext}>
                        to {trans.transition.to_state.name}
                      </Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </Pressable>
          </Modal>

          {/* User Assignment Picker - only show if manual selection is needed */}
          {needsManualUserSelection && (
            <>
              <Text style={styles.label}>{t('incidents.assignToUser')}</Text>
              {loadingUsers ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#2EC4B6" />
                  <Text style={styles.loadingText}>Loading matching users...</Text>
                </View>
              ) : matchingUsers.length > 0 ? (
                <>
                  <TouchableOpacity style={styles.dropdown} onPress={() => setShowUserPicker(true)}>
                    <Text style={[styles.dropdownText, !selectedUser && styles.placeholder]}>
                      {selectedUser ? `${selectedUser.first_name} ${selectedUser.last_name}` : t('incidents.selectAUser')}
                    </Text>
                    <FontAwesome name="chevron-down" size={16} color="#666" />
                  </TouchableOpacity>

                  <Modal
                    transparent={true}
                    visible={showUserPicker}
                    onRequestClose={() => setShowUserPicker(false)}
                  >
                    <Pressable style={styles.pickerOverlay} onPress={() => setShowUserPicker(false)}>
                      <View style={styles.pickerContainer}>
                        <Text style={styles.pickerTitle}>Select User</Text>
                        <ScrollView style={{ maxHeight: 300 }}>
                          {matchingUsers.map((user) => (
                            <TouchableOpacity
                              key={user.id}
                              style={[
                                styles.pickerItem,
                                selectedUser?.id === user.id && styles.pickerItemSelected
                              ]}
                              onPress={() => {
                                setSelectedUser(user);
                                setShowUserPicker(false);
                              }}
                            >
                              <Text style={[
                                styles.pickerItemText,
                                selectedUser?.id === user.id && styles.pickerItemTextSelected
                              ]}>
                                {user.first_name} {user.last_name}
                              </Text>
                              <Text style={styles.pickerItemSubtext}>
                                {user.email}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    </Pressable>
                  </Modal>
                </>
              ) : (
                <View style={styles.noUsersContainer}>
                  <Ionicons name="person-outline" size={24} color="#999" />
                  <Text style={styles.noUsersText}>No matching users found</Text>
                </View>
              )}
            </>
          )}

          {/* Comment Field */}
          {(showCommentField || selectedTransition) && (
            <>
              <Text style={styles.label}>
                {transitionRequiresComment ? t('incidents.commentRequired') : t('incidents.commentOptional')}
              </Text>
              <TextInput
                style={styles.commentInput}
                placeholder={t('incidents.addCommentPlaceholder')}
                placeholderTextColor="#999"
                multiline
                value={comment}
                onChangeText={setComment}
              />
            </>
          )}

          {/* Feedback Rating Field */}
          {showFeedbackField && (
            <>
              <Text style={styles.label}>
                {transitionRequiresFeedback ? t('incidents.feedbackRatingRequired') : t('incidents.feedbackRatingOptional')}
              </Text>
              <View style={styles.starRatingContainer}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity
                    key={star}
                    onPress={() => setFeedbackRating(star)}
                    style={styles.starButton}
                  >
                    <Ionicons
                      name={star <= feedbackRating ? 'star' : 'star-outline'}
                      size={36}
                      color={star <= feedbackRating ? '#FFD700' : '#CCC'}
                    />
                  </TouchableOpacity>
                ))}
              </View>
              {feedbackRating > 0 && (
                <Text style={styles.ratingText}>
                  {feedbackRating === 1 && t('incidents.ratingPoor')}
                  {feedbackRating === 2 && t('incidents.ratingFair')}
                  {feedbackRating === 3 && t('incidents.ratingGood')}
                  {feedbackRating === 4 && t('incidents.ratingVeryGood')}
                  {feedbackRating === 5 && t('incidents.ratingExcellent')}
                </Text>
              )}
            </>
          )}

          {/* Field Changes */}
          {selectedTransition?.transition?.field_changes?.length > 0 && (
            <>
              {selectedTransition.transition.field_changes
                .slice()
                .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                .map((fc) => (
                  <View key={fc.field_name}>
                    <Text style={styles.label}>
                      {fc.label || fc.field_name}{fc.is_required ? ' *' : ''}
                    </Text>

                    {fc.field_name === 'priority' && (
                      <View style={styles.priorityRow}>
                        {[1, 2, 3, 4, 5].map((p) => (
                          <TouchableOpacity
                            key={p}
                            style={[
                              styles.priorityBtn,
                              fieldChangeValues['priority'] === String(p) && styles.priorityBtnSelected,
                            ]}
                            onPress={() =>
                              setFieldChangeValues(prev => ({ ...prev, priority: String(p) }))
                            }
                          >
                            <Text
                              style={[
                                styles.priorityBtnText,
                                fieldChangeValues['priority'] === String(p) && styles.priorityBtnTextSelected,
                              ]}
                            >
                              {p}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}

                    {fc.field_name === 'department_id' && (
                      <TreeSelect
                        label={fc.label || 'Department'}
                        value={fieldChangeDisplayValues['department_id'] || ''}
                        data={departmentsTree}
                        onSelect={(node) => {
                          if (node) {
                            setFieldChangeValues(prev => ({ ...prev, department_id: node.id }));
                            setFieldChangeDisplayValues(prev => ({ ...prev, department_id: node.name }));
                          } else {
                            setFieldChangeValues(prev => { const next = { ...prev }; delete next.department_id; return next; });
                            setFieldChangeDisplayValues(prev => { const next = { ...prev }; delete next.department_id; return next; });
                          }
                        }}
                        leafOnly={false}
                        placeholder="Select department..."
                      />
                    )}

                    {fc.field_name === 'location_id' && (
                      <TreeSelect
                        label={fc.label || 'Location'}
                        value={fieldChangeDisplayValues['location_id'] || ''}
                        data={locationsTree}
                        onSelect={(node) => {
                          if (node) {
                            setFieldChangeValues(prev => ({ ...prev, location_id: node.id }));
                            setFieldChangeDisplayValues(prev => ({ ...prev, location_id: node.name }));
                          } else {
                            setFieldChangeValues(prev => { const next = { ...prev }; delete next.location_id; return next; });
                            setFieldChangeDisplayValues(prev => { const next = { ...prev }; delete next.location_id; return next; });
                          }
                        }}
                        leafOnly={false}
                        placeholder="Select location..."
                      />
                    )}

                    {fc.field_name === 'classification_id' && (
                      <TreeSelect
                        label={fc.label || 'Classification'}
                        value={fieldChangeDisplayValues['classification_id'] || ''}
                        data={classificationsTree}
                        onSelect={(node) => {
                          if (node) {
                            setFieldChangeValues(prev => ({ ...prev, classification_id: node.id }));
                            setFieldChangeDisplayValues(prev => ({ ...prev, classification_id: node.name }));
                          } else {
                            setFieldChangeValues(prev => { const next = { ...prev }; delete next.classification_id; return next; });
                            setFieldChangeDisplayValues(prev => { const next = { ...prev }; delete next.classification_id; return next; });
                          }
                        }}
                        leafOnly={false}
                        placeholder="Select classification..."
                      />
                    )}

                    {fc.field_name === 'title' && (
                      <TextInput
                        style={styles.fieldInput}
                        placeholder="Enter title..."
                        placeholderTextColor="#999"
                        value={fieldChangeValues['title'] || ''}
                        onChangeText={(text) =>
                          setFieldChangeValues(prev => ({ ...prev, title: text }))
                        }
                      />
                    )}

                    {fc.field_name === 'description' && (
                      <TextInput
                        style={[styles.fieldInput, styles.fieldInputMultiline]}
                        placeholder="Enter description..."
                        placeholderTextColor="#999"
                        multiline
                        value={fieldChangeValues['description'] || ''}
                        onChangeText={(text) =>
                          setFieldChangeValues(prev => ({ ...prev, description: text }))
                        }
                      />
                    )}
                  </View>
                ))}
            </>
          )}

          {/* Attachment Field */}
          {(transitionRequiresAttachment || selectedTransition) && (
            <>
              <Text style={styles.label}>
                {transitionRequiresAttachment ? t('incidents.attachmentsRequired') : t('incidents.attachmentsOptional')}
              </Text>

              {/* Attachment Preview */}
              {attachments.length > 0 && (
                <View style={styles.attachmentPreviewContainer}>
                  {attachments.map((attachment, index) => (
                    <View key={index} style={styles.attachmentPreview}>
                      <Image
                        source={{ uri: attachment.uri }}
                        style={styles.attachmentThumbnail}
                        contentFit="cover"
                      />
                      <TouchableOpacity
                        style={styles.removeAttachmentBtn}
                        onPress={() => removeAttachment(index)}
                      >
                        <Ionicons name="close-circle" size={24} color="#E74C3C" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {/* Add Attachment Button */}
              <TouchableOpacity
                style={styles.attachmentBox}
                onPress={() => setShowAttachmentOptions(true)}
              >
                <Ionicons name="cloud-upload-outline" size={32} color="#2EC4B6" />
                <Text style={styles.attachmentText}>
                  {attachments.length > 0 ? 'Add more files' : 'Attach files'}
                </Text>
                <Text style={styles.attachmentSubText}>Max file size: 5 MB</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>

        {/* Upload Progress */}
        {uploadProgress ? (
          <View style={styles.progressContainer}>
            <ActivityIndicator size="small" color="#2EC4B6" />
            <Text style={styles.progressText}>{uploadProgress}</Text>
          </View>
        ) : null}

        {/* Footer Button */}
        <TouchableOpacity
          style={[
            styles.updateButton,
            (loading || !selectedTransition || (needsManualUserSelection && !selectedUser) || (transitionRequiresAttachment && attachments.length === 0)) && styles.disabledButton
          ]}
          onPress={handleUpdate}
          disabled={loading || !selectedTransition || (needsManualUserSelection && !selectedUser) || (transitionRequiresAttachment && attachments.length === 0)}
        >
          {loading ? (
            <View style={styles.buttonLoadingContainer}>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.updateButtonText}>
                {isUploading ? ' Uploading...' : ' Updating...'}
              </Text>
            </View>
          ) : (
            <Text style={styles.updateButtonText}>Update</Text>
          )}
        </TouchableOpacity>
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
            <Text style={styles.bottomSheetTitle}>Add Attachment</Text>

            <TouchableOpacity style={styles.bottomSheetOption} onPress={takePhotoWithCamera}>
              <View style={[styles.optionIconContainer, { backgroundColor: '#E8F5E9' }]}>
                <Ionicons name="camera" size={28} color="#4CAF50" />
              </View>
              <View style={styles.optionTextContainer}>
                <Text style={styles.optionTitle}>Take Photo</Text>
                <Text style={styles.optionSubtitle}>Use your camera to capture an image</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.bottomSheetOption} onPress={pickImageFromGallery}>
              <View style={[styles.optionIconContainer, { backgroundColor: '#E3F2FD' }]}>
                <Ionicons name="images" size={28} color="#2196F3" />
              </View>
              <View style={styles.optionTextContainer}>
                <Text style={styles.optionTitle}>Choose from Gallery</Text>
                <Text style={styles.optionSubtitle}>Select images from your photo library</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowAttachmentOptions(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
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
});

export default UpdateStatusModal;
