import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import type { KffCriticality, KffIncidentState } from './kffTypes';
import { KFF_COLORS, KFF_CRITICALITY_COLORS } from './kffTheme';

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

const STATE_BADGE: Record<
  KffIncidentState,
  { color: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  assigned: { color: KFF_COLORS.assigned, icon: 'warning' },
  inProgress: { color: KFF_COLORS.inProgress, icon: 'navigate' },
  completed: { color: KFF_COLORS.completed, icon: 'checkmark-circle' },
  rejected: { color: KFF_COLORS.danger, icon: 'close-circle' },
};

// Solid status badge, e.g. "⚠ Assigned".
export const KffStateBadge = ({ state }: { state: KffIncidentState }) => {
  const { t } = useTranslation();
  const badge = STATE_BADGE[state];
  return (
    <View style={[styles.stateBadge, { backgroundColor: badge.color }]}>
      <Ionicons name={badge.icon} size={13} color={KFF_COLORS.white} />
      <Text style={styles.stateBadgeText}>{t(`kff.state.${state}`)}</Text>
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
  },
  stateBadgeText: {
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
