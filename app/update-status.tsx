import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Modal, Pressable, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import { executeTransition } from '@/src/api/incidents';

const UpdateStatusModal = () => {
  const router = useRouter();
  const { id, transitions } = useLocalSearchParams();
  const incidentId = Array.isArray(id) ? id[0] : id;
  const availableTransitions = transitions ? JSON.parse(transitions) : [];

  const [selectedTransition, setSelectedTransition] = useState(null);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const transitionRequiresComment = selectedTransition?.requirements?.some(req => req.requirement_type === 'comment' && req.is_mandatory);
  const transitionRequiresAttachment = selectedTransition?.requirements?.some(req => req.requirement_type === 'attachment' && req.is_mandatory);

  const handleUpdate = async () => {
    if (!selectedTransition) {
      Alert.alert('Error', 'Please select a status to update.');
      return;
    }
    if (transitionRequiresComment && !comment.trim()) {
        Alert.alert('Error', 'A comment is required for this transition.');
        return;
    }

    setLoading(true);
    const transitionData = {
        transition_id: selectedTransition.transition.id,
        comment: comment.trim() || undefined, // Send comment only if available
        // attachments: [], // TODO: Handle attachments
    };
    const response = await executeTransition(incidentId, transitionData);
    setLoading(false);

    if (response.success) {
      Alert.alert('Success', 'Incident status updated successfully.', [
        { text: 'OK', onPress: () => {
            router.back(); // Close modal
            // Ideally, trigger a refresh on the incident-details screen
        }},
      ]);
    } else {
      Alert.alert('Error', `Failed to update status: ${response.error}`);
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
          <Text style={styles.headerTitle}>Update the status</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="close-circle" size={28} color="#E74C3C" />
          </TouchableOpacity>
        </View>

        {/* Form */}
        <TouchableOpacity style={styles.dropdown} onPress={() => setShowPicker(true)}>
          <Text style={styles.dropdownText}>
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
                    {availableTransitions.map((trans, index) => (
                        <TouchableOpacity
                            key={trans.transition.id}
                            style={styles.pickerItem}
                            onPress={() => {
                                setSelectedTransition(trans);
                                setShowPicker(false);
                            }}
                        >
                            <Text style={styles.pickerItemText}>{trans.transition.name}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </Pressable>
        </Modal>


        {/* Assign to user (TODO: Implement this) */}
        <TouchableOpacity style={styles.dropdown}>
          <Text style={styles.dropdownText}>Assign to user</Text>
          <FontAwesome name="chevron-down" size={16} color="#666" />
        </TouchableOpacity>

        {transitionRequiresComment && (
            <>
                <Text style={styles.feedbackLabel}>Feedback</Text>
                <TextInput
                    style={styles.feedbackInput}
                    placeholder="Comment limit 500 words"
                    multiline
                    value={comment}
                    onChangeText={setComment}
                />
            </>
        )}

        {transitionRequiresAttachment && (
            <TouchableOpacity style={styles.attachmentBox}>
                <Text style={styles.attachmentText}>Attach files</Text>
                <Text style={styles.attachmentSubText}>Max file size: 5 MB</Text>
            </TouchableOpacity>
        )}

        {/* Footer Button */}
        <TouchableOpacity style={[styles.updateButton, loading && styles.disabledButton]} onPress={handleUpdate} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.updateButtonText}>Update</Text>}
        </TouchableOpacity>
      </View>
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
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  dropdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
  },
  dropdownText: {
    fontSize: 16,
    color: '#333',
  },
  pickerOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  pickerContainer: {
    width: '80%',
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 10,
  },
  pickerItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  pickerItemText: {
    fontSize: 16,
  },
  feedbackLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  feedbackInput: {
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    padding: 15,
    height: 100,
    textAlignVertical: 'top',
    marginBottom: 15,
  },
  attachmentBox: {
    borderWidth: 2,
    borderColor: '#2EC4B6',
    borderStyle: 'dashed',
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  attachmentText: {
    color: '#2EC4B6',
    fontSize: 16,
    fontWeight: 'bold',
  },
  attachmentSubText: {
    color: '#666',
    fontSize: 12,
  },
  updateButton: {
    backgroundColor: '#2EC4B6',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  updateButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  disabledButton: {
    backgroundColor: '#999',
  }
});

export default UpdateStatusModal;
