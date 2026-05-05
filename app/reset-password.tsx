import { CustomAlert } from '@/src/components/CustomAlert';
import apiClient from '@/src/api/client';
import i18n from '@/src/i18n';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
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
  View,
} from 'react-native';

const { height: screenHeight } = Dimensions.get('window');
const isSmallScreen = screenHeight < 700;

const ResetPasswordScreen = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const { resetToken, phoneNumber } = useLocalSearchParams<{ resetToken: string, phoneNumber: string }>();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const passwordFocusAnim = useRef(new Animated.Value(0)).current;
  const confirmPasswordFocusAnim = useRef(new Animated.Value(0)).current;
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

  const handleResetPassword = async () => {
    Keyboard.dismiss();
    setError('');
    console.log(password, confirmPassword)
    if (!password || !confirmPassword) {
      setError(t('resetPassword.required'));
      return;
    }

    if (password.length < 8) {
      setError(t('resetPassword.tooShort'));
      return;
    }

    if (password !== confirmPassword) {
      setError(t('resetPassword.mismatch'));
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.post('/auth/reset-password', {
        resetToken: resetToken,
        newPassword: password,
      });
      if (response.data && response.data.success) {
        CustomAlert.alert(
          t('common.success'),
          t('resetPassword.success'),
          [{ text: t('common.ok'), onPress: () => router.replace('/login') }]
        );
      } else {
        setError(t('errors.unknownError'));
      }
    } catch (err: any) {
      setError(err.response?.data?.error || t('errors.unknownError'));
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordFocus = () => {
    Animated.spring(passwordFocusAnim, {
      toValue: 1,
      useNativeDriver: false,
    }).start();
  };

  const handlePasswordBlur = () => {
    Animated.spring(passwordFocusAnim, {
      toValue: 0,
      useNativeDriver: false,
    }).start();
  };

  const handleConfirmPasswordFocus = () => {
    Animated.spring(confirmPasswordFocusAnim, {
      toValue: 1,
      useNativeDriver: false,
    }).start();
  };

  const handleConfirmPasswordBlur = () => {
    Animated.spring(confirmPasswordFocusAnim, {
      toValue: 0,
      useNativeDriver: false,
    }).start();
  };

  const passwordBorderColor = passwordFocusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#E5E5E5', '#2EC4B6'],
  });

  const confirmPasswordBorderColor = confirmPasswordFocusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#E5E5E5', '#2EC4B6'],
  });

  return (
    <KeyboardAvoidingView
      behavior="padding"
      style={styles.keyboardView}
      keyboardVerticalOffset={Platform.OS === 'android' ? -500 : 0}
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
            <View style={styles.headerContainer}>
              <Text style={styles.titleText}>{t('resetPassword.title')}</Text>
              <Text style={styles.subtitleText}>{t('resetPassword.subtitle')}</Text>
            </View>

            <View style={styles.inputsContainer}>
              {/* New Password Input */}
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>{t('resetPassword.newPassword')}</Text>
                <Animated.View
                  style={[
                    styles.inputContainer,
                    {
                      borderColor: passwordBorderColor,
                      borderWidth: 2,
                    },
                  ]}
                >
                  <Ionicons
                    name="lock-closed-outline"
                    size={20}
                    color="#666"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={[styles.textInput, { textAlign: i18n.language === 'ar' ? 'right' : 'left' }]}
                    placeholder={t('resetPassword.placeholder')}
                    placeholderTextColor="#999"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                    onFocus={handlePasswordFocus}
                    onBlur={handlePasswordBlur}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowPassword(!showPassword)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color="#666"
                    />
                  </TouchableOpacity>
                </Animated.View>
              </View>

              {/* Confirm Password Input */}
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>{t('resetPassword.confirmPassword')}</Text>
                <Animated.View
                  style={[
                    styles.inputContainer,
                    {
                      borderColor: confirmPasswordBorderColor,
                      borderWidth: 2,
                    },
                  ]}
                >
                  <Ionicons
                    name="lock-closed-outline"
                    size={20}
                    color="#666"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={[styles.textInput, { textAlign: i18n.language === 'ar' ? 'right' : 'left' }]}
                    placeholder={t('resetPassword.placeholder')}
                    placeholderTextColor="#999"
                    secureTextEntry={!showConfirmPassword}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    onFocus={handleConfirmPasswordFocus}
                    onBlur={handleConfirmPasswordBlur}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color="#666"
                    />
                  </TouchableOpacity>
                </Animated.View>
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
                onPress={handleResetPassword}
                disabled={loading || !password || !confirmPassword}
                style={styles.submitButton}
              >
                <LinearGradient
                  colors={
                    loading || !password || !confirmPassword
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
                      {t('resetPassword.submit')}
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
  eyeButton: {
    padding: 8,
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

export default ResetPasswordScreen;
