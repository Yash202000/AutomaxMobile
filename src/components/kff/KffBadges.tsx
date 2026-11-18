import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import type { KffCriticality, KffIncidentState } from './kffTypes';
import { KFF_COLORS, KFF_CRITICALITY_COLORS } from './kffTheme';

// Round tile with the tilted ticket glyph used on KFF incident cards.
export const KffTicketIcon = ({ size = 52 }: { size?: number }) => (
  <View style={[styles.ticketTile, { width: size, height: size, borderRadius: size / 2 }]}>
    <Ionicons
      name="ticket"
      size={Math.round(size * 0.48)}
      color={KFF_COLORS.primary}
      style={styles.ticketGlyph}
    />
  </View>
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
  new: { color: KFF_COLORS.primary, icon: 'sparkles' },
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
  ticketTile: {
    backgroundColor: '#F1F3F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ticketGlyph: {
    transform: [{ rotate: '-45deg' }],
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
