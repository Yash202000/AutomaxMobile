import apiClient from '@/src/api/client';
import { getProfile, updateProfile } from '@/src/api/user';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, I18nManager, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface iCustomInputProps {
    label: string;
    value: string;
    onChangeText?: (text: string) => void;
    editable?: boolean;
    actionButton?: { id: string, label: string, onPress: () => void, show: boolean }[];
    isVerified?: boolean;
}

const CustomInput = ({ label, value, onChangeText, editable = true, actionButton, isVerified }: iCustomInputProps) => {
    const isRTL = I18nManager.isRTL;
    return (
        <View style={styles.inputWrapper}>
            <View style={styles.inputContainer}>
                <View style={styles.labelContainer}>
                    <Text style={[styles.inputLabel, isRTL && styles.textRTL]}>{label}</Text>
                    {isVerified && (
                        <View style={styles.verifiedBadge}>
                            <Ionicons name="checkmark-circle" size={16} color="#2EC4B6" />
                            <Text style={styles.verifiedText}>Verified</Text>
                        </View>
                    )}
                </View>
                <TextInput
                    style={[
                        styles.textInput,
                        !editable && styles.disabledInput,
                        isRTL && styles.textRTL
                    ]}
                    value={value}
                    onChangeText={onChangeText}
                    editable={editable}
                />
            </View>
            <View style={styles.actionButtonContainer}>
                {actionButton?.map((button) => (
                    button.show && (
                        <TouchableOpacity key={button.id} onPress={button.onPress} style={styles.actionButton}>
                            <Text style={styles.actionButtonText}>{button.label}</Text>
                        </TouchableOpacity>
                    )
                ))}
            </View>
        </View>
    );
};


