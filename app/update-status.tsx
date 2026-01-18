import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Modal, Pressable, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { executeTransition, getMatchingUsers, uploadMultipleAttachments } from '@/src/api/incidents';

const UpdateStatusModal = () => {
  const router = useRouter();
  const { id, transitions, incident: incidentParam } = useLocalSearchParams();
  const incidentId = Array.isArray(id) ? id[0] : id;
  const availableTransitions = transitions ? JSON.parse(transitions as string) : [];
  const incident = incidentParam ? JSON.parse(incidentParam as string) : null;

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

  const transitionRequiresComment = selectedTransition?.requirements?.some(req => req.requirement_type === 'comment' && req.is_mandatory);
  const transitionRequiresAttachment = selectedTransition?.requirements?.some(req => req.requirement_type === 'attachment' && req.is_mandatory);

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
        console.log('Failed to fetch matching users:', response.error);
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
      Alert.alert('Permission Required', 'Camera permission is needed to take photos.');
      return false;
    }
    return true;
  };

  // Request media library permissions
  const requestMediaLibraryPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Media library permission is needed to select photos.');
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

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      base64: false,
    });

    if (!result.canceled && result.assets && result.assets[0]) {
      const asset = result.assets[0];
      const newAttachment = {
        uri: asset.uri,
        name: asset.fileName || `photo_${Date.now()}.jpg`,
        type: asset.mimeType || 'image/jpeg',
        size: asset.fileSize,
      };
      setAttachments(prev => [...prev, newAttachment]);
    }
  };

  // Remove attachment
  const removeAttachment = (index) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdate = async () => {
    if (!selectedTransition) {
      Alert.alert('Error', 'Please select a status to update.');
      return;
    }
    if (transitionRequiresComment && !comment.trim()) {
      Alert.alert('Error', 'A comment is required for this transition.');
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
    };
    const response = await executeTransition(incidentId, transitionData);
    setLoading(false);
    setUploadProgress('');

    if (response.success) {
      Alert.alert('Success', 'Incident status updated successfully.', [
        { text: 'OK', onPress: () => {
          router.back();
        }},
      ]);
    } else {
      Alert.alert('Error', `Failed to update status: ${response.error}`);
    }
  };

  const handleTransitionSelect = (trans) => {
    setSelectedTransition(trans);
    setSelectedUser(null);
    setMatchingUsers([]);
    setShowPicker(false);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.overlay}
    >
      <View style={styles.modalContainer}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Update the status</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="close-circle" size={28} color="#E74C3C" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.formContainer} showsVerticalScrollIndicator={false}>
          {/* Status/Transition Picker */}
          <Text style={styles.label}>Select Status</Text>
          <TouchableOpacity style={styles.dropdown} onPress={() => setShowPicker(true)}>
            <Text style={[styles.dropdownText, !selectedTransition && styles.placeholder]}>
              {selectedTransition ? selectedTransition.transition.name : "Select the status"}
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
                <Text style={styles.pickerTitle}>Select Status</Text>
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
              <Text style={styles.label}>Assign to User</Text>
              {loadingUsers ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#2EC4B6" />
                  <Text style={styles.loadingText}>Loading matching users...</Text>
                </View>
              ) : matchingUsers.length > 0 ? (
                <>
                  <TouchableOpacity style={styles.dropdown} onPress={() => setShowUserPicker(true)}>
                    <Text style={[styles.dropdownText, !selectedUser && styles.placeholder]}>
                      {selectedUser ? `${selectedUser.first_name} ${selectedUser.last_name}` : "Select a user"}
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
          {(transitionRequiresComment || selectedTransition) && (
            <>
              <Text style={styles.label}>
                {transitionRequiresComment ? 'Feedback (Required)' : 'Feedback (Optional)'}
              </Text>
              <TextInput
                style={styles.feedbackInput}
                placeholder="Add a comment..."
                placeholderTextColor="#999"
                multiline
                value={comment}
                onChangeText={setComment}
              />
            </>
          )}

          {/* Attachment Field */}
          {(transitionRequiresAttachment || selectedTransition) && (
            <>
              <Text style={styles.label}>
                {transitionRequiresAttachment ? 'Attachments (Required)' : 'Attachments (Optional)'}
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
  feedbackInput: {
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    padding: 15,
    minHeight: 100,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    fontSize: 16,
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
