import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Keyboard, StyleSheet, Text, TextInput, View } from 'react-native';

import { verifyKffCredentials } from '@/src/api/kffAuth';
import KffAuthButton from '@/src/components/kff/login/KffAuthButton';
import KffAuthInput from '@/src/components/kff/login/KffAuthInput';
import KffAuthLayout from '@/src/components/kff/login/KffAuthLayout';
import { KFF_AUTH_BLUE, KFF_AUTH_REGISTER_RED } from '@/src/components/kff/login/kffAuthTheme';
import KffStepIndicator from '@/src/components/kff/login/KffStepIndicator';
import { KFF_COLORS } from '@/src/components/kff/kffTheme';
import { setKffRegistrationToken } from '@/src/utils/kffLoginSession';

// KFF passcode login — Register step 1: check the user's normal Automax
// username + password. Only the button submits (the keyboard's "done" just
// closes the keyboard); on success the user continues to create a passcode.
const KffRegisterScreen = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const passwordRef = useRef<TextInput>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const canSubmit = username.trim().length > 0 && password.length > 0;

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/login');
  };

  const handleProceed = async () => {
    if (!canSubmit) {
      setError(t('kff.register.fieldsRequired'));
      return;
    }
    Keyboard.dismiss();
    setError('');
    setLoading(true);
    try {
      const result = await verifyKffCredentials(username.trim(), password);
      if (!result.success) {
        setError(result.error || t('kff.register.failed'));
        return;
      }
      setKffRegistrationToken(result.data.token);
      setPassword('');
      router.push('/kff-create-passcode');
    } finally {
      setLoading(false);
    }
  };

  const clearError = () => error && setError('');

  return (
    <KffAuthLayout onBack={handleBack}>
      <KffStepIndicator step={1} />

      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Ionicons name="person-add" size={26} color={KFF_AUTH_BLUE} />
        </View>
        <Text style={styles.title}>{t('kff.register.title')}</Text>
        <Text style={styles.subtitle}>{t('kff.register.subtitle')}</Text>
      </View>

      <View style={styles.form}>
        <KffAuthInput
          label={t('kff.register.userId')}
          icon="person-outline"
          value={username}
          onChangeText={(value) => {
            setUsername(value);
            clearError();
          }}
          placeholder={t('kff.register.userIdPlaceholder')}
          textContentType="username"
          autoComplete="username"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
        <KffAuthInput
          ref={passwordRef}
          label={t('kff.register.password')}
          icon="lock-closed-outline"
          secure
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            clearError();
          }}
          placeholder={t('kff.register.passwordPlaceholder')}
          textContentType="password"
          autoComplete="password"
          returnKeyType="done"
          onSubmitEditing={() => Keyboard.dismiss()}
        />
      </View>

      {!!error && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle" size={18} color={KFF_COLORS.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <KffAuthButton
        title={t('kff.register.proceed')}
        onPress={handleProceed}
        loading={loading}
        disabled={!canSubmit}
        style={styles.button}
      />

      <Text style={styles.footer}>
        {t('kff.register.haveCode')}{' '}
        <Text style={styles.footerLink} onPress={handleBack}>
          {t('kff.register.backToLogin')}
        </Text>
      </Text>
    </KffAuthLayout>
  );
};

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 22,
  },
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#EEF1FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: KFF_AUTH_BLUE,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: KFF_COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 8,
  },
  form: {
    gap: 18,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FDECEA',
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: KFF_COLORS.danger,
    textAlign: 'left',
  },
  button: {
    marginTop: 28,
  },
  footer: {
    fontSize: 15,
    color: KFF_COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 20,
  },
  footerLink: {
    fontWeight: '700',
    color: KFF_AUTH_REGISTER_RED,
  },
});

export default KffRegisterScreen;
