import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { KFF_COLORS } from '../kffTheme';
import { KFF_AUTH_BLUE } from './kffAuthTheme';

// "STEP 1 OF 2" + progress bars for the two-step KFF registration.
const KffStepIndicator = ({ step, total = 2 }: { step: number; total?: number }) => {
  const { t, i18n } = useTranslation();
  return (
    <View style={styles.container}>
      <Text style={[styles.text, i18n.language !== 'ar' && styles.spaced]}>{t('kff.register.step', { step, total })}</Text>
      <View style={styles.bars}>
        {Array.from({ length: total }).map((_, index) => (
          <View key={index} style={[styles.bar, index < step && styles.barDone]} />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 8,
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
    color: KFF_COLORS.textMuted,
  },
  // Latin only: letter spacing breaks Arabic letter joining.
  spaced: {
    letterSpacing: 1,
  },
  bars: {
    flexDirection: 'row',
    gap: 6,
  },
  bar: {
    width: 28,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E3E6EE',
  },
  barDone: {
    backgroundColor: KFF_AUTH_BLUE,
  },
});

export default KffStepIndicator;
