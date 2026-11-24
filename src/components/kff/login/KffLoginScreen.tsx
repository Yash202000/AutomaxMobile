import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { getKffUnitUsers, kffPasscodeLogin, KffUnitUser } from '@/src/api/kffAuth';
import { useAuth } from '@/src/context/AuthContext';
import { isKffDeviceConfigured, loadKffDeviceConfig } from '@/src/services/kffDeviceConfig';
import { saveKffSession } from '@/src/services/kffSession';
import { KFF_HOME_ROUTE } from '@/src/utils/kff';
import { KFF_ADMIN_PASSCODE, setKffAdminUnlocked } from '@/src/utils/kffLoginSession';

import { KFF_COLORS } from '../kffTheme';
import KffAuthButton from './KffAuthButton';
import KffAuthLayout from './KffAuthLayout';
import { KFF_AUTH_BLUE } from './kffAuthTheme';
import KffCodeInput from './KffCodeInput';
import KffProfileCarousel, { KffProfile } from './KffProfileCarousel';

const PASSCODE_LENGTH = 4;
const ADMIN_ID = '__kff_admin__';

// KFF Dispatcher login (isKffPasscodeLogin() only; app/login.tsx picks it).
// Profiles = the front-end "admin" (opens device setup) + the users of the
// unit set up on this device. Swipe to a profile, enter its 4-digit code.
const KffLoginScreen = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const { login } = useAuth();

  const adminProfile: KffProfile = { id: ADMIN_ID, name: t('kff.login.admin'), isAdmin: true };
  const [users, setUsers] = useState<KffUnitUser[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [deviceId, setDeviceId] = useState('');
  const [configured, setConfigured] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [usersError, setUsersError] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const profiles: KffProfile[] = [adminProfile, ...users];
  const selected = profiles[Math.min(selectedIndex, profiles.length - 1)];

  // Reload the unit's users whenever the screen is shown (e.g. after the admin
  // saves a new Device ID / URL).
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setCode('');
      setError('');
      (async () => {
        const config = await loadKffDeviceConfig();
        if (!active) return;
        const ready = isKffDeviceConfigured(config);
        setConfigured(ready);
        setDeviceId(config.deviceId.trim());
        setUsersError('');
        if (!ready) {
          setUsers([]);
          setSelectedIndex(0);
          return;
        }
        setLoadingUsers(true);
        const result = await getKffUnitUsers(config.deviceId.trim());
        if (!active) return;
        setLoadingUsers(false);
        if (result.success) {
          setUsers(result.data);
          // Start on the first real user; admin stays one swipe away.
          setSelectedIndex(result.data.length > 0 ? 1 : 0);
          if (result.data.length === 0) setUsersError(t('kff.login.noUsers'));
        } else {
          setUsers([]);
          setSelectedIndex(0);
          setUsersError(t('kff.login.unitUsersFailed'));
        }
      })();
      return () => {
        active = false;
      };
    }, [t]),
  );

  const handleSelect = (index: number) => {
    setSelectedIndex(index);
    setCode('');
    setError('');
  };

  const handleLogin = async () => {
    if (code.length !== PASSCODE_LENGTH) {
      setError(t('kff.login.codeRequired'));
      return;
    }
    setError('');

    if (selected.isAdmin) {
      if (!KFF_ADMIN_PASSCODE) {
        setError(t('kff.login.adminCodeMissing'));
        return;
      }
      if (code !== KFF_ADMIN_PASSCODE) {
        setError(t('kff.login.wrongCode'));
        setCode('');
        return;
      }
      setKffAdminUnlocked(true);
      setCode('');
      router.push('/kff-device-setup');
      return;
    }

    setSubmitting(true);
    try {
      const result = await kffPasscodeLogin(selected.id, code);
      if (!result.success) {
        setError(result.error || t('kff.login.wrongCode'));
        setCode('');
        return;
      }
      const { token, refreshToken, unitId, ...user } = result.data;
      // Unit id (UUID) from the unit-user lookup is the one every KFF API
      // needs. Never the Device ID: the backend rejects non-UUID unit ids.
      const unitUser = users.find((u) => u.id === selected.id);
      await saveKffSession({
        ...user,
        unitId: unitUser?.unitId || unitId || '',
        plateNumber: unitUser?.plateNumber,
        uniqueId: unitUser?.uniqueId || deviceId,
      });
      await login(token, refreshToken);
      router.replace(KFF_HOME_ROUTE);
    } catch {
      setError(t('kff.login.loginFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KffAuthLayout scrollToEndOnKeyboard>
      <Text style={styles.title}>{t('kff.login.title')}</Text>
      <Text style={styles.subtitle}>{t('kff.login.selectProfile')}</Text>

      <KffProfileCarousel profiles={profiles} selectedIndex={selectedIndex} onSelect={handleSelect} />

      {loadingUsers && (
        <View style={styles.statusRow}>
          <ActivityIndicator size="small" color={KFF_COLORS.primary} />
          <Text style={styles.statusText}>{t('kff.login.loadingProfiles')}</Text>
        </View>
      )}
      {!loadingUsers && !configured && <Text style={styles.hint}>{t('kff.login.notConfigured')}</Text>}
      {!loadingUsers && configured && !!usersError && <Text style={styles.hint}>{usersError}</Text>}

      <Text style={[styles.subtitle, styles.codeLabel]}>{t('kff.login.enterCode')}</Text>
      <KffCodeInput value={code} onChange={setCode} length={PASSCODE_LENGTH} />

      {!!error && <Text style={styles.error}>{error}</Text>}

      <KffAuthButton
        title={t('kff.login.loginButton')}
        onPress={handleLogin}
        loading={submitting}
        disabled={code.length !== PASSCODE_LENGTH}
        style={styles.button}
      />

      {/* New user → register (secondary action under the main button) */}
      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>{t('kff.login.newUser')}</Text>
        <View style={styles.dividerLine} />
      </View>
      <TouchableOpacity
        style={styles.registerButton}
        activeOpacity={0.8}
        onPress={() => router.push('/kff-register')}
        accessibilityRole="button"
      >
        <Ionicons name="person-add-outline" size={18} color={KFF_AUTH_BLUE} />
        <Text style={styles.registerButtonText}>{t('kff.login.registerLink')}</Text>
      </TouchableOpacity>
    </KffAuthLayout>
  );
};

const styles = StyleSheet.create({
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: KFF_COLORS.primary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: KFF_COLORS.text,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  codeLabel: {
    marginTop: 14,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  statusText: {
    fontSize: 13,
    color: KFF_COLORS.textSecondary,
  },
  hint: {
    fontSize: 13,
    color: KFF_COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 8,
  },
  error: {
    fontSize: 14,
    color: KFF_COLORS.danger,
    textAlign: 'center',
    marginTop: 12,
  },
  button: {
    marginTop: 18,
    marginHorizontal: 8,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 18,
    marginHorizontal: 8,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#D5D9E4',
  },
  dividerText: {
    fontSize: 13,
    color: KFF_COLORS.textMuted,
  },
  registerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 46,
    marginTop: 12,
    marginHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#C9D3FB',
    backgroundColor: '#F4F6FE',
  },
  registerButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: KFF_AUTH_BLUE,
  },
});

export default KffLoginScreen;
