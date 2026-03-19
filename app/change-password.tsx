import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { changePassword } from '@/src/api/user';

const PasswordInput = ({ label, value, onChangeText }) => {
    const [visible, setVisible] = useState(false);
    return (
        <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>{label}</Text>
            <View style={styles.inputRow}>
                <TextInput
                    style={styles.textInput}
                    value={value}
                    onChangeText={onChangeText}
                    secureTextEntry={!visible}
                />
                <TouchableOpacity onPress={() => setVisible(v => !v)} style={styles.eyeIcon}>
                    <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={22} color="#999" />
                </TouchableOpacity>
            </View>
        </View>
    );
};


const ChangePasswordScreen = () => {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUpdate = async () => {
    if (newPassword !== confirmPassword) {
        Alert.alert('Error', 'New passwords do not match.');
        return;
    }
    if (!currentPassword || !newPassword) {
        Alert.alert('Error', 'Please fill out all fields.');
        return;
    }
    setLoading(true);
    const response = await changePassword({ old_password: currentPassword, new_password: newPassword });
    setLoading(false);

    if (response.success) {
        Alert.alert('Success', 'Password updated successfully.', [
            { text: 'OK', onPress: () => router.back() }
        ]);
    } else {
        Alert.alert('Error', `Failed to update password: ${response.error}`);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
        <ScrollView>
            <View style={styles.form}>
                <PasswordInput label="Current password" value={currentPassword} onChangeText={setCurrentPassword} />
                <PasswordInput label="New password" value={newPassword} onChangeText={setNewPassword} />
                <PasswordInput label="Confirm password" value={confirmPassword} onChangeText={setConfirmPassword} />

                <View style={styles.securityInfo}>
                    <Text style={styles.securityTitle}>Password security</Text>
                    <Text style={styles.securityText}>Password minimum length: <Text style={{fontWeight: 'bold'}}>8</Text></Text>
                    <Text style={styles.securityText}>Password must contains: <Text style={{color: '#E74C3C'}}>Digit, Lowercase, Symbol</Text></Text>
                </View>
            </View>
        </ScrollView>
        <TouchableOpacity style={[styles.updateButton, loading && styles.disabledButton]} onPress={handleUpdate} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.updateButtonText}>UPDATE PASSWORD</Text>}
        </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F5F5',
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
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    textInput: {
        flex: 1,
        fontSize: 16,
        color: '#333',
        fontWeight: 'bold',
    },
    eyeIcon: {
        paddingLeft: 8,
    },
    securityInfo: {
        marginTop: 20,
    },
    securityTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    securityText: {
        fontSize: 14,
        color: '#666',
        marginBottom: 5,
    },
    updateButton: {
        backgroundColor: '#2EC4B6',
        padding: 20,
        alignItems: 'center',
    },
    disabledButton: {
        backgroundColor: '#999',
    },
    updateButtonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
});

export default ChangePasswordScreen;