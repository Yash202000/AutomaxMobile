import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, TextInput, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { getProfile, updateProfile } from '@/src/api/user';

const CustomInput = ({ label, value, onChangeText, editable = true }) => (
    <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>{label}</Text>
        <TextInput
            style={[styles.textInput, !editable && styles.disabledInput]}
            value={value}
            onChangeText={onChangeText}
            editable={editable}
        />
    </View>
);


const EditProfileScreen = () => {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [roles, setRoles] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
        setLoading(true);
        const response = await getProfile();
        if (response.success) {
            const { first_name, last_name, email, phone, roles: userRoles } = response.data;
            setFirstName(first_name || '');
            setLastName(last_name || '');
            setEmail(email || '');
            setPhone(phone || '');
            if (userRoles && Array.isArray(userRoles)) {
                setRoles(userRoles.map(role => role.name).join(', '));
            }
        } else {
            Alert.alert('Error', 'Failed to fetch profile data.');
        }
        setLoading(false);
    };
    fetchProfile();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const profileData = { first_name: firstName, last_name: lastName, phone };
    const response = await updateProfile(profileData);
    setSaving(false);
    if (response.success) {
        Alert.alert('Success', 'Profile updated successfully.', [
            { text: 'OK', onPress: () => router.back() }
        ]);
    } else {
        Alert.alert('Error', `Failed to update profile: ${response.error}`);
    }
  };

  if (loading) {
      return <View style={styles.centered}><ActivityIndicator size="large" /></View>
  }

  return (
    <SafeAreaView style={styles.container}>
        <ScrollView>
            <View style={styles.form}>
                <CustomInput label="First Name" value={firstName} onChangeText={setFirstName} />
                <CustomInput label="Last Name" value={lastName} onChangeText={setLastName} />
                <CustomInput label="Enter your email" value={email} editable={false} />
                <CustomInput label="Mobile No." value={phone} onChangeText={setPhone} />
                <CustomInput label="Roles" value={roles} editable={false} />
            </View>
        </ScrollView>
        <TouchableOpacity style={[styles.saveButton, saving && styles.disabledButton]} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>SAVE</Text>}
        </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F5F5',
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    form: {
        padding: 20,
    },
    inputContainer: {
        backgroundColor: 'white',
        padding: 15,
        borderRadius: 10,
        marginBottom: 15,
    },
    inputLabel: {
        fontSize: 14,
        color: '#999',
        marginBottom: 5,
    },
    textInput: {
        fontSize: 16,
        color: '#333',
        fontWeight: 'bold',
    },
    disabledInput: {
        color: '#999',
    },
    saveButton: {
        backgroundColor: '#2EC4B6',
        padding: 20,
        alignItems: 'center',
    },
    disabledButton: {
        backgroundColor: '#999',
    },
    saveButtonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
});

export default EditProfileScreen;
