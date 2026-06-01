import apiClient from '@/src/api/client';
import i18n from '@/src/i18n';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { height: screenHeight } = Dimensions.get('window');
const isSmallScreen = screenHeight < 700;

const ForgotPasswordScreen = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [identifier, setIdentifier] = useState('');
  const [otpChannel, setOtpChannel] = useState<'sms' | 'email'>('sms');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const inputFocusAnim = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleSendOTP = async () => {
    Keyboard.dismiss();
    setError('');

    if (!identifier) {
      setError(t('errors.validationError'));
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.post('/auth/forgot-password', {
        value: identifier,
        channel: otpChannel,
      });
      if (response.data.data && response.data.data.sessionID) {
        router.push({
          pathname: '/otp',
          params: {
            phoneNumber: identifier, // Still using this param name for compatibility with otp.tsx logic
            sessionId: response.data.data.sessionID,
            channel: otpChannel,
            isForgotPassword: 'true',
          },
        });
      } else {
        setError(t('forgotPassword.otpFailed'));
      }
    } catch (err: any) {
      setError(err.response?.data?.error || t('forgotPassword.otpFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleInputFocus = () => {
    Animated.spring(inputFocusAnim, {
      toValue: 1,
      useNativeDriver: false,
    }).start();
  };

  const handleInputBlur = () => {
    Animated.spring(inputFocusAnim, {
      toValue: 0,
      useNativeDriver: false,
    }).start();
  };

  const inputBorderColor = inputFocusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#E5E5E5', '#2EC4B6'],
  });

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.keyboardView}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <LinearGradient
        colors={['#F8FFFE', '#FFFFFF']}
        style={styles.container}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      >
        <View style={styles.decorativeCircle1} />
        <View style={styles.decorativeCircle2} />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={[
              styles.content,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
                paddingTop: isSmallScreen ? 10 : 20,
              },
            ]}
          >
            {/* Back Button */}
            {/* <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={24} color="#333" />
            </TouchableOpacity> */}

            <View style={styles.headerContainer}>
              <Text style={styles.titleText}>{t('forgotPassword.title')}</Text>
              <Text style={styles.subtitleText}>{t('forgotPassword.subtitle')}</Text>
            </View>

            <View style={styles.inputsContainer}>
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>
                  {otpChannel === 'sms' ? t('auth.phone') : t('auth.email')}
                </Text>
                <Animated.View
                  style={[
                    styles.inputContainer,
                    {
                      borderColor: inputBorderColor,
                      borderWidth: 2,
                    },
                  ]}
                >
                  <Ionicons
                    name={otpChannel === 'sms' ? 'call-outline' : 'mail-outline'}
                    size={20}
                    color="#666"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={[styles.textInput, { textAlign: i18n.language === 'ar' ? 'right' : 'left' }]}
                    placeholder={
                      otpChannel === 'sms'
                        ? t('forgotPassword.phonePlaceholder')
                        : t('forgotPassword.emailPlaceholder')
                    }
                    placeholderTextColor="#999"
                    value={identifier}
                    onChangeText={setIdentifier}
                    onFocus={handleInputFocus}
                    onBlur={handleInputBlur}
                    keyboardType={otpChannel === 'sms' ? 'phone-pad' : 'email-address'}
                    autoCapitalize="none"
                  />
                </Animated.View>
              </View>

              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>{t('auth.otpChannel')}</Text>
                <View style={styles.channelContainer}>
                  <TouchableOpacity
                    style={[
                      styles.channelButton,
                      otpChannel === 'sms' && styles.activeChannel,
                    ]}
                    onPress={() => {
                      setOtpChannel('sms');
                      setIdentifier('');
                    }}
                  >
                    <Ionicons
                      name="call-outline"
                      size={20}
                      color={otpChannel === 'sms' ? '#2EC4B6' : '#666'}
                    />
                    <Text
                      style={[
                        styles.channelText,
                        otpChannel === 'sms' && styles.activeChannelText,
                      ]}
                    >
                      {t('auth.sms')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.channelButton,
                      otpChannel === 'email' && styles.activeChannel,
                    ]}
                    onPress={() => {
                      setOtpChannel('email');
                      setIdentifier('');
                    }}
                  >
                    <Ionicons
                      name="mail-outline"
                      size={20}
                      color={otpChannel === 'email' ? '#2EC4B6' : '#666'}
                    />
                    <Text
                      style={[
                        styles.channelText,
                        otpChannel === 'email' && styles.activeChannelText,
                      ]}
                    >
                      {t('auth.emailOtp')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {error ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={18} color="#E74C3C" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={handleSendOTP}
                disabled={loading || !identifier}
                style={styles.submitButton}
              >
                <LinearGradient
                  colors={
                    loading || !identifier
                      ? ['#CCCCCC', '#AAAAAA']
                      : ['#2EC4B6', '#20B2A3']
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.buttonGradient}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.submitButtonText}>
                      {t('forgotPassword.sendOTP')}
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          </Animated.View>
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  decorativeCircle1: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(46, 196, 182, 0.06)',
  },
  decorativeCircle2: {
    position: 'absolute',
    bottom: -100,
    left: -100,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(46, 196, 182, 0.04)',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerContainer: {
    marginBottom: 40,
  },
  titleText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitleText: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
  },
  inputsContainer: {
    marginBottom: 24,
  },
  inputWrapper: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  inputIcon: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    color: '#333',
  },
  channelContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  channelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    gap: 8,
  },
  activeChannel: {
    backgroundColor: '#F0FBFA',
    borderColor: '#2EC4B6',
  },
  channelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  activeChannelText: {
    color: '#2EC4B6',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  errorText: {
    color: '#E74C3C',
    fontSize: 14,
    marginLeft: 8,
    fontWeight: '500',
  },
  submitButton: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#2EC4B6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },
});

export default ForgotPasswordScreen;
