import { Redirect, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
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

import { CustomAlert } from '@/src/components/CustomAlert';
import KffAppBar from '@/src/components/kff/KffAppBar';
import KffBackground from '@/src/components/kff/KffBackground';
import KffAuthButton from '@/src/components/kff/login/KffAuthButton';
import { KFF_COLORS, KFF_SHADOWS } from '@/src/components/kff/kffTheme';
import {
  KFF_DEFAULT_DEVICE_CONFIG,
  KFF_NETWORKS,
  KffDeviceConfig,
  loadKffDeviceConfig,
  saveKffDeviceConfig,
  toKffApiBaseURL,
} from '@/src/services/kffDeviceConfig';
import { isKffAdminUnlocked, setKffAdminUnlocked } from '@/src/utils/kffLoginSession';

type TextField = Exclude<keyof KffDeviceConfig, 'network'>;

const FIELDS: { key: TextField; numeric?: boolean; url?: boolean }[] = [
  { key: 'deviceId' },
  { key: 'syncIntervalMs', numeric: true },
  { key: 'baudRate', numeric: true },
  { key: 'dispatchRadioId' },
  { key: 'webServiceUrl', url: true },
];

// KFF admin device setup (front-end only, opened from the "admin" profile on
// the KFF login screen). Device ID picks the unit whose users appear on the
// login screen; Web Service URL becomes the API server.
const KffDeviceSetupScreen = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [unlocked] = useState(isKffAdminUnlocked);
  const [config, setConfig] = useState<KffDeviceConfig>(KFF_DEFAULT_DEVICE_CONFIG);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  // Keep the field being edited above the keyboard: remember each card's y in
  // the scroll content and scroll to the focused one once the keyboard is up.
  const scrollRef = useRef<ScrollView>(null);
  const fieldY = useRef<Record<string, number>>({});
  const focusedField = useRef<string | null>(null);
  const scrollToField = (key: string | null) => {
    if (!key || fieldY.current[key] === undefined) return;
    scrollRef.current?.scrollTo({ y: Math.max(0, fieldY.current[key] - 12), animated: true });
  };
  useEffect(() => {
    const event = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const sub = Keyboard.addListener(event, () =>
      setTimeout(() => scrollToField(focusedField.current), 120),
    );
    return () => sub.remove();
  }, []);

  useEffect(() => {
    loadKffDeviceConfig().then((stored) => {
      setConfig(stored);
      setLoaded(true);
    });
  }, []);

  if (!unlocked) return <Redirect href="/login" />;

  const leave = () => {
    setKffAdminUnlocked(false);
    if (router.canGoBack()) router.back();
    else router.replace('/login');
  };

  const update = (key: keyof KffDeviceConfig, value: string) =>
    setConfig((current) => ({ ...current, [key]: value }));

  const handleSave = async () => {
    if (!config.deviceId.trim()) {
      CustomAlert.alert(t('common.error'), t('kff.deviceSetup.deviceIdRequired'));
      return;
    }
    if (!toKffApiBaseURL(config.webServiceUrl)) {
      CustomAlert.alert(t('common.error'), t('kff.deviceSetup.invalidUrl'));
      return;
    }
    const badNumber = FIELDS.find(
      (field) => field.numeric && config[field.key].trim() !== '' && !/^\d+$/.test(config[field.key].trim()),
    );
    if (badNumber) {
      CustomAlert.alert(
        t('common.error'),
        t('kff.deviceSetup.invalidNumber', { field: t(`kff.deviceSetup.${badNumber.key}`) }),
      );
      return;
    }

    setSaving(true);
    try {
      const trimmed = Object.fromEntries(
        Object.entries(config).map(([key, value]) => [key, String(value).trim()]),
      ) as unknown as KffDeviceConfig;
      await saveKffDeviceConfig(trimmed);
      CustomAlert.alert(t('kff.deviceSetup.savedTitle'), t('kff.deviceSetup.saved'), [
        { text: t('common.ok'), onPress: leave },
      ]);
    } catch {
      CustomAlert.alert(t('common.error'), t('kff.deviceSetup.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <KffBackground>
      <KffAppBar title={t('kff.deviceSetup.title')} onBack={leave} showActions={false} centerTitle />

      {!loaded ? (
        <ActivityIndicator style={styles.loader} color={KFF_COLORS.primary} />
      ) : (
        // Edge-to-edge Android no longer resizes for the keyboard: pad on both.
        <KeyboardAvoidingView style={styles.flex} behavior="padding">
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
            keyboardShouldPersistTaps="handled"
          >
            {FIELDS.map((field) => (
              <View
                key={field.key}
                style={styles.card}
                onLayout={(e) => {
                  fieldY.current[field.key] = e.nativeEvent.layout.y;
                }}
              >
                <Text style={styles.label}>{t(`kff.deviceSetup.${field.key}`)}</Text>
                <TextInput
                  style={styles.input}
                  value={config[field.key]}
                  onChangeText={(value) => update(field.key, value)}
                  placeholder={t(`kff.deviceSetup.placeholders.${field.key}`)}
                  placeholderTextColor={KFF_COLORS.textMuted}
                  keyboardType={field.numeric ? 'number-pad' : field.url ? 'url' : 'default'}
                  autoCapitalize="none"
                  autoCorrect={false}
                  multiline={field.url}
                  onFocus={() => {
                    focusedField.current = field.key;
                    // Keyboard already open (moving between fields): scroll now.
                    if (Keyboard.isVisible()) setTimeout(() => scrollToField(field.key), 50);
                  }}
                  onBlur={() => {
                    if (focusedField.current === field.key) focusedField.current = null;
                  }}
                />
              </View>
            ))}

            <View style={styles.card}>
              <Text style={styles.label}>{t('kff.deviceSetup.network')}</Text>
              <View style={styles.chips}>
                {KFF_NETWORKS.map((network) => {
                  const active = config.network === network;
                  return (
                    <TouchableOpacity
                      key={network}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => update('network', network)}
                      accessibilityState={{ selected: active }}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{network}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <KffAuthButton title={t('kff.deviceSetup.save')} onPress={handleSave} loading={saving} pill />
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </KffBackground>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  loader: {
    marginTop: 40,
  },
  content: {
    padding: 16,
    gap: 14,
  },
  card: {
    backgroundColor: KFF_COLORS.white,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 16,
    ...KFF_SHADOWS.soft,
  },
  label: {
    fontSize: 17,
    fontWeight: '600',
    color: KFF_COLORS.text,
    textAlign: 'left',
  },
  input: {
    fontSize: 16,
    color: KFF_COLORS.textSecondary,
    paddingVertical: 6,
    marginTop: 4,
    textAlign: 'left',
  },
  chips: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: KFF_COLORS.divider,
  },
  chipActive: {
    backgroundColor: KFF_COLORS.primary,
    borderColor: KFF_COLORS.primary,
  },
  chipText: {
    fontSize: 15,
    color: KFF_COLORS.textSecondary,
  },
  chipTextActive: {
    color: KFF_COLORS.white,
    fontWeight: '600',
  },
});

export default KffDeviceSetupScreen;
