import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { KFF_COLORS } from './kffTheme';

// Destination (pin) → Current Location (dot) vertical timeline.
const KffRouteTimeline = ({
  destination,
  currentLocation,
  compact = false,
}: {
  destination: string;
  currentLocation: string;
  compact?: boolean;
}) => {
  const { t } = useTranslation();
  const textStyle = compact ? styles.valueCompact : styles.value;

  return (
    <View>
      <View style={styles.row}>
        <View style={styles.rail}>
          <Ionicons name="location-sharp" size={compact ? 20 : 24} color={KFF_COLORS.text} />
          <View style={styles.line} />
        </View>
        <View style={styles.body}>
          <Text style={styles.label}>{t('kff.detail.destination')}</Text>
          <Text style={textStyle}>{destination || t('common.na')}</Text>
        </View>
      </View>
      <View style={styles.row}>
        <View style={styles.rail}>
          <View style={styles.dotOuter}>
            <View style={styles.dotInner} />
          </View>
        </View>
        <View style={[styles.body, styles.lastBody]}>
          <Text style={styles.label}>{t('kff.detail.currentLocation')}</Text>
          <Text style={textStyle}>{currentLocation || t('common.na')}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
  rail: {
    width: 28,
    alignItems: 'center',
  },
  line: {
    flex: 1,
    width: 2,
    marginVertical: 2,
    backgroundColor: KFF_COLORS.primaryRing,
  },
  dotOuter: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: KFF_COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  dotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: KFF_COLORS.primary,
  },
  body: {
    flex: 1,
    paddingLeft: 8,
    paddingBottom: 16,
  },
  lastBody: {
    paddingBottom: 0,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: KFF_COLORS.primary,
    textAlign: 'left',
    marginBottom: 3,
  },
  value: {
    fontSize: 15,
    lineHeight: 21,
    color: KFF_COLORS.text,
    textAlign: 'left',
  },
  valueCompact: {
    fontSize: 13,
    lineHeight: 19,
    color: KFF_COLORS.textSecondary,
    textAlign: 'left',
  },
});

export default KffRouteTimeline;
