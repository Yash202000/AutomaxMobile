import { Redirect, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text } from 'react-native';

import { registerKffPasscode } from '@/src/api/kffAuth';
import { CustomAlert } from '@/src/components/CustomAlert';
import KffAuthButton from '@/src/components/kff/login/KffAuthButton';
import KffAuthLayout from '@/src/components/kff/login/KffAuthLayout';
import KffCodeInput from '@/src/components/kff/login/KffCodeInput';
import KffStepIndicator from '@/src/components/kff/login/KffStepIndicator';
import { KFF_COLORS } from '@/src/components/kff/kffTheme';
import { getKffRegistrationToken, setKffRegistrationToken } from '@/src/utils/kffLoginSession';

const PASSCODE_LENGTH = 4;

// KFF passcode login — Register step 2: create the 4-digit quick-access code.
// Only reachable after step 1 (app/kff-register.tsx) verified the credentials.
const KffCreatePasscodeScreen = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const [token] = useState(getKffRegistrationToken);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!token) return <Redirect href="/kff-register" />;

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/kff-register');
  };

  const handleRegister = async () => {
    if (code.length !== PASSCODE_LENGTH) {
      setError(t('kff.login.codeRequired'));
      return;
    }
    setError('');
    setLoading(true);
    try {
      const result = await registerKffPasscode(token, code);
      if (!result.success) {
        setError(result.error || t('kff.createPasscode.failed'));
        return;
      }
      setKffRegistrationToken(null);
      CustomAlert.alert(t('kff.createPasscode.successTitle'), t('kff.createPasscode.success'), [
        { text: t('common.ok'), onPress: () => router.dismissTo('/login') },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KffAuthLayout onBack={handleBack} scrollToEndOnKeyboard>
      <KffStepIndicator step={2} />
      <Text style={styles.title}>{t('kff.createPasscode.title')}</Text>

      <Image
        source={require('@/assets/images/kff/passcode-illustration.png')}
        style={styles.illustration}
        resizeMode="contain"
      />

      <Text style={styles.codeLabel}>{t('kff.login.enterCode')}</Text>
      <KffCodeInput value={code} onChange={setCode} length={PASSCODE_LENGTH} autoFocus />

      {!!error && <Text style={styles.error}>{error}</Text>}

      <KffAuthButton
        title={t('kff.createPasscode.submit')}
        onPress={handleRegister}
        loading={loading}
        disabled={code.length !== PASSCODE_LENGTH}
        pill
        style={styles.button}
      />
    </KffAuthLayout>
  );
};

const styles = StyleSheet.create({
  title: {
    fontSize: 19,
    lineHeight: 28,
    color: KFF_COLORS.text,
    textAlign: 'left',
    paddingHorizontal: 6,
    marginTop: 16,
  },
  illustration: {
    width: 180,
    height: 180,
    alignSelf: 'center',
    marginVertical: 12,
  },
  codeLabel: {
    fontSize: 19,
    color: KFF_COLORS.text,
    textAlign: 'center',
    marginBottom: 14,
  },
  error: {
    fontSize: 14,
    color: KFF_COLORS.danger,
    textAlign: 'center',
    marginTop: 14,
  },
  button: {
    marginTop: 26,
  },
});

export default KffCreatePasscodeScreen;
