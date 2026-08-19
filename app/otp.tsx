import apiClient from '@/src/api/client';
import { OtpInput, useOtpResendTimer } from '@/src/components/OtpInput';
import { updateProfile } from '@/src/api/user';
import { useAuth } from '@/src/context/AuthContext';
import { routeToDashboard, navigateAfterLogin } from '@/src/utils/postLoginNavigation';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const OtpScreen = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const {
    phoneNumber,
    sessionId: initialSessionId,
    channel: initialChannel,
    isForgotPassword,
    securityCheck,
    pendingLogin,
    markMobileVerified,
    firstName,
    lastName,
  } = useLocalSearchParams<{
    phoneNumber: string, sessionId: string, channel: 'sms' | 'whatsapp' | 'email', isForgotPassword?: string,
    securityCheck?: string, pendingLogin?: string, markMobileVerified?: string, firstName?: string, lastName?: string,
  }>();
  const [sessionId, setSessionId] = useState(initialSessionId);
  const [channel, setChannel] = useState(initialChannel || 'sms');
  const { login, user } = useAuth();
  const [otp, setOtp] = useState<string[]>(new Array(6).fill(''));

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { timer, reset: resetTimer } = useOtpResendTimer();

  const handleVerify = async () => {
    const enteredOtp = otp.join('');
    if (enteredOtp.length < 6) return;

    setLoading(true);
    setError('');

    try {
      if (isForgotPassword === 'true') {
        const response = await apiClient.post('/auth/verify-reset-otp', {
          value: phoneNumber,
          session_id: sessionId,
          otp: enteredOtp,
          channel: channel
        });
        if (response.data.data && response.data.data.resetToken) {
          router.push({
            pathname: '/reset-password',
            params: { resetToken: response.data.data.resetToken, phoneNumber }
          });
        } else {
          setError(t('auth.invalidOTP'));
          alert(t('auth.invalidOTP'));
        }
      } else {
        // Updated OTP verify endpoint and payload
        const response = await apiClient.post('/otp/verify', {
          phone: phoneNumber,
          session_id: sessionId,
          otp: enteredOtp
        });

        if (response.data && response.data.success) {
          if (securityCheck === 'true') {
            // Post-login 2FA step — the user is already authenticated, just
            // clear the security gate and continue to the dashboard.
            routeToDashboard(user, router);
          } else if (pendingLogin === 'true') {
            // /auth/login withheld the token pending this 2FA step (not super
            // admin & totp_enabled on) — this verify call is what actually
            // completes the login.
            const { token, refresh_token } = response.data.data;
            const loggedInUser = await login(token, refresh_token);
            if (markMobileVerified === 'true' && loggedInUser) {
              // The phone wasn't verified yet — successfully verifying this
              // OTP is itself proof of ownership, so mark it verified now
              // instead of also routing through the separate /verify-phone gate.
              await updateProfile({
                first_name: firstName ?? loggedInUser.first_name,
                last_name: lastName ?? loggedInUser.last_name,
                phone: phoneNumber,
                mobile_verified: true,
              });
            }
            routeToDashboard(loggedInUser, router);
          } else {
            // Citizen tab / employee "phone" method — this OTP verify IS the
            // login itself, already proving phone ownership, so don't also
            // run the settings-driven 2FA OTP gate right after it.
            const { token, refresh_token } = response.data.data;
            const loggedInUser = await login(token, refresh_token);
            await navigateAfterLogin(loggedInUser, router, { enforcePhoneVerification: true, skipTotpCheck: true });
          }
        } else {
          setError(t('auth.invalidOTP'));
          alert(t('auth.invalidOTP'));
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.error || t('auth.verificationFailed'));
      alert(err.response?.data?.error || t('auth.verificationFailed'));
      setLoading(false);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setLoading(true);
    setError('');
    try {
      let response;
      if (isForgotPassword === 'true') {
        response = await apiClient.post('/auth/forgot-password', {
          value: phoneNumber,
          channel: channel
        });
      } else {
        response = await apiClient.post('/otp/send', {
          phone: phoneNumber,
          channel: channel
        });
      }

      const sessionID = isForgotPassword === 'true' ? response.data.data?.sessionID : response.data.session_id;

      if (response.data && (response.data.session_id || response.data.data?.sessionID)) {
        setSessionId(sessionID);
        setOtp(new Array(6).fill(''));
        resetTimer();
      } else {
        setError(t('auth.otpSentFailed', 'Failed to resend OTP'));
      }
    } catch (err: any) {
      setError(err.response?.data?.error || t('auth.otpSentFailed', 'Failed to resend OTP'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.instructions}>
        {t('auth.otpInstructions')}
      </Text>

      <OtpInput value={otp} onChange={setOtp} />

      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : null}

      <TouchableOpacity
        style={[styles.verifyButton, (loading || otp.join('').length < 6) && styles.disabledButton]}
        onPress={handleVerify}
        disabled={loading || otp.join('').length < 6}
      >
        {loading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.verifyButtonText}>{t('auth.verifyOTP')}</Text>
        )}
      </TouchableOpacity>

      <View style={styles.resendContainer}>
        <Text style={styles.resendText}>{t('auth.didNotReceiveCode')}</Text>
        <Pressable
          onPress={handleResend}
          disabled={timer > 0 || loading}
        >
          <Text style={[styles.resendLink, (timer > 0 || loading) && styles.disabledLink]}>
            {timer > 0 ? t('auth.resendCodeIn', { timer }) : t('auth.resendCode')}
          </Text>
        </Pressable>
      </View>

      {/* <TouchableOpacity
        style={styles.backToLoginButton}
        onPress={() => router.replace('/login')}
      >
        <Ionicons name="arrow-back" size={20} color="#666" />
        <Text style={styles.backToLoginText}>{t('auth.backToLogin')}</Text>
      </TouchableOpacity> */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  instructions: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  verifyButton: {
    backgroundColor: '#2EC4B6',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  verifyButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
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
  errorText: {
    color: '#E74C3C',
    textAlign: 'center',
    marginBottom: 15,
    fontSize: 14,
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  disabledLink: {
    color: '#999',
  },
  backToLoginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
  },
  backToLoginText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    fontWeight: '500',
  },
});

export default OtpScreen;
