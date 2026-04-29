import apiClient from '@/src/api/client';
import { useAuth } from '@/src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const OtpScreen = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const { phoneNumber, sessionId: initialSessionId, channel: initialChannel, isForgotPassword } = useLocalSearchParams<{ phoneNumber: string, sessionId: string, channel: 'sms' | 'whatsapp' | 'email', isForgotPassword?: string }>();
  const [sessionId, setSessionId] = useState(initialSessionId);
  const [channel, setChannel] = useState(initialChannel || 'sms');
  const { login } = useAuth();
  const [otp, setOtp] = useState<string[]>(new Array(6).fill(''));
  const inputs = useRef<(TextInput | null)[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [timer, setTimer] = useState(60);

  React.useEffect(() => {
    let interval: any;
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

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
          const { token, refresh_token } = response.data.data;
          await login(token, refresh_token);
          router.replace('/(tabs)/explore');
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
        setTimer(60);
        inputs.current[0]?.focus();
      } else {
        setError(t('auth.otpSentFailed', 'Failed to resend OTP'));
      }
    } catch (err: any) {
      setError(err.response?.data?.error || t('auth.otpSentFailed', 'Failed to resend OTP'));
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (text: string, index: number) => {
    if (isNaN(Number(text))) {
      return; // Only allow numbers
    }
    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);

    // Move to next input
    if (text !== '' && index < 5) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    // Move to previous input on backspace
    if (e.nativeEvent.key === 'Backspace' && otp[index] === '' && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.instructions}>
        {t('auth.otpInstructions')}
      </Text>

      <View style={styles.otpContainer}>
        {otp.map((digit, index) => (
          <TextInput
            key={index}
            style={styles.otpInput}
            value={digit}
            onChangeText={(text) => handleChange(text, index)}
            onKeyPress={(e) => handleKeyPress(e, index)}
            keyboardType="numeric"
            maxLength={1}
            ref={(ref) => { inputs.current[index] = ref; }}
          />
        ))}
      </View>

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

      <TouchableOpacity
        style={styles.backToLoginButton}
        onPress={() => router.replace('/login')}
      >
        <Ionicons name="arrow-back" size={20} color="#666" />
        <Text style={styles.backToLoginText}>{t('auth.backToLogin')}</Text>
      </TouchableOpacity>
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
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  otpInput: {
    width: 45,
    height: 55,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 20,
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
