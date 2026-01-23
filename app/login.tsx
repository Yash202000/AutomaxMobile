import { View, Text, StyleSheet, Image, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Updates from 'expo-updates';
import { setLanguage, getCurrentLanguage } from '@/src/i18n';
import { useAuth } from '@/src/context/AuthContext';
import apiClient from '@/src/api/client';

const LoginScreen = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentLang, setCurrentLang] = useState(getCurrentLanguage());

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
            }
          }
        ]
      );
    } catch (error) {
      Alert.alert(t('common.error'), t('errors.unknownError'));
    }
  };

  const handleLogin = async () => {
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

  return (
    <View style={styles.container}>
      {/* Header Logo */}
      <Image source={require('@/assets/images/start-logo.png')} style={styles.headerLogo} />

      {/* Welcome Text */}
      <Text style={styles.welcomeText}>{t('auth.welcomeBack', 'Welcome Back!')}</Text>
      <Text style={styles.subtitleText}>{t('auth.loginSubtitle', 'Continue to Employee Log in')}</Text>

      {/* Input Fields */}
      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>{t('auth.email')}</Text>
        <TextInput
          style={styles.textInput}
          placeholder="user@example.com"
          placeholderTextColor="#999"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>{t('auth.password')}</Text>
        <TextInput
          style={styles.textInput}
          placeholder="*******"
          placeholderTextColor="#999"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {/* Login Button */}
      <TouchableOpacity style={[styles.loginButton, loading && styles.disabledButton]} onPress={handleLogin} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginButtonText}>{t('auth.loginButton')}</Text>}
      </TouchableOpacity>

      {/* Forgot Password */}
      <TouchableOpacity onPress={() => router.push('/forgot-password')}>
        <Text style={styles.forgotPasswordText}>{t('auth.forgotPassword')}</Text>
      </TouchableOpacity>

      {/* Footer */}
      <View style={styles.footer}>
        <Image
          source={require('@/assets/images/login-footer-logo.png')}
          style={styles.footerLogo}
          resizeMode="contain"
        />
        <View style={styles.languageContainer}>
          <TouchableOpacity
            style={[styles.languageButton, currentLang === 'en' && styles.activeLanguage]}
            onPress={() => handleLanguageChange('en')}
          >
            <Text style={currentLang === 'en' ? styles.activeLanguageText : styles.languageText}>EN</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.languageButton, currentLang === 'ar' && styles.activeLanguage]}
            onPress={() => handleLanguageChange('ar')}
          >
            <Text style={currentLang === 'ar' ? styles.activeLanguageText : styles.languageText}>AR</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.versionText}>V.3.0</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 50,
  },
  headerLogo: {
    width: 60,
    height: 60,
    resizeMode: 'contain',
    alignSelf: 'flex-start',
    marginBottom: 30,
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#333',
  },
  subtitleText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    color: '#333',
    marginBottom: 5,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
  },
  loginButton: {
    backgroundColor: '#2EC4B6',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 15,
  },
  disabledButton: {
    backgroundColor: '#999',
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  forgotPasswordText: {
    color: '#2EC4B6',
    fontSize: 14,
    textAlign: 'center',
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
    marginBottom: 10,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerLogo: {
    width: 100,
    height: 30,
    flex: 1,
    opacity: 0,
  },
  languageContainer: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    overflow: 'hidden',
  },
  languageButton: {
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  activeLanguage: {
    backgroundColor: '#2EC4B6',
  },
  activeLanguageText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  languageText: {
    color: '#666',
  },
  versionText: {
    fontSize: 12,
    color: '#666',
  },
});

export default LoginScreen;
