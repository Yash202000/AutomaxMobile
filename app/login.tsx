import apiClient from '@/src/api/client';
import { useAuth } from '@/src/context/AuthContext';
import { getCurrentLanguage, setLanguage } from '@/src/i18n';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as Updates from 'expo-updates';
import { default as React, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { height: screenHeight } = Dimensions.get('window');
const isSmallScreen = screenHeight < 700;

const LoginScreen = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const { login } = useAuth();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loginType, setLoginType] = useState<'employee' | 'citizen'>('employee');
  const [loginMethod, setLoginMethod] = useState<'email' | 'phone'>('email');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentLang, setCurrentLang] = useState(getCurrentLanguage());
  const [otpChannel, setOtpChannel] = useState<'sms' | 'whatsapp'>('sms');
  const version = Constants.expoConfig?.version

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const emailFocusAnim = useRef(new Animated.Value(0)).current;
  const passwordFocusAnim = useRef(new Animated.Value(0)).current;
  const phoneFocusAnim = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    // Entrance animations
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
      Animated.spring(logoScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleLanguageChange = async (langCode: string) => {
    if (langCode === currentLang) return;

    try {
      await setLanguage(langCode);
      setCurrentLang(langCode);

      Alert.alert(
        langCode === 'ar' ? 'نجاح' : 'Success',
        langCode === 'ar'
          ? 'تم تغيير اللغة. سيتم إعادة تشغيل التطبيق لتطبيق التغييرات.'
          : 'Language changed. The app will restart to apply changes.',
        [
          {
            text: langCode === 'ar' ? 'موافق' : 'OK',
            onPress: async () => {
              try {
                await Updates.reloadAsync();
              } catch {
                Alert.alert(
                  langCode === 'ar' ? 'إعادة التشغيل مطلوبة' : 'Restart Required',
                  langCode === 'ar'
                    ? 'يرجى إغلاق التطبيق وإعادة فتحه لتطبيق تغييرات اللغة.'
                    : 'Please close and reopen the app to apply language changes.'
                );
              }
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert(t('common.error'), t('errors.unknownError'));
    }
  };

  const handleLogin = async () => {
    Keyboard.dismiss();
    setError('');

    const isEmail = loginMethod === 'email';
    if (isEmail) {
      // Email Login Logic
      const trimmedEmail = email.trim();
      if (!trimmedEmail || !password) {
        setError(t('errors.validationError'));
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        setError(t('auth.invalidCredentials'));
        return;
      }

      setLoading(true);

      try {
        const response = await apiClient.post('/auth/login', { email: trimmedEmail, password });

        if (response.data && response.data.success) {
          const { token, refresh_token } = response.data.data;
          await login(token, refresh_token);
          router.replace('/(tabs)/explore');
        } else {
          setError(t('auth.loginError'));
        }
      } catch (err: any) {
        let errorMessage = t('auth.loginError');
        if (err.response?.data) {
          const remoteError = err.response.data.error || err.response.data.message;
          if (remoteError) {
            errorMessage = typeof remoteError === 'string' ? remoteError : JSON.stringify(remoteError);
          }
        }
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    } else {
      // Phone OTP Login Logic
      if (!phoneNumber) {
        setError(t('errors.validationError'));
        return;
      }

      setLoading(true);
      try {
        const authResponse = await apiClient.post('/auth/login', { phone: phoneNumber });
        if (!authResponse.data || !authResponse.data.success) {
          setError(authResponse.data?.message || t('auth.loginError'));
          return;
        }
        // Updated OTP send endpoint and payload based on user curl
        const response = await apiClient.post('/otp/send', {
          phone: phoneNumber,
          channel: otpChannel
        });

        if (response.data && response.data.session_id) {
          router.push({
            pathname: '/otp',
            params: { phoneNumber, sessionId: response.data.session_id, channel: otpChannel }
          });
        } else {
          setError(t('auth.otpSentFailed', 'Failed to send OTP'));
        }
      } catch (err: any) {
        setError(err.response?.data?.error || t('auth.otpSentFailed', 'Failed to send OTP'));
      } finally {
        setLoading(false);
      }
    }
  };

  const handlePhoneFocus = () => {
    Animated.spring(phoneFocusAnim, {
      toValue: 1,
      useNativeDriver: false,
    }).start();
  };

  const handlePhoneBlur = () => {
    Animated.spring(phoneFocusAnim, {
      toValue: 0,
      useNativeDriver: false,
    }).start();
  };

  const handleEmailFocus = () => {
    Animated.spring(emailFocusAnim, {
      toValue: 1,
      useNativeDriver: false,
    }).start();
  };

  const handleEmailBlur = () => {
    Animated.spring(emailFocusAnim, {
      toValue: 0,
      useNativeDriver: false,
    }).start();
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

  const handleButtonPressIn = () => {
    Animated.spring(buttonScale, {
      toValue: 0.96,
      useNativeDriver: true,
    }).start();
  };

  const handleButtonPressOut = () => {
    Animated.spring(buttonScale, {
      toValue: 1,
      friction: 3,
      useNativeDriver: true,
    }).start();
  };

  const emailBorderColor = emailFocusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#E5E5E5', '#2EC4B6'],
  });

  const passwordBorderColor = passwordFocusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#E5E5E5', '#2EC4B6'],
  });

  const phoneBorderColor = phoneFocusAnim.interpolate({
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
        {/* Decorative circles */}
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
                paddingTop: isSmallScreen ? 30 : 60,
              },
            ]}
          >
            {/* Header Logo */}
            <Animated.View
              style={[
                styles.logoContainer,
                {
                  transform: [{ scale: logoScale }],
                },
              ]}
            >
              <View style={styles.logoShadow}>
                <Image
                  source={require('@/assets/images/start-logo.png')}
                  style={styles.headerLogo}
                />
              </View>
            </Animated.View>

            {/* Welcome Text */}
            <View style={styles.welcomeContainer}>
              <Text style={styles.welcomeText}>{t('auth.welcomeBack')}</Text>
              <Text style={styles.subtitleText}>{t('auth.loginSubtitle')}</Text>
            </View>

            {/* Login Type Tabs */}
            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[
                  styles.tabButton,
                  loginType === 'employee' && styles.activeTab,
                ]}
                onPress={() => { setLoginType('employee'); setError('') }}
              >
                <Text
                  style={[
                    styles.tabText,
                    loginType === 'employee' && styles.activeTabText,
                  ]}
                >
                  {t('auth.employeeLogin')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.tabButton,
                  loginType === 'citizen' && styles.activeTab,
                ]}
                onPress={() => { setLoginType('citizen'); setError('') }}
              >
                <Text
                  style={[
                    styles.tabText,
                    loginType === 'citizen' && styles.activeTabText,
                  ]}
                >
                  {t('auth.citizenLogin')}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.methodToggleContainer}>
              <TouchableOpacity
                onPress={() => {
                  setLoginMethod(loginMethod === 'email' ? 'phone' : 'email');
                  setError('')
                }}
                style={styles.methodToggleButton}
              >
                <Ionicons
                  name={
                    loginMethod === 'email'
                      ? 'call-outline'
                      : 'mail-outline'
                  }
                  size={18}
                  color="#2EC4B6"
                />
                <Text style={styles.methodToggleText}>
                  {loginMethod === 'email'
                    ? t('auth.loginMobile')
                    : t('auth.loginEmail')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Input Fields Container */}
            <View style={styles.inputsContainer}>
              {loginMethod === 'email' ? (
                <>
                  {/* Email Input */}
                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputLabel}>{t('auth.email')}</Text>
                    <Animated.View
                      style={[
                        styles.inputContainer,
                        {
                          borderColor: emailBorderColor,
                          borderWidth: 2,
                        },
                      ]}
                    >
                      <Ionicons
                        name="mail-outline"
                        size={20}
                        color="#666"
                        style={styles.inputIcon}
                      />
                      <TextInput
                        style={styles.textInput}
                        placeholder={t('auth.emailPlaceholder', 'user@example.com')}
                        placeholderTextColor="#999"
                        value={email}
                        onChangeText={setEmail}
                        onFocus={handleEmailFocus}
                        onBlur={handleEmailBlur}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </Animated.View>
                  </View>

                  {/* Password Input */}
                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputLabel}>{t('auth.password')}</Text>
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
                        style={styles.textInput}
                        placeholder={t('auth.passwordPlaceholder', '••••••••')}
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
                </>
              ) : (
                /* Phone Number Input */
                <>
                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputLabel}>{t('auth.phone')}</Text>
                    <Animated.View
                      style={[
                        styles.inputContainer,
                        {
                          borderColor: phoneBorderColor,
                          borderWidth: 2,
                        },
                      ]}
                    >
                      <Ionicons
                        name="call-outline"
                        size={20}
                        color="#666"
                        style={styles.inputIcon}
                      />
                      <TextInput
                        style={styles.textInput}
                        placeholder={t('auth.phonePlaceholder', '+1234567890')}
                        placeholderTextColor="#999"
                        value={phoneNumber}
                        onChangeText={setPhoneNumber}
                        onFocus={handlePhoneFocus}
                        onBlur={handlePhoneBlur}
                        keyboardType="phone-pad"
                      />
                    </Animated.View>
                  </View>

                  {/* OTP Channel Selection */}
                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputLabel}>{t('auth.otpChannel')}</Text>
                    <View style={styles.channelContainer}>
                      <TouchableOpacity
                        style={[
                          styles.channelButton,
                          otpChannel === 'sms' && styles.activeChannel,
                        ]}
                        onPress={() => setOtpChannel('sms')}
                      >
                        <Ionicons
                          name="chatbubble-ellipses-outline"
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
                          otpChannel === 'whatsapp' && styles.activeChannel,
                        ]}
                        onPress={() => setOtpChannel('whatsapp')}
                      >
                        <Ionicons
                          name="logo-whatsapp"
                          size={20}
                          color={otpChannel === 'whatsapp' ? '#2EC4B6' : '#666'}
                        />
                        <Text
                          style={[
                            styles.channelText,
                            otpChannel === 'whatsapp' && styles.activeChannelText,
                          ]}
                        >
                          {t('auth.whatsapp')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              )}

              {/* Forgot Password - Only for email login */}
              {(loginMethod === 'email') && (
                <TouchableOpacity
                  onPress={() => router.push('/forgot-password')}
                  style={styles.forgotPasswordContainer}
                >
                  <Text style={styles.forgotPasswordText}>
                    {t('auth.forgotPassword')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Error Message */}
            {error ? (
              <Animated.View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={18} color="#E74C3C" />
                <Text style={styles.errorText}>{error}</Text>
              </Animated.View>
            ) : null}

            {/* Login Button */}
            <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
              <TouchableOpacity
                activeOpacity={1}
                onPressIn={handleButtonPressIn}
                onPressOut={handleButtonPressOut}
                onPress={handleLogin}
                disabled={loading || (loginMethod === 'email' ? (!email || !password) : !phoneNumber)}
                style={styles.loginButton}
              >
                <LinearGradient
                  colors={
                    loading || (loginMethod === 'email' ? (!email || !password) : !phoneNumber)
                      ? ['#CCCCCC', '#AAAAAA']
                      : ['#2EC4B6', '#20B2A3']
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.loginButtonGradient}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.loginButtonText}>
                      {
                        loginMethod === 'phone' ? t('auth.sendOTP') : t('auth.login')
                      }
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          </Animated.View>
        </ScrollView>

        {/* Footer — outside ScrollView so it's always visible */}
        <View style={[styles.footer, { paddingBottom: Math.max(20, insets.bottom + 10) }]}>
          <View style={styles.languageContainer}>
            <TouchableOpacity
              style={[
                styles.languageButton,
                currentLang === 'en' && styles.activeLanguage,
              ]}
              onPress={() => handleLanguageChange('en')}
              activeOpacity={0.7}
            >
              <Text
                style={
                  currentLang === 'en'
                    ? styles.activeLanguageText
                    : styles.languageText
                }
              >
                EN
              </Text>
            </TouchableOpacity>
            <View style={styles.languageDivider} />
            <TouchableOpacity
              style={[
                styles.languageButton,
                currentLang === 'ar' && styles.activeLanguage,
              ]}
              onPress={() => handleLanguageChange('ar')}
              activeOpacity={0.7}
            >
              <Text
                style={
                  currentLang === 'ar'
                    ? styles.activeLanguageText
                    : styles.languageText
                }
              >
                AR
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.versionText}>V.{version}</Text>
        </View>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
    // backgroundColor: '#F8FFFE',
  },
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
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
  content: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  logoContainer: {
    alignSelf: 'flex-start',
    marginBottom: isSmallScreen ? 16 : 32,
  },
  logoShadow: {
    shadowColor: '#2EC4B6',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  headerLogo: {
    width: 64,
    height: 64,
    resizeMode: 'contain',
  },
  welcomeContainer: {
    marginBottom: isSmallScreen ? 20 : 40,
  },
  welcomeText: {
    fontSize: isSmallScreen ? 26 : 32,
    fontWeight: '800',
    marginBottom: 6,
    color: '#1A1A1A',
    letterSpacing: -0.5,
  },
  subtitleText: {
    fontSize: isSmallScreen ? 14 : 16,
    color: '#666',
    fontWeight: '500',
  },
  inputsContainer: {
    marginBottom: isSmallScreen ? 12 : 24,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  activeTabText: {
    color: '#2EC4B6',
  },
  methodToggleContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  methodToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  methodToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2EC4B6',
    marginLeft: 8,
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
    shadowOffset: {
      width: 0,
      height: 2,
    },
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
  forgotPasswordContainer: {
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  forgotPasswordText: {
    fontWeight: '600',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: '#E5E5E5',
    gap: 8,
  },
  activeChannel: {
    borderColor: '#2EC4B6',
    backgroundColor: '#F0FFFE',
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
    backgroundColor: '#FFF5F5',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#E74C3C',
  },
  errorText: {
    color: '#E74C3C',
    marginLeft: 8,
    fontSize: 14,
    flex: 1,
  },
  loginButton: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#2EC4B6',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  loginButtonGradient: {
    paddingVertical: isSmallScreen ? 14 : 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 10,
  },
  languageContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#E5E5E5',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  languageButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  activeLanguage: {
    backgroundColor: '#2EC4B6',
  },
  languageDivider: {
    width: 1,
    backgroundColor: '#E5E5E5',
  },
  activeLanguageText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  languageText: {
    color: '#666',
    fontWeight: '600',
    fontSize: 14,
  },
  versionText: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
  },
  tabContainer: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 10,
    marginBottom: 20,
  }
});

export default LoginScreen;
