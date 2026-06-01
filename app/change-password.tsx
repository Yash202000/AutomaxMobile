import { changePassword } from '@/src/api/user';
import { useAuth } from '@/src/context/AuthContext';
import i18n from '@/src/i18n';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CustomAlert } from '@/src/components/CustomAlert';

const PasswordInput = ({ label, value, onChangeText }: any) => {
    const [visible, setVisible] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    return (
        <View style={styles.inputWrapper}>
            <Text style={styles.inputLabel}>{label}</Text>
            <View style={[styles.inputContainer, isFocused && styles.inputContainerFocused]}>
                <Ionicons 
                    name="lock-closed-outline" 
                    size={20} 
                    color={isFocused ? '#2EC4B6' : '#666'} 
                    style={styles.inputIcon} 
                />
                <TextInput
                    style={[styles.textInput, { textAlign: i18n.language === 'ar' ? 'right' : 'left' }]}
                    value={value}
                    onChangeText={onChangeText}
                    secureTextEntry={!visible}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    placeholder="••••••••"
                    placeholderTextColor="#CCC"
                    autoCapitalize="none"
                    autoCorrect={false}
                />
                <TouchableOpacity onPress={() => setVisible(v => !v)} style={styles.eyeIcon}>
                    <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={22} color="#999" />
                </TouchableOpacity>
            </View>
        </View>
    );
};

const ValidationItem = ({ label, isValid }: { label: string; isValid: boolean }) => (
    <View style={styles.valItem}>
        <Ionicons 
            name={isValid ? "checkmark-circle" : "ellipse-outline"} 
            size={16} 
            color={isValid ? "#2EC4B6" : "#9CA3AF"} 
            style={styles.valIcon} 
        />
        <Text style={[styles.valText, isValid && styles.valTextValid]}>{label}</Text>
    </View>
);

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
            CustomAlert.alert(t('common.error'), t('password.fillAllFields'));
            return;
        }

        const hasMinLength = newPassword.length >= 8;
        const hasLowercase = /[a-z]/.test(newPassword);
        const hasUppercase = /[A-Z]/.test(newPassword);
        const hasNumberOrSymbol = /\d/.test(newPassword) || /[^A-Za-z0-9]/.test(newPassword);

        if (!hasMinLength || !hasLowercase || !hasUppercase || !hasNumberOrSymbol) {
            CustomAlert.alert(t('common.error'), t('password.requirementsError'));
            return;
        }

        if (newPassword !== confirmPassword) {
            CustomAlert.alert(t('common.error'), t('password.passwordMismatch'));
            return;
        }
        setLoading(true);
        const response = await changePassword({ old_password: currentPassword, new_password: newPassword });
        setLoading(false);

        if (response.success) {
            CustomAlert.alert(t('common.success'), t('password.passwordChanged'), [
                { text: t('common.ok'), onPress: () => logout() }
            ]);
        } else {
            CustomAlert.alert(t('common.error'), response.error || t('password.updateProfileFailed'));
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.form}>
                    <PasswordInput label={t('password.currentPassword')} value={currentPassword} onChangeText={setCurrentPassword} />
                    
                    <PasswordInput label={t('password.newPassword')} value={newPassword} onChangeText={setNewPassword} />
                    
                    {newPassword.length > 0 && (
                        <View style={styles.validationList}>
                            <ValidationItem label={t('password.minLengthError')} isValid={newPassword.length >= 8} />
                            <ValidationItem label={t('password.reqLowercase')} isValid={/[a-z]/.test(newPassword)} />
                            <ValidationItem label={t('password.reqUppercase')} isValid={/[A-Z]/.test(newPassword)} />
                            <ValidationItem label={t('password.reqNumberOrSymbol')} isValid={/\d/.test(newPassword) || /[^A-Za-z0-9]/.test(newPassword)} />
                        </View>
                    )}

                    <PasswordInput label={t('password.confirmPassword')} value={confirmPassword} onChangeText={setConfirmPassword} />

                    <View style={styles.securityInfo}>
                        <Text style={styles.securityTitle}>{t('password.securityTitle')}</Text>
                        <Text style={styles.securityText}>{t('password.minLength')}: <Text style={{ fontWeight: 'bold' }}>8</Text></Text>
                        <Text style={styles.securityText}>{t('password.requirements')}: <Text style={{ color: '#E74C3C', fontWeight: '600' }}>{t('password.digitLowerSymbol')}</Text></Text>
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
        backgroundColor: '#F8F9FA',
    },
    scrollContent: {
        flexGrow: 1,
    },
    form: {
        padding: 20,
    },
    inputWrapper: {
        marginBottom: 16,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#4B5563',
        marginBottom: 8,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'white',
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: '#E5E7EB',
        paddingHorizontal: 16,
        height: 54,
    },
    inputContainerFocused: {
        borderColor: '#2EC4B6',
        backgroundColor: '#FCFDFD',
    },
    inputIcon: {
        marginRight: 10,
    },
    textInput: {
        flex: 1,
        fontSize: 16,
        color: '#1F2937',
        paddingVertical: 10,
    },
    eyeIcon: {
        paddingLeft: 10,
    },
    validationList: {
        marginBottom: 16,
        paddingHorizontal: 4,
        gap: 6,
    },
    valItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    valIcon: {
        marginRight: 8,
    },
    valText: {
        fontSize: 13,
        color: '#9CA3AF',
    },
    valTextValid: {
        color: '#2EC4B6',
        fontWeight: '500',
    },
    securityInfo: {
        marginTop: 24,
        backgroundColor: '#FFFBEB',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#FEF3C7',
    },
    securityTitle: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#92400E',
        marginBottom: 8,
    },
    securityText: {
        fontSize: 13,
        color: '#B45309',
        marginBottom: 4,
    },
    updateButton: {
        backgroundColor: '#2EC4B6',
        paddingVertical: 18,
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 20,
        marginBottom: 20,
        borderRadius: 12,
    },
    disabledButton: {
        backgroundColor: '#9CA3AF',
    },
    updateButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
});

export default ChangePasswordScreen;