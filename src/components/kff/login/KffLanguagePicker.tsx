import { Ionicons } from '@expo/vector-icons';
import * as Updates from 'expo-updates';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CustomAlert } from '@/src/components/CustomAlert';
import { getCurrentLanguage, setLanguage, supportedLanguages } from '@/src/i18n';

import { KFF_AUTH_BLUE } from './kffAuthTheme';

// Language switch on the KFF auth screens: a frosted segmented toggle that sits
// on the blue background. Switching needs an app reload (RTL), same as the
// Automax login screen, so it asks first.
const KffLanguagePicker = () => {
  const { t } = useTranslation();
  const current = getCurrentLanguage();

  const choose = (code: string) => {
    if (code === current) return;
    CustomAlert.alert(t('kff.login.languageChangedTitle'), t('kff.login.languageChanged'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.ok'),
        onPress: async () => {
          try {
            await setLanguage(code);
            await Updates.reloadAsync();
          } catch {
            CustomAlert.alert(t('kff.login.languageChangedTitle'), t('kff.login.restartRequired'));
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container} accessibilityRole="radiogroup" accessibilityLabel={t('kff.login.language')}>
      <View style={styles.globe}>
        <Ionicons name="globe-outline" size={13} color="#FFFFFF" />
      </View>
      {supportedLanguages.map((lang) => {
        const active = lang.code === current;
        return (
          <Pressable
            key={lang.code}
            onPress={() => choose(lang.code)}
            style={({ pressed }) => [styles.segment, active && styles.segmentActive, pressed && !active && styles.pressed]}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{lang.nativeName}</Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 3,
    gap: 1,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  globe: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segment: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
  },
  segmentActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#0B1A6B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  pressed: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
  },
  segmentTextActive: {
    color: KFF_AUTH_BLUE,
  },
});

export default KffLanguagePicker;
