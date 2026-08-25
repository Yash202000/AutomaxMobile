import { sendOtp } from '@/src/api/auth';
import apiClient from '@/src/api/client';
import { updateProfile } from '@/src/api/user';
import { CustomAlert } from '@/src/components/CustomAlert';
import { OtpInput, useOtpResendTimer } from '@/src/components/OtpInput';
import { useAuth } from '@/src/context/AuthContext';
import { navigateAfterLogin } from '@/src/utils/postLoginNavigation';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, I18nManager, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Mandatory post-login gate: shown whenever the logged-in user's
// mobile_verified is false. No skip button by design — see
// src/utils/postLoginNavigation.ts for where this screen is entered from.
const VerifyPhoneScreen = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, logout } = useAuth();
  const isRTL = I18nManager.isRTL;

  const [phone, setPhone] = useState(user?.phone || '');
  const [otpSent, setOtpSent] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [otp, setOtp] = useState<string[]>(new Array(6).fill(''));
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const { timer, reset: resetTimer } = useOtpResendTimer();

  const handleSendOtp = async () => {
    if (!phone || phone.length < 10) {
      CustomAlert.alert(t('common.error'), t('errors.validationError'));
      return;
    }
    setSending(true);
    try {
      const result = await sendOtp(phone, 'sms');
      if (result.success) {
        setSessionId(result.session_id);
        setOtp(new Array(6).fill(''));
        resetTimer();
        setOtpSent(true);
      } else {
        CustomAlert.alert(t('common.error'), result.error || t('auth.otpSentFailed', 'Failed to send OTP'));
      }
    } finally {
      setSending(false);
    }
  };

  const handleVerifyOtp = async (codeOverride?: string) => {
    const enteredOtp = codeOverride ?? otp.join('');
    if (enteredOtp.length < 6 || verifying) return;

    setVerifying(true);
    try {
      const response = await apiClient.post('/otp/verify', {
        phone,
        session_id: sessionId,
        otp: enteredOtp,
      });

      if (response.data && response.data.success) {
        const updateRes = await updateProfile({
          first_name: user?.first_name,
          last_name: user?.last_name,
          phone,
          mobile_verified: true,
        });
        if (updateRes.success) {
          const updatedUser = user ? { ...user, phone, mobile_verified: true } : null;
          await navigateAfterLogin(updatedUser, router, { enforcePhoneVerification: true });
        } else {
          CustomAlert.alert(t('common.error'), updateRes.error || t('profile.updateProfileFailed'));
        }
      } else {
        CustomAlert.alert(t('common.error'), t('auth.invalidOTP'));
      }
    } catch (err: any) {
      CustomAlert.alert(t('common.error'), err.response?.data?.error || t('auth.invalidOTP'));
    } finally {
      setVerifying(false);
    }
  };

  const handleEditNumber = () => {
    setOtpSent(false);
    setOtp(new Array(6).fill(''));
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={[styles.title, isRTL && styles.textRTL]}>{t('auth.phoneVerificationRequired')}</Text>
          <Text style={[styles.subtitle, isRTL && styles.textRTL]}>{t('auth.phoneVerificationRequiredDesc')}</Text>

          <Text style={[styles.label, isRTL && styles.textRTL]}>{t('profile.phone')}</Text>
          <TextInput
            style={[styles.input, otpSent && styles.disabledInput, { textAlign: isRTL ? 'right' : 'left' }]}
            value={phone}
            onChangeText={setPhone}
            editable={!otpSent}
            keyboardType="phone-pad"
            placeholder={t('auth.mobilePlaceholder')}
          />

          {!otpSent ? (
            <TouchableOpacity
              style={[styles.primaryButton, sending && styles.disabledButton]}
              onPress={handleSendOtp}
              disabled={sending}
            >
              {sending ? <ActivityIndicator color="#fff" size="small" /> : (
                <Text style={styles.primaryButtonText}>{t('profile.sendOTP')}</Text>
              )}
            </TouchableOpacity>
          ) : (
            <>
              <Text style={[styles.instructions, isRTL && styles.textRTL]}>{t('auth.otpInstructions')}</Text>

              <OtpInput value={otp} onChange={setOtp} onComplete={(code) => handleVerifyOtp(code)} />

              <TouchableOpacity
                style={[styles.primaryButton, (verifying || otp.join('').length < 6) && styles.disabledButton]}
                onPress={() => handleVerifyOtp()}
                disabled={verifying || otp.join('').length < 6}
              >
                {verifying ? <ActivityIndicator color="#fff" size="small" /> : (
                  <Text style={styles.primaryButtonText}>{t('auth.verifyOTP')}</Text>
                )}
              </TouchableOpacity>

              <View style={styles.resendContainer}>
                <Text style={styles.resendText}>{t('auth.didNotReceiveCode')}</Text>
                <Pressable onPress={handleSendOtp} disabled={timer > 0 || sending}>
                  <Text style={[styles.resendLink, (timer > 0 || sending) && styles.disabledLink]}>
                    {timer > 0 ? t('auth.resendCodeIn', { timer }) : t('auth.resendCode')}
                  </Text>
                </Pressable>
              </View>

              <TouchableOpacity onPress={handleEditNumber} style={styles.editNumberButton}>
                <Text style={styles.editNumberText}>{t('common.change')} {t('profile.phone')}</Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity onPress={logout} style={styles.logoutButton}>
            <Text style={styles.logoutText}>{t('auth.logout')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 20,
    flexGrow: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1A1A2E',
    marginTop: 20,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 28,
    lineHeight: 20,
  },
  label: {
    fontSize: 13,
    color: '#666',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1A1A2E',
    marginBottom: 20,
  },
  disabledInput: {
    backgroundColor: '#F5F5F5',
    color: '#999',
  },
  instructions: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: '#2EC4B6',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  resendText: {
    fontSize: 14,
    color: '#666',
  },
  resendLink: {
    fontSize: 14,
    color: '#2EC4B6',
    fontWeight: 'bold',
    marginLeft: 5,
  },
  disabledLink: {
    color: '#999',
  },
  editNumberButton: {
    alignItems: 'center',
    marginTop: 16,
  },
  editNumberText: {
    fontSize: 13,
    color: '#2EC4B6',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  logoutButton: {
    alignItems: 'center',
    marginTop: 40,
  },
  logoutText: {
    fontSize: 13,
    color: '#999',
  },
  textRTL: {
    textAlign: 'right',
  },
});

export default VerifyPhoneScreen;
