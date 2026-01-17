import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import { createIncident } from '@/src/api/incidents';

const Dropdown = ({ label }) => (
  <TouchableOpacity style={styles.dropdown}>
    <Text style={styles.dropdownText}>{label}</Text>
    <FontAwesome name="chevron-down" size={16} color="#666" />
  </TouchableOpacity>
);

const RadioButton = ({ label, selected, onPress }) => (
    <TouchableOpacity style={styles.radioContainer} onPress={onPress}>
        <View style={[styles.radio, selected && styles.radioSelected]}>
            {selected && <View style={styles.radioInner} />}
        </View>
        <Text>{label}</Text>
    </TouchableOpacity>
);


const AddIncidentScreen = () => {
  const router = useRouter();
  const [mapType, setMapType] = useState('google');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!title || !description) {
        Alert.alert('Missing Information', 'Please fill out at least a title and description.');
        return;
    }
    setLoading(true);
    setError('');

    const incidentData = {
        title,
        description,
        workflow_id: 'a2f9a71e-f232-4308-8120-1099f6766ace', // Hardcoded workflow_id
        priority: 3, // Hardcoded priority (Medium)
    };

    const response = await createIncident(incidentData);
    setLoading(false);

    if (response.success) {
        Alert.alert('Success', 'Incident created successfully.', [
            { text: 'OK', onPress: () => router.back() },
        ]);
    } else {
        setError(response.error);
        Alert.alert('Error', `Failed to create incident: ${response.error}`);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Add Incident</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close-circle" size={28} color="#E74C3C" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.formContainer}>
        <Text style={styles.sectionTitle}>Title</Text>
        <TextInput
            style={styles.titleInput}
            placeholder="A brief title for the incident"
            value={title}
            onChangeText={setTitle}
        />

        <Dropdown label="Select classification" />

        <Text style={styles.sectionTitle}>Select Incident location</Text>
        <View style={styles.radioGroup}>
            <RadioButton label="Google Map" selected={mapType === 'google'} onPress={() => setMapType('google')} />
            <RadioButton label="GIS Map" selected={mapType === 'gis'} onPress={() => setMapType('gis')} />
        </View>

        <Dropdown label="Select a location" />
        
        <View style={styles.mapContainer}>
            <View style={styles.mapSearch}>
                <Ionicons name="chevron-back" size={24} color="#666" />
                <Text style={{color: '#999'}}>Find a place...</Text>
            </View>
            <View style={styles.mapPlaceholderView}>
                <FontAwesome name="map-marker" size={40} color="#E74C3C" />
            </View>
            <View style={styles.mapLocationDisplay}>
                <Ionicons name="location-sharp" size={20} color="#E74C3C" />
                <Text style={{marginLeft: 10}}>bachhani nagar, malad (e), mumbai - 400097, india</Text>
            </View>
        </View>

        <Dropdown label="Select criticality" />

        <Text style={styles.sectionTitle}>Description</Text>
        <TextInput
          style={styles.feedbackInput}
          placeholder="Comment limit 500 words"
          multiline
          value={description}
          onChangeText={setDescription}
        />

        <TouchableOpacity style={styles.attachmentBox}>
          <Text style={styles.attachmentText}>Attach files</Text>
          <Text style={styles.attachmentSubText}>Max file size: 5 MB</Text>
        </TouchableOpacity>
        
      </ScrollView>
      <TouchableOpacity style={[styles.submitButton, loading && styles.disabledButton]} onPress={handleSubmit} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>SUBMIT</Text>}
        </TouchableOpacity>
    </View>
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
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#EEE'
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    titleInput: {
        backgroundColor: 'white',
        borderRadius: 10,
        padding: 15,
        fontSize: 16,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: '#EEE'
    },
    formContainer: {
        padding: 20,
    },
    dropdown: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: 'white',
        padding: 15,
        borderRadius: 10,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: '#EEE'
    },
    dropdownText: {
        fontSize: 16,
        color: '#333',
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 10,
        color: '#333'
    },
    radioGroup: {
        flexDirection: 'row',
        marginBottom: 15,
    },
    radioContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 20,
    },
    radio: {
        height: 20,
        width: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: '#2EC4B6',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    radioSelected: {
        borderColor: '#2EC4B6',
    },
    radioInner: {
        height: 10,
        width: 10,
        borderRadius: 5,
        backgroundColor: '#2EC4B6',
    },
    mapContainer: {
        backgroundColor: 'white',
        borderRadius: 10,
        padding: 10,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: '#EEE'
    },
    mapSearch: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8F9FA',
        padding: 10,
        borderRadius: 20,
        marginBottom: 10,
    },
    mapPlaceholderView: {
        height: 150,
        backgroundColor: '#E0E0E0',
        justifyContent: 'center',
        alignItems: 'center',
    },
    mapLocationDisplay: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FCE8E6',
        padding: 10,
        borderRadius: 10,
        marginTop: 10,
    },
    feedbackInput: {
        backgroundColor: 'white',
        borderRadius: 10,
        padding: 15,
        height: 100,
        textAlignVertical: 'top',
        marginBottom: 15,
        borderWidth: 1,
        borderColor: '#EEE'
    },
    attachmentBox: {
        borderWidth: 2,
        borderColor: '#2EC4B6',
        borderStyle: 'dashed',
        borderRadius: 10,
        padding: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 80, // Add margin for submit button
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
    submitButton: {
        backgroundColor: '#2EC4B6',
        padding: 15,
        margin: 20,
        borderRadius: 10,
        alignItems: 'center',
    },
    disabledButton: {
        backgroundColor: '#999',
    },
    submitButtonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
});

export default AddIncidentScreen;