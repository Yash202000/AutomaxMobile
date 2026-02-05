import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Keyboard,
} from 'react-native';
import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import * as Updates from 'expo-updates';
import { LinearGradient } from 'expo-linear-gradient';
import { setLanguage, getCurrentLanguage } from '@/src/i18n';
import { useAuth } from '@/src/context/AuthContext';
import apiClient from '@/src/api/client';

const LoginScreen = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentLang, setCurrentLang] = useState(getCurrentLanguage());

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const emailFocusAnim = useRef(new Animated.Value(0)).current;
  const passwordFocusAnim = useRef(new Animated.Value(0)).current;
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
    setLoading(true);
    setError('');

    try {
      const response = await apiClient.post('/auth/login', { email, password });

      if (response.data && response.data.success) {
        const { token, refresh_token } = response.data.data;
        await login(token, refresh_token);
        router.push('/otp');
      } else {
        const errorMsg = 'Invalid response from server';
        setError(errorMsg);
        Alert.alert(t('auth.loginError'), errorMsg);
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.message;
      setError(errorMsg);
      Alert.alert(t('auth.loginError'), errorMsg);
    } finally {
      setLoading(false);
    }
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

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.keyboardView}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
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

          <Animated.View
            style={[
              styles.content,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
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

            {/* Input Fields Container */}
            <View style={styles.inputsContainer}>
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
                    placeholder="user@example.com"
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
                    placeholder="••••••••"
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

              {/* Forgot Password */}
              <TouchableOpacity
                onPress={() => router.push('/forgot-password')}
                style={styles.forgotPasswordContainer}
              >
                <Text style={styles.forgotPasswordText}>
                  {t('auth.forgotPassword')}
                </Text>
              </TouchableOpacity>
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
                disabled={loading || !email || !password}
                style={styles.loginButton}
              >
                <LinearGradient
                  colors={
                    loading || !email || !password
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
                      {t('auth.loginButton')}
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          </Animated.View>

          {/* Footer */}
          <View style={styles.footer}>
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
            <Text style={styles.versionText}>V.3.0</Text>
          </View>
        </LinearGradient>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    minHeight: '100%',
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
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 100,
  },
  logoContainer: {
    alignSelf: 'flex-start',
    marginBottom: 32,
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
    marginBottom: 40,
  },
  welcomeText: {
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 8,
    color: '#1A1A1A',
    letterSpacing: -0.5,
  },
  subtitleText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
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
    color: '#2EC4B6',
    fontSize: 14,
    fontWeight: '600',
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
    paddingVertical: 18,
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
    position: 'absolute',
    bottom: 30,
    left: 24,
    right: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
});

export default LoginScreen;
