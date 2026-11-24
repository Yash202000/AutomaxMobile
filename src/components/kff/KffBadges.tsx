import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import type { KffCriticality, KffIncidentState } from './kffTypes';
import { KFF_COLORS, KFF_CRITICALITY_COLORS, KFF_STATE_COLORS } from './kffTheme';

// Round ticket icon (assets/images/kff/ticket-icon.svg, grey circle included)
// used on KFF incident cards, the bell list and the incident detail.
export const KffTicketIcon = ({ size = 52 }: { size?: number }) => (
  <Image
    source={require('@/assets/images/kff/ticket-icon.svg')}
    style={{ width: size, height: size }}
    contentFit="contain"
  />
);

// "Criticality | ● High" pill (blue label segment + white value segment).
export const KffCriticalityPill = ({ level }: { level: KffCriticality }) => {
  const { t } = useTranslation();
  const color = KFF_CRITICALITY_COLORS[level];
  return (
    <View style={styles.pill}>
      <Text style={styles.pillLabel}>{t('kff.criticality')}</Text>
      <View style={styles.pillValue}>
        <View style={[styles.pillDot, { backgroundColor: color }]} />
        <Text style={[styles.pillValueText, { color }]}>{t(`kff.criticalityLevel.${level}`)}</Text>
      </View>
    </View>
  );
};

/** Colour of a state (KFF_STATE_COLORS). */
export const kffStateColor = (state: KffIncidentState): string => KFF_STATE_COLORS[state];

// Solid state badge, e.g. "✓ Dispatched": same icon for every state, only the
// colour changes. `label` is the server's state name; falls back to ours.
export const KffStateBadge = ({ state, label }: { state: KffIncidentState; label?: string }) => {
  const { t } = useTranslation();
  return (
    <View style={[styles.stateBadge, { backgroundColor: KFF_STATE_COLORS[state] }]}>
      <Ionicons name="checkmark-circle" size={13} color={KFF_COLORS.white} />
      <Text style={styles.stateBadgeText} numberOfLines={1}>
        {label || t(`kff.state.${state}`)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  stateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    borderRadius: 12,
    paddingVertical: 5,
    paddingHorizontal: 10,
    maxWidth: '60%',
    flexShrink: 1,
  },
  stateBadgeText: {
    flexShrink: 1,
    color: KFF_COLORS.white,
    fontSize: 12,
    fontWeight: '700',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: KFF_COLORS.primary,
    borderRadius: 16,
    padding: 2,
    paddingLeft: 10,
    gap: 8,
  },
  pillLabel: {
    color: KFF_COLORS.white,
    fontSize: 12,
    fontWeight: '600',
  },
  pillValue: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: KFF_COLORS.white,
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 5,
  },
  pillDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  pillValueText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
