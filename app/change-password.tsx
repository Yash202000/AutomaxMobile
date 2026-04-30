import { changePassword } from '@/src/api/user';
import { useAuth } from '@/src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const PasswordInput = ({ label, value, onChangeText }: any) => {
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
    const { t } = useTranslation();
    const router = useRouter();
    const { logout } = useAuth();
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleUpdate = async () => {
        if (!currentPassword || !newPassword || !confirmPassword) {
            Alert.alert(t('common.error'), t('password.fillAllFields'));
            return;
        }
        if (newPassword.length < 8) {
            Alert.alert(t('common.error'), t('password.minLengthError'));
            return;
        }
        if (newPassword !== confirmPassword) {
            Alert.alert(t('common.error'), t('password.passwordMismatch'));
            return;
        }
        setLoading(true);
        const response = await changePassword({ old_password: currentPassword, new_password: newPassword });
        setLoading(false);

        if (response.success) {
            Alert.alert(t('common.success'), t('password.passwordChanged'), [
                { text: t('common.ok'), onPress: () => logout() }
            ]);
        } else {
            Alert.alert(t('common.error'), response.error || t('password.updateProfileFailed'));
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView>
                <View style={styles.form}>
                    <PasswordInput label={t('password.currentPassword')} value={currentPassword} onChangeText={setCurrentPassword} />
                    <PasswordInput label={t('password.newPassword')} value={newPassword} onChangeText={setNewPassword} />
                    <PasswordInput label={t('password.confirmPassword')} value={confirmPassword} onChangeText={setConfirmPassword} />

                    <View style={styles.securityInfo}>
                        <Text style={styles.securityTitle}>{t('password.securityTitle')}</Text>
                        <Text style={styles.securityText}>{t('password.minLength')}: <Text style={{ fontWeight: 'bold' }}>8</Text></Text>
                        <Text style={styles.securityText}>{t('password.requirements')}: <Text style={{ color: '#E74C3C' }}>{t('password.digitLowerSymbol')}</Text></Text>
                    </View>
                </View>
            </ScrollView>
            <TouchableOpacity style={[styles.updateButton, loading && styles.disabledButton]} onPress={handleUpdate} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.updateButtonText}>{t('password.updateButton')}</Text>}
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