const EditProfileScreen = () => {
    const router = useRouter();
    const { t } = useTranslation();
    const [firstName, setFirstName] = useState('');
    const [originalFirstName, setOriginalFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [originalLastName, setOriginalLastName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [originalPhone, setOriginalPhone] = useState('');
    const [roles, setRoles] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [mobileVerified, setMobileVerified] = useState(false);
    const [data, setData] = useState<any>(null);

    // OTP States
    const [showOtpModal, setShowOtpModal] = useState(false);
    const [otp, setOtp] = useState<string[]>(new Array(6).fill(''));
    const [sessionId, setSessionId] = useState('');
    const [verifying, setVerifying] = useState(false);
    const [otpError, setOtpError] = useState('');
    const otpInputs = useRef<(TextInput | null)[]>([]);

    useEffect(() => {
        const fetchProfile = async () => {
            setLoading(true);
            try {
                const response = await getProfile();
                if (response.success) {
                    const { first_name, last_name, email, phone, roles: userRoles, mobile_verified } = response.data;
                    setData(response.data);
                    setFirstName(first_name || '');
                    setOriginalFirstName(first_name || '');
                    setLastName(last_name || '');
                    setOriginalLastName(last_name || '');
                    setEmail(email || '');
                    setPhone(phone || '');
                    setOriginalPhone(phone || '');
                    setMobileVerified(mobile_verified || false);
                    if (userRoles && Array.isArray(userRoles)) {
                        setRoles(userRoles.map(role => role.name).join(', '));
                    }
                } else {
                    Alert.alert(t('common.error'), t('profile.fetchProfileFailed'));
                }
            } catch (error) {
                console.error('Fetch profile error:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        const isPhoneChanged = phone !== originalPhone;
        const profileData = {
            ...data,
            first_name: firstName,
            last_name: lastName,
            phone: phone,
            extension: data.extension || "",
            mobile_verified: isPhoneChanged ? false : mobileVerified
        };
        const response = await updateProfile(profileData);
        setSaving(false);
        if (response.success) {
            setOriginalPhone(phone);
            setOriginalFirstName(firstName);
            setOriginalLastName(lastName);
            if (response.data && response.data.mobile_verified !== undefined) {
                setMobileVerified(response.data.mobile_verified);
            } else if (isPhoneChanged) {
                setMobileVerified(false);
            }
            Alert.alert(t('common.success'), t('profile.profileUpdated'), [
                {
                    text: t('common.ok'), onPress: () => {
                        // Stay on screen if they need to verify
                    }
                }
            ]);
        } else {
            Alert.alert(t('common.error'), response.error || t('profile.updateProfileFailed'));
        }
    };

    const handleSendOTP = async () => {
        if (!phone || phone.length < 10) {
            Alert.alert(t('common.error'), t('errors.validationError'));
            return;
        }

        setSaving(true);
        try {
            const response = await apiClient.post('/otp/send', {
                phone: phone,
                channel: 'sms'
            });

            if (response.data && response.data.session_id) {
                setSessionId(response.data.session_id);
                setShowOtpModal(true);
                setOtp(new Array(6).fill(''));
                setOtpError('');
            } else {
                Alert.alert(t('common.error'), t('auth.otpSentFailed', 'Failed to send OTP'));
            }
        } catch (err: any) {
            Alert.alert(t('common.error'), err.response?.data?.error || t('auth.otpSentFailed', 'Failed to send OTP'));
        } finally {
            setSaving(false);
        }
    };

    const handleVerifyOTP = async () => {
        const enteredOtp = otp.join('');
        if (enteredOtp.length < 6) return;

        setVerifying(true);
        setOtpError('');
        try {
            const response = await apiClient.post('/otp/verify', {
                phone: phone,
                session_id: sessionId,
                otp: enteredOtp
            });

            if (response.data && response.data.success) {
                const updateRes = await updateProfile({
                    first_name: firstName,
                    last_name: lastName,
                    phone: phone,
                    extension: data.extension || "",
                    mobile_verified: true
                });
                if (updateRes.success) {
                    setMobileVerified(true);
                    setOriginalPhone(phone);
                    setShowOtpModal(false);
                    Alert.alert(t('common.success'), t('profile.phoneVerified'));
                } else {
                    setOtpError(updateRes.error || t('profile.updateProfileFailed'));
                }
            } else {
                setOtpError(t('profile.invalidOTP'));
            }
        } catch (err: any) {
            setOtpError(err.response?.data?.error || t('profile.invalidOTP'));
        } finally {
            setVerifying(false);
        }
    };

    const handleOtpChange = (text: string, index: number) => {
        if (isNaN(Number(text))) return;
        const newOtp = [...otp];
        newOtp[index] = text;
        setOtp(newOtp);
        if (text !== '' && index < 5) {
            otpInputs.current[index + 1]?.focus();
        }
    };

    const handleOtpKeyPress = (e: any, index: number) => {
        if (e.nativeEvent.key === 'Backspace' && otp[index] === '' && index > 0) {
            otpInputs.current[index - 1]?.focus();
        }
    };

    if (loading) {
        return <View style={styles.centered}><ActivityIndicator size="large" color="#2EC4B6" /></View>
    }

    const isPhoneChanged = phone !== originalPhone;
    const hasChanges = isPhoneChanged || firstName !== originalFirstName || lastName !== originalLastName;

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
                <ScrollView
                    contentContainerStyle={{ flexGrow: 1 }}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.form}>
                        <CustomInput label={t('profile.firstName')} value={firstName} onChangeText={setFirstName} />
                        <CustomInput label={t('profile.lastName')} value={lastName} onChangeText={setLastName} />
                        <CustomInput label={t('profile.enterYourEmail')} value={email} editable={false} />
                        <CustomInput
                            label={t('profile.mobileNo')}
                            value={phone}
                            onChangeText={(text) => {
                                setPhone(text);
                            }}
                            isVerified={mobileVerified && !isPhoneChanged}
                            actionButton={[{
                                id: 'verify-btn',
                                label: t('profile.verify'),
                                onPress: handleSendOTP,
                                show: !isPhoneChanged && !mobileVerified
                            }]}
                        />
                        <CustomInput label={t('profile.roles')} value={roles} editable={false} />

                        {/* Placeholder to ensure content is not hidden by floating footer if any, 
                            though here footer is part of KAV */}
                        <View style={{ height: 100 }} />
                    </View>
                </ScrollView>

                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[styles.saveButton, (saving || !hasChanges) && styles.disabledButton]}
                        onPress={handleSave}
                        disabled={saving || !hasChanges}
                    >
                        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>{t('profile.save')}</Text>}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>

            {/* OTP Verification Modal */}
            <Modal
                visible={showOtpModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowOtpModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{t('profile.verify')}</Text>
                            <TouchableOpacity onPress={() => setShowOtpModal(false)}>
                                <Ionicons name="close" size={24} color="#666" />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.modalSubTitle}>{t('profile.otpSent')}</Text>

                        <View style={styles.otpContainer}>
                            {otp.map((digit, index) => (
                                <TextInput
                                    key={index}
                                    style={styles.otpInput}
                                    value={digit}
                                    onChangeText={(text) => handleOtpChange(text, index)}
                                    onKeyPress={(e) => handleOtpKeyPress(e, index)}
                                    keyboardType="numeric"
                                    maxLength={1}
                                    ref={(ref) => { otpInputs.current[index] = ref; }}
                                />
                            ))}
                        </View>

                        {otpError ? <Text style={styles.errorText}>{otpError}</Text> : null}

                        <TouchableOpacity
                            style={[styles.verifyButton, (verifying || otp.join('').length < 6) && styles.disabledButton]}
                            onPress={handleVerifyOTP}
                            disabled={verifying || otp.join('').length < 6}
                        >
                            {verifying ? <ActivityIndicator color="#fff" /> : <Text style={styles.verifyButtonText}>{t('profile.verify')}</Text>}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
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
    inputWrapper: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: 'white',
        padding: 15,
        borderRadius: 12,
        marginBottom: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 2,
    },
    inputContainer: {
        flex: 1,
    },
    labelContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 5,
    },
    inputLabel: {
        fontSize: 14,
        color: '#999',
        textAlign: 'left',
    },
    verifiedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F0FFFE',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        gap: 4,
    },
    verifiedText: {
        fontSize: 10,
        color: '#2EC4B6',
        fontWeight: 'bold',
    },
    textInput: {
        fontSize: 16,
        color: '#333',
        fontWeight: 'bold',
        textAlign: 'left',
    },
    textRTL: {
        textAlign: 'right',
        writingDirection: 'rtl',
    },
    disabledInput: {
        color: '#999',
    },
    actionButtonContainer: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginTop: 10,
    },
    actionButtonText: {
        color: '#2EC4B6',
        fontSize: 12,
        fontWeight: 'bold',
    },
    actionButton: {
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderRadius: 5,
        backgroundColor: '#F0FFFE',
    },
    footer: {
        backgroundColor: 'white',
        borderTopWidth: 1,
        borderTopColor: '#EEE',
        padding: 15,
        paddingBottom: Platform.OS === 'ios' ? 0 : 15, // SafeAreaView handles iOS
    },
    saveButton: {
        backgroundColor: '#2EC4B6',
        padding: 15,
        borderRadius: 12,
        alignItems: 'center',
    },
    disabledButton: {
        backgroundColor: '#CCC',
    },
    saveButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 25,
        width: '100%',
        maxWidth: 400,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
    },
    modalSubTitle: {
        fontSize: 14,
        color: '#666',
        marginBottom: 20,
    },
    otpContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 25,
    },
    otpInput: {
        width: 42,
        height: 50,
        borderWidth: 1.5,
        borderColor: '#E5E5E5',
        borderRadius: 8,
        textAlign: 'center',
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
    },
    verifyButton: {
        backgroundColor: '#2EC4B6',
        paddingVertical: 15,
        borderRadius: 12,
        alignItems: 'center',
    },
    verifyButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    errorText: {
        color: '#E74C3C',
        fontSize: 12,
        textAlign: 'center',
        marginBottom: 15,
    },
});

export default EditProfileScreen;
